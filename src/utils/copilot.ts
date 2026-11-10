import type { NativeCaptureResult } from '../lib/rideOffer';
import type { RideCriteria } from '../types';
import { simulateRide, type RideSimulationResult } from './calculations';

export interface CopilotDefaults {
  costPerKm: number;
  criteria: RideCriteria;
}

export interface CopilotAnalysis {
  complete: boolean;
  missing: string[];
  reason: string;
  appName: string;
  totalDistanceKm: number;
  totalMinutes: number;
  capturedAt: number;
  result: RideSimulationResult | null;
}

/**
 * Converte uma leitura de tela (OCR local) em uma análise financeira usando exatamente
 * os mesmos cálculos do simulador. Nunca inventa dados: quando um campo não foi
 * reconhecido, o resultado bruto é nulo e o motivo é informado.
 */
export function analyzeRideCapture(
  capture: NativeCaptureResult,
  defaults: CopilotDefaults,
): CopilotAnalysis {
  const pickup = capture.distanceToPickupKm ?? 0;
  const trip = capture.tripDistanceKm ?? 0;
  const totalDistanceKm = pickup + trip;
  const totalMinutes = (capture.pickupMinutes ?? 0) + (capture.tripMinutes ?? 0);
  const fare = capture.fareOffered ?? 0;

  const missing: string[] = [];
  if (!(fare > 0)) missing.push('valor');
  if (!(totalDistanceKm > 0)) missing.push('distância');
  if (!(totalMinutes > 0)) missing.push('tempo');
  const complete = missing.length === 0;

  const result = complete
    ? simulateRide({
        fareOffered: fare,
        distanceToPickup: pickup,
        tripDistance: trip,
        returnDistance: 0,
        estimatedMinutes: totalMinutes,
        costPerKm: defaults.costPerKm,
        tollsAndParking: 0,
        criteria: {
          ...defaults.criteria,
          considerReturnDistance: false,
        },
      })
    : null;

  const reason = complete
    ? ''
    : capture.incompleteReason?.trim() ||
      `Análise incompleta: ${missing.join(', ')} não identificado(s) na tela.`;

  return {
    complete,
    missing,
    reason,
    appName: capture.appName,
    totalDistanceKm,
    totalMinutes,
    capturedAt: capture.capturedAt,
    result,
  };
}
