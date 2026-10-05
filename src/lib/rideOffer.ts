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

export interface AnalyzedRideOffer {
  id: string;
  appName: string;
  fare: number;
  totalKm: number;
  minutes: number;
  profit: number;
  profitPerKm: number;
  profitPerHour: number;
  status: 'COMPENSA' | 'ATENÇÃO' | 'NÃO COMPENSA';
  analyzedAt: number;
  convertedAt?: number;
}

export interface AnalyzerDiagnostic {
  analyzed: boolean;
  source: 'notification' | 'accessibility' | string;
  message: string;
  preview: string;
  at: number;
}

interface RideOfferPlugin {
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  isOverlayPermissionGranted(): Promise<{ granted: boolean }>;
  openNotificationAccessSettings(): Promise<void>;
  isAccessibilityAccessGranted(): Promise<{ granted: boolean }>;
  openAccessibilitySettings(): Promise<void>;
  requestAnalyzerNotificationPermission(): Promise<{ granted: boolean }>;
  openOverlaySettings(): Promise<void>;
  testOverlay(options: {
    fare: number;
    body: string;
    status: 'COMPENSA' | 'ATENÇÃO' | 'NÃO COMPENSA';
  }): Promise<void>;
  getOfferHistory(): Promise<{ offers: AnalyzedRideOffer[] }>;
  getAnalyzerDiagnostic(): Promise<{ diagnostic?: AnalyzerDiagnostic }>;
  clearOfferHistory(): Promise<void>;
  markOfferConverted(options: { offerId: string }): Promise<void>;
  getAnalyzerEnabled(): Promise<{ enabled: boolean }>;
  setAnalyzerEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  setProEntitlement(options: { enabled: boolean; expiresAt: number }): Promise<void>;
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
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  return Number.parseFloat(normalized);
}

export function parseRideOfferNotification(offer: NativeRideOffer): RideOfferDraft {
  const content = `${offer.title} ${offer.text}`.replace(/\s+/g, ' ').trim();
  const fareMatch = content.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  const minuteValues = Array.from(content.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:min|minutos?)\b/gi))
    .map((match) => parseNumber(match[1]))
    .filter(Number.isFinite);
  const kmValues = Array.from(content.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi))
    .map((match) => parseNumber(match[1]))
    .filter(Number.isFinite);

  return {
    ...offer,
    fareOffered: fareMatch ? parseNumber(fareMatch[1]) : undefined,
    distanceToPickup: kmValues[0],
    tripDistance: kmValues[1] ?? (kmValues.length === 1 ? kmValues[0] : undefined),
    estimatedMinutes:
      minuteValues.length > 0 ? minuteValues.reduce((total, value) => total + value, 0) : undefined,
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

export async function isRideAccessibilityGranted(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.isAccessibilityAccessGranted()).granted;
}

export async function openRideAccessibilitySettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.openAccessibilitySettings();
}

export async function requestAnalyzerNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.requestAnalyzerNotificationPermission()).granted;
}

export async function isRideOverlayGranted(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.isOverlayPermissionGranted()).granted;
}

export async function openRideOverlaySettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.openOverlaySettings();
}

export async function testRideOverlay(options: {
  fare: number;
  body: string;
  status: 'COMPENSA' | 'ATENÇÃO' | 'NÃO COMPENSA';
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.testOverlay(options);
}

export async function getRideOfferHistory(): Promise<AnalyzedRideOffer[]> {
  if (!Capacitor.isNativePlatform()) return [];
  return (await RideOffer.getOfferHistory()).offers;
}

export async function getAnalyzerDiagnostic(): Promise<AnalyzerDiagnostic | null> {
  if (!Capacitor.isNativePlatform()) return null;
  return (await RideOffer.getAnalyzerDiagnostic()).diagnostic ?? null;
}

export async function clearRideOfferHistory(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.clearOfferHistory();
}

export async function markRideOfferConverted(offerId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.markOfferConverted({ offerId });
}

export async function getRideAnalyzerEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.getAnalyzerEnabled()).enabled;
}

export async function setRideAnalyzerEnabled(enabled: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.setAnalyzerEnabled({ enabled })).enabled;
}

export async function setRideProEntitlement(enabled: boolean, expiresAt: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.setProEntitlement({ enabled, expiresAt });
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
