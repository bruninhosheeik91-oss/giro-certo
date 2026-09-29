/**
 * Tradução das mensagens de erro do Supabase Auth.
 *
 * O `supabase-js` devolve texto em inglês. A tela de autenticação é em
 * português e o texto cru ("Invalid login credentials") não diz nada ao
 * motorista, então as mensagens conhecidas são traduzidas aqui. O texto
 * original continua sendo o último recurso para erro desconhecido.
 */
const MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar.'],
  [/user already registered/i, 'Este e-mail já está cadastrado. Tente entrar.'],
  [/unable to validate email|invalid email/i, 'E-mail inválido. Confira o endereço digitado.'],
  [/email address .* not authorized|not authorized/i, 'Use o e-mail que você cadastrou.'],
  [
    /password should be at least|minimum password length|at least 6 characters/i,
    'A senha deve ter pelo menos 6 caracteres.',
  ],
  [/new password should be different from the old password/i, 'A nova senha deve ser diferente da atual.'],
  [/same as the old password/i, 'A nova senha deve ser diferente da atual.'],
  [/new password matches.*otp|token has expired or is invalid|invalid otp/i, 'O link expirou. Peça um novo.'],
  [
    /rate limit|too many requests|for security purposes/i,
    'Muitas tentativas. Aguarde alguns instantes e tente de novo.',
  ],
  [
    /failed to fetch|network|fetch failed|networkerror|load failed/i,
    'Falha de conexão. Verifique sua internet e tente novamente.',
  ],
  [/over email send rate limit|email rate limit/i, 'Muitos e-mails enviados. Aguarde antes de tentar de novo.'],
  [/signups not allowed|signup is disabled/i, 'O cadastro está desativado neste momento.'],
  [/password recovery.*expired|otp expired/i, 'O link expirou. Peça um novo.'],
  [/database error|unexpected failure|unexpected error/i, 'Falha inesperada. Tente novamente em instantes.'],
];

export function translateAuthError(message: string, fallback: string): string {
  const normalized = message.trim();
  if (!normalized) return fallback;
  for (const [pattern, translated] of MESSAGES) {
    if (pattern.test(normalized)) return translated;
  }
  return normalized;
}
