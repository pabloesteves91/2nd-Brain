// Home-Bildschirm-Widgets wie unter iOS: „Neuer Gedanke“ und „Schnellaktionen“ (Neuer Gedanke, Foto, Heute).
// Ein Tipp öffnet die App mit secondbrain://… – die Weiche dafür steht in js/native.js (appUrlOpen).
package ch.fabioberta.secondbrain;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public final class Widgets {
    private Widgets() { }

    static PendingIntent open(Context ctx, String action, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("secondbrain://" + action), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static class Thought extends AppWidgetProvider {
        @Override
        public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_thought);
            v.setOnClickPendingIntent(R.id.widget_root, open(ctx, "new", 1));
            mgr.updateAppWidget(ids, v);
        }
    }

    public static class Actions extends AppWidgetProvider {
        @Override
        public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_actions);
            v.setOnClickPendingIntent(R.id.action_new, open(ctx, "new", 2));
            v.setOnClickPendingIntent(R.id.action_photo, open(ctx, "photo", 3));
            v.setOnClickPendingIntent(R.id.action_today, open(ctx, "today", 4));
            mgr.updateAppWidget(ids, v);
        }
    }
}
