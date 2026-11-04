import { percentuaisDRE, formatarPercentualDRE } from '@/components/dre/percentuaisDRE';

export default function DREPercentuais({ valor, base, tipo }) {
  const itens = percentuaisDRE(valor, base, tipo);
  if (!itens.length) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[10px] font-normal text-muted-foreground tabular-nums">
      {itens.map(item => (
        <span key={item.chave} className="block" title={item.valor === null ? 'Percentual indisponível: base zero ou não informada.' : undefined}>
          {formatarPercentualDRE(item.valor)} {item.label}
        </span>
      ))}
    </div>
  );
}