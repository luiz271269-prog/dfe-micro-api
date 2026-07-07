import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { calcularFimGozo, calcularSituacaoFerias } from '@/lib/feriasEngine';

export default function FeriasForm({ open, onClose, funcionarios, ferias, onSaved }) {
  const [form, setForm] = useState({
    funcionario_nome: '', data_inicio_gozo: '', dias_gozo: '30', dias_abono: '0',
    pagamento_adiantado: false, data_pagamento: '', valor_pago: '', status: 'planejada', observacoes: '',
  });
  const [saving, setSaving] = useState(false);

  const func = funcionarios.find((f) => f.nome === form.funcionario_nome);
  const dataFim = calcularFimGozo(form.data_inicio_gozo, parseInt(form.dias_gozo) || 0);
  const valorSugerido = func?.salario_base ? (func.salario_base * (4 / 3)).toFixed(2) : '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!func || !dataFim) return;
    setSaving(true);
    const sit = calcularSituacaoFerias(func, ferias.filter((f) => f.funcionario_nome === func.nome));
    const record = {
      funcionario_id: func.id,
      funcionario_nome: func.nome,
      periodo_aquisitivo_inicio: sit.aquisitivoFim ? sit.aquisitivoFim.slice(0, 4) - 1 + sit.aquisitivoFim.slice(4) : undefined,
      periodo_aquisitivo_fim: sit.aquisitivoFim || undefined,
      data_inicio_gozo: form.data_inicio_gozo,
      data_fim_gozo: dataFim,
      dias_gozo: parseInt(form.dias_gozo) || 30,
      dias_abono: parseInt(form.dias_abono) || 0,
      pagamento_adiantado: form.pagamento_adiantado,
      data_pagamento: form.data_pagamento || undefined,
      valor_pago: parseFloat(form.valor_pago) || undefined,
      status: form.status,
      empresa: func.empresa,
      observacoes: form.observacoes || undefined,
    };
    await base44.entities.FeriasFuncionario.create(record);
    // Alimenta as datas no cadastro — a geração automática da folha de férias usa esses campos
    await base44.entities.Funcionario.update(func.id, {
      ferias_inicio: form.data_inicio_gozo,
      ferias_fim: dataFim,
    });
    setSaving(false);
    setForm({ funcionario_nome: '', data_inicio_gozo: '', dias_gozo: '30', dias_abono: '0', pagamento_adiantado: false, data_pagamento: '', valor_pago: '', status: 'planejada', observacoes: '' });
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar Férias</DialogTitle></DialogHeader>
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
            <div><Label>Início do Gozo</Label><Input type="date" value={form.data_inicio_gozo} onChange={(e) => setForm({ ...form, data_inicio_gozo: e.target.value })} required /></div>
            <div><Label>Dias de Gozo</Label><Input type="number" min="1" max="30" value={form.dias_gozo} onChange={(e) => setForm({ ...form, dias_gozo: e.target.value })} required /></div>
            <div><Label>Abono (vendidos)</Label><Input type="number" min="0" max="10" value={form.dias_abono} onChange={(e) => setForm({ ...form, dias_abono: e.target.value })} /></div>
          </div>
          {dataFim && <p className="text-xs text-muted-foreground">Fim do gozo: <b>{dataFim.split('-').reverse().join('/')}</b> — dias picados são aceitos e descontam do saldo do período aquisitivo mais antigo</p>}
          <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
            <div>
              <Label className="cursor-pointer" htmlFor="adiantado">Pagamento adiantado</Label>
              <p className="text-[11px] text-muted-foreground">CLT: pagar até 2 dias antes do início do gozo</p>
            </div>
            <Switch id="adiantado" checked={form.pagamento_adiantado} onCheckedChange={(v) => setForm({ ...form, pagamento_adiantado: v })} />
          </div>
          {form.pagamento_adiantado && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data do Pagamento</Label><Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
              <div><Label>Valor Pago (salário + 1/3)</Label><Input type="number" step="0.01" placeholder={valorSugerido} value={form.valor_pago} onChange={(e) => setForm({ ...form, valor_pago: e.target.value })} /></div>
            </div>
          )}
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planejada">Planejada</SelectItem>
                <SelectItem value="em_gozo">Em Gozo</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={saving || !func}>{saving ? 'Salvando...' : 'Salvar Férias'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}