import { TIPOS_COMPRA } from '@/lib/classificacaoUnificada';

const NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtMes = (m) => `${NOMES[parseInt(m.split('-')[1], 10) - 1]}/${m.slice(2, 4)}`;
const fmt = (v) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const rotulo = (t) => TIPOS_COMPRA[t] || t.replace(/_/g, ' ');

export default function TabelaMensalPorTipo({ dados, tipos }) {
  const totalTipo = (t) => dados.reduce((s, d) => s + (d[t] || 0), 0);
  const ordenados = [...tipos].sort((a, b) => totalTipo(b) - totalTipo(a));

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Pagamentos mês a mês por tipo</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-card">Tipo</th>
              {dados.map((d) => (
                <th key={d.mes} className="text-right font-medium py-2 px-2 whitespace-nowrap">{fmtMes(d.mes)}</th>
              ))}
              <th className="text-right font-semibold py-2 pl-2">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-muted/30">
              <td className="py-2 pr-3 font-semibold sticky left-0 bg-card">Faturamento</td>
              {dados.map((d) => (
                <td key={d.mes} className="text-right py-2 px-2 font-semibold text-emerald-600 whitespace-nowrap">{fmt(d.receita)}</td>
              ))}
              <td className="text-right py-2 pl-2 font-bold text-emerald-600 whitespace-nowrap">
                {fmt(dados.reduce((s, d) => s + d.receita, 0))}
              </td>
            </tr>
            {ordenados.map((t) => (
              <tr key={t} className="border-b last:border-0">
                <td className="py-2 pr-3 capitalize sticky left-0 bg-card">{rotulo(t)}</td>
                {dados.map((d) => (
                  <td key={d.mes} className="text-right py-2 px-2 whitespace-nowrap">{fmt(d[t])}</td>
                ))}
                <td className="text-right py-2 pl-2 font-semibold whitespace-nowrap">{fmt(totalTipo(t))}</td>
              </tr>
            ))}
            <tr className="border-t">
              <td className="py-2 pr-3 font-semibold sticky left-0 bg-card">Total pago</td>
              {dados.map((d) => (
                <td key={d.mes} className="text-right py-2 px-2 font-semibold text-red-600 whitespace-nowrap">{fmt(d.custoTotal)}</td>
              ))}
              <td className="text-right py-2 pl-2 font-bold text-red-600 whitespace-nowrap">
                {fmt(dados.reduce((s, d) => s + d.custoTotal, 0))}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-semibold sticky left-0 bg-card">Resultado</td>
              {dados.map((d) => (
                <td key={d.mes} className={`text-right py-2 px-2 font-semibold whitespace-nowrap ${d.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(d.resultado)}
                </td>
              ))}
              <td className="text-right py-2 pl-2 font-bold whitespace-nowrap">
                {fmt(dados.reduce((s, d) => s + d.resultado, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}