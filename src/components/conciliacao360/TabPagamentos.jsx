import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link2, CheckCircle, AlertCircle, CreditCard, Receipt, Wallet, Landmark, Repeat, AlertTriangle, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { aplicarRegra } from '../../lib/recurringEngine';
import { consolidarContasPagar, acharContaPagarPorLancamento } from '../../lib/contasPagarEngine';

/**
 * Classifica cada débito do extrato. Prioridade:
 * 0. RECORRENTE (regras do usuário) — alerta se divergente
 * 1. CONTA A PAGAR PENDENTE (DDA) — match com despesa/tributo/folha/fatura em aberto
 * 2. pagamento_fatura
 * 3. pagamento_tributo
 * 4. despesa_direta (despesa já paga com mesma data)
 * 5. nao_classificado
 */
function classificarDebito(lanc, faturas, despesas, tributos, regras = [], contasPagar = []) {
  // 0. Regra recorrente (PRIORIDADE MÁXIMA)
  for (const regra of regras) {
    const r = aplicarRegra(lanc, regra);
    if (r.match) {
      return {
        tipo: 'recorrente',
        vinculo: regra,
        label: r.status === 'divergente' ? 'Recorrente (divergente)' : 'Recorrente',
        recorrenteInfo: r,
      };
    }
  }

  // 1. Conta a pagar pendente (DDA/Boleto/Tributo) — match por valor + vencimento próximo
  const dda = acharContaPagarPorLancamento(lanc, contasPagar);
  if (dda) {
    const tipoLabel = {
      despesa: 'DDA/Boleto',
      tributo: 'Tributo a vencer',
      folha: 'Folha',
      fatura: 'Fatura Cartão',
    }[dda.origem_tipo] || dda.origem_tipo;
    return {
      tipo: 'conta_pagar_pendente',
      vinculo: dda,
      label: tipoLabel,
    };
  }

  const desc = (lanc.descricao || '').toUpperCase();
  const valor = Math.abs(lanc.valor);

  if (desc.includes('PAGTO CARTAO') || desc.includes('FATURA CARTAO') || desc.includes('PAGAMENTO CARTAO')) {
    const match = faturas.find(f => Math.abs(f.valor_total - valor) < 1);
    return { tipo: 'pagamento_fatura', vinculo: match, label: 'Fatura de Cartão' };
  }

  if (lanc.categoria === 'tributo' || desc.includes('DARF') || desc.includes('DAS') || desc.includes('ARRECADACAO')) {
    const match = tributos.find(t => Math.abs((t.valor_pago || t.valor_original) - valor) < 0.5);
    return { tipo: 'pagamento_tributo', vinculo: match, label: 'Tributo' };
  }

  const despMatch = despesas.find(d => Math.abs(d.valor - valor) < 0.5 && d.data === lanc.data);
  if (despMatch) return { tipo: 'despesa_direta', vinculo: despMatch, label: 'Despesa' };

  return { tipo: 'nao_classificado', vinculo: null, label: 'Sem vínculo' };
}

const TIPO_CONFIG = {
  recorrente:            { icon: Repeat,      color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  conta_pagar_pendente:  { icon: Clock,       color: 'bg-teal-100 text-teal-700 border-teal-200' },
  pagamento_fatura:      { icon: CreditCard,  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  pagamento_tributo:     { icon: Landmark,    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  despesa_direta:        { icon: Wallet,      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pagamento_boleto:      { icon: Receipt,     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  nao_classificado:      { icon: AlertCircle, color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export default function TabPagamentos({ loading, dados, onRefresh }) {
  const [vincularLanc, setVincularLanc] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Consolida lista de contas a pagar pendentes (DDA, tributos, folha, faturas em aberto)
  const contasPagar = useMemo(() => consolidarContasPagar({
    despesas: dados.despesas,
    tributos: dados.tributos,
    folhas: dados.folhas || [],
    faturas: dados.faturas,
    cartoes: dados.cartoes,
  }), [dados]);

  const pagamentos = useMemo(() => {
    const debitos = dados.lancamentos.filter(l => l.valor < 0);
    return debitos
      .map(l => ({ ...l, classificacao: classificarDebito(l, dados.faturas, dados.despesas, dados.tributos, dados.regrasRecorrentes || [], contasPagar) }))
      .sort((a, b) => (a.data > b.data ? -1 : 1));
  }, [dados, contasPagar]);

  const stats = useMemo(() => ({
    total: pagamentos.length,
    vinculados: pagamentos.filter(p => p.classificacao.vinculo).length,
    pendentes: pagamentos.filter(p => !p.classificacao.vinculo).length,
    recorrentes: pagamentos.filter(p => p.classificacao.tipo === 'recorrente').length,
    recorrentesDivergentes: pagamentos.filter(p => p.classificacao.tipo === 'recorrente' && p.classificacao.recorrenteInfo?.status === 'divergente').length,
    totalValor: pagamentos.reduce((a, p) => a + Math.abs(p.valor), 0),
  }), [pagamentos]);

  // Dá baixa automática no item pendente vinculado ao débito
  async function darBaixaDDA(lanc, item) {
    setSalvando(true);
    try {
      if (item.origem_tipo === 'despesa') {
        await base44.entities.DespesaOperacional.update(item.origem_id, {
          status: 'pago',
          data: lanc.data,
        });
      } else if (item.origem_tipo === 'tributo') {
        await base44.entities.Tributo.update(item.origem_id, {
          status: 'pago',
          data_pagamento: lanc.data,
          valor_pago: Math.abs(lanc.valor),
        });
      } else if (item.origem_tipo === 'folha') {
        await base44.entities.FolhaPagamento.update(item.origem_id, {
          status: 'pago',
          data_pagamento: lanc.data,
        });
      } else if (item.origem_tipo === 'fatura') {
        await base44.entities.FaturaCartao.update(item.origem_id, {
          status: 'paga_total',
          data_pagamento: lanc.data,
          valor_pago: Math.abs(lanc.valor),
        });
      }
    } finally {
      setSalvando(false);
      setVincularLanc(null);
      onRefresh();
    }
  }

  async function criarDespesaRapida(lanc) {
    setSalvando(true);
    await base44.entities.DespesaOperacional.create({
      data: lanc.data,
      descricao: lanc.descricao,
      fornecedor: lanc.descricao,
      categoria: 'outro',
      valor: Math.abs(lanc.valor),
      status: 'pago',
      forma_pagamento: lanc.detalhe?.includes('PIX') ? 'pix' : 'transferencia',
      empresa: lanc.conta_bancaria?.includes('Liesch') ? 'Liesch' : 'NeuralTec',
      observacoes: `Criada a partir do extrato: ${lanc.detalhe || ''}`,
    });
    setSalvando(false);
    setVincularLanc(null);
    onRefresh();
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <div>
      {/* Resumo */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Total débitos</p>
          <p className="text-xl font-bold">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(stats.totalValor)}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-3">
          <p className="text-[10px] font-bold uppercase text-indigo-700 flex items-center gap-1"><Repeat className="w-3 h-3" /> Recorrentes</p>
          <p className="text-xl font-bold text-indigo-700">{stats.recorrentes}</p>
          {stats.recorrentesDivergentes > 0 && (
            <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {stats.recorrentesDivergentes} divergente(s)</p>
          )}
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
          <p className="text-[10px] font-bold uppercase text-emerald-700">Vinculados</p>
          <p className="text-xl font-bold text-emerald-700">{stats.vinculados}</p>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-3">
          <p className="text-[10px] font-bold uppercase text-rose-700">Pendentes</p>
          <p className="text-xl font-bold text-rose-700">{stats.pendentes}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
          <p className="text-[10px] font-bold uppercase text-blue-700">Taxa conciliação</p>
          <p className="text-xl font-bold text-blue-700">{stats.total > 0 ? Math.round(stats.vinculados / stats.total * 100) : 0}%</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Descrição (Extrato)</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Vínculo sugerido</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map(p => {
                const cfg = TIPO_CONFIG[p.classificacao.tipo];
                const Icon = cfg.icon;
                const rec = p.classificacao.recorrenteInfo;
                const divergente = rec?.status === 'divergente';
                return (
                  <tr key={p.id} className={`border-b hover:bg-muted/20 ${divergente ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(p.data)}</td>
                    <td className="px-3 py-2 font-medium">
                      <p className="truncate max-w-[280px]">{p.descricao}</p>
                      {p.detalhe && <p className="text-[10px] text-muted-foreground">{p.detalhe}</p>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-rose-600 tabular-nums">
                      {formatCurrency(p.valor)}
                      {divergente && (
                        <p className="text-[10px] text-amber-700 font-bold">
                          vs. {formatCurrency(rec.valorEsperado)} ({rec.desvioPercentual > 0 ? '+' : ''}{rec.desvioPercentual.toFixed(1)}%)
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${divergente ? 'bg-amber-100 text-amber-700 border-amber-200' : cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {divergente && <AlertTriangle className="w-3 h-3" />}
                        {p.classificacao.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.classificacao.vinculo ? (
                        <div className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {p.classificacao.tipo === 'recorrente'
                              ? `${p.classificacao.vinculo.nome} (${p.classificacao.vinculo.categoria})`
                              : (p.classificacao.vinculo.descricao || p.classificacao.vinculo.tipo || p.classificacao.vinculo.mes_referencia || '—')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Não encontrado</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.classificacao.tipo === 'conta_pagar_pendente' ? (
                        <Button size="sm" className="h-6 text-[10px] bg-teal-600 hover:bg-teal-700" onClick={() => darBaixaDDA(p, p.classificacao.vinculo)} disabled={salvando}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Dar baixa
                        </Button>
                      ) : !p.classificacao.vinculo && (
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setVincularLanc(p)}>
                          <Link2 className="w-3 h-3 mr-1" /> Vincular
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pagamentos.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum débito no mês</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de vínculo rápido */}
      <Dialog open={!!vincularLanc} onOpenChange={() => setVincularLanc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular pagamento do extrato</DialogTitle>
          </DialogHeader>
          {vincularLanc && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Lançamento bancário</p>
                <p className="font-semibold">{vincularLanc.descricao}</p>
                <p className="text-sm text-rose-600 font-bold">{formatCurrency(vincularLanc.valor)} · {formatDate(vincularLanc.data)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-semibold mb-2">Criar despesa operacional rápida:</p>
                <Button className="w-full" onClick={() => criarDespesaRapida(vincularLanc)} disabled={salvando}>
                  {salvando ? 'Criando...' : 'Criar DespesaOperacional com estes dados'}
                </Button>
                <p className="text-[10px] text-blue-700 mt-2">
                  A despesa será criada com os dados do extrato (data, valor, descrição). Você pode editar depois em <strong>Despesas</strong>.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}