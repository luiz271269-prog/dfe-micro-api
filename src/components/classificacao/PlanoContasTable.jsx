import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlanoContaRow from '@/components/classificacao/PlanoContaRow';
import { GRUPOS_PLANO } from '@/lib/planoContasPadrao';

export default function PlanoContasTable({ itens, tipos, centros, onSave }) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setDrafts(Object.fromEntries(itens.map(item => [item.id, item]))), [itens]);
  const contas = useMemo(() => Object.values(drafts).sort((a, b) => a.ordem - b.ordem), [drafts]);
  const alterar = (id, dados) => setDrafts(atual => ({ ...atual, [id]: dados }));
  async function aplicar() { setSaving(true); await onSave(contas); setSaving(false); }
  return <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3"><div><h2 className="font-semibold">Plano de Contas</h2><p className="text-xs text-muted-foreground">Edite as linhas e aplique todas as alterações de uma vez.</p></div><Button onClick={aplicar} disabled={saving}><Save />{saving ? 'Aplicando…' : 'Aplicar alterações'}</Button></div>
    <div className="hidden grid-cols-[80px_minmax(260px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_90px] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid"><span>Código</span><span>Conta</span><span>Natureza econômica</span><span>Centro de custo</span><span>Status</span></div>
    {GRUPOS_PLANO.map(([numero, nome]) => { const grupo = contas.filter(item => Math.floor(Number(item.ordem)) === numero); return <section key={numero}><div className="border-b bg-primary/5 px-4 py-2 text-sm font-bold text-foreground">{numero}. {nome}</div>{grupo.length ? grupo.map(item => <PlanoContaRow key={item.id} item={item} tipos={tipos} centros={centros} onChange={alterar} />) : <p className="border-b px-4 py-3 text-sm text-muted-foreground">Nenhuma conta neste grupo.</p>}</section>; })}
  </div>;
}