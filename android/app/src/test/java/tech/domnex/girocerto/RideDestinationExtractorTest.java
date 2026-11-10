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
            RideDestinationExtractor.extractDestination(content)
        );
    }

    @Test
    public void returnsEmptyWhenNoLegMarkerExists() {
        assertEquals("", RideDestinationExtractor.extractDestination("R$ 14,80 6,9 km Aceitar"));
    }

    @Test
    public void extractsPickupAndDestinationFromNinetyNineScreen() {
        String content = "Moto · Exclusivo · R$ 15 · Est. de R$0,86/km · 4,77 (869) · 6 min (3.0 km) · "
            + "Rua Deputado Orlando Jurca, · Subsetor Norte Dez, Ribeirão Preto · 22 minutos (14.4 km) · "
            + "Rua Marechal Milton Freitas de Almeida, 934, Subsetor Oeste Sete, · Ribeirão Preto · Aceitar";

        assertEquals(
            "Rua Deputado Orlando Jurca, Subsetor Norte Dez, Ribeirão Preto",
            RideDestinationExtractor.extractPickup(content)
        );
        assertEquals(
            "Rua Marechal Milton Freitas de Almeida, 934, Subsetor Oeste Sete, Ribeirão Preto",
            RideDestinationExtractor.extractDestination(content)
        );
    }

    @Test
    public void pickupIsEmptyWithSingleLeg() {
        assertEquals("", RideDestinationExtractor.extractPickup("R$ 9 · 5 min (2 km) · Rua A, 10 · Aceitar"));
    }
}
