import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CalculoManualSeparado from '@/components/funcionarios/documentos/CalculoManualSeparado';
import AnexoTrabalhistaButton from '@/components/funcionarios/documentos/AnexoTrabalhistaButton';
import { normalizarSimulacao } from '@/components/funcionarios/documentos/documentoTrabalhista';

export default function SimulacaoDocumentoButton({ registro, entidade, onSaved }) {
  const [open,setOpen] = useState(false), [linhas,setLinhas] = useState([]), [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function salvar() {
    setBusy(true); setError('');
    try { await base44.entities[entidade].update(registro.id, { simulacao_manual: normalizarSimulacao(linhas) }); await onSaved?.(); setOpen(false); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => { setLinhas(registro.simulacao_manual || []); setError(''); setOpen(true); }}>Cálculo separado</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Simulação · {registro.funcionario_nome}</DialogTitle></DialogHeader>
      <AnexoTrabalhistaButton uri={registro.documento_file_uri} url={registro.anexo_url} nome={registro.documento_nome || registro.anexo_nome} />
      {registro.documento_dados_json && <details><summary className="cursor-pointer text-sm">Valores originais importados (somente leitura)</summary><pre className="text-xs whitespace-pre-wrap rounded border p-3">{registro.documento_dados_json}</pre></details>}
      <CalculoManualSeparado value={linhas} onChange={setLinhas} disabled={busy} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={busy} onClick={salvar}>{busy ? 'Salvando...' : 'Salvar somente a simulação'}</Button>
    </DialogContent></Dialog>
  </>;
}