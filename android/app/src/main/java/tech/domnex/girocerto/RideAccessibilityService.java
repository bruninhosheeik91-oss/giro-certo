package tech.domnex.girocerto;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityService.ScreenshotResult;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.hardware.HardwareBuffer;
import android.os.Build;
import android.text.TextUtils;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

public class RideAccessibilityService extends AccessibilityService {
    private static final long OCR_INTERVAL_MS = 2500L;
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    private boolean ocrRunning;
    private long lastOcrAt;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        CharSequence packageValue = event.getPackageName();
        String packageName = packageValue == null ? "" : packageValue.toString().toLowerCase(Locale.ROOT);
        if (!isNinetyNine(packageName)) return;

        SharedPreferences prefs = getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE);
        if (!hasValidEntitlement(prefs) || !prefs.getBoolean("analyzerEnabled", false)) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        String content = "";
        if (root != null) {
            Set<String> parts = new LinkedHashSet<>();
            collectText(root, parts);
            root.recycle();
            content = TextUtils.join(" · ", parts);
        }
        String searchable = content.toLowerCase(Locale.ROOT);
        if (!searchable.contains("aceitar") || !searchable.contains("r$")) {
            requestOcr(prefs);
            return;
        }

        analyzeOnce(prefs, content, "accessibility");
    }

    private void requestOcr(SharedPreferences prefs) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || ocrRunning) return;
        long now = System.currentTimeMillis();
        if (now - lastOcrAt < OCR_INTERVAL_MS) return;
        lastOcrAt = now;
        ocrRunning = true;
        takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
            @Override public void onSuccess(ScreenshotResult result) {
                HardwareBuffer buffer = result.getHardwareBuffer();
                Bitmap hardware = Bitmap.wrapHardwareBuffer(buffer, result.getColorSpace());
                Bitmap bitmap = hardware == null ? null : hardware.copy(Bitmap.Config.ARGB_8888, false);
                buffer.close();
                if (bitmap == null) {
                    ocrRunning = false;
                    return;
                }
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener(text -> {
                        String content = text.getText();
                        String searchable = content.toLowerCase(Locale.ROOT);
                        if (searchable.contains("aceitar") && searchable.contains("r$")
                            && searchable.contains("km")) {
                            analyzeOnce(prefs, content, "ocr");
                        }
                    })
                    .addOnCompleteListener(task -> {
                        bitmap.recycle();
                        ocrRunning = false;
                    });
            }

            @Override public void onFailure(int errorCode) {
                ocrRunning = false;
                RideNotificationListenerService.recordDiagnostic(
                    prefs,
                    false,
                    "ocr",
                    "Não foi possível capturar a tela da oferta (código " + errorCode + ").",
                    ""
                );
            }
        });
    }

    private void analyzeOnce(SharedPreferences prefs, String content, String source) {

        long now = System.currentTimeMillis();
        String fingerprint = Integer.toHexString(content.hashCode());
        if (fingerprint.equals(prefs.getString("lastAccessibilityFingerprint", ""))
            && now - prefs.getLong("lastAccessibilityFingerprintAt", 0L) < 60000L) return;
        prefs.edit()
            .putString("lastAccessibilityFingerprint", fingerprint)
            .putLong("lastAccessibilityFingerprintAt", now)
            .apply();
        RideNotificationListenerService.analyzeOfferContent(this, "99", content, source);
    }

    @Override public void onInterrupt() { }

    @Override
    protected void onServiceConnected() {
        AnalyzerControlNotification.refresh(this);
    }

    private boolean isNinetyNine(String packageName) {
        return packageName.contains("taxis99") || packageName.contains("didi")
            || packageName.contains("99taxi") || packageName.contains("99");
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

    @Override
    public void onDestroy() {
        recognizer.close();
        super.onDestroy();
    }
}
