import { formatCurrency } from '@/lib/formatters';

// Resumo compacto do topo — cada item filtra a lista (clicar de novo limpa)
export default function ResumoTopoExtrato({ lancamentos, totaisTipo, filtro, onFiltrar }) {
  const ultimo = [...lancamentos].filter(l => l.saldo_apos != null).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  const entradas = lancamentos.reduce((s, l) => s + ((l.valor || 0) > 0 ? l.valor : 0), 0);
  const saidas = lancamentos.reduce((s, l) => s + ((l.valor || 0) < 0 ? l.valor : 0), 0);
  const semFiltro = filtro.tipo === 'all' && filtro.categoria === 'all' && filtro.sinal === 'all';

  const itens = [
    { titulo: 'Saldo atual', valor: ultimo?.saldo_apos, ativo: semFiltro, cor: 'font-bold', onClick: () => onFiltrar({}) },
    { titulo: 'Entradas', valor: entradas, ativo: filtro.sinal === 'entrada', cor: 'text-green-600', onClick: () => onFiltrar({ sinal: filtro.sinal === 'entrada' ? 'all' : 'entrada' }) },
    { titulo: 'Saídas', valor: saidas, ativo: filtro.sinal === 'saida', cor: 'text-red-600', onClick: () => onFiltrar({ sinal: filtro.sinal === 'saida' ? 'all' : 'saida' }) },
    { titulo: '6. Investimentos', valor: totaisTipo.obras || 0, ativo: filtro.tipo === 'obras', onClick: () => onFiltrar({ tipo: filtro.tipo === 'obras' ? 'all' : 'obras' }) },
    { titulo: '8.02 Aplicações (fora da receita)', valor: totaisTipo.__aplicacoes || 0, ativo: filtro.categoria === 'aplicacoes', onClick: () => onFiltrar({ categoria: filtro.categoria === 'aplicacoes' ? 'all' : 'aplicacoes' }) },
    { titulo: '8.03 Resgates (fora da receita)', valor: totaisTipo.__resgates || 0, ativo: filtro.categoria === 'resgates', onClick: () => onFiltrar({ categoria: filtro.categoria === 'resgates' ? 'all' : 'resgates' }) },
  ];

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      {itens.map(i => (
        <button key={i.titulo} onClick={i.onClick}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${i.ativo ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted/50'}`}>
          <span className="text-muted-foreground">{i.titulo}:</span>
          <span className={`font-semibold tabular-nums ${i.cor || ''}`}>{i.valor != null ? formatCurrency(i.valor) : '—'}</span>
        </button>
      ))}
    </div>
  );
}