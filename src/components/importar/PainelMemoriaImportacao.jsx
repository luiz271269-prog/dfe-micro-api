import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Brain, Zap, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';
import { darAval, reativarIA } from '@/lib/memoriaImportacaoEngine';

// Mostra o aprendizado da memória para o tipo selecionado e o botão de aval.
// refreshKey muda a cada importação salva para recarregar o estado.
export default function PainelMemoriaImportacao({ tipoImport, label, refreshKey }) {
  const [mem, setMem] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tipoImport) { setMem(null); return; }
    let alive = true;
    base44.entities.MemoriaImportacao.filter({ tipo_import: tipoImport })
      .then(list => { if (alive) setMem(list?.[0] || null); });
    return () => { alive = false; };
  }, [tipoImport, refreshKey]);

  if (!tipoImport) return null;

  const limite = mem?.limite_para_aval || 5;
  const acertos = mem?.acertos_consecutivos || 0;
  const status = mem?.status || 'aprendendo';
  const pct = Math.min(100, Math.round((acertos / limite) * 100));

  async function handleAval() {
    setBusy(true);
    const user = await base44.auth.me().catch(() => null);
    await darAval(mem.id, user?.email);
    const list = await base44.entities.MemoriaImportacao.filter({ tipo_import: tipoImport });
    setMem(list?.[0] || null);
    setBusy(false);
  }

  async function handleReativar() {
    setBusy(true);
    await reativarIA(mem.id);
    const list = await base44.entities.MemoriaImportacao.filter({ tipo_import: tipoImport });
    setMem(list?.[0] || null);
    setBusy(false);
  }

  if (status === 'economico') {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                Modo econômico ativo <Sparkles className="w-3.5 h-3.5" />
              </p>
              <p className="text-[11px] text-emerald-700">
                {label} aprendido — importações sem IA enquanto o layout bater. Arquivo diferente volta pra IA sozinho.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReativar} disabled={busy} className="text-emerald-700 hover:bg-emerald-100 gap-1.5 shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Voltar pra IA
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'aguardando_aval') {
    return (
      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-indigo-800">Layout aprendido — pronto para economizar</p>
              <p className="text-[11px] text-indigo-700">
                {acertos} importações seguidas de <b>{label}</b> saíram redondas. Ative o modo econômico para parar de gastar IA neste tipo.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleAval} disabled={busy} className="gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-700">
            <Zap className="w-3.5 h-3.5" /> {busy ? 'Ativando…' : 'Ativar modo econômico'}
          </Button>
        </div>
      </div>
    );
  }

  // aprendendo
  return (
    <div className="mb-4 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Aprendendo {label}…</p>
        <span className="ml-auto text-[11px] text-muted-foreground font-medium">{acertos}/{limite} importações redondas</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Quando atingir {limite} importações seguidas sem deixar nada de fora, você poderá ativar o modo econômico (sem IA).
      </p>
    </div>
  );
}