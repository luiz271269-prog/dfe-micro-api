import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Check, XIcon, ChevronDown, ChevronUp, AlertTriangle, SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ehSaidaContasPagar } from '@/lib/extratoNatureza';
import ResolverManualDialog from './ResolverManualDialog';
import AnalisarPagtosExtratoDialog from './AnalisarPagtosExtratoDialog';

export default function SugestoesConciliacaoBanner() {
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [processandoId, setProcessandoId] = useState(null);
  const [resolverManual, setResolverManual] = useState(null);
  const [analisarOpen, setAnalisarOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [lista, lancamentos] = await Promise.all([
      base44.entities.SugestaoConciliacao.filter({ status: 'pendente' }, '-confianca', 200),
      base44.entities.LancamentoBancario.list('-data', 2000),
    ]);
    const lancamentosPorId = new Map(lancamentos.map((l) => [l.id, l]));
    setSugestoes(lista.filter((s) => ehSaidaContasPagar(lancamentosPorId.get(s.lancamento_bancario_id))));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('neuralfinRefresh', handler);
    const unsub = base44.entities.SugestaoConciliacao.subscribe(() => load());
    return () => { window.removeEventListener('neuralfinRefresh', handler); unsub(); };
  }, []);

  async function confirmar(s) {
    setProcessandoId(s.id);
    try {
      // Atualiza entidade origem
      if (s.entidade_tipo === 'DespesaOperacional') {
        await base44.entities.DespesaOperacional.update(s.entidade_id, { status: 'pago', data: s.data_extrato });
      } else if (s.entidade_tipo === 'Tributo') {
        await base44.entities.Tributo.update(s.entidade_id, { status: 'pago', data_pagamento: s.data_extrato, valor_pago: s.valor_extrato });
      } else if (s.entidade_tipo === 'FaturaCartao') {
        await base44.entities.FaturaCartao.update(s.entidade_id, { status: 'paga_total', data_pagamento: s.data_extrato, valor_pago: s.valor_extrato });
      } else if (s.entidade_tipo === 'FolhaPagamento') {
        await base44.entities.FolhaPagamento.update(s.entidade_id, { status: 'pago', data_pagamento: s.data_extrato });
      } else if (s.entidade_tipo === 'ItemCompra') {
        await base44.entities.ItemCompra.update(s.entidade_id, { status_pagamento: 'pago', valor_pago: s.valor_extrato, lancamento_bancario_id: s.lancamento_bancario_id });
      }
      // Cria vínculo
      await base44.entities.VinculoExtrato.create({
        lancamento_bancario_id: s.lancamento_bancario_id,
        entidade_tipo: s.entidade_tipo,
        entidade_id: s.entidade_id,
        valor_alocado: s.valor_extrato,
        tipo_vinculo: 'pagamento_integral',
        conciliado_por: 'manual',
        confianca: s.confianca,
        observacao: `Sugestão confirmada · ${s.descricao_conta}`,
      });
      // Marca lançamento conciliado
      await base44.entities.LancamentoBancario.update(s.lancamento_bancario_id, { status_conciliacao: 'conciliado' });
      // Marca sugestão como confirmada
      await base44.entities.SugestaoConciliacao.update(s.id, { status: 'confirmada', resolvida_em: new Date().toISOString() });
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) {
      alert(`Erro ao confirmar: ${err.message}`);
    }
    setProcessandoId(null);
  }

  // Rejeitar agora abre o diálogo para o usuário escolher a conta correta
  function rejeitar(s) {
    setResolverManual(s);
  }

  if (loading || sugestoes.length === 0) return null;

  const visiveis = expanded ? sugestoes : sugestoes.slice(0, 3);
  const totalValor = sugestoes.reduce((s, x) => s + (x.valor_extrato || 0), 0);

  return (
    <div className="mb-5 rounded-xl border-2 border-yellow-300 bg-yellow-50 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-yellow-200 bg-yellow-100/60">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-700" />
          <div>
            <p className="font-bold text-sm text-yellow-900">
              {sugestoes.length} sugestão(ões) de conciliação aguardando confirmação
            </p>
            <p className="text-xs text-yellow-700">
              Total: {formatCurrency(totalValor)} · Valor bate, mas data difere do vencimento
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setAnalisarOpen(true)} className="gap-1.5 h-8 border-yellow-400 bg-white text-yellow-900 hover:bg-yellow-100">
            <SearchCheck className="w-4 h-4" /> Analisar pagtos × extrato
          </Button>
          {sugestoes.length > 3 && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="gap-1 text-yellow-800 hover:bg-yellow-200">
              {expanded ? <><ChevronUp className="w-4 h-4" /> Recolher</> : <><ChevronDown className="w-4 h-4" /> Ver todas ({sugestoes.length})</>}
            </Button>
          )}
        </div>
      </div>

      <div className="divide-y divide-yellow-200">
        {visiveis.map(s => (
          <div key={s.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                <p className="font-semibold text-sm text-foreground truncate">{s.descricao_conta}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">Saída</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800 font-bold">
                  {s.confianca}% confiança
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <b>{formatCurrency(s.valor_extrato)}</b> debitado em <b>{formatDate(s.data_extrato)}</b>
                {' · '}vencimento {formatDate(s.data_vencimento)} ({s.diff_dias}d)
              </p>
              <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{s.descricao_extrato}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => confirmar(s)}
                disabled={processandoId === s.id}
                className="gap-1 bg-green-600 hover:bg-green-700 text-white h-8"
              >
                <Check className="w-3.5 h-3.5" /> Confirmar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejeitar(s)}
                disabled={processandoId === s.id}
                className="gap-1 h-8 border-red-300 text-red-700 hover:bg-red-50"
              >
                <XIcon className="w-3.5 h-3.5" /> Não é essa
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AnalisarPagtosExtratoDialog
        open={analisarOpen}
        onClose={() => setAnalisarOpen(false)}
        onResolved={load}
      />

      <ResolverManualDialog
        sugestao={resolverManual}
        onClose={() => setResolverManual(null)}
        onResolved={() => { setResolverManual(null); window.dispatchEvent(new Event('neuralfinRefresh')); }}
      />
    </div>
  );
}