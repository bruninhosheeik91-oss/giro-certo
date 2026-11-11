export type ReportsMode = 'mensal' | 'apps' | 'anual' | 'consumo';

let pending: ReportsMode | null = null;

/** Abre Relatórios já na aba Consumo. */
export function openFuelConsumption(setActiveTab: (tab: 'relatorios') => void) {
  pending = 'consumo';
  setActiveTab('relatorios');
}

export function takePendingReportsMode(): ReportsMode {
  const m = pending ?? 'mensal';
  pending = null;
  return m;
}
