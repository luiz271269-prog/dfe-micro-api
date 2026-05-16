import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Check, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

// Mapeamento entidade → tipo de origem
const MAP_TIPO = {
  DespesaOperacional: 'despesa',
  Tributo: 'tributo',
  FaturaCartao: 'fatura',
  FolhaPagamento: 'folha',
};

export default function ResolverManualDialog({ sugestao, onClose, onResolved }) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!sugestao) return;
    (async () => {
      setLoading(true);
      const [despesas, tributos, faturas, cartoes, folhas, vinculos] = await Promise.all([
        base44.entities.DespesaOperacional.filter({ status: 'pendente' }, '-data_vencimento', 500),
        base44.entities.Tributo.list('-data_vencimento', 500),
        base44.entities.FaturaCartao.list('-data_vencimento', 300),
        base44.entities.ContaCartao.list(),
        base44.entities.FolhaPagamento.filter({ status: 'pendente' }, '-competencia', 200),
        base44.entities.VinculoExtrato.list('-created_date', 5000),
      ]);
      const vinc = new Set(vinculos.map(v => `${v.entidade_tipo}-${v.entidade_id}`));
      const lista = [];
      despesas.forEach(d => {
        if (vinc.has(`DespesaOperacional-${d.id}`)) return;
        lista.push({ entidade_tipo: 'DespesaOperacional', entidade_id: d.id, descricao: d.descricao, fornecedor: d.fornecedor || '—', valor: d.valor, data_vencimento: d.data_vencimento || d.data });
      });
      tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => {
        if (vinc.has(`Tributo-${t.id}`)) return;
        lista.push({ entidade_tipo: 'Tributo', entidade_id: t.id, descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo', valor: (t.valor_original || 0) - (t.valor_pago || 0), data_vencimento: t.data_vencimento });
      });
      faturas.filter(f => f.status === 'aberta' || f.status === 'vencida').forEach(f => {
        if (vinc.has(`FaturaCartao-${f.id}`)) return;
        const c = cartoes.find(x => x.id === f.conta_cartao_id);
        lista.push({ entidade_tipo: 'FaturaCartao', entidade_id: f.id, descricao: `Fatura ${c?.nome || 'Cartão'} — ${f.mes_referencia}`, fornecedor: c?.nome || 'Cartão', valor: f.valor_total - (f.valor_pago || 0), data_vencimento: f.data_vencimento });
      });
      folhas.forEach(f => {
        if (vinc.has(`FolhaPagamento-${f.id}`)) return;
        lista.push({ entidade_tipo: 'FolhaPagamento', entidade_id: f.id, descricao: `Salário — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome, valor: f.salario_liquido, data_vencimento: null });
      });
      setOpcoes(lista);
      setLoading(false);
    })();
  }, [sugestao]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return opcoes.slice(0, 50);
    return opcoes.filter(o =>
      (o.descricao || '').toLowerCase().includes(q) ||
      (o.fornecedor || '').toLowerCase().includes(q) ||
      String(o.valor || '').includes(q)
    ).slice(0, 50);
  }, [opcoes, busca]);

  async function aplicarManual(opcao) {
    setSalvando(true);
    const s = sugestao;
    const valor = s.valor_extrato;
    try {
      // Atualiza entidade origem escolhida
      if (opcao.entidade_tipo === 'DespesaOperacional') {
        await base44.entities.DespesaOperacional.update(opcao.entidade_id, { status: 'pago', data: s.data_extrato });
      } else if (opcao.entidade_tipo === 'Tributo') {
        await base44.entities.Tributo.update(opcao.entidade_id, { status: 'pago', data_pagamento: s.data_extrato, valor_pago: valor });
      } else if (opcao.entidade_tipo === 'FaturaCartao') {
        await base44.entities.FaturaCartao.update(opcao.entidade_id, { status: 'paga_total', data_pagamento: s.data_extrato, valor_pago: valor });
      } else if (opcao.entidade_tipo === 'FolhaPagamento') {
        await base44.entities.FolhaPagamento.update(opcao.entidade_id, { status: 'pago', data_pagamento: s.data_extrato });
      }
      await base44.entities.VinculoExtrato.create({
        lancamento_bancario_id: s.lancamento_bancario_id,
        entidade_tipo: opcao.entidade_tipo,
        entidade_id: opcao.entidade_id,
        valor_alocado: valor,
        tipo_vinculo: 'pagamento_integral',
        conciliado_por: 'manual',
        confianca: 100,
        observacao: `Resolução manual após rejeitar sugestão · ${opcao.descricao}`,
      });
      await base44.entities.LancamentoBancario.update(s.lancamento_bancario_id, { status_conciliacao: 'conciliado' });
      await base44.entities.SugestaoConciliacao.update(s.id, { status: 'rejeitada', resolvida_em: new Date().toISOString() });
      onResolved?.();
      onClose();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
    setSalvando(false);
  }

  async function marcarNaoEhContaAPagar() {
    setSalvando(true);
    try {
      // Sugestão rejeitada + lançamento marcado para ignorar (não reabre como sugestão)
      await base44.entities.LancamentoBancario.update(sugestao.lancamento_bancario_id, { status_conciliacao: 'ignorar' });
      await base44.entities.SugestaoConciliacao.update(sugestao.id, { status: 'rejeitada', resolvida_em: new Date().toISOString() });
      onResolved?.();
      onClose();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
    setSalvando(false);
  }

  if (!sugestao) return null;

  return (
    <Dialog open={!!sugestao} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>A qual conta este débito corresponde?</DialogTitle>
        </DialogHeader>

        {/* Resumo do débito */}
        <div className="bg-muted/40 rounded-lg p-3 text-sm border">
          <p className="text-xs text-muted-foreground mb-1">Débito no extrato</p>
          <p className="font-semibold">{sugestao.descricao_extrato}</p>
          <p className="text-xs text-muted-foreground mt-1">
            <b>{formatCurrency(sugestao.valor_extrato)}</b> em <b>{formatDate(sugestao.data_extrato)}</b>
          </p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, fornecedor ou valor..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-center py-6 text-muted-foreground">Carregando contas abertas...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-center py-6 text-muted-foreground">Nenhuma conta encontrada</p>
        ) : (
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {filtradas.map(o => {
              const valorBate = Math.abs(o.valor - sugestao.valor_extrato) < 0.5;
              return (
                <button
                  key={`${o.entidade_tipo}-${o.entidade_id}`}
                  onClick={() => aplicarManual(o)}
                  disabled={salvando}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm hover:bg-primary/5 hover:border-primary transition-colors flex items-center justify-between gap-3 ${valorBate ? 'border-green-300 bg-green-50/50' : 'border-border'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{o.descricao}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.fornecedor} {o.data_vencimento && `· venc. ${formatDate(o.data_vencimento)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold tabular-nums ${valorBate ? 'text-green-700' : ''}`}>{formatCurrency(o.valor)}</p>
                    <p className="text-[10px] text-muted-foreground">{MAP_TIPO[o.entidade_tipo]}</p>
                  </div>
                  {valorBate && <Check className="w-4 h-4 text-green-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button variant="outline" onClick={marcarNaoEhContaAPagar} disabled={salvando} className="gap-2 text-orange-700 border-orange-300 hover:bg-orange-50">
            <AlertCircle className="w-4 h-4" /> Não é conta a pagar (ignorar débito)
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}