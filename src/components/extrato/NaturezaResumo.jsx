import { classificarNaturezaBancaria } from '@/lib/naturezaCreditoExtrato';

const ITENS = [
  ['receita', 'Receitas', 'bg-emerald-500'],
  ['despesa', 'Despesas', 'bg-red-500'],
  ['aplicacao', 'Aplicações', 'bg-violet-500'],
  ['resgate', 'Resgates', 'bg-indigo-500'],
  ['transferencia', 'Transferências', 'bg-slate-400'],
  ['revisar', 'A revisar', 'bg-amber-500'],
];

export default function NaturezaResumo({ lancamentos = [] }) {
  const cont = { receita: 0, despesa: 0, aplicacao: 0, resgate: 0, transferencia: 0, revisar: 0 };
  lancamentos.forEach(l => {
    const { natureza } = classificarNaturezaBancaria(l);
    if (natureza === 'credito_revisar' || natureza === 'debito_revisar') cont.revisar += 1;
    else if (cont[natureza] !== undefined) cont[natureza] += 1;
  });
  if (!lancamentos.length) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {ITENS.map(([chave, rotulo, cor]) => (
        <div key={chave} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px]">
          <span className={`h-1.5 w-1.5 rounded-full ${cor}`} />
          <span className="text-muted-foreground">{rotulo}</span>
          <span className="font-semibold tabular-nums text-foreground">{cont[chave]}</span>
        </div>
      ))}
    </div>
  );
}