import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowUp, ArrowDown, ChevronsUpDown, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { aprenderEAplicarRegra } from '../../lib/autoCategorizacao';
import ComprovantePicker from '../shared/ComprovantePicker';
import SeletorClassificacao from '../shared/SeletorClassificacao';
import { CATEGORIAS_CONTAS, CATEGORIA_COLORS, getCor, loadCustom, saveCustom, slugify } from '../../lib/classificacaoUnificada';

// Plano de contas unificado (compartilhado com Extrato e Contas a Pagar)
export const categoriaLabels = CATEGORIAS_CONTAS;
export const categoriaColors = CATEGORIA_COLORS;

export default function LancamentosEditableTable({ lancamentos, onReload }) {
  const [editing, setEditing] = useState(null);
  const [localRows, setLocalRows] = useState(lancamentos || []);
  const [custom, setCustom] = useState(loadCustom);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [sort, setSort] = useState({ field: 'data_lancamento', dir: 'asc' });

  // Sincroniza com props quando lista externa muda (carregamento silencioso, novo mês, etc.)
  useEffect(() => { setLocalRows(lancamentos || []); }, [lancamentos]);

  const allCategorias = useMemo(() => ({ ...CATEGORIAS_CONTAS, ...(custom.categoria || {}) }), [custom]);

  function catLabel(k) {
    return allCategorias[k] || k || '—';
  }
  function catColor(k) {
    return getCor('categoria', k);
  }

  function addCategoria() {
    const label = newCatName.trim();
    const key = slugify(label);
    if (!key) return;
    const next = { ...custom, categoria: { ...(custom.categoria || {}), [key]: label } };
    setCustom(next);
    saveCustom(next);
    setNewCatName('');
    setAddingCat(false);
  }

  async function update(id, field, value) {
    const original = (lancamentos || []).find((r) => r.id === id);
    // Otimista: atualiza local imediatamente sem fechar painel
    setLocalRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setEditing(null);
    try {
      await base44.entities.LancamentoCartao.update(id, { [field]: value });

      // Auto-classificação: ao mudar categoria manualmente, propaga para lançamentos semelhantes
      if (field === 'categoria' && original?.estabelecimento && original.categoria !== value) {
        try {
          const { aplicados } = await aprenderEAplicarRegra({
            escopo: 'cartao',
            descricao: original.estabelecimento,
            categoria: value,
            categoriasPadraoSubstituiveis: [original.categoria],
          });
          if (aplicados > 0 && onReload) onReload();
        } catch (e) { /* não bloqueia */ }
      }
    } catch (e) {
      // Rollback em caso de erro
      setLocalRows(lancamentos || []);
      console.error('Erro ao salvar', e);
    }
  }

  const sortedRows = useMemo(() => {
    const rows = [...localRows];
    const { field, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let av = a[field];
      let bv = b[field];
      if (field === 'data_lancamento') {
        av = new Date(av || 0).getTime();
        bv = new Date(bv || 0).getTime();
      } else if (field === 'valor') {
        av = a.valor || 0;
        bv = b.valor || 0;
      } else {
        av = (av || '').toString().toLowerCase();
        bv = (bv || '').toString().toLowerCase();
      }
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
    return rows;
  }, [localRows, sort]);

  const totalValor = useMemo(() => localRows.reduce((s, l) => s + (l.valor || 0), 0), [localRows]);

  function toggleSort(field) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  }

  function SortIcon({ field }) {
    if (sort.field !== field) return <ChevronsUpDown className="w-3 h-3 inline opacity-40" />;
    return sort.dir === 'asc'
      ? <ArrowUp className="w-3 h-3 inline" />
      : <ArrowDown className="w-3 h-3 inline" />;
  }

  if (!localRows || localRows.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhum lançamento</p>;
  }

  const headerCls = 'py-2 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className={`text-left ${headerCls}`} onClick={() => toggleSort('data_lancamento')}>Data <SortIcon field="data_lancamento" /></th>
            <th className={`text-left ${headerCls}`} onClick={() => toggleSort('estabelecimento')}>Estabelecimento <SortIcon field="estabelecimento" /></th>
            <th className={`text-left ${headerCls}`} onClick={() => toggleSort('categoria')}>Categoria <SortIcon field="categoria" /></th>
            <th className="text-left py-2 font-semibold text-muted-foreground">Quem comprou</th>
            <th className="text-left py-2 font-semibold text-muted-foreground">Tipo de compra</th>
            <th className={`text-right ${headerCls}`} onClick={() => toggleSort('valor')}>Valor <SortIcon field="valor" /></th>
            <th className="text-left py-2 pl-3 font-semibold text-muted-foreground">Comprovante</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((l) => {
            const isExcluded = l.observacao?.includes('Não faz parte');
            const editingCat = editing?.id === l.id && editing?.field === 'categoria';
            return (
              <tr key={l.id} className={`border-b last:border-b-0 ${isExcluded ? 'opacity-40' : ''}`}>
                <td className="py-1.5 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                <td className="py-1.5 pr-2 min-w-[220px] max-w-[340px]" title={`${l.estabelecimento}${l.observacao ? ' — ' + l.observacao : ''}`}>
                  {l._cartaoInfo && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-1 mb-0.5">
                      {l._cartaoInfo.bandeira} · dia {l._cartaoInfo.dia}
                    </span>
                  )}
                  <div className="leading-tight break-words whitespace-normal">{l.estabelecimento}</div>
                  {l.observacao && !isExcluded && (
                    <div className="text-[10px] text-muted-foreground italic leading-tight mt-0.5 break-words">{l.observacao}</div>
                  )}
                  {isExcluded && <span className="text-[9px] text-red-500 font-semibold">(não contabilizado)</span>}
                </td>
                <td className="py-1.5">
                  {editingCat ? (
                    <Select
                      value={l.categoria || ''}
                      onValueChange={(v) => update(l.id, 'categoria', v)}
                      open
                      onOpenChange={(open) => { if (!open) setEditing(null); }}
                    >
                      <SelectTrigger className="h-6 text-[10px] px-1.5 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(allCategorias).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      onClick={() => setEditing({ id: l.id, field: 'categoria' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${catColor(l.categoria)}`}
                      title="Clique para editar"
                    >
                      {catLabel(l.categoria)}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  <SeletorClassificacao
                    eixo="origem"
                    entityName="LancamentoCartao"
                    record={l}
                    field="origem_compra"
                    onChange={(id, f, v) => {
                      // Mantém a natureza (empresarial/pessoal) sincronizada com "Quem comprou"
                      const nat = (v === 'pessoal' || v === 'pro_labore') ? 'pessoal' : 'empresarial';
                      if (l.natureza !== nat) update(id, 'natureza', nat);
                    }}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <SeletorClassificacao eixo="tipo" entityName="LancamentoCartao" record={l} field="tipo_compra" />
                </td>
                <td className={`py-1.5 text-right font-medium tabular-nums ${l.valor < 0 ? 'text-green-600' : ''}`}>
                  {formatCurrency(l.valor)}
                </td>
                <td className="py-1.5 pl-3">
                  <ComprovantePicker entityName="LancamentoCartao" record={l} onChange={onReload} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/20 font-bold">
            <td className="py-2 uppercase text-[10px] tracking-wider text-muted-foreground" colSpan={5}>
              Total ({localRows.length} lançamentos)
            </td>
            <td className="py-2 text-right tabular-nums text-sm">{formatCurrency(totalValor)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Adicionar nova categoria */}
      <div className="mt-2">
        {addingCat ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategoria(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }}
              placeholder="Nome da nova categoria"
              className="h-7 text-xs px-2 border rounded-md bg-background w-56"
            />
            <button onClick={addCategoria} className="h-7 px-3 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Adicionar
            </button>
            <button onClick={() => { setAddingCat(false); setNewCatName(''); }} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCat(true)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar categoria
          </button>
        )}
      </div>
    </div>
  );
}