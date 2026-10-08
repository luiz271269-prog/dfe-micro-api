import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resumirCarteiraSelecionada } from '@/functions/resumirCarteiraSelecionada';
import { formatCurrency } from '@/lib/formatters';

const ENTIDADES = { despesa: 'DespesaOperacional', tributo: 'Tributo', folha: 'FolhaPagamento', fatura: 'FaturaCartao', compra: 'ItemCompra', obra: 'ObraReforma' };
export default function ResumoSituacaoCarteira({ abertos, pagos, versao }) {
  const selecao = useMemo(() => {
    const mapear = itens => {
      const fontes = {};
      for (const item of itens) {
        const entidade = ENTIDADES[item.origem_tipo];
        if (!entidade || item.is_planejado) continue;
        fontes[entidade] ||= new Set();
        for (const id of item.origem_ids || [item.origem_id]) if (id) fontes[entidade].add(id);
      }
      return Object.fromEntries(Object.entries(fontes).map(([nome, ids]) => [nome, [...ids].sort()]));
    };
    return { aberto: mapear(abertos), pago: mapear(pagos) };
  }, [abertos, pagos]);
  const { data, isFetching, error } = useQuery({
    queryKey: ['resumo-carteira-selecionada', selecao, versao],
    queryFn: async () => {
      const response = await resumirCarteiraSelecionada(selecao);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    }, staleTime: 120000, retry: false, refetchOnWindowFocus: false,
  });
  return <section className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4" aria-busy={isFetching}>
    {[['aberto', 'Saldo confirmado em aberto', 'Obrigações registradas, descontados os pagamentos informados.'], ['pago', 'Documentos quitados por emissão', 'Valor dos documentos; não representa saída de caixa neste período.']].map(([chave, titulo, descricao]) => <div key={chave} className="rounded-xl border bg-card px-3 py-2">
      <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
      <p className="text-xl font-bold tabular-nums">{isFetching ? 'Calculando…' : error ? 'Indisponível' : formatCurrency(data?.[chave]?.valor || 0)}</p>
      <p className="text-xs text-muted-foreground">{descricao}</p>
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error.message}</p>}
    <p className="text-xs text-muted-foreground sm:col-span-2">Resumo dos registros carregados na consulta, empresa e natureza selecionadas. Previsões sem documento ficam separadas e não são dívida confirmada.</p>
  </section>;
}