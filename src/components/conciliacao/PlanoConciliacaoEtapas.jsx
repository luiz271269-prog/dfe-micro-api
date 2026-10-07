import { Link } from 'react-router-dom';
import { ETAPAS_CONCILIACAO, PLANO_INTEGRAL } from '@/components/conciliacao/planoIntegral';
export default function PlanoConciliacaoEtapas() {
  return <section className="bg-card text-card-foreground border rounded-xl p-4 mt-5 space-y-4">
    <h2 className="font-semibold">Plano integral de conciliação</h2>
    <p className="text-sm text-muted-foreground">15 frentes planejadas. Este roteiro não certifica que os dados estejam conciliados. Compra por competência; quitação da fatura somente no caixa.</p>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{ETAPAS_CONCILIACAO.map(e=><div key={e.nome} className="border rounded-lg p-3"><h3 className="text-sm font-semibold">{e.nome}</h3><p className="text-xs text-primary my-1">Dependência: {e.dependencia}</p><p className="text-xs text-muted-foreground">Aceite: {e.aceite}</p></div>)}</div>
    <div className="space-y-2">{PLANO_INTEGRAL.map(g=><details key={g.id} className="border rounded-lg p-3"><summary className="cursor-pointer text-sm font-medium">{g.priority} · {g.grupo} · {g.title}</summary><p className="text-sm mt-2">{g.desc}</p><p className="text-xs text-muted-foreground mt-2">Critério de aceite: {g.aceite}</p><Link to={g.rota} className="inline-block text-xs text-primary underline mt-2">Abrir módulo relacionado</Link></details>)}</div>
  </section>;
}