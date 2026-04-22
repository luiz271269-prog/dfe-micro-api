import { useMemo } from 'react';
import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

/**
 * Classifica cada crédito do extrato:
 * - venda_conciliada → valor bate com Título pago
 * - lote_cobranca    → descrição é LIQ.COBRANCA SIMPLES (COB lote)
 * - externa          → sem NF/Título associada
 */
function classificarCredito(lanc, titulos, notas) {
  const desc = (lanc.descricao || '').toUpperCase();
  const valor = lanc.valor;

  if (desc.includes('LIQ.COBRANCA') || desc.includes('COB0')) {
    return { tipo: 'lote_cobranca', vinculo: null, label: 'Lote COB Sicredi' };
  }

  const titMatch = titulos.find(t =>
    t.status === 'pago' && Math.abs((t.valor_pago || 0) - valor) < 0.02
    && t.data_pagamento === lanc.data
  );
  if (titMatch) return { tipo: 'venda_conciliada', vinculo: titMatch, label: 'Título pago' };

  const nfMatch = notas.find(n => Math.abs(n.valor_total - valor) < 0.02 && n.data_emissao === lanc.data);
  if (nfMatch) return { tipo: 'venda_conciliada', vinculo: nfMatch, label: 'NF emitida hoje' };

  if (desc.includes('TRANSFER') || desc.includes('APORTE') || desc.includes('EMPRESTIMO')) {
    return { tipo: 'nao_operacional', vinculo: null, label: 'Não operacional' };
  }

  return { tipo: 'externa', vinculo: null, label: 'Sem NF vinculada' };
}

const TIPO_CONFIG = {
  venda_conciliada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  lote_cobranca:    'bg-blue-100 text-blue-700 border-blue-200',
  externa:          'bg-amber-100 text-amber-700 border-amber-200',
  nao_operacional:  'bg-slate-100 text-slate-700 border-slate-200',
};

export default function TabReceita({ loading, dados }) {
  const receitas = useMemo(() => {
    const creditos = dados.lancamentos.filter(l => l.valor > 0);
    return creditos
      .map(l => ({ ...l, classificacao: classificarCredito(l, dados.titulos, dados.notas) }))
      .sort((a, b) => (a.data > b.data ? -1 : 1));
  }, [dados]);

  const stats = useMemo(() => {
    const conciliadas = receitas.filter(r => r.classificacao.tipo === 'venda_conciliada');
    const lotes = receitas.filter(r => r.classificacao.tipo === 'lote_cobranca');
    const externas = receitas.filter(r => r.classificacao.tipo === 'externa');
    const total = receitas.reduce((a, r) => a + r.valor, 0);
    const vendas = conciliadas.reduce((a, r) => a + r.valor, 0) + lotes.reduce((a, r) => a + r.valor, 0);
    return {
      total, vendas,
      conciliadas: conciliadas.length,
      lotes: lotes.length,
      externas: externas.length,
    };
  }, [receitas]);

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Total recebido</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats.total)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
          <p className="text-[10px] font-bold uppercase text-emerald-700">Venda conciliada (NF/Título)</p>
          <p className="text-xl font-bold text-emerald-700">{stats.conciliadas}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
          <p className="text-[10px] font-bold uppercase text-blue-700">Lotes COB</p>
          <p className="text-xl font-bold text-blue-700">{stats.lotes}</p>
          <p className="text-[10px] text-blue-600">Detalhar no Sicredi</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
          <p className="text-[10px] font-bold uppercase text-amber-700">Externas / sem NF</p>
          <p className="text-xl font-bold text-amber-700">{stats.externas}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Descrição (Extrato)</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Classificação</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Vínculo</th>
              </tr>
            </thead>
            <tbody>
              {receitas.map(r => (
                <tr key={r.id} className="border-b hover:bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(r.data)}</td>
                  <td className="px-3 py-2 font-medium">
                    <p className="truncate max-w-[280px]">{r.descricao}</p>
                    {r.detalhe && <p className="text-[10px] text-muted-foreground">{r.detalhe}</p>}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600 tabular-nums">{formatCurrency(r.valor)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${TIPO_CONFIG[r.classificacao.tipo]}`}>
                      {r.classificacao.tipo === 'venda_conciliada' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {r.classificacao.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.classificacao.vinculo ? (
                      <span className="font-medium text-foreground">
                        {r.classificacao.vinculo.cliente || r.classificacao.vinculo.numero || '—'}
                      </span>
                    ) : (
                      <span className="italic">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {receitas.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum crédito no mês</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}