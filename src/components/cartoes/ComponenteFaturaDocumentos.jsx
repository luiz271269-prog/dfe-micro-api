import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';
const ORIGENS = { ItemCompra: { nome: 'Compra', rota: '/compras' }, DespesaOperacional: { nome: 'Despesa', rota: '/despesas' }, ObraReforma: { nome: 'Obra', rota: '/obras' } };
export default function ComponenteFaturaDocumentos({ documentos = [], situacao }) {
  const { opcoes: categorias } = useCadastroClassificacao('categoria');
  const { opcoes: origens } = useCadastroClassificacao('origem');
  const { opcoes: tipos } = useCadastroClassificacao('tipo');
  if (!documentos.length) return <p className="text-muted-foreground mt-2">Nenhum compromisso vinculado localizado nesta consulta. Não foram inferidos vínculos por semelhança.</p>;
  return <div className="mt-2 space-y-2"><ul className="space-y-2 border-l border-border pl-2">{documentos.map(doc => <li key={`${doc.entidade}-${doc.id}`} className="space-y-1">
    <p className="font-medium"><Link to={ORIGENS[doc.entidade]?.rota || '/cartoes'} className="text-primary underline">{ORIGENS[doc.entidade]?.nome || doc.entidade}{doc.numero ? ` ${doc.numero}` : ''}</Link> · {doc.descricao}</p>
    {doc.fornecedor && <p>{doc.fornecedor}</p>}
    <p className="text-muted-foreground">Referência: {doc.id}</p>
    <p>Valor do documento: {formatCurrency(doc.valor_documento)} · Vencimento: {doc.vencimento ? formatDate(doc.vencimento) : 'Não informado'}</p>
    {doc.valor_alocado > 0 && <p>Valor vinculado à transação: {formatCurrency(doc.valor_alocado)}</p>}
    <p>Situação registrada no documento: {doc.status_documento?.replace(/_/g, ' ') || 'Não informada'}</p>
    <p className="text-muted-foreground">Classificação do documento: {origens[doc.origem_compra] || doc.origem_compra || 'Quem comprou não definido'} · {tipos[doc.tipo_compra] || doc.tipo_compra || 'Tipo não definido'} · {categorias[doc.categoria] || doc.categoria || 'Categoria não definida'}</p>
    <p className="text-muted-foreground">{doc.vinculo}{situacao ? ` · ${situacao}` : ''}</p>
  </li>)}</ul><p className="text-muted-foreground">Vínculo documental não comprova pagamento da fatura. O documento explica a compra; não representa uma nova cobrança além da fatura.</p></div>;
}