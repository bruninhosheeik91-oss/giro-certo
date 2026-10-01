import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeRideOffer {
  packageName: string;
  appName: string;
  title: string;
  text: string;
  receivedAt: number;
}

export interface RideOfferDraft extends NativeRideOffer {
  fareOffered?: number;
  distanceToPickup?: number;
  tripDistance?: number;
  estimatedMinutes?: number;
}

interface RideOfferPlugin {
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  isOverlayPermissionGranted(): Promise<{ granted: boolean }>;
  openNotificationAccessSettings(): Promise<void>;
  openOverlaySettings(): Promise<void>;
  testOverlay(): Promise<void>;
  getLatestRideOffer(): Promise<{ offer?: NativeRideOffer }>;
  saveRideCriteria(options: {
    minProfitPerKm: number;
    minProfitPerHour: number;
    minAcceptableValue: number;
    costPerKm: number;
  }): Promise<void>;
  addListener(
    eventName: 'rideOffer',
    listener: (offer: NativeRideOffer) => void,
  ): Promise<PluginListenerHandle>;
}

const RideOffer = registerPlugin<RideOfferPlugin>('RideOffer');

function parseNumber(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  return Number.parseFloat(normalized);
}

export function parseRideOfferNotification(offer: NativeRideOffer): RideOfferDraft {
  const content = `${offer.title} ${offer.text}`.replace(/\s+/g, ' ').trim();
  const fareMatch = content.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  const minuteMatch = content.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minutos?)\b/i);
  const kmValues = Array.from(content.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi))
    .map((match) => parseNumber(match[1]))
    .filter(Number.isFinite);

  return {
    ...offer,
    fareOffered: fareMatch ? parseNumber(fareMatch[1]) : undefined,
    distanceToPickup: kmValues[0],
    tripDistance: kmValues[1] ?? (kmValues.length === 1 ? kmValues[0] : undefined),
    estimatedMinutes: minuteMatch ? parseNumber(minuteMatch[1]) : undefined,
  };
}

export function isRideOfferNativeAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isRideOfferAccessGranted(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.isNotificationAccessGranted()).granted;
}

export async function openRideOfferAccessSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.openNotificationAccessSettings();
}

export async function isRideOverlayGranted(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.isOverlayPermissionGranted()).granted;
}

export async function openRideOverlaySettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.openOverlaySettings();
}

export async function testRideOverlay(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.testOverlay();
}

export async function saveNativeRideCriteria(options: {
  minProfitPerKm: number;
  minProfitPerHour: number;
  minAcceptableValue: number;
  costPerKm: number;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.saveRideCriteria(options);
}

export async function getLatestRideOffer(): Promise<NativeRideOffer | null> {
  if (!Capacitor.isNativePlatform()) return null;
  return (await RideOffer.getLatestRideOffer()).offer ?? null;
}

export async function listenForRideOffers(
  listener: (offer: NativeRideOffer) => void,
): Promise<PluginListenerHandle | null> {
  if (!Capacitor.isNativePlatform()) return null;
  return RideOffer.addListener('rideOffer', listener);
}
