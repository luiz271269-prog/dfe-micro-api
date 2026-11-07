import NaturezaChip from './NaturezaChip';
import OrigemNatureza from './OrigemNatureza';
import { reais, dataBR, competenciaBR } from './rotulosConferencia';

export default function ForaJanelaConferencia({ itens, janela, competencia }) {
  if (!itens?.length) return null;
  const ordenados = [...itens].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return <section className="rounded-xl border bg-card">
    <div className="border-b px-4 py-3">
      <h4 className="text-sm font-semibold">PIX fora da janela de pagamento · {competenciaBR(competencia)}</h4>
      <p className="text-xs text-muted-foreground">
        Janela da folha: {janela ? `${dataBR(janela.inicio)} a ${dataBR(janela.fim)}` : '—'}. O texto do PIX é sempre lido primeiro (adiantamento, vale, comissão, prêmio, bônus, meta, venda); sem termo, a partir do dia 10 vira <b>possível comissão</b> pelo padrão histórico. São indicações, não confirmações. Nada é alterado.
      </p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground"><tr className="text-left">
          <th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Funcionário</th>
          <th className="px-4 py-2 font-medium">Descrição bancária</th><th className="px-4 py-2 font-medium text-right">Valor</th><th className="px-4 py-2 font-medium">Natureza indicada</th>
        </tr></thead>
        <tbody>{ordenados.map(v => <tr key={v.id} className="border-t">
          <td className="px-4 py-2 tabular-nums">{dataBR(v.data)}</td>
          <td className="px-4 py-2">{v.funcionario_nome}</td>
          <td className="px-4 py-2 max-w-[320px] truncate" title={v.descricao_banco}>{v.descricao_banco || '—'}</td>
          <td className="px-4 py-2 text-right tabular-nums">{reais(v.valor)}</td>
          <td className="px-4 py-2"><div className="flex flex-wrap items-center gap-1"><NaturezaChip natureza={v.fora_janela.natureza} /><OrigemNatureza n={v.fora_janela} /></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}