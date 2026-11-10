package tech.domnex.girocerto;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.hardware.HardwareBuffer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Copiloto Giro Certo.
 *
 * Lê apenas as janelas da Uber Driver, 99 Motorista e inDrive (packageNames no XML do
 * serviço). Primeiro tenta o texto da árvore de acessibilidade (só nós visíveis, dentro do
 * quadro que contém o botão "Aceitar"); quando o app esconde o texto, usa OCR local
 * ignorando o próprio cartão do Giro Certo e o topo da tela. O cartão só aparece depois de
 * duas leituras iguais seguidas e some quando a oferta sai da tela.
 *
 * Fica ligado só durante a jornada: ao encerrar o turno o app chama {@link #disableFromApp()}.
 */
public class RideAccessibilityService extends AccessibilityService {
    static final String PREFS = RideOfferPlugin.PREFS;
    private static final long OCR_INTERVAL_MS = 1200L;
    private static final long STABLE_WINDOW_MS = 4000L;
    private static final int MISSES_TO_CLEAR = 2;

    private static RideAccessibilityService instance;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextRecognizer recognizer;
    private RideOfferCard card;
    private boolean ocrRunning;
    private long lastOcrAt;
    private String activeApp = "";

    // Estabilidade: precisa ler a mesma oferta duas vezes antes de mostrar.
    private String candidateKey = "";
    private long candidateAt;
    private String shownKey = "";
    private int misses;

    private final Runnable ocrLoop = new Runnable() {
        @Override public void run() {
            if (activeApp.isEmpty()) return;
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (!isActive(prefs) || !rideAppInFront()) {
                activeApp = "";
                return;
            }
            requestOcr(prefs, activeApp);
            handler.postDelayed(this, OCR_INTERVAL_MS);
        }
    };

    static boolean isRunning() {
        return instance != null;
    }

    static boolean disableFromApp() {
        RideAccessibilityService service = instance;
        if (service == null) return false;
        service.disableSelf();
        return true;
    }

    @Override
    protected void onServiceConnected() {
        instance = this;
        card = new RideOfferCard(this);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        CharSequence pkg = event.getPackageName();
        String appName = resolveAppName(pkg == null ? "" : pkg.toString());
        if (appName.isEmpty()) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!isActive(prefs)) return;

        if (!appName.equals(activeApp)) {
            activeApp = appName;
            handler.removeCallbacks(ocrLoop);
            handler.postDelayed(ocrLoop, OCR_INTERVAL_MS);
        }

        String content = readOfferNodes();
        if (looksLikeOffer(content)) {
            process(prefs, appName, content, null, "texto");
        } else {
            requestOcr(prefs, appName);
        }
    }

    /** Texto só dos nós visíveis; se houver "Aceitar", só do quadro da oferta. */
    private String readOfferNodes() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "";
        AccessibilityNodeInfo scope = root;
        List<AccessibilityNodeInfo> accept = root.findAccessibilityNodeInfosByText("Aceitar");
        if (accept != null) {
            for (AccessibilityNodeInfo node : accept) {
                if (!node.isVisibleToUser()) continue;
                AccessibilityNodeInfo parent = node.getParent();
                for (int depth = 0; parent != null && depth < 8; depth++) {
                    if (looksLikeOffer(collect(parent))) { scope = parent; break; }
                    parent = parent.getParent();
                }
                break;
            }
        }
        return collect(scope);
    }

    private static String collect(AccessibilityNodeInfo node) {
        Set<String> parts = new LinkedHashSet<>();
        collectText(node, parts, 0);
        return TextUtils.join(" · ", parts);
    }

    private static void collectText(AccessibilityNodeInfo node, Set<String> parts, int depth) {
        if (node == null || depth > 40 || !node.isVisibleToUser()) return;
        CharSequence text = node.getText();
        if (text != null && text.toString().trim().length() > 0) parts.add(text.toString().trim());
        CharSequence description = node.getContentDescription();
        if (description != null && description.toString().trim().length() > 0) parts.add(description.toString().trim());
        for (int i = 0; i < node.getChildCount(); i++) collectText(node.getChild(i), parts, depth + 1);
    }

    /** Só permite print/OCR com a Uber, 99 ou inDrive em primeiro plano. */
    private boolean rideAppInFront() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || root.getPackageName() == null) return false;
        return !resolveAppName(root.getPackageName().toString()).isEmpty();
    }

    private void requestOcr(SharedPreferences prefs, String appName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || ocrRunning) return;
        if (!rideAppInFront()) return;
        long now = System.currentTimeMillis();
        if (now - lastOcrAt < OCR_INTERVAL_MS) return;
        lastOcrAt = now;
        ocrRunning = true;
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        final Rect cardArea = card == null ? null : card.bounds();
        final int screenHeight = getResources().getDisplayMetrics().heightPixels;
        takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
            @Override public void onSuccess(ScreenshotResult result) {
                HardwareBuffer buffer = result.getHardwareBuffer();
                Bitmap hardware = Bitmap.wrapHardwareBuffer(buffer, result.getColorSpace());
                Bitmap bitmap = hardware == null ? null : hardware.copy(Bitmap.Config.ARGB_8888, false);
                if (hardware != null) hardware.recycle();
                buffer.close();
                if (bitmap == null) { ocrRunning = false; return; }
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener(text -> handleOcr(prefs, appName, text, cardArea, screenHeight))
                    .addOnCompleteListener(task -> {
                        bitmap.recycle();
                        ocrRunning = false;
                    });
            }

            @Override public void onFailure(int errorCode) {
                ocrRunning = false;
                CopilotLog.add(prefs, "falha-print", "ocr", "código " + errorCode, "");
            }
        });
    }

    private void handleOcr(SharedPreferences prefs, String appName, Text text, Rect cardArea, int screenHeight) {
        int topCut = Math.round(screenHeight * 0.08f);
        List<Text.Line> lines = new ArrayList<>();
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                Rect box = line.getBoundingBox();
                if (box == null) continue;
                if (box.bottom < topCut) continue;
                if (cardArea != null && Rect.intersects(box, cardArea)) continue;
                lines.add(line);
            }
        }
        Collections.sort(lines, (a, b) -> {
            Rect ra = a.getBoundingBox(), rb = b.getBoundingBox();
            int dy = ra.top - rb.top;
            return Math.abs(dy) > ra.height() / 2 ? dy : ra.left - rb.left;
        });

        Double fare = null;
        int tallest = 0;
        StringBuilder content = new StringBuilder();
        for (Text.Line line : lines) {
            String value = line.getText();
            content.append(value).append('\n');
            if (value.contains("R$") && !value.toLowerCase(Locale.ROOT).contains("/km")) {
                Double parsed = RideOfferTextExtractor.parseFare(value);
                int h = line.getBoundingBox().height();
                if (parsed != null && parsed > 0 && h > tallest) {
                    tallest = h;
                    fare = parsed;
                }
            }
        }
        String joined = content.toString();
        if (looksLikeOffer(joined)) {
            process(prefs, appName, joined, fare, "ocr");
        } else {
            onNoOffer(prefs);
        }
    }

    private void process(SharedPreferences prefs, String appName, String content, Double fare, String source) {
        RideOfferTextExtractor.Result offer = RideOfferTextExtractor.extract(content, fare);
        if (offer.fareOffered == null || offer.fareOffered <= 0 || offer.totalDistanceKm() <= 0) {
            CopilotLog.add(prefs, "incompleta", source, offer.incompleteReason, content);
            recordDiagnostic(prefs, false, source, offer.incompleteReason, content);
            return;
        }
        misses = 0;
        String pickup = RideDestinationExtractor.extractPickup(content);
        String key = appName + "|" + offer.fareOffered + "|" + offer.totalDistanceKm() + "|" + offer.totalMinutes();
        String parsed = String.format(Locale.US, "R$ %.2f · %.1f km · %.0f min · nota %s · embarque: %s",
            offer.fareOffered, offer.totalDistanceKm(), offer.totalMinutes(),
            offer.passengerRating == null ? "-" : offer.passengerRating.toString(),
            pickup.isEmpty() ? "(não achado)" : pickup);

        if (key.equals(shownKey)) return;
        long now = System.currentTimeMillis();
        if (!key.equals(candidateKey) || now - candidateAt > STABLE_WINDOW_MS) {
            candidateKey = key;
            candidateAt = now;
            CopilotLog.add(prefs, "lida-1x", source, parsed, content);
            return;
        }

        shownKey = key;
        candidateKey = "";
        RideOfferEvaluator.Criteria criteria = RideOfferEvaluator.Criteria.from(prefs);
        RideOfferEvaluator.Evaluation evaluation = RideOfferEvaluator.evaluate(offer, criteria);
        evaluation.pickupAddress = pickup;
        if (card != null) card.show(appName, evaluation, criteria);
        saveHistory(prefs, appName, evaluation, now);
        recordDiagnostic(prefs, true, source, "Oferta analisada: " + evaluation.status, content);
        CopilotLog.add(prefs, "mostrada " + evaluation.status, source, parsed, content);
    }

    private void onNoOffer(SharedPreferences prefs) {
        if (shownKey.isEmpty() && candidateKey.isEmpty()) return;
        misses++;
        if (misses < MISSES_TO_CLEAR) return;
        misses = 0;
        candidateKey = "";
        if (!shownKey.isEmpty()) {
            shownKey = "";
            if (card != null) card.hide();
            CopilotLog.add(prefs, "oferta-saiu", "ocr", "cartão escondido", "");
        }
    }

    private static boolean looksLikeOffer(String content) {
        String s = content.toLowerCase(Locale.ROOT);
        return s.contains("r$") && s.contains("km") && (s.contains("aceitar") || s.contains("min"));
    }

    private static boolean isActive(SharedPreferences prefs) {
        if (!prefs.getBoolean("analyzerEnabled", false)) return false;
        if (!prefs.getBoolean("proEntitlement", false)) return false;
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        return expiresAt == 0L || expiresAt > System.currentTimeMillis();
    }

    static String resolveAppName(String packageName) {
        String v = packageName.toLowerCase(Locale.ROOT);
        if (v.equals("com.ubercab.driver")) return "Uber";
        if (v.equals("com.app99.driver") || v.equals("com.taxis99")) return "99";
        if (v.contains("indriver")) return "inDrive";
        return "";
    }

    private static void saveHistory(SharedPreferences prefs, String appName,
                                    RideOfferEvaluator.Evaluation e, long now) {
        try {
            JSONArray current = new JSONArray(prefs.getString("offerHistory", "[]"));
            JSONArray updated = new JSONArray();
            JSONObject item = new JSONObject();
            item.put("id", String.valueOf(now));
            item.put("appName", appName);
            item.put("fare", e.fare);
            item.put("totalKm", e.totalKm);
            item.put("minutes", e.minutes);
            item.put("profit", e.profit);
            item.put("profitPerKm", e.profitPerKm);
            item.put("profitPerHour", e.profitPerHour);
            if (e.rating != null) item.put("passengerRating", e.rating);
            item.put("status", e.status);
            item.put("analyzedAt", now);
            updated.put(item);
            for (int i = 0; i < current.length() && updated.length() < 50; i++) updated.put(current.get(i));
            prefs.edit().putString("offerHistory", updated.toString()).apply();
        } catch (Exception ignored) { }
    }

    static void recordDiagnostic(SharedPreferences prefs, boolean analyzed, String source,
                                 String message, String content) {
        prefs.edit()
            .putBoolean("diagnosticAnalyzed", analyzed)
            .putString("diagnosticSource", source)
            .putString("diagnosticMessage", message == null ? "" : message)
            .putString("diagnosticPreview", content.length() > 500 ? content.substring(0, 500) : content)
            .putLong("diagnosticAt", System.currentTimeMillis())
            .apply();
    }

    @Override public void onInterrupt() { }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        cleanup();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        cleanup();
        super.onDestroy();
    }

    private void cleanup() {
        handler.removeCallbacksAndMessages(null);
        if (card != null) card.hide();
        if (recognizer != null) { recognizer.close(); recognizer = null; }
        if (instance == this) instance = null;
    }
}
