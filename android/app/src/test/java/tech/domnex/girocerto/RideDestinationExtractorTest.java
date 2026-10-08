package tech.domnex.girocerto;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class RideDestinationExtractorTest {
    @Test
    public void extractsLastLegAddressFromOcr() {
        String content = "Entrega Moto\nR$ 7,50\n4 min (947 m)\nRua Valentina Lanzone, 365\n"
            + "11 min (7,4 km)\nAvenida Dr Francisco Junqueira, 2030\nCampos Elíseos\nAceitar";

        assertEquals(
            "Avenida Dr Francisco Junqueira, 2030, Campos Elíseos",
            RideNotificationListenerService.extractDestination(content)
        );
    }

    @Test
    public void returnsEmptyWhenNoLegMarkerExists() {
        assertEquals("", RideNotificationListenerService.extractDestination("R$ 14,80 6,9 km Aceitar"));
    }
}
