package tech.domnex.girocerto;

import android.animation.ValueAnimator;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Botão flutuante do Giro Certo (bolinha com o ícone) sobre a tela inicial e outros apps.
 * Toque abre o Giro Certo; arrastar move e gruda na borda. Usa "Sobrepor a outros apps".
 */
public class FloatingButtonService extends Service {
    static final String PREFS = "giro_certo_floating_button";
    static final String KEY_ENABLED = "enabled";
    private static final String KEY_Y = "y";
    private static final String KEY_RIGHT = "right";
    private static final String CHANNEL_ID = "giro_certo_atalho";
    private static final int NOTIFICATION_ID = 9061;

    private static final long LONG_PRESS_MS = 2000L;
    private static FloatingButtonService instance;
    private static boolean appInFront;

    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams params;
    private View dismissTarget;
    private boolean overTarget;

    static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    static boolean isEnabled(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        context.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, enabled).apply();
        Intent intent = new Intent(context, FloatingButtonService.class);
        if (enabled && canDraw(context)) {
            ContextCompat.startForegroundService(context, intent);
        } else {
            context.stopService(intent);
        }
    }

    /** Chamado pela MainActivity: some com o app aberto e volta quando ele sai da frente. */
    static void onAppVisibilityChanged(boolean visible) {
        appInFront = visible;
        FloatingButtonService service = instance;
        if (service != null && service.bubble != null) {
            service.bubble.setVisibility(visible ? View.GONE : View.VISIBLE);
        }
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!canDraw(this) || !isEnabled(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0);
        instance = this;
        if (bubble == null) addBubble();
        if (bubble != null) bubble.setVisibility(appInFront ? View.GONE : View.VISIBLE);
        return START_STICKY;
    }

    @SuppressLint("ClickableViewAccessibility")
    private void addBubble() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        int size = dp(56);

        FrameLayout shell = new FrameLayout(this);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(Color.rgb(9, 13, 22));
        ring.setStroke(dp(2), Color.rgb(16, 185, 129));
        shell.setBackground(ring);
        shell.setElevation(dp(8));
        shell.setAlpha(0.92f);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.ic_launcher_round);
        int pad = dp(6);
        icon.setPadding(pad, pad, pad, pad);
        shell.addView(icon, new FrameLayout.LayoutParams(size, size));
        shell.setContentDescription("Abrir Giro Certo");

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        params = new WindowManager.LayoutParams(size, size,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = prefs.getBoolean(KEY_RIGHT, true) ? screenWidth() - size : 0;
        params.y = prefs.getInt(KEY_Y, screenHeight() / 3);

        shell.setOnTouchListener(new View.OnTouchListener() {
            private int startX, startY;
            private float touchX, touchY;
            private boolean moved;
            private boolean longFired;
            private final android.os.Handler press = new android.os.Handler(android.os.Looper.getMainLooper());
            private final Runnable longPress = () -> {
                if (moved) return;
                longFired = true;
                triggerPanic();
            };

            @Override public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = params.x; startY = params.y;
                        touchX = event.getRawX(); touchY = event.getRawY();
                        moved = false;
                        longFired = false;
                        press.postDelayed(longPress, LONG_PRESS_MS);
                        shell.setAlpha(1f);
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = Math.round(event.getRawX() - touchX);
                        int dy = Math.round(event.getRawY() - touchY);
                        if (!moved && (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6))) {
                            moved = true;
                            press.removeCallbacks(longPress);
                            showDismissTarget();
                        }
                        params.x = startX + dx;
                        params.y = Math.max(0, Math.min(screenHeight() - size, startY + dy));
                        windowManager.updateViewLayout(shell, params);
                        if (moved) updateTargetHighlight(event.getRawX(), event.getRawY());
                        return true;
                    case MotionEvent.ACTION_UP:
                        press.removeCallbacks(longPress);
                        shell.setAlpha(0.92f);
                        if (longFired) return true;
                        boolean dismiss = moved && overTarget;
                        hideDismissTarget();
                        if (!moved) {
                            openApp();
                        } else if (dismiss) {
                            setEnabled(FloatingButtonService.this, false);
                        } else {
                            snapToEdge(shell, size);
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        try {
            windowManager.addView(shell, params);
            bubble = shell;
        } catch (RuntimeException error) {
            stopSelf();
        }
    }

    private void showDismissTarget() {
        if (dismissTarget != null) return;
        int size = dp(64);
        FrameLayout target = new FrameLayout(this);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.argb(200, 15, 23, 42));
        circle.setStroke(dp(2), Color.argb(200, 248, 250, 252));
        target.setBackground(circle);
        android.widget.TextView x = new android.widget.TextView(this);
        x.setText("✕");
        x.setTextColor(Color.WHITE);
        x.setTextSize(26);
        x.setGravity(Gravity.CENTER);
        target.addView(x, new FrameLayout.LayoutParams(size, size));
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(size, size,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(56);
        try {
            windowManager.addView(target, lp);
            dismissTarget = target;
            target.setAlpha(0f);
            target.animate().alpha(1f).setDuration(150).start();
        } catch (RuntimeException ignored) { }
    }

    private void updateTargetHighlight(float rawX, float rawY) {
        if (dismissTarget == null) return;
        float cx = screenWidth() / 2f;
        float cy = screenHeight() - dp(56) - dp(32);
        boolean near = Math.hypot(rawX - cx, rawY - cy) < dp(80);
        if (near == overTarget) return;
        overTarget = near;
        dismissTarget.animate().scaleX(near ? 1.25f : 1f).scaleY(near ? 1.25f : 1f).setDuration(120).start();
        GradientDrawable bg = (GradientDrawable) dismissTarget.getBackground();
        bg.setColor(near ? Color.argb(230, 220, 38, 38) : Color.argb(200, 15, 23, 42));
    }

    private void hideDismissTarget() {
        overTarget = false;
        if (dismissTarget == null) return;
        try { windowManager.removeView(dismissTarget); } catch (RuntimeException ignored) { }
        dismissTarget = null;
    }

    private void snapToEdge(View view, int size) {
        boolean right = params.x + size / 2 > screenWidth() / 2;
        int target = right ? screenWidth() - size : 0;
        ValueAnimator animator = ValueAnimator.ofInt(params.x, target);
        animator.setDuration(180);
        animator.setInterpolator(new DecelerateInterpolator());
        animator.addUpdateListener(a -> {
            if (bubble == null) return;
            params.x = (int) a.getAnimatedValue();
            windowManager.updateViewLayout(view, params);
        });
        animator.start();
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_RIGHT, right).putInt(KEY_Y, params.y).apply();
    }

    /** Segurar 2s: pânico silencioso, sem nenhuma mudança na tela. */
    private void triggerPanic() {
        Intent open = new Intent(this, PanicTriggerActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        try { startActivity(open); } catch (RuntimeException ignored) { }
    }

    private void openApp() {
        Intent open = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try { startActivity(open); } catch (RuntimeException ignored) { }
    }

    private Notification notification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Botão flutuante", NotificationManager.IMPORTANCE_MIN);
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Giro Certo")
            .setContentText("Botão flutuante ativo")
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build();
    }

    private int screenWidth() { return getResources().getDisplayMetrics().widthPixels; }
    private int screenHeight() { return getResources().getDisplayMetrics().heightPixels; }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    public void onDestroy() {
        hideDismissTarget();
        if (instance == this) instance = null;
        if (bubble != null && windowManager != null) {
            try { windowManager.removeView(bubble); } catch (RuntimeException ignored) { }
        }
        bubble = null;
        super.onDestroy();
    }
}
