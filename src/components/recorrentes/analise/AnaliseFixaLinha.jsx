import { formatCurrency, formatDate } from '@/lib/formatters';

// Cada origem define um trio de cores (fundo da etiqueta, tinta da etiqueta, preenchimento da barra).
const CORES = {
  empresa: 'var(--primary)', pro_labore: 'var(--chart-5)', pessoal: 'var(--warning)', condominio: 'var(--success)',
};
const HACHURA = { backgroundImage: 'repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.4) 0 1.7px, transparent 1.7px 6.364px)' };
const CANAIS = { extrato: 'Extrato bancário', cartao: 'Cartão' };
const pct = v => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default function AnaliseFixaLinha({ item, base, primeira }) {
  const { cadastro: c, pago } = item, lado = item[base];
  const cor = CORES[c.origem] || 'var(--muted-foreground)';
  const trio = { '--sc8-tag-bg': `hsl(${cor} / 0.12)`, '--sc8-tag-ink': 'hsl(var(--foreground))', '--sc8-fill': `hsl(${cor})` };
  return (
    <li data-sc8-row className={`relative ${primeira ? '' : 'mt-6 pt-6'}`} style={trio}>
      {!primeira && <span data-sc8-rule className="absolute inset-x-0 top-0 h-px origin-left bg-border" />}
      <span data-sc8-rise className="inline-block rounded-sm px-2 py-1 font-mono text-[11px] leading-none" style={{ background: 'var(--sc8-tag-bg)', color: 'var(--sc8-tag-ink)' }}>
        {c.origem_rotulo || 'Origem não definida'} · {c.categoria_rotulo}
      </span>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h4 data-sc8-rise className="min-w-0 truncate text-base font-semibold capitalize">{item.nome}{!item.ativa && <span className="ml-2 text-xs font-normal text-muted-foreground">inativa</span>}</h4>
        <p className="shrink-0 whitespace-nowrap text-base font-semibold tabular-nums">
          <span data-sc8-num={lado.media_mensal} className="inline-block text-right">{formatCurrency(lado.media_mensal)}</span>
          <span className="ml-1 text-xs font-normal text-muted-foreground">/mês · {pct(lado.pct)}</span>
        </p>
      </div>
      <div role="meter" aria-label={`Participação de ${item.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lado.pct)} className="mt-2 h-3" style={HACHURA}>
        <span data-sc8-fill className="block h-full origin-left" style={{ width: `${lado.barra}%`, background: 'var(--sc8-fill)' }} />
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div><dt className="inline font-semibold text-foreground">Cadastro: </dt><dd className="inline">{[c.empresa || 'empresa não definida', c.forma || 'forma não definida', `${formatCurrency(c.valor_esperado)} ${c.frequencia}`, `palavra-chave "${c.padrao}"`].join(' · ')}</dd></div>
        <div><dt className="inline font-semibold text-foreground">Pagamentos: </dt>
          {pago.ocorrencias ? <dd className="inline">{[pago.canais.map(k => CANAIS[k]).join(' e '), ...pago.contas, `classificado como ${pago.origem_rotulo || 'sem origem'} / ${pago.categoria_rotulo || 'sem conta'}`, `${pago.meses} de 12 meses`, `${pago.ocorrencias} lançamento(s), total ${formatCurrency(pago.total)}`, `último em ${formatDate(pago.ultima_data)}`, pago.conciliado_total ? `${formatCurrency(pago.conciliado_total)} conciliado` : 'não conciliado'].join(' · ')}</dd>
            : <dd className="inline text-warning">Nenhum pagamento identificado no extrato ou cartão nos últimos 12 meses.</dd>}
        </div>
      </dl>
    </li>
  );
}