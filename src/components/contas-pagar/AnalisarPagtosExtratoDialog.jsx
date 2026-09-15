import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Link2, Check } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ehSaidaContasPagar } from '@/lib/extratoNatureza';
import { carregarObrigacoesAbertas, conciliarObrigacaoComLancamento } from '@/lib/obrigacoesAbertas';
import { ordenarPorSimilaridade, scoreSimilaridadeConciliacao } from '@/lib/similaridadeConciliacao';
import ColunaSelecao from './ColunaSelecao';

export default function AnalisarPagtosExtratoDialog({ open, onClose, onResolved, lancamentoIdInicial }) {
  const [obrigacoes, setObrigacoes] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [selObrig, setSelObrig] = useState(null);
  const [selLanc, setSelLanc] = useState(null);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('data');

  async function load() {
    setLoading(true);
    const [obr, lancs] = await Promise.all([
      carregarObrigacoesAbertas(),
      base44.entities.LancamentoBancario.list('-data', 2000),
    ]);
    const pendentes = lancs.filter(l => ehSaidaContasPagar(l) && l.status_conciliacao !== 'conciliado' && l.status_conciliacao !== 'ignorar');
    setObrigacoes(obr);
    setLancamentos(pendentes);
    setSelObrig(null);
    setSelLanc(lancamentoIdInicial ? pendentes.find(l => l.id === lancamentoIdInicial) || null : null);
    setLoading(false);
  }

  useEffect(() => { if (open) load(); }, [open, lancamentoIdInicial]);

  const q = busca.toLowerCase().trim();

  function ordenar(arr, campoData, campoValor) {
    const copia = [...arr];
    copia.sort((a, b) => ordem === 'valor'
      ? Math.abs(b[campoValor] || 0) - Math.abs(a[campoValor] || 0)
      : String(b[campoData] || '').localeCompare(String(a[campoData] || '')));
    return copia;
  }

  const obrigacoesFiltradas = useMemo(() => {
    const base = q
      ? obrigacoes.filter(o => `${o.descricao} ${o.fornecedor} ${o.valor}`.toLowerCase().includes(q))
      : obrigacoes;
    return selLanc ? ordenarPorSimilaridade(base, selLanc, 'obrigacao') : ordenar(base, 'data_vencimento', 'valor');
  }, [obrigacoes, q, ordem, selLanc]);

  const lancamentosFiltrados = useMemo(() => {
    const base = q
      ? lancamentos.filter(l => `${l.descricao} ${l.valor}`.toLowerCase().includes(q))
      : lancamentos;
    return selObrig ? ordenarPorSimilaridade(base, selObrig, 'lancamento') : ordenar(base, 'data', 'valor');
  }, [lancamentos, q, ordem, selObrig]);

  const diff = selObrig && selLanc
    ? Math.abs(Math.abs(selLanc.valor || 0) - (selObrig.valor || 0))
    : null;

  async function conciliar() {
    setSalvando(true);
    try {
      await conciliarObrigacaoComLancamento(selObrig, selLanc, `Conciliação manual (análise pagtos × extrato) · ${selObrig.descricao}`);
      window.dispatchEvent(new Event('neuralfinRefresh'));
      onResolved?.();
      await load();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
    setSalvando(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analisar pagamentos × extrato</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição ou valor..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={ordem === 'data' ? 'default' : 'outline'} onClick={() => setOrdem('data')}>Por data</Button>
            <Button size="sm" variant={ordem === 'valor' ? 'default' : 'outline'} onClick={() => setOrdem('valor')}>Por valor</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-center py-10 text-muted-foreground">Carregando pagamentos e extrato...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColunaSelecao
              titulo={`Contas a pagar em aberto (${obrigacoesFiltradas.length})${selLanc ? ' · semelhantes primeiro' : ''}`}
              itens={obrigacoesFiltradas}
              getKey={o => `${o.entidade_tipo}-${o.entidade_id}`}
              selecionadoKey={selObrig ? `${selObrig.entidade_tipo}-${selObrig.entidade_id}` : null}
              onSelect={o => setSelObrig(selObrig?.entidade_id === o.entidade_id ? null : o)}
              renderTitulo={o => o.descricao}
              renderSub={o => `${o.tipo_label} · ${o.fornecedor}${o.data_vencimento ? ` · venc. ${formatDate(o.data_vencimento)}` : ''}`}
              renderValor={o => formatCurrency(o.valor)}
              renderIndicador={o => selLanc && <span className="text-[10px] font-semibold text-primary">{scoreSimilaridadeConciliacao(o, selLanc)}% compatível</span>}
              comparar={o => selLanc ? scoreSimilaridadeConciliacao(o, selLanc) >= 70 : false}
            />
            <ColunaSelecao
              titulo={`Débitos do extrato não conciliados (${lancamentosFiltrados.length})${selObrig ? ' · semelhantes primeiro' : ''}`}
              itens={lancamentosFiltrados}
              getKey={l => l.id}
              selecionadoKey={selLanc?.id || null}
              onSelect={l => setSelLanc(selLanc?.id === l.id ? null : l)}
              renderTitulo={l => l.descricao}
              renderSub={l => `${formatDate(l.data)} · ${l.conta_bancaria || '—'}`}
              renderValor={l => formatCurrency(Math.abs(l.valor || 0))}
              renderIndicador={l => selObrig && <span className="text-[10px] font-semibold text-primary">{scoreSimilaridadeConciliacao(selObrig, l)}% compatível</span>}
              comparar={l => selObrig ? scoreSimilaridadeConciliacao(selObrig, l) >= 70 : false}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t">
          <div className="flex-1 text-sm">
            {selObrig && selLanc ? (
              <p className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate max-w-[220px]">{selObrig.descricao}</span>
                <Link2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold truncate max-w-[220px]">{selLanc.descricao}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff < 0.5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {diff < 0.5 ? 'valores batem' : `diferença ${formatCurrency(diff)}`}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">Selecione um item em qualquer coluna para ordenar a outra por valor, data e descrição semelhantes.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={salvando}>Fechar</Button>
            <Button onClick={conciliar} disabled={!selObrig || !selLanc || salvando} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <Check className="w-4 h-4" /> {salvando ? 'Conciliando...' : 'Conciliar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}