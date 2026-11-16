const REGRAS = [
  ['Itens analisados', 'Todos os cadastros de Despesas Fixas desta página. Cadastros inativos aparecem, mas não somam na previsão.'],
  ['Origem do cadastro', 'Centro de custo, conta do plano de contas, empresa e forma de pagamento informados no próprio cadastro da despesa fixa.'],
  ['Média mensal prevista', 'Valor esperado do cadastro convertido para mês: semanal × 52 ÷ 12, mensal × 1, trimestral ÷ 3, anual ÷ 12. É previsão, não pagamento.'],
  ['Pagamentos identificados', 'Débitos do extrato bancário e compras do cartão dos 12 meses cuja descrição contém todas as palavras da palavra-chave do cadastro, respeitando forma de pagamento, conta e empresa. Ficam de fora pagamentos de fatura, estornos, transferências internas, aplicações e resgates. Cada lançamento conta para uma única despesa: a de palavra-chave mais específica.'],
  ['Média mensal paga', 'Soma dos pagamentos identificados no período ÷ 12 meses, mesmo quando houve pagamento em menos meses.'],
  ['Origem nos pagamentos', 'Canal (extrato ou cartão), conta bancária e a classificação que concentra o maior valor entre os lançamentos identificados.'],
  ['Participação', 'Média mensal do item ÷ soma das médias de todos os itens da mesma base (prevista ou paga). A barra é proporcional ao maior item da lista.'],
  ['Identificado × conciliado', 'Identificado é evidência pela descrição do lançamento. Conciliado é somente o valor com documento de despesa vinculado ao cadastro pela baixa.'],
];

export default function AnaliseFixasRegra() {
  return (
    <dl className="grid gap-x-8 gap-y-3 rounded-lg bg-muted/50 p-4 text-xs sm:grid-cols-2">
      {REGRAS.map(([titulo, texto]) => (
        <div key={titulo}>
          <dt className="font-semibold">{titulo}</dt>
          <dd className="mt-0.5 leading-relaxed text-muted-foreground">{texto}</dd>
        </div>
      ))}
    </dl>
  );
}