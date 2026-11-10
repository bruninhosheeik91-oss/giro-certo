package tech.domnex.girocerto;

/**
 * Ponte em memória entre o serviço de captura (que roda em background) e o plugin
 * Capacitor. O plugin registra um listener enquanto o app está vivo; o serviço publica
 * o resultado ou o encerramento da sessão.
 */
final class RideCaptureBus {
    interface Listener {
        void onCaptureResult(RideCapturePayload payload);
        void onCaptureStopped(String reason);
    }

    private static volatile Listener listener;

    private RideCaptureBus() { }

    static void setListener(Listener value) {
        listener = value;
    }

    static void clearListener(Listener value) {
        if (listener == value) listener = null;
    }

    static void emitResult(RideCapturePayload payload) {
        Listener current = listener;
        if (current != null) current.onCaptureResult(payload);
    }

    static void emitStopped(String reason) {
        Listener current = listener;
        if (current != null) current.onCaptureStopped(reason);
    }
}
