import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import CadastroNovoItem from '@/components/classificacao/CadastroNovoItem';
import CadastroClassificacaoLista from '@/components/classificacao/CadastroClassificacaoLista';
import useCadastroClassificacaoAdmin from '@/hooks/useCadastroClassificacaoAdmin';

const eixos = [
  { key: 'categoria', label: '1. Plano de contas' },
  { key: 'tipo', label: '2. Natureza econômica' },
  { key: 'origem', label: '3. Centro de custo' },
];

export default function CadastroClassificacao() {
  const [error, setError] = useState('');
  const { itens, usuario, isLoading, salvar, remover } = useCadastroClassificacaoAdmin();
  const tipos = itens.filter(x => x.eixo === 'tipo' && x.ativo);
  const centros = itens.filter(x => x.eixo === 'origem' && x.ativo);
  async function executar(fn) { setError(''); try { await fn(); } catch (e) { setError(e.response?.data?.error || e.message); } }
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando cadastro…</div>;
  if (usuario?.role !== 'admin') return <div className="p-8"><h1 className="text-xl font-bold">Acesso restrito</h1><p className="mt-2 text-muted-foreground">Somente administradores podem editar o cadastro mestre.</p></div>;
  return <div className="mx-auto max-w-none space-y-5 p-4 md:p-6">
    <PageHeader title="Cadastro de Classificação" subtitle="Fonte única para todo o app: responsável, natureza econômica e plano de contas." />
    {error && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
      {eixos.map(x => <section key={x.key} className="min-w-0 space-y-3">
        <h2 className="text-base font-semibold">{x.label}</h2>
        <CadastroNovoItem eixo={x.key} tipos={tipos} centros={centros} onSave={dados => executar(() => salvar(dados))} />
        <CadastroClassificacaoLista eixo={x.key} itens={itens.filter(i => i.eixo === x.key)} tipos={tipos} centros={centros} onSave={(dados, id) => executar(() => salvar(dados, id))} onRemove={id => { if (window.confirm('Excluir esta classificação do cadastro mestre?')) executar(() => remover(id)); }} />
      </section>)}
    </div>
  </div>;
}