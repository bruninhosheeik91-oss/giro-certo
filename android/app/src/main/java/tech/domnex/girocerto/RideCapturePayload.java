package tech.domnex.girocerto;

import com.getcapacitor.JSObject;

/** Resultado de uma leitura de tela do copiloto. Nunca contém nem referencia imagens. */
final class RideCapturePayload {
    String appName = "";
    String packageName = "";
    String rawText = "";
    Double fareOffered;
    Double distanceToPickupKm;
    Double tripDistanceKm;
    Double pickupMinutes;
    Double tripMinutes;
    boolean complete;
    String incompleteReason = "";
    long capturedAt;
    boolean fullScreen;

    JSObject toJsObject() {
        JSObject object = new JSObject();
        object.put("appName", appName);
        object.put("packageName", packageName);
        object.put("rawText", rawText);
        putOrNull(object, "fareOffered", fareOffered);
        putOrNull(object, "distanceToPickupKm", distanceToPickupKm);
        putOrNull(object, "tripDistanceKm", tripDistanceKm);
        putOrNull(object, "pickupMinutes", pickupMinutes);
        putOrNull(object, "tripMinutes", tripMinutes);
        object.put("complete", complete);
        object.put("incompleteReason", incompleteReason == null ? "" : incompleteReason);
        object.put("capturedAt", capturedAt);
        object.put("fullScreen", fullScreen);
        return object;
    }

    private static void putOrNull(JSObject object, String key, Double value) {
        if (value == null) object.put(key, JSObject.NULL);
        else object.put(key, value);
    }
}
