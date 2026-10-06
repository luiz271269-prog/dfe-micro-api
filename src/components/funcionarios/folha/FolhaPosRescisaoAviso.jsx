import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { gerenciarFolha } from '@/functions/gerenciarFolha';
import { erroFolha } from '@/components/funcionarios/folha/folhaOperacoes';

export default function FolhaPosRescisaoAviso({ folha, onSaved }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const data = folha._funcionario?.data_demissao;
  if (!data || (folha.tipo || 'mensal') !== 'mensal' || folha.competencia <= data.slice(0,7)) return null;
  const removivel = folha.gerada_automaticamente && folha.status === 'pendente' && !(folha.valor_pago > 0);
  async function excluir(e) {
    e.stopPropagation();
    if (!confirm('Excluir esta previsão automática criada antes do bloqueio? Registros com pagamentos ou conciliações serão protegidos.')) return;
    setBusy(true); setError('');
    try { await gerenciarFolha({ action:'excluir_pos_rescisao', id:folha.id }); await onSaved(); }
    catch (err) { setError(erroFolha(err)); } finally { setBusy(false); }
  }
  return <span className="block text-xs font-normal text-destructive mt-1" onClick={e => e.stopPropagation()}>
    Após desligamento em {data.split('-').reverse().join('/')} · registro anterior ao bloqueio; novas folhas bloqueadas
    {removivel && <Button type="button" className="ml-2" variant="outline" size="sm" disabled={busy} onClick={excluir}>{busy ? 'Excluindo...' : 'Excluir previsão indevida'}</Button>}
    {error && <span role="alert" className="block">{error}</span>}
  </span>;
}