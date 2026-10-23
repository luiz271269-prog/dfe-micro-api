import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chamarBaixas } from '@/components/baixas/baixasService';

export default function useBaixaContextual(registro, onSaved) {
  const [detalhe, setDetalhe] = useState(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [erro, setErro] = useState(''), [sucesso, setSucesso] = useState('');
  const [confirmacao, setConfirmacao] = useState(null);
  const seq = useRef(0), executando = useRef(false), aoSalvar = useRef(onSaved);
  const queryClient = useQueryClient();
  aoSalvar.current = onSaved;
  async function carregar() {
    const n = ++seq.current; setLoading(true); setDetalhe(null);
    try { const d = await chamarBaixas({ acao: 'detalhe', tipo: registro.tipo, id: registro.id }); if (n === seq.current) setDetalhe(d); }
    catch (e) { if (n === seq.current) setErro(e.response?.data?.error || e.message); }
    finally { if (n === seq.current) setLoading(false); }
  }
  useEffect(() => { setErro(''); setSucesso(''); setConfirmacao(null); carregar(); return () => { seq.current++; }; }, [registro.tipo, registro.id]);
  function solicitar(payload, resumo) {
    if (!detalhe || detalhe.registro.id !== registro.id || detalhe.registro.tipo !== registro.tipo || executando.current) return;
    const r = detalhe.registro;
    setConfirmacao({ payload: { tipo: r.tipo, id: r.id, versao: r.versao, ...payload, pedidoId: crypto.randomUUID() }, resumo });
    setErro(''); setSucesso('');
  }
  async function executar() {
    if (executando.current || !confirmacao) return;
    executando.current = true; setBusy(true); setErro('');
    const comando = confirmacao.payload;
    try {
      const resultado = await chamarBaixas(comando);
      setConfirmacao(null); setSucesso('Operação registrada e auditada. Confira a situação atualizada abaixo.');
      await carregar();
      window.dispatchEvent(new Event('neuralfinRefresh'));
      try { await Promise.all([queryClient.invalidateQueries(), aoSalvar.current?.(comando, resultado)]); }
      catch (e) { setErro(`A baixa foi registrada, mas a atualização da tela de origem falhou: ${e.message}. Não repita o pagamento.`); }
    } catch (e) { setErro(e.response?.data?.error || e.message); }
    finally { executando.current = false; setBusy(false); }
  }
  const atualizado = detalhe?.registro.id === registro.id && detalhe?.registro.tipo === registro.tipo;
  return { detalhe: atualizado ? detalhe : null, loading: loading || !!(detalhe && !atualizado), busy, erro, sucesso, confirmacao, setConfirmacao, carregar, solicitar, executar };
}