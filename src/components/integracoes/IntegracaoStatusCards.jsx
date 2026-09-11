import { Building2, Wrench, RefreshCw } from 'lucide-react';

export default function IntegracaoStatusCards({ registros, sincronizando }) {
  const locacoes = registros.filter(item => item.app_origem === 'locacoes').length;
  const assistencia = registros.filter(item => item.app_origem === 'assistencia').length;
  const pendentes = registros.filter(item => item.pendente_envio).length;
  const cards = [
    { label: 'Locações e condomínio', value: locacoes, icon: Building2 },
    { label: 'Assistência técnica', value: assistencia, icon: Wrench },
    { label: 'Aguardando envio', value: pendentes, icon: RefreshCw },
  ];
  return <div className="grid gap-3 sm:grid-cols-3 my-4">{cards.map(({ label, value, icon: Icon }) => (
    <div key={label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <Icon className={sincronizando ? 'text-primary animate-spin' : 'text-primary'} />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>
    </div>
  ))}</div>;
}