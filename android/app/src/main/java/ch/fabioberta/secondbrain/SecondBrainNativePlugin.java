// Eigenes Plugin wie unter iOS (ios-extensions/App/SecondBrainNativePlugin.swift):
// Teilen-Inbox, Kurzbefehl-Aktion, Bild in der Galerie sichern.
package ch.fabioberta.secondbrain;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "SecondBrainNative")
public class SecondBrainNativePlugin extends Plugin {
    static final String PREFS = "secondbrain";
    static final String PENDING_ACTION = "pendingAction";
    private static SecondBrainNativePlugin instance;

    static File inbox(Context ctx) {
        File dir = new File(ctx.getFilesDir(), "inbox");
        dir.mkdirs();
        return dir;
    }

    /** Von MainActivity aufgerufen, wenn neue geteilte Inhalte da sind. */
    static void notifyPending() {
        if (instance != null) instance.notifyListeners("pendingAction", new JSObject());
    }

    @Override
    public void load() { instance = this; }

    @PluginMethod
    public void readInbox(PluginCall call) {
        File dir = inbox(getContext());
        List<JSONObject> items = new ArrayList<>();
        File[] files = dir.listFiles();
        if (files != null) for (File f : files) {
            if (!f.getName().endsWith(".json")) continue;
            try {
                JSONObject obj = new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
                JSONArray names = obj.optJSONArray("images");
                JSONArray urls = new JSONArray();
                if (names != null) for (int i = 0; i < names.length(); i++) {
                    File img = new File(dir, names.getString(i));
                    if (img.exists()) urls.put("data:image/jpeg;base64," + Base64.encodeToString(Files.readAllBytes(img.toPath()), Base64.NO_WRAP));
                }
                obj.put("images", urls);
                items.add(obj);
            } catch (Exception ignored) { }
        }
        items.sort((a, b) -> a.optString("created_at").compareTo(b.optString("created_at")));
        JSObject ret = new JSObject();
        ret.put("items", new JSArray(items));
        call.resolve(ret);
    }

    @PluginMethod
    public void clearInbox(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        File[] files = inbox(getContext()).listFiles();
        if (files != null) for (File f : files) {
            for (int i = 0; i < ids.length(); i++) {
                if (f.getName().startsWith(ids.optString(i))) { f.delete(); break; }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void takePendingAction(PluginCall call) {
        android.content.SharedPreferences p = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String action = p.getString(PENDING_ACTION, "");
        p.edit().remove(PENDING_ACTION).apply();
        JSObject ret = new JSObject();
        ret.put("action", action);
        call.resolve(ret);
    }

    /** Bild (data-URL) in der Galerie unter „Bilder/2nd Brain“ sichern. */
    @PluginMethod
    public void saveToPhotos(PluginCall call) {
        String raw = call.getString("dataUrl", "");
        int comma = raw.indexOf(',');
        if (comma < 0) { call.reject("Kein Bild"); return; }
        // shortcut: vor Android 10 bräuchte es die Speicher-Berechtigung, dort gibt es den Knopf nicht
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) { call.reject("Ab Android 10"); return; }
        try {
            byte[] data = Base64.decode(raw.substring(comma + 1), Base64.DEFAULT);
            String mime = raw.startsWith("data:image/png") ? "image/png" : "image/jpeg";
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, "2nd-Brain-" + System.currentTimeMillis());
            v.put(MediaStore.Images.Media.MIME_TYPE, mime);
            v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/2nd Brain");
            ContentResolver r = getContext().getContentResolver();
            Uri uri = r.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) { call.reject("Sichern fehlgeschlagen"); return; }
            try (OutputStream out = r.openOutputStream(uri)) { out.write(data); }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Sichern fehlgeschlagen");
        }
    }
}
