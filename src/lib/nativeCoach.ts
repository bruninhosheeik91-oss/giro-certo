import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeCoachPlugin {
  speak(options: { text: string; voiceId?: string; rate?: number; pitch?: number }): Promise<void>;
  listVoices(): Promise<{ voices: Array<{ id: string; name: string }> }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  notify(options: { title: string; body: string }): Promise<void>;
}

const NativeCoach = registerPlugin<NativeCoachPlugin>('NativeCoach');

export interface CoachVoicePreferences {
  voiceId?: string;
  rate: number;
  pitch: number;
  greetingEnabled: boolean;
}

const VOICE_PREFS_KEY = 'giro_certo_coach_voice_v1';

export function getCoachVoicePreferences(): CoachVoicePreferences {
  try {
    return { rate: 0.95, pitch: 0.92, greetingEnabled: true, ...JSON.parse(localStorage.getItem(VOICE_PREFS_KEY) ?? '{}') };
  } catch {
    return { rate: 0.95, pitch: 0.92, greetingEnabled: true };
  }
}

export function saveCoachVoicePreferences(value: CoachVoicePreferences): void {
  localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(value));
}

export async function listCoachVoices(): Promise<Array<{ id: string; name: string }>> {
  if (!Capacitor.isNativePlatform()) return [];
  return (await NativeCoach.listVoices()).voices;
}

export async function speakGoalCoach(text: string): Promise<void> {
  const preferences = getCoachVoicePreferences();
  if (Capacitor.isNativePlatform()) {
    await NativeCoach.speak({ text, ...preferences });
    return;
  }
  if (!('speechSynthesis' in window)) throw new Error('Áudio indisponível neste dispositivo.');
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'pt-BR';
  speech.rate = preferences.rate;
  speech.pitch = preferences.pitch;
  window.speechSynthesis.speak(speech);
}

export async function requestGoalNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return (await NativeCoach.requestNotificationPermission()).granted;
  }
  if (!('Notification' in window)) return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function showGoalNotification(title: string, body: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NativeCoach.notify({ title, body });
    return;
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  }
}
