import { useState } from 'react';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { conciliarFaturasCartao } from '@/functions/conciliarFaturasCartao';

export default function ConciliarFaturasButton({ onDone }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function handle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await conciliarFaturasCartao({});
      const d = res?.data || {};
      const msg = `✅ ${d.conciliados || 0} pagamento(s) vinculado(s) · ${d.atualizadas_pagas || 0} fatura(s) marcada(s) como paga · ${d.nao_conciliados || 0} sem match`;
      setToast({ type: 'success', msg });
      if (onDone) onDone();
    } catch (err) {
      setToast({ type: 'error', msg: `Erro: ${err.message}` });
    }
    setLoading(false);
    setTimeout(() => setToast(null), 6000);
  }

  return (
    <>
      <Button variant="outline" onClick={handle} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
        {loading ? 'Conciliando...' : 'Conciliar com Extrato'}
      </Button>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-md ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}