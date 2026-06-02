import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { deduplicarCartoes } from '@/functions/deduplicarCartoes';

export default function DeduplicarCartoesButton({ onDone }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function handle() {
    if (!confirm('Deduplicar faturas e lançamentos de cartão? Mantém o registro mais antigo de cada duplicata.')) return;
    setLoading(true);
    try {
      const { data } = await deduplicarCartoes({});
      setToast({
        type: 'success',
        msg: `${data.faturas_duplicadas_removidas} faturas e ${data.lancamentos_duplicados_removidos} lançamentos duplicados removidos.`,
      });
      onDone?.();
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Erro ao deduplicar' });
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handle} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Deduplicando...' : 'Deduplicar'}
      </Button>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}