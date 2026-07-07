import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import BancoHorasForm from './BancoHorasForm';

function fmtHoras(h) {
  const sinal = h < 0 ? '-' : '';
  const abs = Math.abs(h);
  const horas = Math.floor(abs);
  const min = Math.round((abs - horas) * 60);
  return `${sinal}${horas}h${min > 0 ? String(min).padStart(2, '0') : ''}`;
}

export default function BancoHorasTab({ funcionarios }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroFunc, setFiltroFunc] = useState(null);

  async function load() {
    const list = await base44.entities.BancoHoras.list('-data', 1000);
    setLancamentos(list);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const saldos = useMemo(() => {
    const ativos = funcionarios.filter((f) => f.status !== 'desligado');
    return ativos.map((func) => {
      const meus = lancamentos.filter((l) => l.funcionario_nome === func.nome);
      const creditos = meus.filter((l) => l.tipo === 'credito').reduce((s, l) => s + (l.horas || 0), 0);
      const debitos = meus.filter((l) => l.tipo === 'debito').reduce((s, l) => s + (l.horas || 0), 0);
      return { func, creditos, debitos, saldo: creditos - debitos, qtd: meus.length };
    }).sort((a, b) => b.saldo - a.saldo);
  }, [funcionarios, lancamentos]);

  async function handleExcluir(l) {
    if (!confirm(`Excluir lançamento de ${l.funcionario_nome} (${fmtHoras(l.horas)})?`)) return;
    await base44.entities.BancoHoras.delete(l.id);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const visiveis = filtroFunc ? lancamentos.filter((l) => l.funcionario_nome === filtroFunc) : lancamentos;

  return (
    <div className="space-y-6">
      {/* Saldos por funcionário */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Saldo por Funcionário</p>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Lançar Horas</Button>
        </div>
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Funcionário</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Créditos</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Débitos</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Saldo</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Lançamentos</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map(({ func, creditos, debitos, saldo, qtd }) => (
                <tr key={func.id}
                  onClick={() => setFiltroFunc(filtroFunc === func.nome ? null : func.nome)}
                  className={`border-b hover:bg-muted/20 transition-colors cursor-pointer ${filtroFunc === func.nome ? 'bg-primary/5' : ''}`}>
                  <td className="px-4 py-2.5 font-semibold">{func.nome}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{creditos > 0 ? `+${fmtHoras(creditos)}` : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{debitos > 0 ? `-${fmtHoras(debitos)}` : '—'}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${saldo > 0 ? 'text-green-700' : saldo < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{fmtHoras(saldo)}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{qtd || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtroFunc && <p className="text-xs text-muted-foreground mt-1">Mostrando lançamentos de <b>{filtroFunc}</b> — clique na linha novamente para ver todos</p>}
      </div>

      {/* Lançamentos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Lançamentos</p>
        {visiveis.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum lançamento de banco de horas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visiveis.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 bg-card border rounded-xl px-4 py-2.5 text-sm">
                {l.tipo === 'credito'
                  ? <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                  : <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="font-semibold">{l.funcionario_nome}</span>
                <span className="text-xs text-muted-foreground">{formatDate(l.data)}</span>
                <span className={`font-bold tabular-nums ${l.tipo === 'credito' ? 'text-green-700' : 'text-red-600'}`}>
                  {l.tipo === 'credito' ? '+' : '-'}{fmtHoras(l.horas)}
                </span>
                {l.descricao && <span className="text-xs text-muted-foreground italic">{l.descricao}</span>}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 ml-auto" title="Excluir" onClick={() => handleExcluir(l)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BancoHorasForm open={showForm} onClose={() => setShowForm(false)} funcionarios={funcionarios} onSaved={load} />
    </div>
  );
}