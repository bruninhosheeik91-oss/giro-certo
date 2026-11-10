package tech.domnex.girocerto;

/**
 * Extração pura de endereço a partir de texto de oferta.
 *
 * Usada pelo Copiloto para achar o endereço de embarque (entre o 1º e o 2º trecho
 * "X min (Y km)") e o de destino (depois do último trecho), para o Street View.
 */
final class RideDestinationExtractor {
    private RideDestinationExtractor() { }

    private static final java.util.regex.Pattern LEG = java.util.regex.Pattern.compile(
        "(?i)\\d+(?:[.,]\\d+)?\\s*(?:min|minutos?)\\s*\\([^)]*(?:km|m)\\)");

    static String extractPickup(String content) {
        if (content == null || content.trim().isEmpty()) return "";
        String normalized = content.replace(" · ", "\n").replace('•', '\n');
        java.util.regex.Matcher leg = LEG.matcher(normalized);
        if (!leg.find()) return "";
        int start = leg.end();
        if (!leg.find()) return "";
        return clean(normalized.substring(start, leg.start()));
    }

    private static String clean(String value) {
        String text = value
            .replaceAll("\\s*\\n\\s*", ", ")
            .replaceAll("(?:,\\s*){2,}", ", ")
            .replaceAll("^[,\\s.-]+|[,\\s.-]+$", "")
            .trim();
        if (text.length() < 5 || text.matches(".*(?i)R\\$.*")) return "";
        return text.length() > 220 ? text.substring(0, 220).trim() : text;
    }

    static String extractDestination(String content) {
        if (content == null || content.trim().isEmpty()) return "";
        String normalized = content.replace(" · ", "\n").replace('•', '\n');
        java.util.regex.Matcher leg = java.util.regex.Pattern.compile(
            "(?i)\\d+(?:[.,]\\d+)?\\s*(?:min|minutos?)\\s*\\([^)]*(?:km|m)\\)"
        ).matcher(normalized);
        int addressStart = -1;
        while (leg.find()) addressStart = leg.end();
        if (addressStart < 0 || addressStart >= normalized.length()) return "";

        String tail = normalized.substring(addressStart)
            .replaceAll("(?is)\\b(?:aceitar|recusar|ignorar|confirmar)\\b.*$", "")
            .replaceAll("(?im)^\\s*(?:cart[aã]o verif\\.?|perfil premium|taxa de servi[cç]o.*|tarifa base.*)\\s*$", "")
            .replaceAll("\\s*\\n\\s*", ", ")
            .replaceAll("(?:,\\s*){2,}", ", ")
            .replaceAll("^[,\\s.-]+|[,\\s.-]+$", "")
            .trim();
        if (tail.length() < 5 || tail.matches(".*(?i)R\\$.*")) return "";
        return tail.length() > 220 ? tail.substring(0, 220).trim() : tail;
    }
}
