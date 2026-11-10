package tech.domnex.girocerto;

import android.content.SharedPreferences;

/** Regras puras de decisão: compara a oferta com os critérios do motorista. */
final class RideOfferEvaluator {
    private RideOfferEvaluator() { }

    static final String GOOD = "COMPENSA";
    static final String MEDIUM = "ATENÇÃO";
    static final String BAD = "NÃO COMPENSA";

    static final class Criteria {
        double costPerKm = 0.28;
        double minProfitPerKm = 0.8;
        double minProfitPerHour = 25;
        double minAcceptableValue = 8;
        double minPassengerRating = 4.7;

        static Criteria from(SharedPreferences prefs) {
            Criteria c = new Criteria();
            c.costPerKm = prefs.getFloat("costPerKm", 0.28f);
            c.minProfitPerKm = prefs.getFloat("minProfitPerKm", 0.8f);
            c.minProfitPerHour = prefs.getFloat("minProfitPerHour", 25f);
            c.minAcceptableValue = prefs.getFloat("minAcceptableValue", 8f);
            c.minPassengerRating = prefs.getFloat("minPassengerRating", 4.7f);
            return c;
        }
    }

    static final class Evaluation {
        double fare;
        double pickupKm;
        double tripKm;
        double pickupMinutes;
        double tripMinutes;
        double totalKm;
        double minutes;
        Double rating;
        String pickupAddress = "";
        double profit;
        double profitPerKm;
        double profitPerHour;
        double grossPerKm;
        String status;
        String reason;
    }

    static Evaluation evaluate(RideOfferTextExtractor.Result offer, Criteria criteria) {
        Evaluation e = new Evaluation();
        e.fare = offer.fareOffered == null ? 0 : offer.fareOffered;
        e.pickupKm = offer.distanceToPickupKm == null ? 0 : offer.distanceToPickupKm;
        e.tripKm = offer.tripDistanceKm == null ? 0 : offer.tripDistanceKm;
        e.pickupMinutes = offer.pickupMinutes == null ? 0 : offer.pickupMinutes;
        e.tripMinutes = offer.tripMinutes == null ? 0 : offer.tripMinutes;
        e.totalKm = offer.totalDistanceKm();
        e.minutes = offer.totalMinutes();
        e.rating = offer.passengerRating;
        e.profit = e.fare - e.totalKm * criteria.costPerKm;
        e.profitPerKm = e.totalKm > 0 ? e.profit / e.totalKm : 0;
        e.grossPerKm = e.totalKm > 0 ? e.fare / e.totalKm : 0;
        e.profitPerHour = e.minutes > 0 ? e.profit / (e.minutes / 60d) : 0;

        if (e.fare < criteria.minAcceptableValue) {
            e.status = BAD;
            e.reason = "Abaixo do valor mínimo";
            return e;
        }
        if (e.profit <= 0) {
            e.status = BAD;
            e.reason = "Não cobre o custo";
            return e;
        }
        int fails = 0;
        StringBuilder reason = new StringBuilder();
        if (e.profitPerKm < criteria.minProfitPerKm) { fails++; reason.append("lucro/km baixo"); }
        if (e.minutes > 0 && e.profitPerHour < criteria.minProfitPerHour) {
            fails++;
            if (reason.length() > 0) reason.append(" · ");
            reason.append("lucro/hora baixo");
        }
        if (e.rating != null && e.rating < criteria.minPassengerRating) {
            fails++;
            if (reason.length() > 0) reason.append(" · ");
            reason.append("nota baixa");
        }
        e.status = fails == 0 ? GOOD : fails == 1 ? MEDIUM : BAD;
        e.reason = fails == 0 ? "Dentro dos seus critérios" : reason.toString();
        return e;
    }
}
