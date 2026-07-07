import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function BancoHorasForm({ open, onClose, funcionarios, onSaved }) {
  const [form, setForm] = useState({ funcionario_nome: '', data: '', tipo: 'credito', horas: '', descricao: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const func = funcionarios.find((f) => f.nome === form.funcionario_nome);
    if (!func) return;
    setSaving(true);
    await base44.entities.BancoHoras.create({
      funcionario_id: func.id,
      funcionario_nome: func.nome,
      data: form.data,
      tipo: form.tipo,
      horas: parseFloat(form.horas),
      descricao: form.descricao || undefined,
      empresa: func.empresa,
    });
    setSaving(false);
    setForm({ funcionario_nome: '', data: '', tipo: 'credito', horas: '', descricao: '' });
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Lançar Banco de Horas</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Funcionário</Label>
            <Select value={form.funcionario_nome} onValueChange={(v) => setForm({ ...form, funcionario_nome: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {funcionarios.filter((f) => f.status !== 'desligado').map((f) => (
                  <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito (+)</SelectItem>
                  <SelectItem value="debito">Débito (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Horas</Label><Input type="number" step="0.5" min="0.5" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} required /></div>
          </div>
          <div><Label>Descrição / Motivo</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: hora extra sábado, folga compensada..." /></div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Lançamento'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}