package ch.fabioberta.secondbrain;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Parcelable;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecondBrainNativePlugin.class);
        super.onCreate(savedInstanceState); // ruft onNewIntent(getIntent()) auf → auch Kaltstart über „Teilen“
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (storeShared(intent)) {
            intent.setAction(Intent.ACTION_MAIN); // nicht nochmals übernehmen (z. B. nach Drehen)
            SecondBrainNativePlugin.notifyPending();
        }
        super.onNewIntent(intent);
    }

    /** „Teilen → 2nd Brain“: wie die iOS-Erweiterung als JSON (+ Bilder) in die Inbox legen. */
    private boolean storeShared(Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return false;
        try {
            String id = UUID.randomUUID().toString().toLowerCase(Locale.ROOT);
            File dir = SecondBrainNativePlugin.inbox(this);
            List<Uri> uris = new ArrayList<>();
            if (Intent.ACTION_SEND.equals(action)) {
                Parcelable p = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (p instanceof Uri) uris.add((Uri) p);
            } else {
                ArrayList<Parcelable> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) for (Parcelable p : list) if (p instanceof Uri) uris.add((Uri) p);
            }
            JSONArray images = new JSONArray();
            for (Uri uri : uris) {
                if (images.length() >= 5) break; // wie iOS
                String type = getContentResolver().getType(uri);
                if (type == null || !type.startsWith("image/")) continue;
                String name = id + "-" + images.length() + ".jpg";
                try (InputStream in = getContentResolver().openInputStream(uri);
                     OutputStream out = new FileOutputStream(new File(dir, name))) {
                    if (in == null) continue;
                    byte[] buf = new byte[65536];
                    for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                    images.put(name);
                }
            }
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            CharSequence extra = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            String text = extra != null ? extra.toString().trim() : "";
            if (subject != null && !subject.trim().isEmpty() && !text.contains(subject.trim())) {
                text = text.isEmpty() ? subject.trim() : subject.trim() + "\n" + text;
            }
            if (text.isEmpty() && images.length() == 0) return false;
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            JSONObject obj = new JSONObject();
            obj.put("id", id);
            obj.put("text", text);
            obj.put("images", images);
            obj.put("created_at", iso.format(new Date()));
            try (OutputStream out = new FileOutputStream(new File(dir, id + ".json"))) {
                out.write(obj.toString().getBytes(StandardCharsets.UTF_8));
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
