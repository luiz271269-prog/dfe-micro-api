import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, HelpCircle, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import LancamentosEditableTable from './LancamentosEditableTable';

function formatMesLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[parseInt(mo)-1]}/${y}`;
}

export default function ConciliacaoCartoes({ lancamentos, selectedMonth, isAnnual, totalFaturas }) {
  const [obras, setObras] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ObraReforma.list(),
      base44.entities.DespesaOperacional.list(),
      base44.entities.ContaCartao.list(),
      base44.entities.FaturaCartao.list('-data_vencimento', 300),
    ]).then(([obrasData, despesasData, cartoesData, faturasData]) => {
      setObras(obrasData);
      setDespesas(despesasData);
      setCartoes(cartoesData);
      setFaturas(faturasData);
    });
  }, []);

  // Mapa fatura_id -> { bandeira, dia, label } para anotar cada lançamento
  const cartaoPorFatura = {};
  for (const f of faturas) {
    const c = cartoes.find(x => x.id === f.conta_cartao_id);
    if (c) cartaoPorFatura[f.id] = { bandeira: c.bandeira || '—', dia: c.dia_vencimento, titular: (c.titular || '').split(' ')[0] };
  }

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

  // A base deve refletir o banco: classifica TODOS os lançamentos do mês
  // (o valor_total das faturas os inclui). Não removemos nada aqui, senão
  // o total da conciliação nunca bate com o Total Faturas.
  const lancComClasse = lancamentos.map(l => ({
    ...l,
    _classe: classificarLanc(l),
    _cartaoInfo: cartaoPorFatura[l.fatura_id] || null,
  }));

  // Soma COM sinal — igual ao banco. O valor_total da fatura já é o líquido
  // (despesas menos pagamentos/estornos), então mantemos o sinal para bater.
  const classificacao = lancComClasse.reduce((acc, l) => {
    acc[l._classe] = (acc[l._classe] || 0) + (l.valor || 0);
    return acc;
  }, {});

  const totalClassificado = Object.values(classificacao).reduce((s, v) => s + v, 0);
  const total = totalClassificado;
  const divergenciaFaturas = totalFaturas != null && Math.abs(totalFaturas - totalClassificado) > 1
    ? totalClassificado - totalFaturas
    : 0;

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

      {divergenciaFaturas !== 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="text-amber-800">
            <span className="font-semibold">Divergência detectada:</span> soma dos lançamentos ({formatCurrency(totalClassificado)}) {divergenciaFaturas > 0 ? 'excede' : 'fica abaixo de'} Total Faturas ({formatCurrency(totalFaturas)}) em <span className="font-bold">{formatCurrency(Math.abs(divergenciaFaturas))}</span>. Use "Reparo Forense" no topo para corrigir.
          </span>
        </div>
      )}

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
        <div className="border-t px-4 pb-4 bg-background">
          <div className="flex items-center justify-between py-2 mb-2">
            <p className={`text-xs font-bold ${activeItem?.text}`}>
              {activeItem?.label} — {filteredLancs.length} lançamento(s)
            </p>
            <button onClick={() => setActiveKey(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <LancamentosEditableTable
            lancamentos={filteredLancs}
            onReload={() => window.dispatchEvent(new Event('neuralfinRefresh'))}
          />
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