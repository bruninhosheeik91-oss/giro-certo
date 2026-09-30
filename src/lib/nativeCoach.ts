import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeCoachPlugin {
  speak(options: { text: string }): Promise<void>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  notify(options: { title: string; body: string }): Promise<void>;
}

const NativeCoach = registerPlugin<NativeCoachPlugin>('NativeCoach');

export async function speakGoalCoach(text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NativeCoach.speak({ text });
    return;
  }
  if (!('speechSynthesis' in window)) throw new Error('Áudio indisponível neste dispositivo.');
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'pt-BR';
  speech.rate = 0.95;
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
