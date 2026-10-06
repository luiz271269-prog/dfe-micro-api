import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { calcularFimGozo, calcularSituacaoFerias, simularCustoFerias } from '@/lib/feriasEngine';
import { criarFolha, validarFolha, validarAdmissaoFuncionario, erroFolha } from '@/components/funcionarios/folha/folhaOperacoes';
import DocumentoTrabalhistaImportador from '@/components/funcionarios/documentos/DocumentoTrabalhistaImportador';
import CalculoManualSeparado from '@/components/funcionarios/documentos/CalculoManualSeparado';
import { dadosDocumentoSalvos, formularioDocumento } from '@/components/funcionarios/documentos/documentoTrabalhista';

export default function FeriasForm({ open, onClose, funcionarios, ferias, onSaved }) {
  const [form, setForm] = useState({
    funcionario_nome: '', data_inicio_gozo: '', dias_gozo: '30', dias_abono: '0',
    pagamento_adiantado: false, data_pagamento: '', valor_pago: '', status: 'planejada', observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [documento, setDocumento] = useState(null), [simulacao, setSimulacao] = useState([]), [importando, setImportando] = useState(false);
  function receberDocumento(doc) {
    if (doc.file_uri !== documento?.file_uri) setForm(prev => ({ ...prev, ...formularioDocumento(doc, funcionarios) }));
    setDocumento(doc);
  }

  const func = funcionarios.find((f) => f.nome === form.funcionario_nome);
  const dataFim = calcularFimGozo(form.data_inicio_gozo, parseInt(form.dias_gozo) || 0);
  const valorSugerido = func?.salario_base ? (func.salario_base * (4 / 3)).toFixed(2) : '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!func || !dataFim) return;
    if (saving || importando) return;
    if (documento && !documento.revisado) { setError('Confira o documento antes de salvar.'); return; }
    if (documento && ['valor_documento_bruto','valor_documento_descontos','valor_documento_liquido'].some(k => form[k] === '' || form[k] === undefined)) { setError('Confira e preencha bruto, descontos e líquido do documento (zero quando não houver desconto).'); return; }
    if (documento && Math.abs(Number(form.valor_documento_bruto) - Number(form.valor_documento_descontos) - Number(form.valor_documento_liquido)) > 0.01) { setError('Bruto menos descontos deve corresponder ao líquido do documento.'); return; }
    if (documento?.dados.data_fim_gozo && documento.dados.data_fim_gozo !== dataFim) { setError('Confira o início e os dias de gozo: o fim calculado difere do documento.'); return; }
    setSaving(true); setError('');
    try {
    await validarAdmissaoFuncionario(func, [form.data_inicio_gozo, dataFim, form.data_pagamento, form.periodo_aquisitivo_inicio, form.periodo_aquisitivo_fim]);
    const competencia = form.data_inicio_gozo.slice(0, 7);
    const existentes = await base44.entities.FolhaPagamento.filter({ funcionario_id: func.id, competencia, tipo: 'ferias' }, { limit: 1 });
    let folhaId = existentes.items[0]?.id;
    if (documento && folhaId && (Math.abs((existentes.items[0].salario_bruto || 0) - Number(form.valor_documento_bruto)) > 0.01 || Math.abs((existentes.items[0].salario_liquido || 0) - Number(form.valor_documento_liquido)) > 0.01)) throw new Error('Já existe folha de férias com valores diferentes nesta competência. Revise essa folha antes de vincular o documento; pagamentos existentes não serão alterados automaticamente.');
    if (!folhaId) await validarFolha({ funcionario_id: func.id, competencia, tipo: 'ferias' });
    const sit = calcularSituacaoFerias(func, ferias.filter((f) => f.funcionario_nome === func.nome));
    const record = {
      funcionario_id: func.id,
      funcionario_nome: func.nome,
      periodo_aquisitivo_inicio: form.periodo_aquisitivo_inicio || (sit.aquisitivoFim ? sit.aquisitivoFim.slice(0, 4) - 1 + sit.aquisitivoFim.slice(4) : undefined),
      periodo_aquisitivo_fim: form.periodo_aquisitivo_fim || sit.aquisitivoFim || undefined,
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
      ...dadosDocumentoSalvos(documento, simulacao),
      ...(documento ? { valor_documento_bruto:Number(form.valor_documento_bruto), valor_documento_descontos:Number(form.valor_documento_descontos), valor_documento_liquido:Number(form.valor_documento_liquido) } : {}),
    };
    await validarAdmissaoFuncionario(func, [record.periodo_aquisitivo_inicio, record.periodo_aquisitivo_fim]);
    const created = await base44.entities.FeriasFuncionario.create(record);
    // Alimenta as datas no cadastro — a geração automática da folha de férias usa esses campos
    await base44.entities.Funcionario.update(func.id, {
      ferias_inicio: form.data_inicio_gozo,
      ferias_fim: dataFim,
    });
    // Cria a folha de férias vinculada (se ainda não existir para a competência)
    if (!folhaId) {
      const custo = simularCustoFerias(func.salario_base || 0, record.dias_gozo, record.dias_abono);
      const total = Math.round(custo.totalPagamento * 100) / 100;
      const folha = await criarFolha({
        funcionario_id: func.id,
        funcionario_nome: func.nome,
        competencia,
        tipo: 'ferias',
        salario_bruto: documento ? Number(form.valor_documento_bruto) : total,
        outros_descontos: documento ? Number(form.valor_documento_descontos) : 0,
        salario_liquido: documento ? Number(form.valor_documento_liquido) : total,
        fgts_valor: Math.round(custo.fgts * 100) / 100,
        data_pagamento: form.pagamento_adiantado && form.data_pagamento ? form.data_pagamento : undefined,
        status: form.pagamento_adiantado && form.data_pagamento ? 'pago' : 'pendente',
        empresa: func.empresa,
      });
      folhaId = folha.id;
    }
    await base44.entities.FeriasFuncionario.update(created.id, { folha_pagamento_id: folhaId });
    // Baixa a previsão lançada pelo simulador no fluxo de caixa (evita dupla contagem)
    const previsoes = await base44.entities.FluxoCaixa.filter({ categoria: 'folha_pagamento', status: 'previsto' });
    const prev = previsoes.find((p) => (p.descricao || '').startsWith('Férias') && p.descricao.includes(func.nome));
    if (prev) await base44.entities.FluxoCaixa.update(prev.id, { status: 'confirmado', origem_id: folhaId, origem_tipo: 'folha' });
    setSaving(false);
    setForm({ funcionario_nome: '', data_inicio_gozo: '', dias_gozo: '30', dias_abono: '0', pagamento_adiantado: false, data_pagamento: '', valor_pago: '', status: 'planejada', observacoes: '' });
    setDocumento(null); setSimulacao([]);
    onSaved();
    onClose();
    } catch (err) { setError(erroFolha(err)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar Férias</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentoTrabalhistaImportador tipo="ferias" value={documento} onChange={receberDocumento} onBusy={setImportando} disabled={saving} />
          {documento && !form.funcionario_nome && <p className="text-sm text-warning">Nome importado: {documento.dados.funcionario_nome || 'não identificado'}; selecione e confirme o funcionário cadastrado.</p>}
          {documento && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[['valor_documento_bruto','Bruto do documento'],['valor_documento_descontos','Descontos do documento'],['valor_documento_liquido','Líquido do documento']].map(([k,l]) => <div key={k}><Label>{l}</Label><Input type="number" min="0" step="0.01" required value={form[k] ?? ''} onChange={e => setForm({ ...form,[k]:e.target.value })} /></div>)}</div>}
          {documento && <div className="grid grid-cols-2 gap-3">{[['periodo_aquisitivo_inicio','Período aquisitivo: início'],['periodo_aquisitivo_fim','Período aquisitivo: fim']].map(([k,l]) => <div key={k}><Label>{l}</Label><Input type="date" value={form[k] || ''} onChange={e => setForm({ ...form,[k]:e.target.value })} /></div>)}</div>}
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
            <div><Label>Início do Gozo</Label><Input type="date" min={func?.data_admissao} value={form.data_inicio_gozo} onChange={(e) => setForm({ ...form, data_inicio_gozo: e.target.value })} required /></div>
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
          <CalculoManualSeparado value={simulacao} onChange={setSimulacao} disabled={saving || importando} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving || importando || !func || (!!documento && !documento.revisado)}>{saving ? 'Salvando...' : 'Salvar Férias'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}