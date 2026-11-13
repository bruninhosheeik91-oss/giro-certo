const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hash32(value: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909) >>> 0;
  hash ^= hash >>> 16;
  // `^` devolve inteiro com sinal: sem `>>> 0` o hex sairia negativo ("-7bb4…"), ID inválido.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function deterministicUuid(value: string): string {
  const hex = [
    hash32(value, 2166136261),
    hash32(`${value}:b`, 3339675911),
    hash32(`${value}:c`, 1013904242),
    hash32(`${value}:d`, 277803737),
  ].join('');
  // UUID v5-like: versão 5 no 13º dígito, variante RFC 4122 no 17º.
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function normalizeUuid(id: string, namespace: string, entityType: string): string {
  return isUuid(id) ? id : deterministicUuid(`${namespace}:${entityType}:${id}`);
}

/** Aceito pelo Postgres: 32 dígitos hex, hífens só entre grupos de 4 e nunca no início/fim ou duplicados. */
export function isPostgresUuid(value: string): boolean {
  return /^[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}$/i.test(value);
}

/** Converte IDs gerados com o bug do sinal em um UUID válido e estável. */
export function repairUuid(value: string): string {
  return isPostgresUuid(value) ? value : deterministicUuid(`repair:${value}`);
}
