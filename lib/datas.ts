// Formatação de data/hora sem depender de Intl (suporte varia entre Hermes/Android/iOS).

const DOIS = (n: number) => String(n).padStart(2, '0');

/** Dias inteiros entre uma data ISO e agora. Negativo vira 0. */
export function diasDesde(iso: string, agora: Date = new Date()): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const dias = Math.floor((agora.getTime() - d.getTime()) / 86400000);
  return dias > 0 ? dias : 0;
}

/** "hoje" · "há 1 dia" · "há 12 dias" */
export function emDias(dias: number): string {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  return `há ${dias} dias`;
}

/** Ex: "hoje, 14:32" · "ontem, 09:05" · "18/08, 14:32" · "18/08/2025, 14:32" (outro ano) */
export function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';

  const hora = `${DOIS(d.getHours())}:${DOIS(d.getMinutes())}`;
  const agora = new Date();

  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (mesmoDia(d, agora)) return `hoje, ${hora}`;

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (mesmoDia(d, ontem)) return `ontem, ${hora}`;

  const dataCurta = `${DOIS(d.getDate())}/${DOIS(d.getMonth() + 1)}`;
  if (d.getFullYear() === agora.getFullYear()) return `${dataCurta}, ${hora}`;
  return `${dataCurta}/${d.getFullYear()}, ${hora}`;
}
