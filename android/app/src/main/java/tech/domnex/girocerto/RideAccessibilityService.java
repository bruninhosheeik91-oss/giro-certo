package tech.domnex.girocerto;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

public class RideAccessibilityService extends AccessibilityService {
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        CharSequence packageValue = event.getPackageName();
        String packageName = packageValue == null ? "" : packageValue.toString().toLowerCase(Locale.ROOT);
        if (!isNinetyNine(packageName)) return;

        SharedPreferences prefs = getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE);
        if (!hasValidEntitlement(prefs) || !prefs.getBoolean("analyzerEnabled", false)) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        Set<String> parts = new LinkedHashSet<>();
        collectText(root, parts);
        root.recycle();
        String content = TextUtils.join(" · ", parts);
        String searchable = content.toLowerCase(Locale.ROOT);
        if (!searchable.contains("aceitar") || !searchable.contains("r$")) return;

        long now = System.currentTimeMillis();
        String fingerprint = Integer.toHexString(content.hashCode());
        if (fingerprint.equals(prefs.getString("lastAccessibilityFingerprint", ""))
            && now - prefs.getLong("lastAccessibilityFingerprintAt", 0L) < 60000L) return;
        prefs.edit()
            .putString("lastAccessibilityFingerprint", fingerprint)
            .putLong("lastAccessibilityFingerprintAt", now)
            .apply();
        RideNotificationListenerService.analyzeOfferContent(this, "99", content, "accessibility");
    }

    @Override public void onInterrupt() { }

    @Override
    protected void onServiceConnected() {
        AnalyzerControlNotification.refresh(this);
    }

    private boolean isNinetyNine(String packageName) {
        return packageName.contains("taxis99") || packageName.contains("didi") || packageName.contains("99taxi");
    }

    private boolean hasValidEntitlement(SharedPreferences prefs) {
        if (!prefs.getBoolean("proEntitlement", false)) return false;
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        return expiresAt == 0L || expiresAt > System.currentTimeMillis();
    }

    private void collectText(AccessibilityNodeInfo node, Set<String> parts) {
        CharSequence text = node.getText();
        if (text != null && !text.toString().trim().isEmpty()) parts.add(text.toString().trim());
        CharSequence description = node.getContentDescription();
        if (description != null && !description.toString().trim().isEmpty()) {
            parts.add(description.toString().trim());
        }
        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child == null) continue;
            collectText(child, parts);
            child.recycle();
        }
    }
}
