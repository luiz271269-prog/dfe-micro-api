import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deduplicarImportacoes } from '@/functions/deduplicarImportacoes';

// Botão de deduplicação global — varre todas as entidades do sistema e remove duplicatas.
// Quando `autoOncePerDay` é true, dispara automaticamente uma vez por dia ao montar.
// Após rodar, dispara evento `neuralfinRefresh` para atualizar o dashboard.
export default function DedupButton({ autoOncePerDay = false, size = 'sm', variant = 'outline', label = 'Limpar duplicatas' }) {
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);

  async function runDedup(silent = false) {
    if (running) return;
    setRunning(true);
    try {
      const res = await deduplicarImportacoes({});
      const total = res?.data?.total || 0;
      if (!silent) {
        setToast({
          type: 'success',
          msg: total > 0 ? `🧹 ${total} duplicatas removidas` : 'Banco limpo — nenhuma duplicata',
        });
        setTimeout(() => setToast(null), 4000);
      }
      if (total > 0) window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) {
      if (!silent) {
        setToast({ type: 'error', msg: `Erro: ${err.message}` });
        setTimeout(() => setToast(null), 4000);
      }
    }
    setRunning(false);
  }

  useEffect(() => {
    if (!autoOncePerDay) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem('neuralfinLastDedupDate');
    if (last !== today) {
      localStorage.setItem('neuralfinLastDedupDate', today);
      runDedup(true);
    }
  }, []); // eslint-disable-line

  return (
    <>
      <Button variant={variant} size={size} onClick={() => runDedup(false)} disabled={running} className="gap-2">
        {running ? (
          <>
            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            Limpando…
          </>
        ) : (
          <>
            <Trash2 className="w-3.5 h-3.5" />
            {label}
          </>
        )}
      </Button>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}