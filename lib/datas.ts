// Formatação de data/hora sem depender de Intl (suporte varia entre Hermes/Android/iOS).

const DOIS = (n: number) => String(n).padStart(2, '0');

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
