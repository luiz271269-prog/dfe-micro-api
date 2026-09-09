import { getOpcoes, getCor, loadCustom } from '@/lib/classificacaoUnificada';

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MatrizClassificacao({ vinculos, onSelecionar }) {
  const custom = loadCustom();
  const origens = getOpcoes('origem', custom);
  const tipos = { ...getOpcoes('tipo', custom), __fatura__: 'Faturas (composição no cartão)' };

  const chaveO = Object.keys(origens).concat('__sem__');
  const chaveT = Object.keys(tipos).concat('__sem__');

  const matriz = {};
  const grupos = {};
  let total = 0;
  for (const v of vinculos) {
    const o = origens[v.origem_compra] ? v.origem_compra : '__sem__';
    const t = v.entidade_tipo === 'FaturaCartao' ? '__fatura__' : tipos[v.tipo_compra] ? v.tipo_compra : '__sem__';
    const k = `${o}|${t}`;
    matriz[k] = (matriz[k] || 0) + (v.valor_alocado || 0);
    (grupos[k] = grupos[k] || []).push(v);
    total += v.valor_alocado || 0;
  }
  const somaLinha = (o) => chaveT.reduce((s, t) => s + (matriz[`${o}|${t}`] || 0), 0);
  const somaCol = (t) => chaveO.reduce((s, o) => s + (matriz[`${o}|${t}`] || 0), 0);

  const label = (map, k) => (k === '__sem__' ? 'Pendente de classificação' : map[k]);
  const linhasVisiveis = chaveO.filter((o) => somaLinha(o) > 0);
  const colsVisiveis = chaveT.filter((t) => somaCol(t) > 0);

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-semibold">Quem comprou \ Tipo</th>
            {colsVisiveis.map((t) => (
              <th key={t} className="text-right p-2 font-medium whitespace-nowrap">
                <span className={`px-1.5 py-0.5 rounded ${getCor('tipo', t)}`}>{label(tipos, t)}</span>
              </th>
            ))}
            <th className="text-right p-2 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhasVisiveis.map((o) => (
            <tr key={o} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-2">
                <span className={`px-1.5 py-0.5 rounded ${getCor('origem', o)}`}>{label(origens, o)}</span>
              </td>
              {colsVisiveis.map((t) => {
                const v = matriz[`${o}|${t}`] || 0;
                return (
                  <td
                    key={t}
                    onClick={() => v && onSelecionar?.(
                      `${label(origens, o)} · ${label(tipos, t)}`,
                      grupos[`${o}|${t}`] || []
                    )}
                    className={`text-right p-2 tabular-nums text-muted-foreground ${v ? 'cursor-pointer hover:bg-primary/10 hover:text-foreground' : ''}`}
                  >
                    {v ? fmt(v) : '—'}
                  </td>
                );
              })}
              <td className="text-right p-2 tabular-nums font-semibold">{fmt(somaLinha(o))}</td>
            </tr>
          ))}
          <tr className="bg-muted/50 font-semibold">
            <td className="p-2">Total</td>
            {colsVisiveis.map((t) => (
              <td key={t} className="text-right p-2 tabular-nums">{fmt(somaCol(t))}</td>
            ))}
            <td className="text-right p-2 tabular-nums">{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}