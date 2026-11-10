package tech.domnex.girocerto;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extração pura dos dados de uma oferta a partir do texto reconhecido por OCR.
 *
 * Não guarda imagens, não envia nada e nunca inventa dados: quando um campo não é
 * encontrado o resultado é marcado como incompleto e o motivo é informado ao app.
 */
final class RideOfferTextExtractor {
    private RideOfferTextExtractor() { }

    private static final Pattern FARE = Pattern.compile(
        "R\\$\\s*([\\d.]+(?:,\\d{1,2})?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MINUTES = Pattern.compile(
        "(\\d+(?:[.,]\\d+)?)\\s*(?:min|minutos?)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern RATING = Pattern.compile(
        "(?:★|\\u2605|\\*)\\s*([1-5][.,]\\d{1,2})|\\b([1-5][.,]\\d{1,2})\\s*\\(\\s*\\d[\\d.]*\\s*\\)");
    private static final Pattern PER_KM = Pattern.compile(
        "R\\$\\s*[\\d.]+(?:,\\d{1,2})?\\s*/\\s*km", Pattern.CASE_INSENSITIVE);
    private static final Pattern DISTANCE = Pattern.compile(
        "(\\d+(?:[.,]\\d+)?)\\s*(km|m)\\b", Pattern.CASE_INSENSITIVE);

    static final class Result {
        Double fareOffered;
        Double distanceToPickupKm;
        Double tripDistanceKm;
        Double pickupMinutes;
        Double tripMinutes;
        Double passengerRating;
        boolean complete;
        String incompleteReason = "";

        double totalDistanceKm() {
            return (distanceToPickupKm == null ? 0 : distanceToPickupKm)
                + (tripDistanceKm == null ? 0 : tripDistanceKm);
        }

        double totalMinutes() {
            return (pickupMinutes == null ? 0 : pickupMinutes)
                + (tripMinutes == null ? 0 : tripMinutes);
        }
    }

    static Result extract(String content, Double fareOverride) {
        Result result = extract(content);
        if (fareOverride != null && fareOverride > 0) {
            result.fareOffered = fareOverride;
            boolean hasDistance = result.totalDistanceKm() > 0;
            boolean hasTime = result.totalMinutes() > 0;
            result.complete = hasDistance && hasTime;
            if (result.complete) result.incompleteReason = "";
        }
        return result;
    }

    static Double parseFare(String text) {
        if (text == null) return null;
        Matcher fare = FARE.matcher(PER_KM.matcher(text).replaceAll(" "));
        return fare.find() ? parseNumber(fare.group(1)) : null;
    }

    static Result extract(String content) {
        Result result = new Result();
        String normalized = content == null ? "" : content.replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty()) {
            result.incompleteReason = "Nenhum texto reconhecido na tela.";
            return result;
        }

        Matcher rating = RATING.matcher(normalized);
        if (rating.find()) {
            Double value = parseNumber(rating.group(1) != null ? rating.group(1) : rating.group(2));
            if (value != null && value >= 1 && value <= 5) result.passengerRating = value;
        }

        normalized = PER_KM.matcher(normalized).replaceAll(" ");
        Matcher fare = FARE.matcher(normalized);
        if (fare.find()) result.fareOffered = parseNumber(fare.group(1));

        List<Double> minutes = new ArrayList<>();
        Matcher minutesMatcher = MINUTES.matcher(normalized);
        while (minutesMatcher.find()) {
            Double value = parseNumber(minutesMatcher.group(1));
            if (value != null) minutes.add(value);
        }
        List<Double> distances = new ArrayList<>();
        Matcher distanceMatcher = DISTANCE.matcher(normalized);
        while (distanceMatcher.find()) {
            Double value = parseNumber(distanceMatcher.group(1));
            if (value == null) continue;
            if ("m".equalsIgnoreCase(distanceMatcher.group(2))) value = value / 1000.0;
            distances.add(value);
        }

        if (!minutes.isEmpty()) result.pickupMinutes = minutes.get(0);
        if (minutes.size() > 1) result.tripMinutes = minutes.get(1);

        if (distances.size() == 1) {
            result.tripDistanceKm = distances.get(0);
        } else if (distances.size() >= 2) {
            result.distanceToPickupKm = distances.get(0);
            result.tripDistanceKm = distances.get(1);
        }

        List<String> missing = new ArrayList<>();
        if (result.fareOffered == null || result.fareOffered <= 0) missing.add("valor");
        if (result.totalDistanceKm() <= 0) missing.add("distância");
        if (result.totalMinutes() <= 0) missing.add("tempo");

        result.complete = missing.isEmpty();
        if (!result.complete) {
            result.incompleteReason = "Análise incompleta: " + String.join(", ", missing)
                + " não identificado(s) na tela.";
        }
        return result;
    }

    private static Double parseNumber(String value) {
        if (value == null) return null;
        String normalized = value.replace(" ", "")
            .replaceAll("(?<=\\d)\\.(?=\\d{3}(?:\\D|$))", "")
            .replace(',', '.');
        try {
            return Double.parseDouble(normalized);
        } catch (NumberFormatException error) {
            return null;
        }
    }
}
