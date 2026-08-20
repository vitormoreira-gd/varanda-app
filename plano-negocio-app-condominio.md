# Plano de Negócio — App de Comunicação para Condomínios

*Rascunho para avaliação futura — versão inicial, sem validação de campo.*

## 1. Proposta de valor

App de comunicação para condomínios, posicionado como substituto do grupo de WhatsApp: avisos, ocorrências, autorizações de portaria, reservas de área comum, centralizando o que hoje é informal e disperso.

**Concorrente real não é outro software — é o grupo de WhatsApp grátis.** Isso define toda a estratégia: o produto precisa vencer por hábito e conveniência, não por lista de features.

## 2. Modelo de cobrança

- **R$ 5,00 por condômino/mês**, cobrado do condomínio (não do morador individualmente).
- Condomínio médio de 100 unidades → R$ 500/mês.
- Comparado ao mercado (sistemas de gestão condominial no Brasil vão de R$ 49 a R$ 2.000/mês), o preço está competitivo — principalmente por cobrir só comunicação, não gestão financeira/fiscal completa.

## 3. Estimativa de receita (cenários)

| Condomínios ativos | Receita mensal (base 100 un./condomínio) |
|---|---|
| 10 | R$ 5.000 |
| 50 | R$ 25.000 |
| 200 | R$ 100.000 |

*Números ilustrativos — dependem de retenção real e não consideram churn.*

## 4. Estrutura de custos

| Item | Peso | Observação |
|---|---|---|
| Infra/hosting | Baixo | Escala bem, provavelmente < R$0,50/unidade/mês |
| Pagamento/cobrança | Médio | Taxa de gateway (2–4%) + risco de inadimplência do condomínio |
| Suporte/onboarding | **Alto** | Síndico não é usuário técnico; exige treinamento e suporte humano — não escala como software puro |
| Comercial/vendas | **Alto** | Ciclo de venda longo; decisão passa por assembleia |

**Principal gargalo do negócio: custo de suporte e vendas, não infraestrutura.**

## 5. Principal barreira identificada

Gasto novo em condomínio geralmente exige **aprovação em assembleia**, o que trava ou atrasa a conversão mesmo quando o síndico está convencido individualmente.

## 6. Estratégia de trial (modelo definido na conversa)

**Trial condicional de engajamento:**
1. 3 meses grátis para todo condomínio que entrar.
2. Se houver adesão medida por critério objetivo (ex: % de moradores cadastrados, nº de avisos publicados, % de abertura do app), estende para 6 meses.
3. Ao fim do período estendido, oferece plano pago completo ao síndico.

**Por que funciona:**
- Contorna a barreira da assembleia no primeiro contato (síndico testa sem precisar aprovar gasto).
- Cria hábito e custo de troca durante o período grátis — moradores migram do WhatsApp, e isso é o que retém de fato.
- Segmenta esforço comercial: quem engaja recebe mais investimento seu, quem não engaja sai do funil mais cedo.

**Pontos em aberto a definir antes de rodar:**
- Critério de adesão precisa ser objetivo, mensurável e **comunicado ao síndico desde o início** (não decidido depois, para não parecer mudança de regra).
- Definir o que fazer com quem não atinge o critério em 3 meses — cortar direto vs. investigar causa (ex: falta de divulgação interna) antes de descartar.
- Antecipar a conversa de aprovação formal: provocar o síndico a levar a proposta à assembleia **no mês 5**, não esperar o trial acabar (senão perde o momentum).

## 7. Riscos principais

- Baixa disposição a pagar por algo que já existe "de graça" (grupo de WhatsApp).
- Ciclo de decisão lento (dependência de assembleia).
- Custo de suporte pode não escalar tão bem quanto a receita, especialmente em fase inicial com poucos condomínios.
- Inadimplência do condomínio (histórico comum no setor).

## 8. Próximos passos sugeridos (para validação, não para decidir agora)

- Testar apetite de compra com síndicos/imobiliárias reais antes de investir em desenvolvimento completo.
- Definir e testar o critério de engajamento do trial com um grupo piloto pequeno.
- Avaliar modelo alternativo (freemium: base grátis para síndico, upsell pago em features específicas) como comparação ao modelo atual de cobrança direta.

---
*Documento gerado a partir de conversa exploratória em 20/08/2026. Estimativas não validadas com dados reais de mercado ou custos operacionais específicos do projeto.*
