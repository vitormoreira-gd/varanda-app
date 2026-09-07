// Calendário de mês, com datas indisponíveis desabilitadas.
//
// POR QUE NÃO O DateTimePicker NATIVO. Ele continua sendo o certo pra reunião
// (data + hora, e qualquer dia serve). Aqui o requisito é outro: o morador
// precisa ver quais dias o salão já está ocupado ANTES de pedir. Hoje ele
// descobre o conflito só depois de enviar, pelo erro 23505 traduzido em "Data
// indisponível" — e sem saber quais datas tentar. O `@react-native-community/
// datetimepicker` só aceita minimumDate/maximumDate: não há como desabilitar
// um dia solto no meio do mês.
//
// POR QUE NÃO UMA BIBLIOTECA. `react-native-calendars` faria isso de fábrica,
// mas o projeto já recusou dependência nova em situação parecida (ver
// armadilha nº20) e uma grade de mês é aritmética de calendário, não física
// de gesto. São ~60 linhas de lógica e o controle visual fica inteiro aqui.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores, espaco, raio } from '../lib/tema';
import { INICIAIS_SEMANA, deDataISO, formatarMesAno, hojeISO, paraDataISO } from '../lib/datas';

/** Uma célula da grade. `null` é o preenchimento antes do dia 1. */
type Celula = { iso: string; dia: number } | null;

function gradeDoMes(ano: number, mes: number): Celula[] {
  const primeiro = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  // Casas vazias até cair no dia da semana correto. `getDay()` já devolve
  // 0 = domingo, que é a ordem do cabeçalho.
  const celulas: Celula[] = Array(primeiro.getDay()).fill(null);
  for (let dia = 1; dia <= diasNoMes; dia++) {
    celulas.push({ iso: paraDataISO(new Date(ano, mes, dia)), dia });
  }
  return celulas;
}

export default function Calendario({
  valor,
  aoEscolher,
  indisponiveis,
  mesesAFrente = 6,
}: {
  /** Data escolhida, YYYY-MM-DD, ou null se ainda não escolheu. */
  valor: string | null;
  aoEscolher: (iso: string) => void;
  /** Datas YYYY-MM-DD que não podem ser escolhidas. */
  indisponiveis: ReadonlySet<string>;
  /** Até quantos meses à frente dá pra navegar. */
  mesesAFrente?: number;
}) {
  const hoje = hojeISO();
  const inicial = valor ? deDataISO(valor) : new Date();
  const [ano, setAno] = useState(inicial.getFullYear());
  const [mes, setMes] = useState(inicial.getMonth());

  const celulas = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);

  const agora = new Date();
  const limite = new Date(agora.getFullYear(), agora.getMonth() + mesesAFrente, 1);
  const temAnterior = ano > agora.getFullYear() || (ano === agora.getFullYear() && mes > agora.getMonth());
  const temSeguinte = ano < limite.getFullYear() || (ano === limite.getFullYear() && mes < limite.getMonth());

  function andar(passo: number) {
    const d = new Date(ano, mes + passo, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <View style={styles.base}>
      <View style={styles.cabecalho}>
        <Pressable onPress={() => andar(-1)} disabled={!temAnterior} hitSlop={12}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={temAnterior ? cores.primaria : cores.borda}
          />
        </Pressable>
        <Text style={styles.mes}>{formatarMesAno(ano, mes)}</Text>
        <Pressable onPress={() => andar(1)} disabled={!temSeguinte} hitSlop={12}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={temSeguinte ? cores.primaria : cores.borda}
          />
        </Pressable>
      </View>

      <View style={styles.semana}>
        {INICIAIS_SEMANA.map((inicial, i) => (
          <Text key={i} style={styles.diaSemana}>
            {inicial}
          </Text>
        ))}
      </View>

      <View style={styles.grade}>
        {celulas.map((celula, i) => {
          if (!celula) return <View key={`vazio-${i}`} style={styles.celula} />;

          const ocupada = indisponiveis.has(celula.iso);
          const passada = celula.iso < hoje;
          const bloqueada = ocupada || passada;
          const escolhida = celula.iso === valor;

          return (
            <Pressable
              key={celula.iso}
              style={styles.celula}
              disabled={bloqueada}
              onPress={() => aoEscolher(celula.iso)}
            >
              <View
                style={[
                  styles.dia,
                  escolhida && styles.diaEscolhido,
                  ocupada && styles.diaOcupado,
                ]}
              >
                <Text
                  style={[
                    styles.diaTexto,
                    escolhida && styles.diaTextoEscolhido,
                    bloqueada && styles.diaTextoBloqueado,
                    // Riscado, e não só apagado: apagado se confunde com dia
                    // de outro mês, e o morador ficaria tocando à toa.
                    ocupada && styles.diaTextoOcupado,
                  ]}
                >
                  {celula.dia}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legenda}>
        <View style={[styles.pontinho, { backgroundColor: cores.perigoFundo }]} />
        <Text style={styles.legendaTexto}>data indisponível</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.md,
    backgroundColor: cores.superficie,
    padding: espaco.md,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.xs,
    marginBottom: espaco.md,
  },
  mes: { fontSize: 17, fontWeight: '800', color: cores.texto, textTransform: 'capitalize' },

  semana: { flexDirection: 'row' },
  diaSemana: {
    flexBasis: '14.2857%',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: cores.textoFraco,
    marginBottom: espaco.xs,
  },

  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  celula: { flexBasis: '14.2857%', aspectRatio: 1, padding: 2 },
  dia: {
    flex: 1,
    borderRadius: raio.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaEscolhido: { backgroundColor: cores.primaria },
  diaOcupado: { backgroundColor: cores.perigoFundo },
  diaTexto: { fontSize: 16, color: cores.texto, fontWeight: '600' },
  diaTextoEscolhido: { color: cores.textoClaro, fontWeight: '800' },
  diaTextoBloqueado: { color: cores.textoFraco, opacity: 0.5 },
  diaTextoOcupado: {
    color: cores.perigo,
    opacity: 1,
    textDecorationLine: 'line-through',
  },

  legenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    marginTop: espaco.md,
  },
  pontinho: { width: 12, height: 12, borderRadius: 3 },
  legendaTexto: { fontSize: 13, color: cores.textoFraco },
});
