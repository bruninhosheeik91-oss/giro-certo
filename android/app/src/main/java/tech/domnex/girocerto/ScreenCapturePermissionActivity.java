package tech.domnex.girocerto;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

public class ScreenCapturePermissionActivity extends Activity {
    private static final int REQUEST_SCREEN_CAPTURE = 9100;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!hasValidEntitlement()) {
            finish();
            return;
        }
        if (savedInstanceState == null) {
            MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_SCREEN_CAPTURE);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SCREEN_CAPTURE && resultCode == RESULT_OK && data != null) {
            Intent serviceIntent = new Intent(this, RideScreenCaptureService.class)
                .setAction(RideScreenCaptureService.ACTION_START)
                .putExtra(RideScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
                .putExtra(RideScreenCaptureService.EXTRA_RESULT_DATA, data);
            ContextCompat.startForegroundService(this, serviceIntent);
            getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE)
                .edit().putBoolean("analyzerEnabled", true).apply();
        } else {
            getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE)
                .edit().putBoolean("analyzerEnabled", false).apply();
        }
        AnalyzerControlNotification.refresh(this);
        finish();
    }

    private boolean hasValidEntitlement() {
        SharedPreferences prefs =
            getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("proEntitlement", false)) return false;
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        return expiresAt == 0L || expiresAt > System.currentTimeMillis();
    }
}
