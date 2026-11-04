import { percentuaisDRE, formatarPercentualDRE } from '@/components/dre/percentuaisDRE';

export default function DREPercentuais({ valor, base, tipo }) {
  const itens = percentuaisDRE(valor, base, tipo);
  return (
    <>
      {itens.length > 0 && <div className="mt-1 space-y-0.5 text-[10px] font-normal text-muted-foreground tabular-nums xl:hidden">
        {itens.map(item => (
          <span key={item.chave} className="block" title={item.valor === null ? 'Percentual indisponível: base zero ou não informada.' : undefined}>
            {formatarPercentualDRE(item.valor)} {item.label}
          </span>
        ))}
      </div>}
      <div className="hidden xl:contents">
        {['bruta', 'liquida', 'lucro'].map(chave => {
          const item = itens.find(percentual => percentual.chave === chave);
          return <span key={chave} className="text-right text-xs font-normal text-muted-foreground tabular-nums" title={item ? (item.valor === null ? 'Percentual indisponível: base zero ou não informada.' : item.label) : 'Não se aplica'}>
            {item ? formatarPercentualDRE(item.valor) : ''}
          </span>;
        })}
      </div>
    </>
  );
}