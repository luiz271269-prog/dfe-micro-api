import { Fragment } from 'react';
import BaixasCandidato from '@/components/baixas/BaixasCandidato';
import CartaoVinculoForm from '@/components/baixas/cartao/CartaoVinculoForm';
import { fontesBaixas } from '@/components/baixas/baixasService';

export default function CartaoSecaoLocais({ locais, registro, sel, onSelect, onSubmit }) {
  const ativo = c => sel?.origem === 'local' && sel.id === c.id;
  return <section className="space-y-2">
    <h3 className="text-sm font-semibold">Compras, despesas e obras registradas no financeiro</h3>
    {!locais.length && <p className="text-sm text-muted-foreground">Nenhum documento local com valor e data compatíveis.</p>}
    {locais.map(c => <Fragment key={`${c.tipo}-${c.id}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{fontesBaixas[c.tipo]}</p>
      <BaixasCandidato c={c} selecionado={ativo(c)} rotulo="Vincular a este documento" onSelect={r => onSelect({ ...r, origem: 'local' })} />
      {ativo(c) && <CartaoVinculoForm registro={registro} candidato={sel} onSubmit={onSubmit} />}
    </Fragment>)}
  </section>;
}