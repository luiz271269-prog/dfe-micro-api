import { AlertTriangle, TrendingUp, Users, Clock } from 'lucide-react';

const ICONS = {
  variacao_preco: TrendingUp,
  concentracao_fornecedor: Users,
  pagamento_pendente: Clock,
};

const CORES = {
  alta:  'bg-rose-50 border-rose-200 text-rose-900',
  media: 'bg-amber-50 border-amber-200 text-amber-900',
  baixa: 'bg-blue-50 border-blue-200 text-blue-900',
};

export default function AlertasControle({ alertas }) {
  if (!alertas || alertas.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-5 flex items-center gap-2">
        <span className="text-emerald-700 text-sm font-semibold">✓ Nenhuma anomalia detectada — compras em conformidade</span>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> {alertas.length} alerta(s) de governança
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {alertas.map((a, i) => {
          const Icon = ICONS[a.tipo] || AlertTriangle;
          return (
            <div key={i} className={`rounded-lg border p-3 ${CORES[a.severidade] || CORES.media}`}>
              <div className="flex items-start gap-2">
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{a.titulo}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{a.detalhe}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}