import BaixaManualButton from '@/components/shared/BaixaManualButton';
import useSelecaoBaixas, { chaveBaixa } from '@/components/baixas/useSelecaoBaixas';

export default function BaixaAcaoRegistro({ entidade, registroId, registros, descricao, onSaved, children, abaInicial = 'dados', className = '' }) {
  const selecao = useSelecaoBaixas();
  const refs = registros || [{ tipo: entidade, id: registroId, descricao }];
  if (!refs.length || refs.some(r => !r.id)) return null;
  const marcado = !!selecao && refs.every(r => selecao.chaves.includes(chaveBaixa(r)));
  return <span className="inline-flex items-center gap-2" onClick={e => e.stopPropagation()}>
    {selecao && <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary" aria-label={`Selecionar ${descricao || 'lançamento'} para revisão`} checked={marcado} onChange={e => selecao.marcar(refs, e.target.checked)} />}
    <BaixaManualButton registros={refs} onSaved={onSaved || selecao?.onSaved} abaInicial={abaInicial} className={className}>{children}</BaixaManualButton>
  </span>;
}