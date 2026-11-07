import AlertaChips from './AlertaChips';
import NaturezaChip from './NaturezaChip';
import { CATEGORIAS, reais, dataBR, competenciaBR } from './rotulosConferencia';

export default function VinculoConferenciaLinha({ v }) {
  return <tr className="border-t text-xs">
    <td className="px-3 py-2">{dataBR(v.data)}</td>
    <td className="px-3 py-2 max-w-[260px] truncate" title={v.descricao_banco}>{v.descricao_banco || '—'}</td>
    <td className="px-3 py-2">{CATEGORIAS[v.categoria]}{v.observacao && <span className="block text-muted-foreground truncate max-w-[180px]" title={v.observacao}>{v.observacao}</span>}</td>
    <td className="px-3 py-2 text-right tabular-nums">{reais(v.valor)}</td>
    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{v.valor_banco == null ? '—' : `${reais(Math.abs(v.valor_banco))} · alocado ${reais(v.alocado_no_lancamento)}`}</td>
    <td className="px-3 py-2">
      {v.fora_janela && <div className="mb-1"><NaturezaChip natureza={v.fora_janela.natureza} /></div>}
      <AlertaChips alertas={v.alertas} info={v.info} />
      {v.competencia_sugerida && <p className="mt-1 text-[11px] text-muted-foreground">Pela data, corresponderia à competência {competenciaBR(v.competencia_sugerida)}.</p>}
    </td>
  </tr>;
}