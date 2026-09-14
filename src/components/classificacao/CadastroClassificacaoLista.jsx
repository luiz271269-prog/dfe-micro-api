import CadastroClassificacaoRow from '@/components/classificacao/CadastroClassificacaoRow';

export default function CadastroClassificacaoLista({ eixo, itens, tipos, centros, onSave, onRemove }) {
  if (!itens.length) return <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum item cadastrado.</div>;
  const conta = eixo === 'categoria';
  return <div className="overflow-hidden rounded-lg border bg-card">
    <div className={conta ? 'hidden 2xl:grid grid-cols-[minmax(140px,1fr)_130px_130px_68px_56px_64px_76px] gap-2 border-b bg-muted/50 px-2 py-2 text-xs font-semibold text-muted-foreground' : 'hidden 2xl:grid grid-cols-[minmax(120px,1fr)_68px_56px_64px_76px] gap-2 border-b bg-muted/50 px-2 py-2 text-xs font-semibold text-muted-foreground'}>
      <span>Nome</span>{conta && <><span>Naturezas</span><span>Centros de custo</span></>}<span>Status</span><span>Admin</span><span>Usuário</span><span>Ações</span>
    </div>
    {itens.map(item => <CadastroClassificacaoRow key={item.id} item={item} tipos={tipos} centros={centros} onSave={onSave} onRemove={onRemove} />)}
  </div>;
}