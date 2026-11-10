import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SecurityCameraStatus {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  recording: boolean;
  startedAt: number;
  lens: 'front' | 'back';
  audio: boolean;
  lastVideoName: string;
  lastVideoAt: number;
  lastError: string;
}

export interface PanicStatus {
  configured: boolean;
  active: boolean;
  startedAt: number;
  status: string;
  locationGranted: boolean;
}

export interface FloatingButtonState {
  canDraw: boolean;
  enabled: boolean;
}

interface SecurityCameraPlugin {
  requestAccess(): Promise<SecurityCameraStatus>;
  getStatus(): Promise<SecurityCameraStatus>;
  saveSettings(options: { lens: 'front' | 'back'; audio: boolean }): Promise<SecurityCameraStatus>;
  start(): Promise<void>;
  stop(): Promise<void>;
  consumeOpenRequest(): Promise<{ open: boolean }>;
  getFloatingButton(): Promise<FloatingButtonState>;
  setFloatingButton(options: { enabled: boolean }): Promise<FloatingButtonState>;
  openOverlaySettings(): Promise<void>;
  openExternal(options: { url: string; package?: string }): Promise<{ opened: boolean }>;
  configurePanic(options: { endpoint: string; anonKey: string; deviceId: string; secret: string }): Promise<PanicStatus>;
  clearPanic(): Promise<PanicStatus>;
  getPanicStatus(): Promise<PanicStatus>;
  requestLocation(): Promise<PanicStatus>;
  triggerPanic(): Promise<PanicStatus>;
  endPanic(): Promise<void>;
}

const SecurityCamera = registerPlugin<SecurityCameraPlugin>('SecurityCamera');

export const isSecurityCameraAvailable = () => Capacitor.isNativePlatform();

export const requestSecurityCameraAccess = () => SecurityCamera.requestAccess();
export const getSecurityCameraStatus = () => SecurityCamera.getStatus();
export const saveSecurityCameraSettings = (lens: 'front' | 'back', audio: boolean) =>
  SecurityCamera.saveSettings({ lens, audio });
export const startSecurityCamera = () => SecurityCamera.start();
export const stopSecurityCamera = () => SecurityCamera.stop();

export async function consumeSecurityOpenRequest(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await SecurityCamera.consumeOpenRequest()).open;
}

export const getFloatingButton = () => SecurityCamera.getFloatingButton();
export const setFloatingButton = (enabled: boolean) => SecurityCamera.setFloatingButton({ enabled });
export const openOverlaySettings = () => SecurityCamera.openOverlaySettings();

export async function openExternal(url: string, packageName?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    window.open(url, '_blank');
    return true;
  }
  return (await SecurityCamera.openExternal({ url, package: packageName })).opened;
}

export const nativePanic = {
  configure: (options: { endpoint: string; anonKey: string; deviceId: string; secret: string }) =>
    SecurityCamera.configurePanic(options),
  clear: () => SecurityCamera.clearPanic(),
  status: () => SecurityCamera.getPanicStatus(),
  requestLocation: () => SecurityCamera.requestLocation(),
  trigger: () => SecurityCamera.triggerPanic(),
  end: () => SecurityCamera.endPanic(),
};
