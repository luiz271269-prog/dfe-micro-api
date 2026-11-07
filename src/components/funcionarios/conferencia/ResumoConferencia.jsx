import { reais, dataBR, competenciaBR, CATEGORIAS, TIPOS } from './rotulosConferencia';

const Bloco = ({ titulo, linhas }) => <div className="rounded-xl border bg-card p-4">
  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
  {linhas.length ? linhas.map(([k, v]) => <div key={k} className="flex justify-between py-0.5 text-sm"><span>{k}</span><span className="tabular-nums font-medium">{v}</span></div>) : <p className="text-sm text-muted-foreground">—</p>}
</div>;

export default function ResumoConferencia({ data }) {
  const t = data.totais, j = data.janela;
  return <div className="space-y-3">
    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
      Competência <b>{competenciaBR(data.competencia)}</b> · gerada neste mês · pagamento esperado em <b>{competenciaBR(j.mes_pagamento)}</b>, a partir do 5º dia útil (<b>{dataBR(j.inicio)}</b>; prazo até o 7º, {dataBR(j.fim)}). Adiantamentos são esperados dentro da própria competência.
    </div>
    <div className="grid gap-3 md:grid-cols-4">
      <Bloco titulo="Totais" linhas={[['Líquido cadastrado', reais(t.liquido)], ['Líquido pela composição', reais(t.calculado)], ['Pagamentos no banco', reais(t.pagamento_banco)], ['Saldo pelo banco', reais(t.saldo_por_banco)]]} />
      <Bloco titulo="Por tipo de folha" linhas={Object.entries(data.por_tipo).map(([k, v]) => [`${TIPOS[k] || k} (${v.count})`, reais(v.liquido)])} />
      <Bloco titulo="Por tipo de pagamento" linhas={Object.entries(data.por_categoria).map(([k, v]) => [`${CATEGORIAS[k]} (${v.count})`, reais(v.valor)])} />
      <Bloco titulo="Por forma cadastrada" linhas={Object.entries(data.por_forma).map(([k, v]) => [`${k === 'nao_informada' ? 'Não informada' : k} (${v.count})`, reais(v.liquido)])} />
    </div>
    <p className="text-xs text-muted-foreground">Pago informado no cadastro ({reais(t.informado)}) e baixas manuais ({reais(t.manuais)}) aparecem à parte e não são somados ao banco. Adiantamentos vinculados: {reais(t.adiantamento)}.</p>
  </div>;
}