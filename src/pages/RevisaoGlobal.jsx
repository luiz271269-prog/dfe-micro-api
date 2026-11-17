import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import RevisaoFiltros from '@/components/revisao/RevisaoFiltros';
import RevisaoLista from '@/components/revisao/RevisaoLista';
import RevisaoDetalhe from '@/components/revisao/RevisaoDetalhe';
import RevisaoConfirmacao from '@/components/revisao/RevisaoConfirmacao';
import RevisaoCobertura from '@/components/revisao/RevisaoCobertura';
import { revisaoGlobal } from '@/functions/revisaoGlobal';

const PESO = { alta: 0, media: 1, baixa: 2 };
const erroDe = e => e.response?.data?.error || e.message;

export default function RevisaoGlobal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: ['revisao-global'], queryFn: async () => (await revisaoGlobal({ acao: 'listar' })).data });
  const [filtros, setFiltros] = useState({ modulo: 'todos', situacao: 'todos', estado: 'pendente' });
  const [sel, setSel] = useState(null);
  const [pedido, setPedido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const itens = useMemo(() => [...(data?.itens || [])].sort((a, b) => PESO[a.prioridade] - PESO[b.prioridade]), [data]);
  const modulos = useMemo(() => [...new Set(itens.map(i => i.modulo))], [itens]);
  const visiveis = itens.filter(i => (filtros.modulo === 'todos' || i.modulo === filtros.modulo) && (filtros.situacao === 'todos' || i.situacao === filtros.situacao) && (filtros.estado === 'todos' || i.estado === filtros.estado));
  const atual = itens.find(i => i.chave === sel);

  async function enviar(payload) {
    setOcupado(true); setErro('');
    const ok = await revisaoGlobal({ acao: 'decidir', ...payload }).then(() => true).catch(e => { setErro(erroDe(e)); return false; });
    setOcupado(false);
    if (ok) { setPedido(null); await qc.invalidateQueries({ queryKey: ['revisao-global'] }); }
    return ok;
  }
  function confirmar() {
    const { item, proc, alternativa } = pedido;
    if (proc.tipo === 'abrir') return navigate(proc.rota || item.rota);
    enviar({ chave: item.chave, procedimento_id: proc.id, alternativa });
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 lg:px-6 lg:py-6">
      <PageHeader title="Revisão Global" subtitle="Cada informação identificada nos módulos, com evidência e procedimentos para você escolher. Nada é alterado sem sua confirmação.">
        <Button variant="outline" className="gap-2" disabled={isFetching} onClick={() => qc.invalidateQueries({ queryKey: ['revisao-global'] })}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </PageHeader>
      <RevisaoCobertura modulos={data?.modulos} />
      <RevisaoFiltros modulos={modulos} filtros={filtros} onChange={setFiltros} />
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Não foi possível ler os módulos: {erroDe(error)}</p>}
      {isLoading ? (
        <div className="flex justify-center p-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <RevisaoLista itens={visiveis} selecionado={sel} onSelect={setSel} />
          <div className="lg:sticky lg:top-4 lg:self-start">
            <RevisaoDetalhe item={atual} ocupado={ocupado}
              onConfirmar={(item, proc, alternativa) => { setErro(''); setPedido({ item, proc, alternativa }); }}
              onAdiar={item => enviar({ chave: item.chave, adiar: true })} />
            {erro && !pedido && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
          </div>
        </div>
      )}
      <RevisaoConfirmacao pedido={pedido} ocupado={ocupado} erro={erro} onCancelar={() => setPedido(null)} onConfirmar={confirmar} />
    </div>
  );
}