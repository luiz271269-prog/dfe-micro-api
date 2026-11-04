import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import BaixaAcaoRegistro from '@/components/baixas/BaixaAcaoRegistro';

export default function RevisaoObrasFaturas({ obras = [], faturas = [], onSaved }) {
  const itens = [...obras.map(r => ({ registro: r, tipo: 'ObraReforma', titulo: r.descricao || 'Obra', href: '/obras' })), ...faturas.map(r => ({ registro: r, tipo: 'FaturaCartao', titulo: `Fatura ${r.mes_referencia}`, href: '/cartoes' }))].filter(i => i.registro.liquidacao_consulta?.revisao);
  if (!itens.length) return null;
  return <details className="border border-warning/40 rounded-xl bg-card p-3 mb-4">
    <summary className="cursor-pointer text-sm font-semibold text-warning">Obras e faturas: {itens.length} registro(s) com divergência para revisão</summary>
    <p className="text-xs text-muted-foreground mt-2">Históricos e pagamentos preservados. Totais não positivos, pagamentos excedentes e diferenças históricas exigem conferência; não houve nova baixa nem recálculo pelo consumo do cartão.</p>
    <div className="mt-2 divide-y">{itens.map(({ registro: r, tipo, titulo, href }) => {
      const l = r.liquidacao_consulta;
      return <div key={`${tipo}-${r.id}`} className="py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs"><Link className="font-semibold text-primary" to={href}>{titulo}</Link><p>Total: {formatCurrency(l.total)} · Pago registrado: {formatCurrency(l.pago_registrado)} · Alocado no banco: {formatCurrency(l.alocado_banco)} · Saldo: {formatCurrency(l.saldo)}</p><p className="text-muted-foreground">Histórico: {l.historico || 'não informado'} · Leitura atual: {l.liquidacao}</p></div>
        <BaixaAcaoRegistro entidade={tipo} registroId={r.id} descricao={titulo} abaInicial="historico" onSaved={onSaved}>Revisar histórico</BaixaAcaoRegistro>
      </div>;
    })}</div>
  </details>;
}