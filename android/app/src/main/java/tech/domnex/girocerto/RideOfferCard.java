package tech.domnex.girocerto;

import android.accessibilityservice.AccessibilityService;
import android.animation.ObjectAnimator;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

/**
 * Cartão do Copiloto exibido pelo serviço de acessibilidade (TYPE_ACCESSIBILITY_OVERLAY).
 * Não pede "Sobrepor a outros apps", não intercepta toques na oferta e some sozinho.
 */
final class RideOfferCard {
    private static final long VISIBLE_MS = 12000L;
    private static final Locale BR = Locale.forLanguageTag("pt-BR");

    private static final int BG_TOP = Color.rgb(15, 23, 42);
    private static final int BG_BOTTOM = Color.rgb(2, 6, 23);
    private static final int TILE = Color.argb(255, 30, 41, 59);
    private static final int TEXT = Color.rgb(241, 245, 249);
    private static final int MUTED = Color.rgb(148, 163, 184);
    private static final int GOOD = Color.rgb(16, 185, 129);
    private static final int WARN = Color.rgb(245, 158, 11);
    private static final int BAD = Color.rgb(239, 68, 68);

    private final AccessibilityService service;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private View current;

    RideOfferCard(AccessibilityService service) {
        this.service = service;
    }

    void show(String appName, RideOfferEvaluator.Evaluation e, RideOfferEvaluator.Criteria c) {
        handler.post(() -> {
            hide();
            boolean good = e.status.equals(RideOfferEvaluator.GOOD);
            boolean warn = e.status.equals(RideOfferEvaluator.MEDIUM);
            int accent = good ? GOOD : warn ? WARN : BAD;
            String verdict = good ? "VALE A PENA" : warn ? "ATENÇÃO" : "NÃO COMPENSA";
            String icon = good ? "✓" : warn ? "!" : "✕";

            LinearLayout shell = new LinearLayout(service);
            shell.setOrientation(LinearLayout.VERTICAL);
            GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { BG_TOP, BG_BOTTOM });
            bg.setCornerRadius(dp(18));
            bg.setStroke(dp(2), accent);
            shell.setBackground(bg);
            shell.setElevation(dp(16));
            shell.setClipToOutline(true);

            LinearLayout body = new LinearLayout(service);
            body.setOrientation(LinearLayout.VERTICAL);
            body.setPadding(dp(12), dp(10), dp(12), dp(9));
            shell.addView(body);

            // Linha 1: veredito + app | valor e lucro
            LinearLayout header = row();
            LinearLayout left = new LinearLayout(service);
            left.setOrientation(LinearLayout.VERTICAL);
            TextView badge = label(icon + " " + verdict, 12, Color.WHITE, true);
            badge.setPadding(dp(8), dp(4), dp(10), dp(4));
            badge.setBackground(rounded(accent, 999));
            left.addView(badge, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
            TextView app = label(appName.toUpperCase(BR), 9, MUTED, true);
            app.setLetterSpacing(0.12f);
            app.setPadding(dp(2), dp(4), 0, 0);
            left.addView(app);
            header.addView(left);
            header.addView(spacer());
            LinearLayout right = new LinearLayout(service);
            right.setOrientation(LinearLayout.VERTICAL);
            right.setGravity(Gravity.END);
            right.addView(label(money(e.fare), 24, TEXT, true));
            right.addView(label("lucro " + money(e.profit), 12, e.profit > 0 ? accent : BAD, true));
            header.addView(right);
            body.addView(header);

            // Linha 2: métricas
            LinearLayout grid = row();
            grid.setPadding(0, dp(8), 0, 0);
            grid.addView(tile("Lucro/km", money(e.profitPerKm), e.profitPerKm >= c.minProfitPerKm, "mín " + money(c.minProfitPerKm)), weighted());
            grid.addView(gap());
            grid.addView(tile("Lucro/hora", e.minutes > 0 ? String.format(BR, "R$ %.0f", e.profitPerHour) : "—",
                e.minutes <= 0 || e.profitPerHour >= c.minProfitPerHour, String.format(BR, "mín R$ %.0f", c.minProfitPerHour)), weighted());
            grid.addView(gap());
            grid.addView(tile("Passageiro", e.rating != null ? String.format(BR, "★ %.2f", e.rating) : "—",
                e.rating == null || e.rating >= c.minPassengerRating, String.format(BR, "mín %.2f", c.minPassengerRating)), weighted());
            body.addView(grid);

            // Linha 3: tempo total gasto na corrida
            if (e.minutes > 0) {
                LinearLayout time = row();
                time.setPadding(dp(10), dp(6), dp(10), dp(6));
                time.setBackground(rounded(Color.argb(40, Color.red(accent), Color.green(accent), Color.blue(accent)), 10));
                time.addView(label("⏱ " + duration(e.minutes), 14, TEXT, true));
                String split = e.pickupMinutes > 0 && e.tripMinutes > 0
                    ? String.format(BR, "  %.0f até o passageiro + %.0f viagem · %.1f km", e.pickupMinutes, e.tripMinutes, e.totalKm)
                    : String.format(BR, "  %.1f km", e.totalKm);
                time.addView(label(split, 10, MUTED, false));
                time.addView(spacer());
                long end = System.currentTimeMillis() + Math.round(e.minutes * 60000d);
                time.addView(label("até " + new java.text.SimpleDateFormat("HH:mm", BR).format(new java.util.Date(end)), 12, accent, true));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                lp.topMargin = dp(8);
                body.addView(time, lp);
            }

            // Linha 4: local de embarque
            if (!e.pickupAddress.isEmpty()) {
                TextView pickup = label("📍 Embarque: " + e.pickupAddress, 10, MUTED, false);
                pickup.setSingleLine(true);
                pickup.setEllipsize(android.text.TextUtils.TruncateAt.END);
                pickup.setPadding(0, dp(7), 0, 0);
                body.addView(pickup);
            }

            // Barra de tempo
            FrameLayout track = new FrameLayout(service);
            track.setBackgroundColor(Color.argb(60, 148, 163, 184));
            View progress = new View(service);
            progress.setBackgroundColor(accent);
            track.addView(progress, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(4)));
            shell.addView(track, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(4)));

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                service.getResources().getDisplayMetrics().widthPixels - dp(20),
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = dp(30);
            try {
                windowManager().addView(shell, params);
                current = shell;
                shell.setAlpha(0f);
                shell.setTranslationY(-dp(40));
                shell.animate().alpha(1f).translationY(0).setDuration(260)
                    .setInterpolator(new DecelerateInterpolator()).start();
                progress.setPivotX(0);
                ObjectAnimator countdown = ObjectAnimator.ofFloat(progress, "scaleX", 1f, 0f);
                countdown.setDuration(VISIBLE_MS);
                countdown.setInterpolator(new LinearInterpolator());
                countdown.start();
                handler.postDelayed(this::hide, VISIBLE_MS);
            } catch (RuntimeException ignored) {
                current = null;
            }
        });
    }

    /** Área do cartão na tela (para o OCR ignorar o próprio cartão). */
    android.graphics.Rect bounds() {
        View view = current;
        if (view == null || view.getWidth() == 0) return null;
        int[] xy = new int[2];
        view.getLocationOnScreen(xy);
        return new android.graphics.Rect(xy[0], xy[1], xy[0] + view.getWidth(), xy[1] + view.getHeight());
    }

    boolean isShowing() {
        return current != null;
    }

    void hide() {
        handler.removeCallbacksAndMessages(null);
        if (current == null) return;
        try {
            windowManager().removeView(current);
        } catch (RuntimeException ignored) { }
        current = null;
    }

    private View tile(String title, String value, boolean ok, String hint) {
        LinearLayout box = new LinearLayout(service);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(8), dp(5), dp(8), dp(5));
        box.setBackground(rounded(TILE, 10));
        box.addView(label(title, 9, MUTED, false));
        box.addView(label(value, 13, ok ? TEXT : BAD, true));
        box.addView(label((ok ? "● " : "▼ ") + hint, 8, ok ? GOOD : BAD, false));
        return box;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(service);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private View spacer() {
        View v = new View(service);
        v.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1f));
        return v;
    }

    private View gap() {
        View v = new View(service);
        v.setLayoutParams(new LinearLayout.LayoutParams(dp(8), 1));
        return v;
    }

    private LinearLayout.LayoutParams weighted() {
        return new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    }

    private TextView label(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(service);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(sp);
        view.setIncludeFontPadding(false);
        view.setPadding(0, dp(1), 0, dp(1));
        if (bold) view.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        return view;
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private static String duration(double minutes) {
        long total = Math.round(minutes);
        if (total < 60) return total + " min";
        long h = total / 60, m = total % 60;
        return m == 0 ? h + " h" : h + " h " + m + " min";
    }

    private static String money(double value) {
        return String.format(BR, "R$ %.2f", value);
    }

    private WindowManager windowManager() {
        return (WindowManager) service.getSystemService(AccessibilityService.WINDOW_SERVICE);
    }

    private int dp(int value) {
        return Math.round(value * service.getResources().getDisplayMetrics().density);
    }
}
