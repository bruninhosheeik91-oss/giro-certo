import { getSupabaseClient } from './auth';

const AVATAR_BUCKET = 'avatars';
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir esta imagem.'));
    };
    image.src = url;
  });
}

async function squareAvatar(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível compactar a imagem.'))),
      'image/webp',
      0.86,
    );
  });
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.');

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase não está configurado.');

  const blob = await squareAvatar(file);
  const path = `${userId}/avatar.webp`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/webp',
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeProfileAvatar(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.webp`]);
  if (error) throw error;
}
