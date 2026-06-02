import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatCurrency, formatDate } from '../../lib/formatters';

export const categoriaLabels = {
  alimentacao: 'Alimentação', combustivel: 'Combustível', lazer: 'Lazer',
  tecnologia: 'Tecnologia', servico_pessoal: 'Serviço Pessoal', saude_bem_estar: 'Saúde/Bem-Estar',
  beleza: 'Beleza', farmacia: 'Farmácia', transporte: 'Transporte',
  financeiro: 'Financeiro', seguro: 'Seguro',
  produtos: 'Produtos', estoque: 'Estoque',
  outro: 'Outro',
};

export const categoriaColors = {
  alimentacao: 'bg-green-100 text-green-700', combustivel: 'bg-orange-100 text-orange-700',
  lazer: 'bg-purple-100 text-purple-700', tecnologia: 'bg-blue-100 text-blue-700',
  servico_pessoal: 'bg-pink-100 text-pink-700', saude_bem_estar: 'bg-teal-100 text-teal-700',
  beleza: 'bg-rose-100 text-rose-700', farmacia: 'bg-cyan-100 text-cyan-700',
  transporte: 'bg-slate-100 text-slate-700', financeiro: 'bg-red-100 text-red-700',
  seguro: 'bg-gray-100 text-gray-700',
  produtos: 'bg-indigo-100 text-indigo-700', estoque: 'bg-emerald-100 text-emerald-700',
  outro: 'bg-amber-100 text-amber-700',
};

export default function LancamentosEditableTable({ lancamentos, onReload }) {
  const [editing, setEditing] = useState(null);
  const [localRows, setLocalRows] = useState(lancamentos || []);

  // Sincroniza com props quando lista externa muda (carregamento silencioso, novo mês, etc.)
  useEffect(() => { setLocalRows(lancamentos || []); }, [lancamentos]);

  async function update(id, field, value) {
    // Otimista: atualiza local imediatamente sem fechar painel
    setLocalRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setEditing(null);
    try {
      await base44.entities.LancamentoCartao.update(id, { [field]: value });
    } catch (e) {
      // Rollback em caso de erro
      setLocalRows(lancamentos || []);
      console.error('Erro ao salvar', e);
    }
  }

  if (!localRows || localRows.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhum lançamento</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold text-muted-foreground">Data</th>
            <th className="text-left py-2 font-semibold text-muted-foreground">Estabelecimento</th>
            <th className="text-left py-2 font-semibold text-muted-foreground">Categoria</th>
            <th className="text-left py-2 font-semibold text-muted-foreground">Natureza</th>
            <th className="text-right py-2 font-semibold text-muted-foreground">Valor</th>
          </tr>
        </thead>
        <tbody>
          {localRows.map(l => {
            const isExcluded = l.observacao?.includes('Não faz parte');
            const editingCat = editing?.id === l.id && editing?.field === 'categoria';
            const editingNat = editing?.id === l.id && editing?.field === 'natureza';
            return (
              <tr key={l.id} className={`border-b last:border-b-0 ${isExcluded ? 'opacity-40' : ''}`}>
                <td className="py-1.5 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                <td className="py-1.5 pr-2 min-w-[220px] max-w-[340px]" title={`${l.estabelecimento}${l.observacao ? ' — ' + l.observacao : ''}`}>
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
                      onValueChange={v => update(l.id, 'categoria', v)}
                      open
                      onOpenChange={open => { if (!open) setEditing(null); }}
                    >
                      <SelectTrigger className="h-6 text-[10px] px-1.5 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoriaLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      onClick={() => setEditing({ id: l.id, field: 'categoria' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${categoriaColors[l.categoria] || 'bg-slate-100 text-slate-700'}`}
                      title="Clique para editar"
                    >
                      {categoriaLabels[l.categoria] || l.categoria || '—'}
                    </span>
                  )}
                </td>
                <td className="py-1.5">
                  {editingNat ? (
                    <Select
                      value={l.natureza || ''}
                      onValueChange={v => update(l.id, 'natureza', v)}
                      open
                      onOpenChange={open => { if (!open) setEditing(null); }}
                    >
                      <SelectTrigger className="h-6 text-[10px] px-1.5 w-[110px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empresarial">empresarial</SelectItem>
                        <SelectItem value="pessoal">pessoal</SelectItem>
                        <SelectItem value="reembolso">reembolso</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      onClick={() => setEditing({ id: l.id, field: 'natureza' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${l.natureza === 'empresarial' ? 'bg-blue-100 text-blue-700' : l.natureza === 'reembolso' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}
                      title="Clique para editar"
                    >
                      {l.natureza || '—'}
                    </span>
                  )}
                </td>
                <td className={`py-1.5 text-right font-medium ${l.valor < 0 ? 'text-green-600' : ''}`}>
                  {formatCurrency(l.valor)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}