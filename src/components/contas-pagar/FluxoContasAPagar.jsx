import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, CreditCard, Landmark, AlertTriangle, ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../lib/formatters';
import { classificarNaturezaExtrato, ehSaidaContasPagar } from '../../lib/extratoNatureza';

// Mapa visual do funcionamento do Contas a Pagar e seus cruzamentos:
//  Origens (compras, despesas, tributos, folha, pró-labore)
//   → pagas no CARTÃO: o item "evapora" para a fatura (só a fatura fica a pagar)
//   → pagas no BANCO: cruzam com o extrato bancário (baixa automática)
//  Sinaliza gaps: faturas de contas não monitoradas, fatura sem cartão, duplicidades.
export default function FluxoContasAPagar({ faturas = [], cartoes = [], lancamentos = [], mesReferencia }) {
  const [aberto, setAberto] = useState(true);

  const diag = useMemo(() => {
    // Contas bancárias com extrato importado (monitoradas)
    const contasMonitoradas = new Set();
    lancamentos.forEach(l => {
      const m = (l.conta_bancaria || '').match(/\d{4,6}-\d/);
      if (m) contasMonitoradas.add(m[0]);
    });

    const abertas = faturas.filter(f => f.status === 'aberta' || f.status === 'vencida');
    const semCartao = [];
    const contaNaoMonitorada = [];
    const monitoradas = [];

    abertas.forEach(f => {
      const aberto = (f.valor_total || 0) - (f.valor_pago || 0);
      const cartao = cartoes.find(c => c.id === f.conta_cartao_id);
      if (!cartao) { semCartao.push({ f, aberto }); return; }
      const contaPagto = (cartao.conta_bancaria_pagamento || '').match(/\d{4,6}-\d/)?.[0];
      if (contaPagto && contasMonitoradas.has(contaPagto)) {
        monitoradas.push({ f, cartao, aberto });
      } else {
        contaNaoMonitorada.push({ f, cartao, aberto });
      }
    });

    const soma = arr => arr.reduce((s, x) => s + x.aberto, 0);
    const duplicados = lancamentos.filter(l => l.alerta_duplicidade && l.status_conciliacao !== 'ignorar');
    const movimentosMes = lancamentos.filter((l) => !mesReferencia || (l.data || '').startsWith(mesReferencia));
    const extrato = movimentosMes.reduce((acc, l) => {
      const natureza = classificarNaturezaExtrato(l);
      if (natureza === 'entrada') acc.entradas += Math.abs(l.valor || 0);
      if (natureza === 'saida' && ehSaidaContasPagar(l)) acc.saidas += Math.abs(l.valor || 0);
      if (natureza === 'aplicacao') acc.aplicacoes += Math.abs(l.valor || 0);
      if (natureza !== 'saida' || ehSaidaContasPagar(l)) acc.quantidades[natureza] = (acc.quantidades[natureza] || 0) + 1;
      return acc;
    }, { entradas: 0, saidas: 0, aplicacoes: 0, quantidades: {} });

    return {
      semCartao, contaNaoMonitorada, monitoradas,
      totalSemCartao: soma(semCartao),
      totalNaoMonitorado: soma(contaNaoMonitorada),
      totalMonitorado: soma(monitoradas),
      duplicados, extrato,
    };
  }, [faturas, cartoes, lancamentos, mesReferencia]);

  return (
    <div className="bg-card border rounded-xl mb-4 overflow-hidden">
      <button onClick={() => setAberto(!aberto)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fluxo &amp; Cruzamentos do Contas a Pagar</h3>
          {(diag.semCartao.length > 0 || diag.contaNaoMonitorada.length > 0) && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {diag.semCartao.length + diag.contaNaoMonitorada.length} sinal(is)
            </span>
          )}
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2" title={`${diag.extrato.quantidades.entrada || 0} movimento(s) no mês`}>
              <p className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> Entradas no extrato</p>
              <p className="text-sm font-bold text-emerald-800 whitespace-nowrap">{formatCurrency(diag.extrato.entradas)}</p>
            </div>
            <div className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2" title={`${diag.extrato.quantidades.saida || 0} movimento(s) elegíveis para baixa`}>
              <p className="text-[10px] font-bold uppercase text-red-700 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Saídas no extrato</p>
              <p className="text-sm font-bold text-red-800 whitespace-nowrap">{formatCurrency(diag.extrato.saidas)}</p>
            </div>
            <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2" title={`${diag.extrato.quantidades.aplicacao || 0} movimento(s) fora do Contas a Pagar`}>
              <p className="text-[10px] font-bold uppercase text-blue-700 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Aplicações e resgates</p>
              <p className="text-sm font-bold text-blue-800 whitespace-nowrap">{formatCurrency(diag.extrato.aplicacoes)}</p>
            </div>
          </div>
          {/* Mapa do fluxo */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold bg-muted/30 rounded-lg px-3 py-2" title='Item comprado no cartão não fica "a pagar" individualmente — a obrigação evapora para a fatura do cartão, que é paga no extrato. Pró-labore (retirada de lucros) é identificado no extrato e nos cartões pessoais.'>
            <span className="bg-sky-100 text-sky-700 px-2 py-1 rounded">Compras</span>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Despesas fixas/variáveis</span>
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">Impostos (vendas + folha)</span>
            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Folha</span>
            <Link to="/prolabore" className="bg-purple-100 text-purple-700 px-2 py-1 rounded hover:underline">Pró-labore</Link>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 px-2 py-1 rounded">
              <CreditCard className="w-3 h-3" /> No cartão → vira Fatura
            </span>
            <span className="text-muted-foreground">ou</span>
            <span className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
              <Landmark className="w-3 h-3" /> Direto → cruza com Extrato
            </span>
          </div>
          {/* Sinais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2" title={`${diag.monitoradas.length} fatura(s) de contas monitoradas — a baixa automática resolve`}>
              <p className="text-[10px] font-bold uppercase text-emerald-700">Faturas cruzáveis com extrato</p>
              <p className="text-sm font-bold text-emerald-800 whitespace-nowrap">{formatCurrency(diag.totalMonitorado)}</p>
            </div>
            <div className={`border rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${diag.contaNaoMonitorada.length ? 'border-amber-200 bg-amber-50' : 'border-border bg-muted/20'}`}
              title={`${diag.contaNaoMonitorada.length} fatura(s) pagas por contas sem extrato importado (${[...new Set(diag.contaNaoMonitorada.map(x => x.cartao.conta_bancaria_pagamento))].join(', ') || '—'}) — nunca serão baixadas automaticamente`}>
              <p className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem extrato da conta pagadora</p>
              <p className="text-sm font-bold text-amber-800 whitespace-nowrap">{formatCurrency(diag.totalNaoMonitorado)}</p>
            </div>
            <div className={`border rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${diag.semCartao.length ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20'}`}
              title={diag.semCartao.length ? `${diag.semCartao.map(x => x.f.mes_referencia).join(', ')} — vincule o cartão em Cartões para permitir o cruzamento` : 'Nenhuma — tudo certo'}>
              <p className="text-[10px] font-bold uppercase text-red-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fatura sem cartão vinculado</p>
              <p className="text-sm font-bold text-red-800 whitespace-nowrap">{formatCurrency(diag.totalSemCartao)}</p>
            </div>
          </div>

          {diag.duplicados.length > 0 && (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ {diag.duplicados.length} débito(s) no extrato marcados como possível duplicidade — resolva em <Link to="/extrato" className="underline font-semibold">Extrato Bancário</Link> antes de conciliar, para não baixar a mesma conta duas vezes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}