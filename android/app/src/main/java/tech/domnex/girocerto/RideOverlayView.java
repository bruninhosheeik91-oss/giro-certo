package tech.domnex.girocerto;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

public final class RideOverlayView {
    private static WindowManager activeManager;
    private static View activeView;

    private RideOverlayView() { }

    public static void show(Context context, String title, double fare, String body, String status) {
        new Handler(Looper.getMainLooper()).post(() -> {
            removeCurrent();
            WindowManager manager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
            int accent = status.equals("COMPENSA") ? Color.rgb(45, 212, 191)
                : status.equals("ATENÇÃO") ? Color.rgb(251, 191, 36) : Color.rgb(251, 113, 133);

            LinearLayout shell = new LinearLayout(context);
            shell.setOrientation(LinearLayout.HORIZONTAL);
            GradientDrawable shellBackground = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[] { Color.rgb(6, 18, 38), Color.rgb(11, 29, 55) }
            );
            shellBackground.setCornerRadius(dp(context, 20));
            shellBackground.setStroke(dp(context, 1), Color.argb(115, 71, 105, 148));
            shell.setBackground(shellBackground);
            shell.setElevation(dp(context, 18));

            View rail = new View(context);
            GradientDrawable railBackground = new GradientDrawable();
            railBackground.setColor(accent);
            railBackground.setCornerRadii(new float[] {
                dp(context, 20), dp(context, 20), 0, 0, 0, 0, dp(context, 20), dp(context, 20)
            });
            rail.setBackground(railBackground);
            shell.addView(rail, new LinearLayout.LayoutParams(dp(context, 5), LinearLayout.LayoutParams.MATCH_PARENT));

            LinearLayout content = new LinearLayout(context);
            content.setOrientation(LinearLayout.VERTICAL);
            content.setPadding(dp(context, 13), dp(context, 10), dp(context, 10), dp(context, 10));
            shell.addView(content, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

            LinearLayout header = new LinearLayout(context);
            header.setGravity(Gravity.CENTER_VERTICAL);
            content.addView(header, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

            TextView monogram = label(context, "GC", 11, Color.rgb(5, 20, 38), Typeface.BOLD);
            monogram.setGravity(Gravity.CENTER);
            GradientDrawable monogramBackground = new GradientDrawable();
            monogramBackground.setColor(Color.rgb(45, 212, 191));
            monogramBackground.setCornerRadius(dp(context, 9));
            monogram.setBackground(monogramBackground);
            header.addView(monogram, new LinearLayout.LayoutParams(dp(context, 30), dp(context, 30)));

            LinearLayout brand = new LinearLayout(context);
            brand.setOrientation(LinearLayout.VERTICAL);
            brand.setPadding(dp(context, 9), 0, 0, 0);
            TextView brandName = label(context, "COPILOTO GIRO CERTO", 11, Color.WHITE, Typeface.BOLD);
            brandName.setLetterSpacing(0.08f);
            brand.addView(brandName);
            TextView source = label(context, "Análise financeira em tempo real", 9, Color.rgb(148, 163, 184), Typeface.NORMAL);
            brand.addView(source);
            header.addView(brand, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

            TextView close = label(context, "×", 22, Color.rgb(148, 163, 184), Typeface.NORMAL);
            close.setGravity(Gravity.CENTER);
            close.setContentDescription("Fechar análise");
            close.setOnClickListener(view -> removeCurrent());
            header.addView(close, new LinearLayout.LayoutParams(dp(context, 34), dp(context, 34)));

            LinearLayout decision = new LinearLayout(context);
            decision.setGravity(Gravity.CENTER_VERTICAL);
            decision.setPadding(0, dp(context, 8), 0, 0);
            content.addView(decision, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

            LinearLayout amountBlock = new LinearLayout(context);
            amountBlock.setOrientation(LinearLayout.VERTICAL);
            TextView amountCaption = label(context, "OFERTA", 9, Color.rgb(100, 116, 139), Typeface.BOLD);
            amountCaption.setLetterSpacing(0.12f);
            amountBlock.addView(amountCaption);
            TextView amount = label(
                context,
                String.format(Locale.forLanguageTag("pt-BR"), "R$ %.2f", fare),
                25,
                Color.WHITE,
                Typeface.BOLD
            );
            amountBlock.addView(amount);
            decision.addView(amountBlock, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

            TextView verdict = label(context, status, 11, accent, Typeface.BOLD);
            verdict.setGravity(Gravity.CENTER);
            verdict.setPadding(dp(context, 12), dp(context, 7), dp(context, 12), dp(context, 7));
            GradientDrawable verdictBackground = new GradientDrawable();
            verdictBackground.setColor(Color.argb(35, Color.red(accent), Color.green(accent), Color.blue(accent)));
            verdictBackground.setStroke(dp(context, 1), Color.argb(150, Color.red(accent), Color.green(accent), Color.blue(accent)));
            verdictBackground.setCornerRadius(dp(context, 14));
            verdict.setBackground(verdictBackground);
            decision.addView(verdict);

            TextView details = label(context, body, 11, Color.rgb(203, 213, 225), Typeface.NORMAL);
            details.setLineSpacing(0, 1.08f);
            details.setPadding(0, dp(context, 7), 0, 0);
            content.addView(details);

            TextView footer = label(
                context,
                "LUCRO REAL ESTIMADO  •  custo por km já descontado",
                9,
                Color.rgb(94, 234, 212),
                Typeface.BOLD
            );
            footer.setLetterSpacing(0.04f);
            footer.setPadding(0, dp(context, 7), 0, 0);
            content.addView(footer);

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                context.getResources().getDisplayMetrics().widthPixels - dp(context, 28),
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = dp(context, 68);
            enableDragging(shell, manager, params);

            try {
                manager.addView(shell, params);
                activeManager = manager;
                activeView = shell;
                new Handler(Looper.getMainLooper()).postDelayed(() -> remove(manager, shell), 15000);
            } catch (RuntimeException ignored) { }
        });
    }

    private static TextView label(Context context, String text, float size, int color, int style) {
        TextView view = new TextView(context);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans-serif", style));
        return view;
    }

    private static void enableDragging(View view, WindowManager manager, WindowManager.LayoutParams params) {
        view.setOnTouchListener(new View.OnTouchListener() {
            private float downY;
            private int startY;
            private boolean dragging;

            @Override public boolean onTouch(View target, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    downY = event.getRawY();
                    startY = params.y;
                    dragging = false;
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    float delta = event.getRawY() - downY;
                    if (Math.abs(delta) > dp(target.getContext(), 5)) dragging = true;
                    if (dragging) {
                        params.y = Math.max(0, startY + Math.round(delta));
                        try { manager.updateViewLayout(target, params); } catch (RuntimeException ignored) { }
                    }
                    return true;
                }
                return event.getAction() == MotionEvent.ACTION_UP && dragging;
            }
        });
    }

    private static void removeCurrent() {
        if (activeManager != null && activeView != null) remove(activeManager, activeView);
    }

    private static void remove(WindowManager manager, View view) {
        try { manager.removeView(view); } catch (RuntimeException ignored) { }
        if (activeView == view) {
            activeView = null;
            activeManager = null;
        }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
