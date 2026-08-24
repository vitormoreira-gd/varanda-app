// Formatação de data/hora sem depender de Intl (suporte varia entre Hermes/Android/iOS).

const DOIS = (n: number) => String(n).padStart(2, '0');
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Iniciais dos dias da semana, domingo primeiro — cabecalho do calendario. */
export const INICIAIS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Data no formato que a coluna `date` do Postgres espera (YYYY-MM-DD).
 * Montada a partir dos componentes locais de propósito: `toISOString()`
 * converte pra UTC e, à noite no Brasil, joga a data pro dia seguinte.
 */
export function paraDataISO(d: Date): string {
  return `${d.getFullYear()}-${DOIS(d.getMonth() + 1)}-${DOIS(d.getDate())}`;
}

/** A data de hoje como YYYY-MM-DD, pelos componentes locais. */
export function hojeISO(): string {
  return paraDataISO(new Date());
}

/**
 * "2026-09-20" -> Date local ao meio-dia. O meio-dia e nao a meia-noite de
 * proposito: e o horario que sobrevive a qualquer horario de verao sem a
 * data escorregar um dia pra tras.
 */
export function deDataISO(dataISO: string): Date {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

/** "setembro de 2026", para o cabecalho de um calendario. Sem Intl. */
export function formatarMesAno(ano: number, mes: number): string {
  return `${MESES[mes]} de ${ano}`;
}

/** Formata "2026-09-20" (coluna date) como "sáb, 20/09". Sem fuso no meio. */
export function formatarDataCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  if (!ano || !mes || !dia) return dataISO;
  const d = new Date(ano, mes - 1, dia);
  return `${SEMANA[d.getDay()]}, ${DOIS(dia)}/${DOIS(mes)}`;
}

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

/**
 * Timestamp com dia da semana, pra data futura: "sex, 29/08 · 19:00".
 * Reunião e prazo de votação são compromissos — saber que cai numa sexta
 * importa mais do que saber o ano.
 */
export function formatarCompromisso(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dia = `${SEMANA[d.getDay()]}, ${DOIS(d.getDate())}/${DOIS(d.getMonth() + 1)}`;
  return `${dia} · ${DOIS(d.getHours())}:${DOIS(d.getMinutes())}`;
}

/**
 * Só a data de um timestamp: "29/08/2026".
 * Existe pra substituir `toLocaleString('pt-BR')`, que dependia de Intl —
 * o resto do arquivo evita Intl de propósito (suporte varia no Hermes).
 */
export function formatarData(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${DOIS(d.getDate())}/${DOIS(d.getMonth() + 1)}/${d.getFullYear()}`;
}
