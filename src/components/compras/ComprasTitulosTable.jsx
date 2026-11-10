import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import CompraPagamentoDados from '@/components/compras/CompraPagamentoDados';
import { Button } from '@/components/ui/button';
import BaixasSelecao from '@/components/baixas/BaixasSelecao';
import BaixaAcaoRegistro from '@/components/baixas/BaixaAcaoRegistro';
import CompraValor from '@/components/compras/CompraValor';

const statusLabel = { pendente: 'Pendente', parcial: 'Parcial', nao_identificado: 'Não identificado' };
export default function ComprasTitulosTable({ documentos, loading = false, embedded = false, onSaved, somenteLeitura = false, resumo }) {
  const referencias = doc => (doc.itens || []).map(i => ({ tipo: 'ItemCompra', id: i.id, descricao: `${doc.numero} · ${i.descricao_produto || doc.fornecedor}` }));
  const tabela = <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="border-b bg-muted/30">
      <th className="p-3 text-left">{somenteLeitura ? 'Data de criação da ordem' : 'Data da ordem / emissão'}</th><th className="p-3 text-left">Vencimento / prazo</th><th className="p-3 text-left">Nota / parcela</th>
      <th className="p-3 text-left">Fornecedor</th><th className="p-3 text-left">Pagamento</th><th className="p-3 text-left">Data de pagamento informada</th>
      <th className="p-3 text-left">{somenteLeitura ? 'Status na origem' : 'Status'}</th><th className="p-3 text-right">Valor da compra / parcela (R$)</th><th className="p-3 text-right">Em aberto (R$)</th><th className="p-3 text-right">Ação</th>
    </tr></thead>
    <tbody>{loading ? <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">Carregando...</td></tr>
      : documentos.length === 0 ? <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">Nenhuma nota ou parcela em aberto</td></tr>
      : documentos.map((doc) => <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20">
        <td className="p-3 whitespace-nowrap">{(somenteLeitura ? doc.data_criacao_ordem : doc.data_emissao) ? formatDate(somenteLeitura ? doc.data_criacao_ordem : doc.data_emissao) : 'Não informada'}</td>
        <td className="p-3 whitespace-nowrap">{doc.data_vencimento ? formatDate(doc.data_vencimento) : 'Não informado'}{doc.vencimento_previsto && <p className="text-xs text-muted-foreground">Previsão pela condição da OC</p>}</td>
        <td className="p-3"><p className="font-semibold">{doc.tipo} {doc.numero}</p><p className="text-xs text-muted-foreground">Parcela {doc.parcela}{doc.valor_previsto ? ' · rateio previsto' : ''}</p></td>
        <td className="p-3">{doc.fornecedor}</td><td className="p-3"><CompraPagamentoDados documento={doc} /></td>
        <td className="p-3 whitespace-nowrap">{doc.data_pagamento_informada ? formatDate(doc.data_pagamento_informada) : 'Não informada'}</td>
        <td className="p-3">{statusLabel[doc.status_pagamento] || doc.status_pagamento}</td>
        <td className="p-3 text-right font-semibold"><CompraValor valor={doc.valor_compra} moeda={doc.moeda_original} valorOriginal={doc.valor_original} taxaCambio={doc.taxa_cambio} /></td>
        <td className="p-3 text-right font-bold tabular-nums text-destructive">{formatCurrency(doc.valor)}</td>
        <td className="p-3 text-right">
          {!somenteLeitura && <BaixaAcaoRegistro registros={referencias(doc)} descricao={doc.numero} onSaved={onSaved} />}{' '}
          <Button asChild size="sm" variant="outline">
            <Link to={`/pedido-central/${encodeURIComponent(doc.itens?.[0]?.pedido_central_id || doc.numero)}`}>
              Mais <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </td>
      </tr>)}</tbody>
    {documentos.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30"><td colSpan={7} className="p-3 font-semibold">Total ({documentos.length} títulos)</td><td className="p-3 text-right font-bold">{formatCurrency(resumo?.valor_compra ?? documentos.reduce((s, d) => s + d.valor_compra, 0))}</td><td className="p-3 text-right font-bold text-destructive">{formatCurrency(resumo?.total ?? documentos.reduce((s, d) => s + d.valor, 0))}</td><td /></tr></tfoot>}
  </table></div>;
  const conteudo = embedded ? tabela : <div className="rounded-xl border bg-card overflow-hidden">{tabela}</div>;
  return somenteLeitura ? conteudo : <BaixasSelecao registros={documentos.flatMap(referencias)} onSaved={onSaved}>{conteudo}</BaixasSelecao>;
}