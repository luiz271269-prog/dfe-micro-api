import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import BaixasDialog from '@/components/baixas/BaixasDialog';
import { SelecaoBaixasContext, chaveBaixa } from '@/components/baixas/useSelecaoBaixas';
import { fontesBaixas } from '@/components/baixas/baixasService';

export default function BaixasSelecao({ registros, children, onSaved, abaInicial = 'dados' }) {
  const lista = [...new Map(registros.filter(r => r.id && fontesBaixas[r.tipo]).map(r => [chaveBaixa(r), r])).values()];
  const [chaves, setChaves] = useState([]), [revisao, setRevisao] = useState(null);
  const assinatura = lista.map(chaveBaixa).sort().join('|');
  useEffect(() => { const visiveis = new Set(assinatura.split('|')); setChaves(prev => prev.filter(k => visiveis.has(k))); }, [assinatura]);
  const selecionados = lista.filter(r => chaves.includes(chaveBaixa(r)));
  function marcar(regs, marcado) {
    const keys = regs.map(chaveBaixa);
    setChaves(prev => marcado ? [...new Set([...prev, ...keys])] : prev.filter(k => !keys.includes(k)));
  }
  return <SelecaoBaixasContext.Provider value={{ chaves, marcar, onSaved }}>
    {lista.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <Button variant="outline" size="sm" disabled={!selecionados.length} onClick={() => setRevisao(selecionados)}>Revisar selecionados{selecionados.length ? ` (${selecionados.length})` : ''}</Button>
      <Button variant="ghost" size="sm" onClick={() => setChaves(lista.map(chaveBaixa))}>Selecionar visíveis</Button>
      {selecionados.length > 0 && <Button variant="ghost" size="sm" onClick={() => setChaves([])}>Limpar seleção</Button>}
      <span className="text-xs text-muted-foreground">Baixa ou conciliação com confirmação por lançamento.</span>
    </div>}
    {children}
    {revisao?.length > 0 && <BaixasDialog registros={revisao} abaInicial={abaInicial} onClose={() => setRevisao(null)} onSaved={onSaved} />}
  </SelecaoBaixasContext.Provider>;
}