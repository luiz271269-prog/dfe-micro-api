const UMA_HORA_MS = 60 * 60 * 1000;

export function iniciarAgendador(executar) {
  let executando = false;
  const timer = setInterval(async () => {
    if (executando) return;
    executando = true;
    try { await executar(); } catch (error) { console.error('[scheduler]', error.message); } finally { executando = false; }
  }, UMA_HORA_MS);
  timer.unref();
  return timer;
}