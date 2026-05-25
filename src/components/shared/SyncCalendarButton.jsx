import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sincronizarVencimentosCalendar } from '@/functions/sincronizarVencimentosCalendar';

export default function SyncCalendarButton() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleSync() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await sincronizarVencimentosCalendar({});
      const d = res?.data || {};
      const msg = `📅 ${d.criados || 0} novos · ${d.atualizados || 0} atualizados · ${d.pulados || 0} sem mudança${d.erros ? ` · ${d.erros} erros` : ''}`;
      setToast({ type: 'success', msg });
    } catch (err) {
      setToast({ type: 'error', msg: `Erro: ${err.message}` });
    }
    setLoading(false);
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
        {loading ? 'Sincronizando...' : 'Sync Calendar'}
      </Button>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}