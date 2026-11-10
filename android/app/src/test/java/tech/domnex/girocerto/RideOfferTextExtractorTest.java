package tech.domnex.girocerto;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class RideOfferTextExtractorTest {
    @Test
    public void extractsFarePickupAndTripLegs() {
        String ocr = "Uber\nR$ 28,50\n2,5 km até a coleta\n"
            + "8 km de viagem\n3 min\n25 min\nAceitar";

        RideOfferTextExtractor.Result result = RideOfferTextExtractor.extract(ocr);

        assertEquals(28.5, result.fareOffered, 0.001);
        assertEquals(2.5, result.distanceToPickupKm, 0.001);
        assertEquals(8.0, result.tripDistanceKm, 0.001);
        assertEquals(3.0, result.pickupMinutes, 0.001);
        assertEquals(25.0, result.tripMinutes, 0.001);
        assertEquals(10.5, result.totalDistanceKm(), 0.001);
        assertTrue(result.complete);
        assertEquals("", result.incompleteReason);
    }

    @Test
    public void convertsMetersToKilometersForPickup() {
        String ocr = "Entrega Moto · R$ 7,50 · 4 min (947 m) · 11 min (7,4 km) · Aceitar";

        RideOfferTextExtractor.Result result = RideOfferTextExtractor.extract(ocr);

        assertEquals(7.5, result.fareOffered, 0.001);
        assertEquals(0.947, result.distanceToPickupKm, 0.001);
        assertEquals(7.4, result.tripDistanceKm, 0.001);
        assertEquals(15.0, result.totalMinutes(), 0.001);
        assertTrue(result.complete);
    }

    @Test
    public void flagsIncompleteWhenDistanceIsMissing() {
        RideOfferTextExtractor.Result result = RideOfferTextExtractor.extract("R$ 12,00 · 10 min");

        assertEquals(12.0, result.fareOffered, 0.001);
        assertFalse(result.complete);
        assertTrue(result.incompleteReason.contains("distância"));
    }

    @Test
    public void flagsIncompleteWhenNothingIsRecognized() {
        RideOfferTextExtractor.Result result = RideOfferTextExtractor.extract("   ");

        assertFalse(result.complete);
        assertTrue(result.incompleteReason.contains("Nenhum texto"));
    }

    @Test
    public void readsNinetyNineOfferWithRatingAndPerKmEstimate() {
        String screen = "Moto · Exclusivo · R$ 15 · Est. de R$0,86/km · 4,77 (869) · "
            + "6 min (3.0 km) · Rua Deputado Orlando Jurca · 22 minutos (14.4 km) · "
            + "Rua Marechal Milton Freitas de Almeida, 934 · Aceitar";

        RideOfferTextExtractor.Result result = RideOfferTextExtractor.extract(screen);

        assertEquals(15.0, result.fareOffered, 0.001);
        assertEquals(3.0, result.distanceToPickupKm, 0.001);
        assertEquals(14.4, result.tripDistanceKm, 0.001);
        assertEquals(28.0, result.totalMinutes(), 0.001);
        assertEquals(4.77, result.passengerRating, 0.001);
        assertTrue(result.complete);
    }

    @Test
    public void readsStarRating() {
        RideOfferTextExtractor.Result result = RideOfferTextExtractor.extract(
            "UberX R$ 22,40 ★ 4.91 5 min (1,2 km) 18 min (9,8 km) Aceitar");

        assertEquals(22.4, result.fareOffered, 0.001);
        assertEquals(4.91, result.passengerRating, 0.001);
    }
}
