import { fontesBaixas } from '@/components/baixas/baixasService';
export default function referenciasContaBaixa(item) {
  if (item.is_planejado || item._situacao === 'previsto') return [];
  const tipo = ({ despesa: 'DespesaOperacional', tributo: 'Tributo', folha: 'FolhaPagamento', fatura: 'FaturaCartao', compra: 'ItemCompra', obra: 'ObraReforma' })[item.origem_tipo];
  if (!fontesBaixas[tipo]) return [];
  return (item.origem_ids || [item.origem_id]).filter(Boolean).map(id => ({ tipo, id, descricao: item.descricao }));
}