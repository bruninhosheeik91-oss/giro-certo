package tech.domnex.girocerto;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

final class AnalyzerControlNotification {
    static final String ACTION_TOGGLE = "tech.domnex.girocerto.TOGGLE_ANALYZER";
    private static final String CHANNEL_ID = "giro_certo_analyzer_control";
    private static final int NOTIFICATION_ID = 9020;

    private AnalyzerControlNotification() { }

    static void refresh(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        SharedPreferences prefs = context.getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        if (!hasValidEntitlement(prefs)) {
            manager.cancel(NOTIFICATION_ID);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID,
                "Controle do Copiloto Giro Certo",
                NotificationManager.IMPORTANCE_LOW
            ));
        }

        boolean enabled = prefs.getBoolean("analyzerEnabled", false);
        Intent openIntent = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            9020,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent toggleIntent = new Intent(context, AnalyzerToggleReceiver.class).setAction(ACTION_TOGGLE);
        PendingIntent togglePendingIntent = PendingIntent.getBroadcast(
            context,
            9021,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(enabled ? "Copiloto Giro Certo ligado" : "Copiloto Giro Certo desligado")
            .setContentText(enabled ? "Monitorando ofertas da 99" : "Toque em Ligar para monitorar ofertas")
            .setContentIntent(openPendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(
                enabled ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                enabled ? "Desligar" : "Ligar",
                togglePendingIntent
            );
        manager.notify(NOTIFICATION_ID, notification.build());
    }

    private static boolean hasValidEntitlement(SharedPreferences prefs) {
        if (!prefs.getBoolean("proEntitlement", false)) return false;
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        return expiresAt == 0L || expiresAt > System.currentTimeMillis();
    }
}
