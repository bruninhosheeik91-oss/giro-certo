package tech.domnex.girocerto;

import android.app.Notification;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import java.util.Locale;

public class RideNotificationListenerService extends NotificationListenerService {
    public static final String ACTION_RIDE_OFFER = "tech.domnex.girocerto.RIDE_OFFER";
    public static final String PREFS = "giro_certo_ride_offers";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        if (!isSupportedRideApp(packageName)) return;

        Bundle extras = sbn.getNotification().extras;
        String title = stringValue(extras.get(Notification.EXTRA_TITLE));
        String text = stringValue(extras.get(Notification.EXTRA_BIG_TEXT));
        if (text.isEmpty()) text = stringValue(extras.get(Notification.EXTRA_TEXT));
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null && lines.length > 0) text = TextUtils.join(" · ", lines);
        if (title.isEmpty() && text.isEmpty()) return;
        String searchable = (title + " " + text).toLowerCase(Locale.ROOT);
        if (!searchable.contains("r$") || (!searchable.contains("km") && !searchable.contains("corrida") && !searchable.contains("entrega"))) return;

        long receivedAt = System.currentTimeMillis();
        String appName = resolveAppName(packageName);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit()
            .putString("packageName", packageName)
            .putString("appName", appName)
            .putString("title", title)
            .putString("text", text)
            .putLong("receivedAt", receivedAt)
            .apply();

        Intent intent = new Intent(ACTION_RIDE_OFFER).setPackage(getPackageName());
        intent.putExtra("packageName", packageName);
        intent.putExtra("appName", appName);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        intent.putExtra("receivedAt", receivedAt);
        sendBroadcast(intent);
    }

    private boolean isSupportedRideApp(String packageName) {
        String value = packageName.toLowerCase(Locale.ROOT);
        return value.contains("uber") || value.contains("didi") || value.contains("99")
            || value.contains("ifood") || value.contains("lalamove")
            || value.contains("rappi") || value.contains("borzo");
    }

    private String resolveAppName(String packageName) {
        String value = packageName.toLowerCase(Locale.ROOT);
        if (value.contains("uber")) return "Uber";
        if (value.contains("didi") || value.contains("99")) return "99";
        if (value.contains("ifood")) return "iFood";
        if (value.contains("lalamove")) return "Lalamove";
        if (value.contains("rappi")) return "Rappi";
        if (value.contains("borzo")) return "Borzo";
        return "Aplicativo de corrida";
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
