import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import CadastroNovoItem from '@/components/classificacao/CadastroNovoItem';
import PlanoContasTable from '@/components/classificacao/PlanoContasTable';
import useCadastroClassificacaoAdmin from '@/hooks/useCadastroClassificacaoAdmin';

export default function CadastroClassificacao() {
  const [mensagem, setMensagem] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const { itens, usuario, isLoading, salvar, salvarLote, sincronizarPlano } = useCadastroClassificacaoAdmin();
  const tipos = itens.filter(x => x.eixo === 'tipo' && x.ativo);
  const centros = itens.filter(x => x.eixo === 'origem' && x.ativo);
  const contas = itens.filter(x => x.eixo === 'categoria');
  async function executar(fn) { setError(''); setMensagem(''); try { return await fn(); } catch (e) { setError(e.response?.data?.error || e.message); } }
  async function sincronizar() { setSyncing(true); const r = await executar(sincronizarPlano); if (r) setMensagem(`Plano sincronizado: ${r.atualizados} atualizados e ${r.criados} criados. Validação concluída sem alterar o histórico.`); setSyncing(false); }
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando cadastro…</div>;
  if (usuario?.role !== 'admin') return <div className="p-8"><h1 className="text-xl font-bold">Acesso restrito</h1><p className="mt-2 text-muted-foreground">Somente administradores podem editar o cadastro mestre.</p></div>;
  return <div className="mx-auto max-w-[1800px] space-y-5 p-4 md:p-6">
    <PageHeader title="Cadastro de Classificação" subtitle="Plano de contas hierárquico com naturezas econômicas e centros de custo vinculados."><Button onClick={sincronizar} disabled={syncing} variant="outline"><RefreshCw className={syncing ? 'animate-spin' : ''} />{syncing ? 'Sincronizando…' : 'Sincronizar plano'}</Button></PageHeader>
    {error && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {mensagem && <div className="rounded-lg bg-success/10 p-3 text-sm text-success">{mensagem}</div>}
    <CadastroNovoItem eixo="categoria" tipos={tipos} centros={centros} onSave={dados => executar(() => salvar(dados))} />
    <PlanoContasTable itens={contas} tipos={tipos} centros={centros} onSave={dados => executar(() => salvarLote(dados))} />
  </div>;
}