import { resumirCarteiraSelecionada } from '@/functions/resumirCarteiraSelecionada';

export default async function consultarLiquidacoes(obras = [], faturas = []) {
  const response = await resumirCarteiraSelecionada({ acao: 'liquidacoes', ObraReforma: obras.map(r => r.id), FaturaCartao: faturas.map(r => r.id) });
  if (response.data?.error) throw new Error(response.data.error);
  const anexar = (registros, entidade) => registros.map(r => ({ ...r, liquidacao_consulta: response.data.liquidacoes[entidade][r.id] }));
  return { obras: anexar(obras, 'ObraReforma'), faturas: anexar(faturas, 'FaturaCartao') };
}