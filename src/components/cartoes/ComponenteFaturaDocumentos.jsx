import { Link } from 'react-router-dom';
const ORIGENS = { ItemCompra: { nome: 'Compra', rota: '/compras' }, DespesaOperacional: { nome: 'Despesa', rota: '/despesas' }, ObraReforma: { nome: 'Obra', rota: '/obras' } };
export default function ComponenteFaturaDocumentos({ documentos = [], situacao }) {
  if (!documentos.length) return <p className="text-muted-foreground mt-1">Sem documento associado visível nesta consulta. A natureza do lançamento pode explicar o componente.</p>;
  return <ul className="mt-2 space-y-1 border-l border-border pl-2">{documentos.map(doc => <li key={`${doc.entidade}-${doc.id}`}>
    <p><Link to={ORIGENS[doc.entidade]?.rota || '/cartoes'} className="text-primary underline">{ORIGENS[doc.entidade]?.nome || doc.entidade}{doc.numero ? ` ${doc.numero}` : ''}</Link> · {doc.descricao}</p>
    <p className="text-muted-foreground">{doc.vinculo} · {doc.natureza || 'Natureza não classificada'} · {situacao}. Sem baixa individual.</p>
  </li>)}</ul>;
}