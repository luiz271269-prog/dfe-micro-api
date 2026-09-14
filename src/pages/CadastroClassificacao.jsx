import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CadastroNovoItem from '@/components/classificacao/CadastroNovoItem';
import CadastroClassificacaoLista from '@/components/classificacao/CadastroClassificacaoLista';
import useCadastroClassificacaoAdmin from '@/hooks/useCadastroClassificacaoAdmin';

const eixos = [
  { key: 'origem', label: '1. Quem comprou' },
  { key: 'tipo', label: '2. Natureza econômica' },
  { key: 'categoria', label: '3. Plano de contas' },
];

export default function CadastroClassificacao() {
  const [eixo, setEixo] = useState('origem');
  const [error, setError] = useState('');
  const { itens, usuario, isLoading, salvar, remover } = useCadastroClassificacaoAdmin();
  const tipos = itens.filter(x => x.eixo === 'tipo' && x.ativo);
  async function executar(fn) { setError(''); try { await fn(); } catch (e) { setError(e.response?.data?.error || e.message); } }
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando cadastro…</div>;
  if (usuario?.role !== 'admin') return <div className="p-8"><h1 className="text-xl font-bold">Acesso restrito</h1><p className="mt-2 text-muted-foreground">Somente administradores podem editar o cadastro mestre.</p></div>;
  return <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
    <PageHeader title="Cadastro de Classificação" subtitle="Fonte única para todo o app: responsável, natureza econômica e plano de contas." />
    {error && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    <Tabs value={eixo} onValueChange={setEixo}>
      <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">{eixos.map(x => <TabsTrigger key={x.key} value={x.key}>{x.label}</TabsTrigger>)}</TabsList>
      {eixos.map(x => <TabsContent key={x.key} value={x.key} className="space-y-3"><CadastroNovoItem eixo={x.key} tipos={tipos} onSave={dados => executar(() => salvar(dados))} /><CadastroClassificacaoLista itens={itens.filter(i => i.eixo === x.key)} tipos={tipos} onSave={(dados, id) => executar(() => salvar(dados, id))} onRemove={id => { if (window.confirm('Excluir esta classificação do cadastro mestre?')) executar(() => remover(id)); }} /></TabsContent>)}
    </Tabs>
  </div>;
}