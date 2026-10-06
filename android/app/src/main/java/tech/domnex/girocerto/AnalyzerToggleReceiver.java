package tech.domnex.girocerto;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class AnalyzerToggleReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!AnalyzerControlNotification.ACTION_TOGGLE.equals(intent.getAction())) return;
        SharedPreferences prefs = context.getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        boolean hasPro = prefs.getBoolean("proEntitlement", false)
            && (expiresAt == 0L || expiresAt > System.currentTimeMillis());
        boolean enabled = hasPro && prefs.getBoolean("analyzerEnabled", false);
        if (enabled) {
            prefs.edit().putBoolean("analyzerEnabled", false).apply();
            Intent stopIntent = new Intent(context, RideScreenCaptureService.class)
                .setAction(RideScreenCaptureService.ACTION_STOP);
            context.startService(stopIntent);
            AnalyzerControlNotification.refresh(context);
            return;
        }
        Intent openIntent = new Intent(context, ScreenCapturePermissionActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(openIntent);
    }
}
