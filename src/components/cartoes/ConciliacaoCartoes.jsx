import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export default function ConciliacaoCartoes({ lancamentos, selectedMonth }) {
  const [obras, setObras] = useState([]);
  const [despesas, setDespesas] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.ObraReforma.list(),
      base44.entities.DespesaOperacional.list(),
    ]).then(([obrasData, despesasData]) => {
      setObras(obrasData);
      setDespesas(despesasData);
    });
  }, []);

  // Classificar lançamentos
  const classificacao = lancamentos.reduce((acc, lanc) => {
    const { estabelecimento, categoria, natureza, valor, observacao } = lanc;
    const desc = (estabelecimento || '').toUpperCase();

    if (observacao?.includes('Não faz parte')) {
      acc.excluido = (acc.excluido || 0) + Math.abs(valor || 0);
      return acc;
    }

    // Parcelamento: detectar múltiplos pagamentos iguais no mesmo mês
    const mesmoValor = lancamentos.filter(l => Math.abs((l.valor || 0) - (valor || 0)) < 0.01).length;
    if (mesmoValor >= 2 && (desc.includes('FINANCEIRA') || desc.includes('BANCO'))) {
      acc.parcelamento = (acc.parcelamento || 0) + Math.abs(valor || 0);
      return acc;
    }

    // Obra: se houver obra vinculada
    const obraVinculada = obras.some(o => 
      (o.data?.startsWith(selectedMonth) || true) && 
      (o.descricao?.toUpperCase().includes(desc.split(' ')[0]) || o.responsavel?.toUpperCase().includes(desc))
    );
    if (obraVinculada) {
      acc.obra = (acc.obra || 0) + Math.abs(valor || 0);
      return acc;
    }

    // Despesa: se houver despesa vinculada ou categoria de despesa
    const despesaVinculada = despesas.some(d => 
      (d.data?.startsWith(selectedMonth) || true) && 
      (d.descricao?.toUpperCase().includes(desc.split(' ')[0]) || d.fornecedor?.toUpperCase().includes(desc))
    );
    const categoriasDespesa = ['aluguel', 'energia', 'agua', 'manutencao', 'limpeza', 'contabilidade', 'juridico', 'seguro'];
    if (despesaVinculada || categoriasDespesa.includes(categoria)) {
      acc.despesa = (acc.despesa || 0) + Math.abs(valor || 0);
      return acc;
    }

    // Pessoal: natureza pessoal ou categorias pessoais
    const categoriassPessoais = ['alimentacao', 'combustivel', 'saude_bem_estar', 'beleza', 'farmacia', 'transporte', 'lazer'];
    if (natureza === 'pessoal' || categoriassPessoais.includes(categoria)) {
      acc.pessoal = (acc.pessoal || 0) + Math.abs(valor || 0);
      return acc;
    }

    // Padrão: não classificado
    acc.nao_classificado = (acc.nao_classificado || 0) + Math.abs(valor || 0);
    return acc;
  }, {});

  const total = Object.values(classificacao).reduce((s, v) => s + v, 0);

  const items = [
    { label: '🏗️ Obra e Reforma', key: 'obra', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700' },
    { label: '💼 Despesa Operacional', key: 'despesa', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
    { label: '👤 Gasto Pessoal', key: 'pessoal', color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700' },
    { label: '📅 Parcelamento', key: 'parcelamento', color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700' },
    { label: '❓ Não Classificado', key: 'nao_classificado', color: 'bg-red-50 border-red-200', textColor: 'text-red-700' },
    { label: '🚫 Excluído', key: 'excluido', color: 'bg-slate-50 border-slate-200', textColor: 'text-slate-700' },
  ];

  return (
    <div className="bg-card rounded-xl border overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 flex items-center gap-2.5">
        <AlertCircle className="w-5 h-5 text-white" />
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Conciliação de Cartões</h3>
      </div>
      
      <div className="p-5 space-y-3">
        {items.map(item => {
          const value = classificacao[item.key] || 0;
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          const hasValue = value > 0;

          return (
            <div key={item.key} className={`rounded-lg border p-3 ${item.color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${item.textColor}`}>{item.label}</span>
                {hasValue && <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white ${item.textColor}`}>{pct}%</span>}
              </div>
              <p className={`text-lg font-bold ${item.textColor}`}>
                {formatCurrency(value)}
              </p>
              {!hasValue && <p className={`text-xs ${item.textColor} opacity-60`}>Nenhum lançamento</p>}
            </div>
          );
        })}

        {/* Total */}
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total Geral</span>
            <p className="text-lg font-bold text-primary">{formatCurrency(total)}</p>
          </div>
        </div>

        {/* Alerta de não classificados */}
        {(classificacao.nao_classificado || 0) > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 mt-3 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-yellow-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Atenção: Lançamentos não classificados</p>
              <p className="text-xs text-yellow-700 mt-1">
                {formatCurrency(classificacao.nao_classificado)} ainda não foram categorizados. Classifique-os na tabela acima como Obra, Despesa ou Pessoal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}