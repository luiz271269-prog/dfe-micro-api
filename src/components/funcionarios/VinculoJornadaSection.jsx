import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import VinculoJornadaFields from '@/components/funcionarios/VinculoJornadaFields';
import { dadosJornadaSalvos } from '@/lib/jornadaTrabalho';
export default function VinculoJornadaSection({ func, onSaved }) {
  const [form, setForm] = useState({ data_fichamento: func.data_fichamento || '', jornada_trabalho: func.jornada_trabalho || [], jornada_referencia_diaria: func.jornada_referencia_diaria ?? 8, jornada_referencia_semanal: func.jornada_referencia_semanal ?? 44 });
  const [saving, setSaving] = useState(false), [erro, setErro] = useState(''), [salvo, setSalvo] = useState(false);
  async function salvar(e) {
    e.preventDefault(); if (saving) return;
    setSaving(true); setErro(''); setSalvo(false);
    try {
      const payload = dadosJornadaSalvos(form);
      await base44.entities.Funcionario.update(func.id, payload);
      onSaved?.({ ...func, ...payload }); setSalvo(true);
    } catch (err) { setErro(err.message); }
    finally { setSaving(false); }
  }
  return <form onSubmit={salvar} className="rounded-lg border p-3 mb-4 space-y-3">
    <VinculoJornadaFields value={form} onChange={value => { setForm(value); setSalvo(false); }} disabled={saving} />
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {salvo && <p role="status" className="text-xs text-primary">Fichamento e jornada salvos.</p>}
    <Button type="submit" disabled={saving} size="sm">{saving ? 'Salvando...' : 'Salvar fichamento e jornada'}</Button>
  </form>;
}