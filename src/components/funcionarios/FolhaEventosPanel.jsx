import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, History, Save, X, Printer } from 'lucide-react';
import { imprimirFolha } from '@/lib/imprimirFolha';
import { formatCurrency } from '@/lib/formatters';
import { CAMPOS_PROVENTO, CAMPOS_DESCONTO, PRESETS_PROVENTO, PRESETS_DESCONTO, calcularTotaisFolha, competenciaAnterior } from '@/lib/folhaEventos';
import EventoLinha from './EventoLinha';
import AdicionarEvento from './AdicionarEvento';
import NovoTipoEvento from './NovoTipoEvento';

const CAMPOS_NUM = [...CAMPOS_PROVENTO, ...CAMPOS_DESCONTO].map(([k]) => k);

// Conteúdo do painel "Eventos Detalhados da Folha" — usado inline (coluna lateral) ou dentro de um Dialog.
export default function FolhaEventosPanel({ folha, folhas = [], funcionario = null, onClose, onSaved, showClose = false }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!folha) { setForm(null); return; }
    const f = { salario_bruto: folha.salario_bruto ?? 0, eventos: folha.eventos || [] };
    CAMPOS_NUM.forEach(k => { f[k] = folha[k] ?? 0; });
    setForm(f);
  }, [folha]);

  const anterior = useMemo(() => {
    if (!folha) return null;
    const comp = competenciaAnterior(folha.competencia);
    return folhas.find(x => x.competencia === comp && x.funcionario_nome === folha.funcionario_nome && (x.tipo || 'mensal') === (folha.tipo || 'mensal')) || null;
  }, [folha, folhas]);

  if (!folha || !form) return null;
  const totais = calcularTotaisFolha(form);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setEvento = (i, patch) => setForm(p => ({ ...p, eventos: p.eventos.map((e, idx) => idx === i ? { ...e, ...patch } : e) }));
  const addEvento = (tipo) => (descricao) => setForm(p => ({ ...p, eventos: [...p.eventos, { descricao, tipo, valor: 0, recorrente: false }] }));
  const rmEvento = (i) => setForm(p => ({ ...p, eventos: p.eventos.filter((_, idx) => idx !== i) }));

  function copiarAnterior() {
    if (!anterior) return;
    const f = { ...form, eventos: (anterior.eventos || []).map(e => ({ ...e })) };
    CAMPOS_NUM.forEach(k => { f[k] = anterior[k] ?? 0; });
    setForm(f);
  }

  async function salvar() {
    setSaving(true);
    const payload = { salario_bruto: parseFloat(form.salario_bruto) || 0, eventos: form.eventos.map(e => ({ ...e, valor: parseFloat(e.valor) || 0 })) };
    CAMPOS_NUM.forEach(k => { payload[k] = parseFloat(form[k]) || 0; });
    payload.salario_liquido = Math.round(calcularTotaisFolha(payload).liquido * 100) / 100;
    await base44.entities.FolhaPagamento.update(folha.id, payload);
    setSaving(false);
    onSaved?.();
    onClose();
  }

  const idx = (tipo) => form.eventos.map((e, i) => [e, i]).filter(([e]) => e.tipo === tipo);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Eventos Detalhados da Folha</h3>
          <p className="text-sm text-muted-foreground">{folha.funcionario_nome} · <span className="font-semibold">{folha.competencia}</span></p>
          {funcionario && (
            <p className="text-[11px] text-muted-foreground">
              {funcionario.cargo || 'sem cargo'} · setor {funcionario.setor || '—'} · CPF {funcionario.cpf || 'não informado'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" title="Imprimir folha + recibo por fora"
          onClick={() => imprimirFolha({ ...folha, ...form, salario_bruto: parseFloat(form.salario_bruto) || 0 }, funcionario)}>
          <Printer className="w-3.5 h-3.5" /> Imprimir
        </Button>
        {showClose && (
          <button type="button" onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        )}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1"><Label className="text-xs">Salário Bruto</Label>
          <Input type="number" step="0.01" inputMode="decimal" value={form.salario_bruto} onChange={e => set('salario_bruto', e.target.value)} className="h-9 font-semibold tabular-nums" /></div>
        <Button type="button" variant="outline" size="sm" onClick={copiarAnterior} disabled={!anterior} className="gap-1.5"
          title={anterior ? `Copiar eventos de ${anterior.competencia}` : 'Sem folha do mês anterior'}>
          <History className="w-3.5 h-3.5" /> Copiar {anterior ? anterior.competencia : 'mês anterior'}
        </Button>
      </div>

      <section>
        <h4 className="text-sm font-bold flex items-center gap-1.5 text-emerald-700 mb-1"><TrendingUp className="w-4 h-4" /> Proventos (Créditos)</h4>
        <div className="rounded-lg border px-3">
          {CAMPOS_PROVENTO.map(([k, l]) => <EventoLinha key={k} label={l} valor={form[k]} onChange={v => set(k, v)} tone="provento" />)}
          {idx('provento').map(([e, i]) => (
            <EventoLinha key={i} label={e.descricao} valor={e.valor} tone="provento" recorrente={e.recorrente}
              onChange={v => setEvento(i, { valor: v })} onRemove={() => rmEvento(i)} onToggleRecorrente={() => setEvento(i, { recorrente: !e.recorrente })} />
          ))}
        </div>
        <AdicionarEvento presets={PRESETS_PROVENTO} usados={form.eventos.map(e => e.descricao)} onAdd={addEvento('provento')} tone="provento" />
      </section>

      <section>
        <h4 className="text-sm font-bold flex items-center gap-1.5 text-red-700 mb-1"><TrendingDown className="w-4 h-4" /> Descontos (Débitos)</h4>
        <div className="rounded-lg border px-3">
          {CAMPOS_DESCONTO.map(([k, l]) => <EventoLinha key={k} label={l} valor={form[k]} onChange={v => set(k, v)} tone="desconto" />)}
          {idx('desconto').map(([e, i]) => (
            <EventoLinha key={i} label={e.descricao} valor={e.valor} tone="desconto" recorrente={e.recorrente}
              onChange={v => setEvento(i, { valor: v })} onRemove={() => rmEvento(i)} onToggleRecorrente={() => setEvento(i, { recorrente: !e.recorrente })} />
          ))}
        </div>
        <AdicionarEvento presets={PRESETS_DESCONTO} usados={form.eventos.map(e => e.descricao)} onAdd={addEvento('desconto')} tone="desconto" />
      </section>

      <NovoTipoEvento onAdd={(tipo, descricao) => addEvento(tipo)(descricao)} />

      <div className="rounded-xl bg-muted/50 border p-3 grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[10px] font-bold uppercase text-emerald-700">Proventos</p><p className="text-sm font-bold tabular-nums text-emerald-700">+{formatCurrency(totais.proventos)}</p></div>
        <div><p className="text-[10px] font-bold uppercase text-red-700">Descontos</p><p className="text-sm font-bold tabular-nums text-red-700">-{formatCurrency(totais.descontos)}</p></div>
        <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Líquido</p><p className="text-base font-bold tabular-nums">{formatCurrency(totais.liquido)}</p></div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">Ícone <span className="inline-block align-middle">↻</span> marca eventos recorrentes — herdados automaticamente na folha do mês seguinte.</p>

      <Button onClick={salvar} disabled={saving} className="w-full gap-2">
        {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Salvar Folha
      </Button>
    </div>
  );
}