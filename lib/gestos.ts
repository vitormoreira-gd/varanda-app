import { useCallback, useEffect, useRef } from 'react';

/** Janela em que o segundo toque ainda conta como duplo. */
const JANELA_MS = 260;

/**
 * Distingue toque simples de toque duplo na mesma superfície.
 *
 * O preço: quando existe ação de toque simples, ela precisa esperar a janela
 * fechar antes de disparar — senão o primeiro toque de um duplo já teria
 * aberto o post. Onde não há ação simples (post já aberto), o duplo responde
 * na hora.
 */
export function useToqueDuplo(
  aoToqueSimples: (() => void) | undefined,
  aoToqueDuplo: () => void
) {
  const ultimoToque = useRef(0);
  const agendado = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sem isto, um toque simples agendado dispararia depois do componente sair
  // da árvore — abrindo um post que já não está na lista, por exemplo.
  useEffect(
    () => () => {
      if (agendado.current) clearTimeout(agendado.current);
    },
    []
  );

  return useCallback(() => {
    const agora = Date.now();

    if (agora - ultimoToque.current < JANELA_MS) {
      ultimoToque.current = 0;
      if (agendado.current) {
        clearTimeout(agendado.current);
        agendado.current = null;
      }
      aoToqueDuplo();
      return;
    }

    ultimoToque.current = agora;
    if (aoToqueSimples) {
      agendado.current = setTimeout(() => {
        agendado.current = null;
        aoToqueSimples();
      }, JANELA_MS);
    }
  }, [aoToqueSimples, aoToqueDuplo]);
}
