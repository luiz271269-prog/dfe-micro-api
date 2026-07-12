import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calculator, Paperclip } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { calcularPeriodosAquisitivos } from '@/lib/feriasEngine';
import { calcularRescisao, TIPOS_RESCISAO } from '@/lib/rescisaoEngine';
import { calcularMediaVariaveis, calcularDeficitBancoHoras } from '@/lib/rescisaoRemuneracao';

const VERBAS = [
  ['saldo_salario', 'Saldo de Salário'],
  ['aviso_previo_valor', 'Aviso Prévio Indenizado'],
  ['ferias_vencidas_valor', 'Férias Vencidas + 1/3'],
  ['ferias_proporcionais_valor', 'Férias Proporcionais + 1/3'],
  ['decimo_terceiro_valor', '13º Proporcional'],
  ['multa_fgts_valor', 'Multa FGTS'],
];

export default function RescisaoForm({ open, onClose, funcionarios, onSaved }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    funcionario_nome: '', data_desligamento: hoje, tipo_rescisao: 'sem_justa_causa', aviso_previo: 'indenizado',
    saldo_fgts: '', saldo_salario: '0', aviso_previo_valor: '0', ferias_vencidas_valor: '0',
    ferias_proporcionais_valor: '0', decimo_terceiro_valor: '0', multa_fgts_valor: '0',
    outros_valores: '0', desconto_banco_horas: '0', descontos: '0', observacoes: '',
  });
  const [ferias, setFerias] = useState([]);
  const [folhas, setFolhas] = useState([]);
  const [bancoHoras, setBancoHoras] = useState([]);
  const [anexar, setAnexar] = useState(false);
  const [file, setFile] = useState(null);
  const [homologada, setHomologada] = useState(false);
  const [calculo, setCalculo] = useState(null);
  const [error, setError] = useState('');
  const [efetivar, setEfetivar] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      base44.entities.FeriasFuncionario.list('', 500),
      base44.entities.FolhaPagamento.list('-competencia', 500),
      base44.entities.BancoHoras.list('-data', 500),
    ]).then(([listaFerias, listaFolhas, listaBanco]) => {
      setFerias(listaFerias);
      setFolhas(listaFolhas);
      setBancoHoras(listaBanco);
    });
  }, [open]);

  const func = funcionarios.find((f) => f.nome === form.funcionario_nome);
  const periodosFerias = useMemo(() => {
    if (!func) return [];
    return calcularPeriodosAquisitivos(func, ferias.filter((f) => f.funcionario_nome === func.nome), form.data_desligamento);
  }, [func, ferias, form.data_desligamento]);
  const periodosCompletos = periodosFerias.filter((p) => !p.emCurso && p.saldo > 0);
  const saldoFeriasDias = periodosCompletos.reduce((s, p) => s + p.saldo, 0);
  const feriasDobradasDias = periodosCompletos.filter((p) => p.status === 'vencido').reduce((s, p) => s + p.saldo, 0);
  const mediaVariavel = useMemo(() => calcularMediaVariaveis(folhas, func, form.data_desligamento), [folhas, func, form.data_desligamento]);
  const remuneracaoBase = (func?.salario_base || 0) + mediaVariavel.media;
  const deficitBanco = useMemo(() => calcularDeficitBancoHoras(bancoHoras, func, form.data_desligamento, remuneracaoBase), [bancoHoras, func, form.data_desligamento, remuneracaoBase]);

  function preCalcular() {
    if (!func) return;
    const c = calcularRescisao({
      salarioBase: func.salario_base, mediaVariaveis: mediaVariavel.media, dataAdmissao: func.data_admissao, dataDesligamento: form.data_desligamento,
      tipo: form.tipo_rescisao, avisoPrevio: form.aviso_previo, saldoFgts: parseFloat(form.saldo_fgts) || 0,
      feriasPendentesDias: saldoFeriasDias, feriasDobradasDias,
    });
    setCalculo(c);
    setForm({
      ...form,
      saldo_salario: c.saldoSalario.toFixed(2),
      aviso_previo_valor: c.avisoValor.toFixed(2),
      ferias_vencidas_valor: c.feriasVencidas.toFixed(2),
      ferias_proporcionais_valor: c.feriasProporcionais.toFixed(2),
      decimo_terceiro_valor: c.decimoTerceiro.toFixed(2),
      multa_fgts_valor: c.multaFgts.toFixed(2),
      desconto_banco_horas: deficitBanco.desconto.toFixed(2),
    });
  }

  const totalBruto = VERBAS.reduce((s, [k]) => s + (parseFloat(form[k]) || 0), 0) + (parseFloat(form.outros_valores) || 0);
  const totalDescontos = (parseFloat(form.desconto_banco_horas) || 0) + (parseFloat(form.descontos) || 0);
  const totalLiquido = totalBruto - totalDescontos;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!func) return;
    if (homologada && !file) {
      setError('Para marcar como homologada, anexe o termo de rescisão.');
      return;
    }
    setError('');
    setSaving(true);
    let anexo_url = '', anexo_nome = '';
    if (anexar && file) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      anexo_url = file_url;
      anexo_nome = file.name;
    }
    const num = (k) => parseFloat(form[k]) || 0;
    const calcBase = calcularRescisao({
      salarioBase: func.salario_base, mediaVariaveis: mediaVariavel.media, dataAdmissao: func.data_admissao, dataDesligamento: form.data_desligamento,
      tipo: form.tipo_rescisao, avisoPrevio: form.aviso_previo, saldoFgts: parseFloat(form.saldo_fgts) || 0,
      feriasPendentesDias: saldoFeriasDias, feriasDobradasDias,
    });
    const resc = await base44.entities.RescisaoFuncionario.create({
      funcionario_id: func.id, funcionario_nome: func.nome,
      data_desligamento: form.data_desligamento, tipo_rescisao: form.tipo_rescisao, aviso_previo: form.aviso_previo,
      saldo_salario: num('saldo_salario'), aviso_previo_valor: num('aviso_previo_valor'),
      ferias_vencidas_valor: num('ferias_vencidas_valor'), ferias_proporcionais_valor: num('ferias_proporcionais_valor'),
      decimo_terceiro_valor: num('decimo_terceiro_valor'), multa_fgts_valor: num('multa_fgts_valor'),
      outros_valores: num('outros_valores'), descontos: num('descontos'),
      total_liquido: Math.round(totalLiquido * 100) / 100,
      tempo_casa_meses: calcBase.tempoCasaMeses,
      dias_aviso_previo: calcBase.diasAviso,
      ferias_pendentes_dias: saldoFeriasDias,
      ferias_dobradas_dias: feriasDobradasDias,
      media_remuneracao_variavel: Math.round(mediaVariavel.media * 100) / 100,
      meses_media_remuneracao: mediaVariavel.meses,
      saldo_banco_horas: Math.round(deficitBanco.saldo * 100) / 100,
      desconto_banco_horas: num('desconto_banco_horas'),
      anexo_url, anexo_nome,
      homologada: homologada && !!anexo_url,
      ...(homologada && anexo_url ? { homologada_em: new Date().toISOString() } : {}),
      status: homologada && anexo_url ? 'homologada' : 'pre_calculo',
      empresa: func.empresa, observacoes: form.observacoes,
    });
    if (efetivar) {
      await base44.entities.Funcionario.update(func.id, { status: 'desligado', data_demissao: form.data_desligamento });
      const folha = await base44.entities.FolhaPagamento.create({
        funcionario_id: func.id, funcionario_nome: func.nome,
        competencia: form.data_desligamento.slice(0, 7), tipo: 'rescisao',
        salario_bruto: Math.round(totalBruto * 100) / 100,
        outros_descontos: totalDescontos,
        salario_liquido: Math.round(totalLiquido * 100) / 100,
        status: 'pendente', empresa: func.empresa,
      });
      await base44.entities.RescisaoFuncionario.update(resc.id, { folha_pagamento_id: folha.id });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Rescisão de Contrato</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Funcionário</Label>
              <Select value={form.funcionario_nome} onValueChange={(v) => setForm({ ...form, funcionario_nome: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{funcionarios.filter((f) => f.status !== 'desligado').map((f) => <SelectItem key={f.id} value={f.nome}>{f.nome} — {formatCurrency(f.salario_base)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data do Desligamento</Label><Input type="date" value={form.data_desligamento} onChange={(e) => setForm({ ...form, data_desligamento: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Tipo de Rescisão</Label>
              <Select value={form.tipo_rescisao} onValueChange={(v) => setForm({ ...form, tipo_rescisao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TIPOS_RESCISAO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Aviso Prévio</Label>
              <Select value={form.aviso_previo} onValueChange={(v) => setForm({ ...form, aviso_previo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indenizado">Indenizado</SelectItem>
                  <SelectItem value="trabalhado">Trabalhado</SelectItem>
                  <SelectItem value="dispensado">Dispensado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1"><Label>Saldo FGTS p/ multa (R$)</Label><Input type="number" step="0.01" value={form.saldo_fgts} onChange={(e) => setForm({ ...form, saldo_fgts: e.target.value })} placeholder="Consultar extrato FGTS" /></div>
            <Button type="button" variant="outline" onClick={preCalcular} disabled={!func} className="gap-2">
              <Calculator className="w-4 h-4" /> Pré-calcular Verbas
            </Button>
          </div>
          {func && (
            <div className="text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 space-y-1">
              <p><b>Base CLT do pré-cálculo:</b> admissão em {formatDate(func.data_admissao)} · salário-base {formatCurrency(func.salario_base)}.</p>
              <p>Média variável: <b>{formatCurrency(mediaVariavel.media)}</b> em {mediaVariavel.meses} folha(s) · base remuneratória sugerida: <b>{formatCurrency(remuneracaoBase)}</b>.</p>
              <p>Férias de períodos completos pendentes: <b>{saldoFeriasDias} dias</b>{feriasDobradasDias > 0 ? ` · ${feriasDobradasDias} dias fora do período concessivo calculados em dobro` : ''}.</p>
              <p>Banco de horas: <b>{deficitBanco.saldo.toFixed(2)}h</b>{deficitBanco.horasDeficit > 0 ? ` · déficit sugerido para desconto: ${formatCurrency(deficitBanco.desconto)}` : ' · sem déficit'}.</p>
              {calculo && <p>Tempo de casa: <b>{Math.floor(calculo.tempoCasaMeses / 12)} ano(s) e {calculo.tempoCasaMeses % 12} mês(es)</b> · aviso considerado: <b>{calculo.diasAviso} dias</b> · férias proporcionais: <b>{calculo.mesesFeriasProp}/12</b> · 13º: <b>{calculo.mesesDecimo}/12</b>.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {VERBAS.map(([k, l]) => (
              <div key={k}><Label className="text-xs">{l}</Label><Input type="number" step="0.01" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            <div><Label className="text-xs">Outras Verbas</Label><Input type="number" step="0.01" value={form.outros_valores} onChange={(e) => setForm({ ...form, outros_valores: e.target.value })} /></div>
            <div><Label className="text-xs">Desconto Banco de Horas</Label><Input type="number" step="0.01" value={form.desconto_banco_horas} onChange={(e) => setForm({ ...form, desconto_banco_horas: e.target.value })} /></div>
            <div><Label className="text-xs">Outros Descontos</Label><Input type="number" step="0.01" value={form.descontos} onChange={(e) => setForm({ ...form, descontos: e.target.value })} /></div>
          </div>

          <div className="bg-muted/40 rounded-xl p-3 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Bruto: <b>{formatCurrency(totalBruto)}</b> · descontos: <b>{formatCurrency(totalDescontos)}</b></span>
            <span className="font-bold text-lg text-primary">Líquido: {formatCurrency(totalLiquido)}</span>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={anexar} onChange={(e) => setAnexar(e.target.checked)} className="rounded" />
            <Paperclip className="w-4 h-4 text-muted-foreground" /> Anexar termo de rescisão (PDF/imagem)
          </label>
          {anexar && <Input type="file" accept=".pdf,image/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }} />}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={homologada} onChange={(e) => { setHomologada(e.target.checked); if (e.target.checked) setAnexar(true); }} className="rounded" />
            Rescisão homologada (exige termo anexado)
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={efetivar} onChange={(e) => setEfetivar(e.target.checked)} className="rounded" />
            Efetivar desligamento agora (marca o funcionário como desligado e gera a folha de rescisão)
          </label>

          <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>

          <p className="text-[11px] text-muted-foreground">Estimativa baseada nas regras CLT gerais. A conferência final deve considerar convenção coletiva, médias remuneratórias, descontos e validação contábil.</p>
          <Button type="submit" className="w-full" disabled={saving || !func}>
            {saving ? 'Salvando...' : 'Salvar Rescisão'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}