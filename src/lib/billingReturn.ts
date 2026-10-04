export const BILLING_RETURN_HOST = 'billing-result';
const RETURN_KEY = 'giro_certo_billing_return_v1';

export function recordBillingReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'tech.domnex.girocerto:' || parsed.hostname !== BILLING_RETURN_HOST) {
      return false;
    }
    localStorage.setItem(RETURN_KEY, new Date().toISOString());
    window.dispatchEvent(new Event('giro-certo:billing-return'));
    return true;
  } catch {
    return false;
  }
}

export function consumeBillingReturn(): boolean {
  try {
    if (!localStorage.getItem(RETURN_KEY)) return false;
    localStorage.removeItem(RETURN_KEY);
    return true;
  } catch {
    return false;
  }
}
