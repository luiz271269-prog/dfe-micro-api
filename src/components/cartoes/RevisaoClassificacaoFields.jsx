import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';
export default function RevisaoClassificacaoFields({ value, onChange, disabled }) {
  const origens = useCadastroClassificacao('origem');
  const tipos = useCadastroClassificacao('tipo');
  const contas = useCadastroClassificacao('categoria', value.tipo_compra);
  const campos = [{ key: 'origem_compra', label: 'Quem comprou', cadastro: origens }, { key: 'tipo_compra', label: 'Tipo de compra', cadastro: tipos }, { key: 'categoria', label: 'Categoria / plano de contas', cadastro: contas }];
  function alterar(key, novo) {
    const next = { ...value, [key]: novo };
    if (key === 'origem_compra' && novo === 'pro_labore') next.tipo_compra = 'pro_labore';
    onChange(next);
  }
  return <div className="grid gap-3">{campos.map(c => <label key={c.key} className="grid gap-1 text-sm"><span>{c.label}</span>
    <select aria-label={c.label} value={value[c.key] || ''} disabled={disabled || c.cadastro.isLoading} onChange={e => alterar(c.key,e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60">
      <option value="">Selecione...</option>
      {value[c.key] && !c.cadastro.itens.some(i => i.chave === value[c.key]) && <option value={value[c.key]} disabled>{value[c.key]} (revisar cadastro)</option>}
      {c.cadastro.itens.map(i => <option key={i.chave} value={i.chave}>{i.rotulo}</option>)}
    </select>
  </label>)}</div>;
}