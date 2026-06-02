import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, HelpCircle, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

function isPagamentoFatura(l) {
  if ((l.valor || 0) < 0) return true;
  const desc = `${l.estabelecimento || ''} ${l.observacao || ''}`.toLowerCase();
  return /pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento/.test(desc);
}

function formatMesLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[parseInt(mo)-1]}/${y}`;
}

export default function ConciliacaoCartoes({ lancamentos, selectedMonth, isAnnual, totalFaturas }) {
  const [obras, setObras] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ObraReforma.list(),
      base44.entities.DespesaOperacional.list(),
    ]).then(([obrasData, despesasData]) => {
      setObras(obrasData);
      setDespesas(despesasData);
    });
  }, []);

  // Classificar cada lançamento individualmente (para filtro por categoria)
  function classificarLanc(lanc) {
    const { estabelecimento, categoria, natureza, valor, observacao } = lanc;
    const desc = (estabelecimento || '').toUpperCase();

    if (observacao?.includes('Não faz parte')) return 'excluido';

    const mesmoValor = lancamentos.filter(l => Math.abs((l.valor || 0) - (valor || 0)) < 0.01).length;
    if (mesmoValor >= 2 && (desc.includes('FINANCEIRA') || desc.includes('BANCO'))) return 'parcelamento';

    const obraVinculada = obras.some(o =>
      (o.descricao?.toUpperCase().includes(desc.split(' ')[0]) || o.responsavel?.toUpperCase().includes(desc))
    );
    if (obraVinculada) return 'obra';

    const despesaVinculada = despesas.some(d =>
      (d.descricao?.toUpperCase().includes(desc.split(' ')[0]) || d.fornecedor?.toUpperCase().includes(desc))
    );
    const categoriasDespesa = ['aluguel', 'energia', 'agua', 'manutencao', 'limpeza', 'contabilidade', 'juridico', 'seguro'];
    if (despesaVinculada || categoriasDespesa.includes(categoria)) return 'despesa';

    const categoriassPessoais = ['alimentacao', 'combustivel', 'saude_bem_estar', 'beleza', 'farmacia', 'transporte', 'lazer'];
    if (natureza === 'pessoal' || categoriassPessoais.includes(categoria)) return 'pessoal';

    return 'nao_classificado';
  }

  // Exclui pagamentos da fatura anterior — não são despesas reais
  const lancsValidos = lancamentos.filter(l => !isPagamentoFatura(l));
  const lancComClasse = lancsValidos.map(l => ({ ...l, _classe: classificarLanc(l) }));

  const classificacao = lancComClasse.reduce((acc, l) => {
    acc[l._classe] = (acc[l._classe] || 0) + Math.abs(l.valor || 0);
    return acc;
  }, {});

  const totalClassificado = Object.values(classificacao).reduce((s, v) => s + v, 0);
  // Total Geral = soma real das faturas do mês (mesmo valor do card "Total Faturas")
  const total = totalFaturas != null ? totalFaturas : totalClassificado;
  const diferenca = total - totalClassificado;

  const items = [
    { label: '🏗️ Obra e Reforma',       key: 'obra',             bg: 'bg-orange-50',  border: 'border-orange-300', text: 'text-orange-700', activeBg: 'bg-orange-100' },
    { label: '💼 Despesa Operacional',   key: 'despesa',          bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-700',   activeBg: 'bg-blue-100' },
    { label: '👤 Gasto Pessoal',         key: 'pessoal',          bg: 'bg-purple-50',  border: 'border-purple-300', text: 'text-purple-700', activeBg: 'bg-purple-100' },
    { label: '📅 Parcelamento',          key: 'parcelamento',     bg: 'bg-amber-50',   border: 'border-amber-300',  text: 'text-amber-700',  activeBg: 'bg-amber-100' },
    { label: '❓ Não Classificado',      key: 'nao_classificado', bg: 'bg-red-50',     border: 'border-red-300',    text: 'text-red-700',    activeBg: 'bg-red-100' },
    { label: '🚫 Excluído',              key: 'excluido',         bg: 'bg-slate-50',   border: 'border-slate-300',  text: 'text-slate-600',  activeBg: 'bg-slate-100' },
  ];

  const filteredLancs = activeKey
    ? lancComClasse.filter(l => l._classe === activeKey)
    : [];

  const activeItem = items.find(i => i.key === activeKey);

  return (
    <div className="bg-card rounded-xl border overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 flex items-center gap-2.5">
        <AlertCircle className="w-5 h-5 text-white" />
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Conciliação de Cartões</h3>
        <span className="ml-auto text-[11px] font-semibold text-white/90 bg-white/15 px-2 py-0.5 rounded-full">
          {isAnnual ? 'Anual' : formatMesLabel(selectedMonth)}
        </span>
      </div>

      {/* Grid de cards lado a lado */}
      <div className="p-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {items.map(item => {
          const value = classificacao[item.key] || 0;
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
          const isActive = activeKey === item.key;

          return (
            <button
              key={item.key}
              onClick={() => setActiveKey(isActive ? null : item.key)}
              className={`rounded-lg border p-2.5 text-left transition-all hover:shadow-md ${
                isActive
                  ? `${item.activeBg} ${item.border} ring-2 ring-offset-1 ring-current`
                  : `${item.bg} ${item.border} hover:opacity-90`
              }`}
            >
              <p className={`text-[10px] font-semibold ${item.text} mb-1 leading-tight`}>{item.label}</p>
              <p className={`text-sm font-bold ${item.text} leading-tight`}>{formatCurrency(value)}</p>
              {value > 0 && (
                <p className={`text-[9px] ${item.text} opacity-70 mt-0.5`}>{pct}%</p>
              )}
            </button>
          );
        })}
      </div>



      {/* Listagem filtrada ao clicar */}
      {activeKey && filteredLancs.length > 0 && (
        <div className="border-t px-4 pb-4">
          <div className="flex items-center justify-between py-2 mb-2">
            <p className={`text-xs font-bold ${activeItem?.text}`}>
              {activeItem?.label} — {filteredLancs.length} lançamento(s)
            </p>
            <button onClick={() => setActiveKey(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Estabelecimento</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Natureza</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filteredLancs.map((l, i) => (
                  <tr key={i} className="border-b hover:bg-muted/10">
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{l.data_lancamento || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[180px] truncate">{l.estabelecimento || '—'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground capitalize">{l.natureza || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(Math.abs(l.valor || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeKey && filteredLancs.length === 0 && (
        <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
          Nenhum lançamento nesta categoria
        </div>
      )}


    </div>
  );
}