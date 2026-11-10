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
  passengerRating?: number;
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

export interface CopilotLogEntry {
  at: string;
  event: string;
  source: string;
  detail: string;
  raw: string;
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
  showTargetBar(options: { title: string; body: string }): Promise<{ shown: boolean }>;
  hideTargetBar(): Promise<void>;
  disableAccessibility(): Promise<{ disabled: boolean }>;
  getCopilotLog(): Promise<{ entries: CopilotLogEntry[] }>;
  clearCopilotLog(): Promise<void>;
  saveRideCriteria(options: {
    minProfitPerKm: number;
    minProfitPerHour: number;
    minAcceptableValue: number;
    costPerKm: number;
    minPassengerRating?: number;
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
  const distanceValues = Array.from(content.matchAll(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/gi))
    .map((match) => {
      const value = parseNumber(match[1]);
      return match[2].toLowerCase() === 'm' ? value / 1000 : value;
    })
    .filter(Number.isFinite);

  return {
    ...offer,
    fareOffered: fareMatch ? parseNumber(fareMatch[1]) : undefined,
    distanceToPickup: distanceValues[0],
    tripDistance:
      distanceValues[1] ?? (distanceValues.length === 1 ? distanceValues[0] : undefined),
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
  minPassengerRating?: number;
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

export async function showTargetBar(title: string, body: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.showTargetBar({ title, body })).shown;
}

export async function hideTargetBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.hideTargetBar();
}

export async function disableRideAccessibility(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await RideOffer.disableAccessibility()).disabled;
}

export async function getCopilotLog(): Promise<CopilotLogEntry[]> {
  if (!Capacitor.isNativePlatform()) return [];
  return (await RideOffer.getCopilotLog()).entries;
}

export async function clearCopilotLog(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await RideOffer.clearCopilotLog();
}
