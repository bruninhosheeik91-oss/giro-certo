import { openExternal, requestSecurityCameraAccess, startSecurityCamera, getSecurityCameraStatus } from './securityCamera';

export interface EmergencyContact {
  name: string;
  phone: string;
}

const CONTACT_KEY = 'giro_certo_emergency_contact_v1';

export function readEmergencyContact(): EmergencyContact | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? 'null') as EmergencyContact | null;
    return parsed && parsed.phone ? parsed : null;
  } catch {
    return null;
  }
}

export function saveEmergencyContact(contact: EmergencyContact | null): void {
  try {
    if (contact) localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
    else localStorage.removeItem(CONTACT_KEY);
  } catch {
    /* só local */
  }
}

/** Normaliza para o formato internacional do WhatsApp (55 + DDD + número). */
export function normalizeBrazilPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits.replace(/^0+/, '')}`;
}

export function getCurrentPosition(timeoutMs = 8000): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

export function buildPanicMessage(position: GeolocationPosition | null, now = new Date()): string {
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const where = position
    ? `Minha localização: https://maps.google.com/?q=${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`
    : 'Não consegui pegar minha localização agora.';
  return `🚨 PRECISO DE AJUDA! Estou em uma corrida e posso estar em perigo. ${where} (enviado pelo Giro Certo às ${time})`;
}

export interface PanicResult {
  recording: boolean;
  location: boolean;
  opened: 'whatsapp' | 'sms' | 'nenhum';
}

/** Liga a câmera, pega a localização e abre o WhatsApp (ou SMS) do contato com a mensagem pronta. */
export async function triggerPanic(contact: EmergencyContact): Promise<PanicResult> {
  let recording = false;
  try {
    const status = await getSecurityCameraStatus();
    const access = status.cameraGranted ? status : await requestSecurityCameraAccess();
    if (access.cameraGranted && !access.recording) await startSecurityCamera();
    recording = access.cameraGranted;
  } catch {
    recording = false;
  }

  const position = await getCurrentPosition();
  const text = buildPanicMessage(position);
  const phone = normalizeBrazilPhone(contact.phone);

  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  if (await openExternal(whatsappUrl, 'com.whatsapp')) {
    return { recording, location: Boolean(position), opened: 'whatsapp' };
  }
  if (await openExternal(whatsappUrl, 'com.whatsapp.w4b')) {
    return { recording, location: Boolean(position), opened: 'whatsapp' };
  }
  const sms = await openExternal(`smsto:+${phone}?body=${encodeURIComponent(text)}`);
  return { recording, location: Boolean(position), opened: sms ? 'sms' : 'nenhum' };
}

export const callPolice = () => openExternal('tel:190');
