import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calculator, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { simularCustoFerias, dataLimitePagamento, calcularFimGozo } from '@/lib/feriasEngine';

export default function SimuladorFerias({ open, onClose, funcionarios }) {
  const [form, setForm] = useState({ funcionario_nome: '', data_inicio_gozo: '', dias_gozo: '30', dias_abono: '0' });
  const [lancando, setLancando] = useState(false);
  const [lancado, setLancado] = useState(false);

  const func = funcionarios.find((f) => f.nome === form.funcionario_nome);
  const diasGozo = parseInt(form.dias_gozo) || 0;
  const diasAbono = parseInt(form.dias_abono) || 0;
  const sim = func?.salario_base ? simularCustoFerias(func.salario_base, diasGozo, diasAbono) : null;
  const dataPagamento = dataLimitePagamento(form.data_inicio_gozo);
  const dataFim = calcularFimGozo(form.data_inicio_gozo, diasGozo);

  async function handleLancarFluxo() {
    if (!sim || !dataPagamento) return;
    setLancando(true);
    await base44.entities.FluxoCaixa.create({
      data_prevista: dataPagamento,
      tipo: 'saida',
      categoria: 'folha_pagamento',
      descricao: `Férias ${func.nome} — ${diasGozo} dias${diasAbono > 0 ? ` + ${diasAbono} vendidos (abono)` : ''} (adiantamento até ${formatDate(dataPagamento)})`,
      valor_previsto: Math.round(sim.totalPagamento * 100) / 100,
      status: 'previsto',
      origem_tipo: 'folha',
      mes_referencia: dataPagamento.slice(0, 7),
      empresa: func.empresa,
    });
    setLancando(false);
    setLancado(true);
    setTimeout(() => setLancado(false), 5000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setLancado(false); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Simulador de Custo de Férias</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Funcionário</Label>
            <Select value={form.funcionario_nome} onValueChange={(v) => setForm({ ...form, funcionario_nome: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {funcionarios.filter((f) => f.status !== 'desligado' && f.salario_base).map((f) => (
                  <SelectItem key={f.id} value={f.nome}>{f.nome} — {formatCurrency(f.salario_base)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Início do Gozo</Label><Input type="date" value={form.data_inicio_gozo} onChange={(e) => setForm({ ...form, data_inicio_gozo: e.target.value })} /></div>
            <div><Label>Dias de Gozo</Label><Input type="number" min="1" max="30" value={form.dias_gozo} onChange={(e) => setForm({ ...form, dias_gozo: e.target.value })} /></div>
            <div><Label>Abono (vendidos)</Label><Input type="number" min="0" max="10" value={form.dias_abono} onChange={(e) => setForm({ ...form, dias_abono: e.target.value })} /></div>
          </div>

          {sim && (
            <div className="bg-muted/40 rounded-xl border p-4 space-y-2 text-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Memória de Cálculo</p>
              <div className="flex justify-between"><span>Férias ({diasGozo} dias × {formatCurrency(sim.diaria)}/dia)</span><b className="tabular-nums">{formatCurrency(sim.valorFerias)}</b></div>
              <div className="flex justify-between"><span>1/3 constitucional</span><b className="tabular-nums">{formatCurrency(sim.tercoFerias)}</b></div>
              {diasAbono > 0 && (
                <>
                  <div className="flex justify-between"><span>Abono pecuniário ({diasAbono} dias)</span><b className="tabular-nums">{formatCurrency(sim.valorAbono)}</b></div>
                  <div className="flex justify-between"><span>1/3 sobre o abono</span><b className="tabular-nums">{formatCurrency(sim.tercoAbono)}</b></div>
                </>
              )}
              <div className="flex justify-between border-t pt-2 text-base"><span className="font-bold">Total do adiantamento</span><b className="tabular-nums text-primary">{formatCurrency(sim.totalPagamento)}</b></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>+ FGTS 8% (custo empregador, sem incidir no abono)</span><span className="tabular-nums">{formatCurrency(sim.fgts)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Custo total para a empresa</span><span className="tabular-nums font-semibold">{formatCurrency(sim.custoTotalEmpregador)}</span></div>
              {dataPagamento && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 mt-2">
                  Pagamento (CLT art. 145): até <b>{formatDate(dataPagamento)}</b> · Gozo: {formatDate(form.data_inicio_gozo)} → {formatDate(dataFim)} · Impacto no caixa de <b>{dataPagamento.slice(0, 7)}</b>
                </div>
              )}
            </div>
          )}

          {lancado ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-700 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Previsão lançada no Fluxo de Caixa de {dataPagamento.slice(0, 7)}
            </div>
          ) : (
            <Button className="w-full gap-2" disabled={!sim || !dataPagamento || lancando} onClick={handleLancarFluxo}>
              {lancando ? 'Lançando...' : 'Projetar no Fluxo de Caixa do Mês'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}