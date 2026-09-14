import CadastroClassificacaoRow from '@/components/classificacao/CadastroClassificacaoRow';

export default function CadastroClassificacaoLista({ itens, tipos, onSave, onRemove }) {
  if (!itens.length) return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma classificação cadastrada neste eixo.</div>;
  return <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="hidden lg:grid grid-cols-[1fr_180px_80px_90px_90px_96px] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
      <span>Classificação</span><span>Natureza vinculada</span><span>Status</span><span>Ver/usar</span><span>Ver/usar</span><span>Ações</span>
    </div>
    {itens.map(item => <CadastroClassificacaoRow key={item.id} item={item} tipos={tipos} onSave={onSave} onRemove={onRemove} />)}
  </div>;
}