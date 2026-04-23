import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wallet, Landmark, Users, CreditCard, AlertTriangle, CheckCircle, Calendar, ArrowRight } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency, formatDate } from '../lib/formatters';
import { consolidarContasPagar, calcularAging } from '../lib/contasPagarEngine';

const ORIGEM_CONFIG = {
  despesa: { icon: Wallet,     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Despesa', href: '/despesas' },
  tributo: { icon: Landmark,   color: 'bg-orange-100 text-orange-700 border-orange-200',   label: 'Tributo', href: '/tributos' },
  folha:   { icon: Users,      color: 'bg-indigo-100 text-indigo-700 border-indigo-200',   label: 'Folha',   href: '/funcionarios' },
  fatura:  { icon: CreditCard, color: 'bg-purple-100 text-purple-700 border-purple-200',   label: 'Cartão',  href: '/cartoes' },
};

const BUCKETS = [
  { key: 'vencidos', label: 'Vencidos', color: 'bg-red-50 border-red-300 text-red-700', icon: AlertTriangle },
  { key: 'hoje',     label: 'Hoje',     color: 'bg-amber-50 border-amber-300 text-amber-700', icon: Calendar },
  { key: 'semana',   label: 'Próximos 7 dias', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: Calendar },
  { key: 'ate15',    label: '8 a 15 dias',  color: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: Calendar },
  { key: 'ate30',    label: '16 a 30 dias', color: 'bg-blue-50 border-blue-200 text-blue-700', icon: Calendar },
  { key: 'acima30',  label: 'Acima de 30 dias', color: 'bg-slate-50 border-slate-200 text-slate-700', icon: Calendar },
  { key: 'semData',  label: 'Sem vencimento', color: 'bg-muted border-border text-muted-foreground', icon: Calendar },
];

export default function ContasAPagar() {
  const [loading, setLoading] = useState(true);
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos');
  const [dados, setDados] = useState({ despesas: [], tributos: [], folhas: [], faturas: [], cartoes: [] });

  async function load() {
    setLoading(true);
    const [despesas, tributos, folhas, faturas, cartoes] = await Promise.all([
      base44.entities.DespesaOperacional.list('-data_vencimento', 500),
      base44.entities.Tributo.list('-data_vencimento', 200),
      base44.entities.FolhaPagamento.list('-competencia', 500),
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.ContaCartao.filter({ is_ativo: true }),
    ]);
    setDados({ despesas, tributos, folhas, faturas, cartoes });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const itensRaw = useMemo(() => consolidarContasPagar(dados), [dados]);
  const itens = useMemo(() => {
    return itensRaw.filter(i => {
      if (filtroOrigem !== 'todos' && i.origem_tipo !== filtroOrigem) return false;
      if (filtroEmpresa !== 'todos' && i.empresa !== filtroEmpresa) return false;
      return true;
    });
  }, [itensRaw, filtroOrigem, filtroEmpresa]);

  const aging = useMemo(() => calcularAging(itens), [itens]);

  const total = itens.reduce((a, i) => a + (i.valor || 0), 0);
  const totalVencido = aging.vencidos.reduce((a, i) => a + (i.valor || 0), 0);
  const totalSemana = [...aging.hoje, ...aging.semana].reduce((a, i) => a + (i.valor || 0), 0);
  const totalMes = [...aging.hoje, ...aging.semana, ...aging.ate15, ...aging.ate30].reduce((a, i) => a + (i.valor || 0), 0);

  const totaisPorOrigem = useMemo(() => {
    const t = { despesa: 0, tributo: 0, folha: 0, fatura: 0 };
    itensRaw.forEach(i => { t[i.origem_tipo] = (t[i.origem_tipo] || 0) + i.valor; });
    return t;
  }, [itensRaw]);

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Contas a Pagar" subtitle="Visão consolidada: despesas, tributos, folha e faturas de cartão">
        <Button variant="outline" onClick={load} size="sm">Atualizar</Button>
      </PageHeader>

      {/* Totais principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white rounded-xl p-4 shadow">
          <p className="text-[10px] font-bold uppercase opacity-80">Total a pagar</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          <p className="text-[10px] opacity-80 mt-1">{itens.length} itens em aberto</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-[10px] font-bold uppercase text-red-700">Vencido</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalVencido)}</p>
          <p className="text-[10px] text-red-600 mt-1">{aging.vencidos.length} item(ns) em atraso</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <p className="text-[10px] font-bold uppercase text-orange-700">Próximos 7 dias</p>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalSemana)}</p>
          <p className="text-[10px] text-orange-600 mt-1">{aging.hoje.length + aging.semana.length} item(ns)</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-[10px] font-bold uppercase text-blue-700">Este mês (30d)</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalMes)}</p>
          <p className="text-[10px] text-blue-600 mt-1">Projeção de desembolso</p>
        </div>
      </div>

      {/* Filtro por origem */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <button onClick={() => setFiltroOrigem('todos')}
          className={`rounded-xl border p-3 text-left transition-all ${filtroOrigem === 'todos' ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Todas as origens</p>
          <p className="text-lg font-bold">{formatCurrency(itensRaw.reduce((a,i)=>a+i.valor,0))}</p>
          <p className="text-[10px] text-muted-foreground">{itensRaw.length} itens</p>
        </button>
        {Object.entries(ORIGEM_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const qtd = itensRaw.filter(i => i.origem_tipo === key).length;
          return (
            <button key={key} onClick={() => setFiltroOrigem(key)}
              className={`rounded-xl border p-3 text-left transition-all ${filtroOrigem === key ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
              <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {cfg.label}</p>
              <p className="text-lg font-bold">{formatCurrency(totaisPorOrigem[key] || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{qtd} item(ns)</p>
            </button>
          );
        })}
      </div>

      {/* Filtro empresa */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="font-bold text-muted-foreground">Empresa:</span>
        {['todos', 'NeuralTec', 'Liesch'].map(e => (
          <button key={e} onClick={() => setFiltroEmpresa(e)}
            className={`px-3 py-1 rounded-full border font-semibold ${filtroEmpresa === e ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
            {e === 'todos' ? 'Todas' : e}
          </button>
        ))}
      </div>

      {/* Buckets de aging */}
      {BUCKETS.map(b => {
        const lista = aging[b.key] || [];
        if (lista.length === 0) return null;
        const total = lista.reduce((a, i) => a + (i.valor || 0), 0);
        const Icon = b.icon;
        return (
          <div key={b.key} className={`rounded-xl border mb-3 overflow-hidden ${b.color}`}>
            <div className="px-4 py-2 flex items-center justify-between border-b border-current/20">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <h3 className="font-bold text-sm uppercase tracking-wide">{b.label}</h3>
                <span className="text-[10px] bg-white/60 rounded-full px-2 py-0.5 font-bold">{lista.length}</span>
              </div>
              <p className="font-bold">{formatCurrency(total)}</p>
            </div>
            <div className="bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="text-left px-3 py-1.5 font-semibold">Vencimento</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Origem</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Descrição</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Fornecedor</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Empresa</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Valor</th>
                    <th className="text-center px-3 py-1.5 font-semibold">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.sort((a,b)=>(a.data_vencimento||'').localeCompare(b.data_vencimento||'')).map(i => {
                    const cfg = ORIGEM_CONFIG[i.origem_tipo];
                    const OIcon = cfg.icon;
                    return (
                      <tr key={i.id} className="border-b hover:bg-muted/20">
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground font-medium">
                          {i.data_vencimento ? formatDate(i.data_vencimento) : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.color}`}>
                            <OIcon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-medium max-w-[280px] truncate">{i.descricao}</td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[180px] truncate">{i.fornecedor}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{i.empresa || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums text-rose-600">{formatCurrency(i.valor)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <Link to={cfg.href}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ArrowRight className="w-3 h-3" /></Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {itens.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-800">Tudo em dia!</p>
          <p className="text-xs text-emerald-700">Nenhuma conta a pagar pendente no filtro atual.</p>
        </div>
      )}
    </div>
  );
}