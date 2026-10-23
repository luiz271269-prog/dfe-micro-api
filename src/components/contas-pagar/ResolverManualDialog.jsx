import { base44 } from '@/api/base44Client';
import BaixasDialog from '@/components/baixas/BaixasDialog';

export default function ResolverManualDialog({ sugestao, onClose, onResolved }) {
  if (!sugestao?.lancamento_bancario_id) return null;
  async function aoSalvar(comando) {
    if (comando.acao === 'banco') await base44.entities.SugestaoConciliacao.update(sugestao.id, { status: comando.destino === sugestao.entidade_tipo && comando.destino_id === sugestao.entidade_id ? 'confirmada' : 'rejeitada', resolvida_em: new Date().toISOString() });
    await onResolved?.();
  }
  return <BaixasDialog registros={[{ tipo: 'LancamentoBancario', id: sugestao.lancamento_bancario_id, descricao: sugestao.descricao_extrato }]} abaInicial="conciliar" onClose={onClose} onSaved={aoSalvar} />;
}