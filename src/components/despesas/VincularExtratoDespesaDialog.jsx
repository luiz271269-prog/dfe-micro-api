import BaixasDialog from '@/components/baixas/BaixasDialog';

export default function VincularExtratoDespesaDialog({ despesa, vinculo, open, onClose, onChanged }) {
  if (!open || !despesa) return null;
  return <BaixasDialog registros={[{ tipo: 'DespesaOperacional', id: despesa.id, descricao: despesa.descricao }]} abaInicial={vinculo ? 'historico' : 'conciliar'} onClose={onClose} onSaved={onChanged} />;
}