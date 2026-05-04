import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Users, Download, Calendar, Briefcase, Building2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency, formatDate } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';

const SETORES = ['vendas', 'assistencia', 'financeiro', 'compras', 'administrativo', 'telemarketing'];
const EMPRESAS = ['NeuralTec', 'Liesch'];
const TIPOS_CONTRATO = ['CLT', 'PJ', 'estagiario', 'temporario'];

const SETOR_CONFIG = {
  administrativo: { label: 'Administrativo', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  vendas:         { label: 'Vendas',          color: 'bg-green-100 text-green-700 border-green-200' },
  assistencia:    { label: 'Assistência',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  financeiro:     { label: 'Financeiro',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  compras:        { label: 'Compras',         color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  telemarketing:  { label: 'Telemarketing',   color: 'bg-pink-100 text-pink-700 border-pink-200' },
};

const STATUS_CONFIG = {
  ativo:     { label: 'Ativo',     color: 'bg-green-100 text-green-700' },
  ferias:    { label: 'Férias',    color: 'bg-blue-100 text-blue-700' },
  afastado:  { label: 'Afastado', color: 'bg-yellow-100 text-yellow-700' },
  desligado: { label: 'Desligado',color: 'bg-red-100 text-red-700' },
};

const FOLHA_STATUS = {
  pago:        { label: 'Pago',        color: 'bg-green-100 text-green-700' },
  pendente:    { label: 'Pendente',    color: 'bg-orange-100 text-orange-700' },
  adiantamento:{ label: 'Adiantamento',color: 'bg-blue-100 text-blue-700' },
};

function tempoEmpresa(dataAdmissao) {
  if (!dataAdmissao) return '—';
  const inicio = new Date(dataAdmissao);
  const hoje = new Date();
  const meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  if (meses < 12) return `${meses}m`;
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  return m > 0 ? `${anos}a ${m}m` : `${anos} ano${anos > 1 ? 's' : ''}`;
}

function FuncRow({ func, folhas, onClick }) {
  const status = STATUS_CONFIG[func.status] || { label: func.status, color: 'bg-slate-100 text-slate-700' };
  const historico = folhas.filter(f => f.funcionario_nome === func.nome);
  return (
    <tr
      onClick={() => onClick(func)}
      className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
            {func.nome?.split(' ').map(n => n[0]).slice(0,2).join('')}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{func.nome}</p>
            <p className="text-xs text-muted-foreground">{func.cargo}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{func.empresa}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{func.tipo_contrato}</td>
      <td className="px-3 py-3 text-sm font-semibold tabular-nums">{formatCurrency(func.salario_base)}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{tempoEmpresa(func.data_admissao)}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{historico.length > 0 ? `${historico.length} folha(s)` : '—'}</td>
      <td className="px-3 py-3">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${status.color}`}>{status.label}</span>
      </td>
    </tr>
  );
}

function FuncModal({ func, folhas, onClose }) {
  if (!func) return null;
  const historico = folhas.filter(f => f.funcionario_nome === func.nome).sort((a,b) => b.competencia.localeCompare(a.competencia));
  const setor = SETOR_CONFIG[func.setor] || { label: func.setor, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  return (
    <Dialog open={!!func} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
              {func.nome?.split(' ').map(n => n[0]).slice(0,2).join('')}
            </div>
            {func.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Cargo</p>
            <p className="font-semibold">{func.cargo}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Setor</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${setor.color}`}>{setor.label}</span>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Empresa</p>
            <p className="font-semibold">{func.empresa}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Contrato</p>
            <p className="font-semibold">{func.tipo_contrato}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Admissão</p>
            <p className="font-semibold">{formatDate(func.data_admissao)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Tempo de Empresa</p>
            <p className="font-semibold">{tempoEmpresa(func.data_admissao)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Salário Base</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(func.salario_base)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">CPF</p>
            <p className="font-semibold font-mono text-xs">{func.cpf || '—'}</p>
          </div>
        </div>
        {func.observacoes && <p className="text-xs text-muted-foreground italic mb-4 bg-yellow-50 border border-yellow-200 rounded p-2">{func.observacoes}</p>}
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Histórico de Folhas</p>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma folha registrada</p>
        ) : (
          <div className="space-y-2">
            {historico.map(f => {
              const descontos = (f.desconto_inss||0)+(f.desconto_irrf||0)+(f.desconto_vt||0)+(f.desconto_vr||0)+(f.outros_descontos||0);
              const sc = FOLHA_STATUS[f.status] || FOLHA_STATUS.pendente;
              return (
                <div key={f.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-16">{f.competencia}</span>
                  <span className="text-xs">Bruto: <b>{formatCurrency(f.salario_bruto)}</b></span>
                  {f.comissao > 0 && <span className="text-xs text-blue-600">+{formatCurrency(f.comissao)}</span>}
                  <span className="text-xs text-red-500">-{formatCurrency(descontos)}</span>
                  <span className="font-bold text-green-700 text-xs">{formatCurrency(f.salario_liquido)}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Funcionarios() {
  const [activeTab, setActiveTab] = useState('funcionarios');
  const [funcionarios, setFuncionarios] = useState([]);
  const [folhas, setFolhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFuncForm, setShowFuncForm] = useState(false);
  const [showFolhaForm, setShowFolhaForm] = useState(false);
  const [selectedFunc, setSelectedFunc] = useState(null);
  const [competencia, setCompetencia] = useState(getCurrentMonth());
  const [funcForm, setFuncForm] = useState({
    nome: '', cpf: '', cargo: '', setor: '', data_admissao: '', status: 'ativo', salario_base: '', tipo_contrato: 'CLT', empresa: 'NeuralTec'
  });
  const [folhaForm, setFolhaForm] = useState({
    funcionario_nome: '', competencia: '', salario_bruto: '', desconto_inss: '0', desconto_irrf: '0',
    desconto_vt: '0', desconto_vr: '0', outros_descontos: '0', horas_extras: '0', comissao: '0',
    data_pagamento: '', status: 'pendente', fgts_valor: '0', empresa: 'NeuralTec'
  });

  async function loadData() {
    const [funcs, fols] = await Promise.all([
      base44.entities.Funcionario.list('-data_admissao', 500),
      base44.entities.FolhaPagamento.list('-competencia', 500),
    ]);
    setFuncionarios(funcs);
    setFolhas(fols);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    const unsubFunc = base44.entities.Funcionario.subscribe(() => loadData());
    const unsubFolha = base44.entities.FolhaPagamento.subscribe(() => loadData());
    return () => { window.removeEventListener('neuralfinRefresh', handler); unsubFunc(); unsubFolha(); };
  }, []);

  async function handleFuncSubmit(e) {
    e.preventDefault();
    await base44.entities.Funcionario.create({ ...funcForm, salario_base: parseFloat(funcForm.salario_base) });
    setShowFuncForm(false);
    setFuncForm({ nome:'',cpf:'',cargo:'',setor:'',data_admissao:'',status:'ativo',salario_base:'',tipo_contrato:'CLT',empresa:'NeuralTec' });
    loadData();
  }

  async function handleFolhaSubmit(e) {
    e.preventDefault();
    const descontos = ['desconto_inss','desconto_irrf','desconto_vt','desconto_vr','outros_descontos'].reduce((s,k)=>s+(parseFloat(folhaForm[k])||0),0);
    const adicionais = (parseFloat(folhaForm.horas_extras)||0)+(parseFloat(folhaForm.comissao)||0);
    const liquido = (parseFloat(folhaForm.salario_bruto)||0) + adicionais - descontos;
    await base44.entities.FolhaPagamento.create({
      ...folhaForm,
      salario_bruto: parseFloat(folhaForm.salario_bruto),
      desconto_inss: parseFloat(folhaForm.desconto_inss)||0,
      desconto_irrf: parseFloat(folhaForm.desconto_irrf)||0,
      desconto_vt: parseFloat(folhaForm.desconto_vt)||0,
      desconto_vr: parseFloat(folhaForm.desconto_vr)||0,
      outros_descontos: parseFloat(folhaForm.outros_descontos)||0,
      horas_extras: parseFloat(folhaForm.horas_extras)||0,
      comissao: parseFloat(folhaForm.comissao)||0,
      salario_liquido: liquido,
      fgts_valor: parseFloat(folhaForm.fgts_valor)||0,
    });
    setShowFolhaForm(false);
    loadData();
  }

  // Folha do mês selecionado
  const folhasMes = useMemo(() => folhas.filter(f => f.competencia === competencia), [folhas, competencia]);

  // Competências disponíveis
  const competencias = useMemo(() => [...new Set(folhas.map(f=>f.competencia))].sort().reverse(), [folhas]);

  // Totais folha
  const totalBruto   = folhasMes.reduce((s,f)=>s+(f.salario_bruto||0),0);
  const totalLiquido = folhasMes.reduce((s,f)=>s+(f.salario_liquido||0),0);
  const totalComissao= folhasMes.reduce((s,f)=>s+(f.comissao||0),0);
  const totalPago    = folhasMes.filter(f=>f.status==='pago').reduce((s,f)=>s+(f.salario_liquido||0),0);
  const totalSaldo   = totalLiquido - totalPago;

  // Agrupar funcionários por setor
  const gruposFunc = useMemo(() => {
    const grupos = {};
    const ativos = funcionarios.filter(f => f.status !== 'desligado');
    ativos.forEach(f => {
      const s = f.setor || 'outros';
      if (!grupos[s]) grupos[s] = [];
      grupos[s].push(f);
    });
    return grupos;
  }, [funcionarios]);

  // Agrupar folha por setor
  const gruposFolha = useMemo(() => {
    const grupos = {};
    folhasMes.forEach(f => {
      const func = funcionarios.find(fn => fn.nome === f.funcionario_nome);
      const setor = func?.setor || 'outros';
      if (!grupos[setor]) grupos[setor] = [];
      grupos[setor].push({ ...f, _setor: setor });
    });
    return grupos;
  }, [folhasMes, funcionarios]);

  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;

  function exportar() {
    const lines = [
      `Folha de Pagamento — ${competencia}`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      'Funcionário,Bruto,Comissão,Descontos,Líquido,Status',
      ...folhasMes.map(f => {
        const desc = (f.desconto_inss||0)+(f.desconto_irrf||0)+(f.desconto_vt||0)+(f.desconto_vr||0)+(f.outros_descontos||0);
        return `${f.funcionario_nome},${f.salario_bruto},${f.comissao||0},${desc},${f.salario_liquido},${f.status}`;
      }),
      '',
      `TOTAL,${totalBruto},${totalComissao},,${totalLiquido},`,
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `folha_${competencia}.csv`; a.click();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Pessoas (RH)" subtitle={`${funcionariosAtivos} funcionários ativos · ${funcionarios.length} cadastrados`}>
        {activeTab === 'funcionarios' && (
          <Button onClick={() => setShowFuncForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Funcionário</Button>
        )}
        {activeTab === 'folha' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportar} className="gap-2"><Download className="w-4 h-4" /> Exportar</Button>
            <Button onClick={() => setShowFolhaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Lançar Folha</Button>
          </div>
        )}
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-500" /><p className="text-xs font-semibold text-muted-foreground">Ativos</p></div>
          <p className="text-2xl font-bold">{funcionariosAtivos}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-purple-500" /><p className="text-xs font-semibold text-muted-foreground">Setores</p></div>
          <p className="text-2xl font-bold">{Object.keys(gruposFunc).length}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-green-500" /><p className="text-xs font-semibold text-muted-foreground">Folha {competencia}</p></div>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalLiquido)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-orange-500" /><p className="text-xs font-semibold text-muted-foreground">A Pagar</p></div>
          <p className="text-xl font-bold text-orange-700">{formatCurrency(totalSaldo)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {[['funcionarios','Funcionários'],['folha','Folha de Pagamento']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 font-semibold text-sm transition-colors ${activeTab === key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ABA 1 — Funcionários */}
      {activeTab === 'funcionarios' && (
        <div className="space-y-6">
          {Object.entries(gruposFunc).sort().map(([setor, funcs]) => {
            const sc = SETOR_CONFIG[setor] || { label: setor, color: 'bg-slate-100 text-slate-700' };
            return (
              <div key={setor}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${sc.color}`}>{sc.label}</span>
                  <span className="text-xs text-muted-foreground">{funcs.length} pessoa{funcs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-card rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs">
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Funcionário</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Empresa</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Contrato</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Salário Base</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tempo</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Folhas</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funcs.map(f => <FuncRow key={f.id} func={f} folhas={folhas} onClick={setSelectedFunc} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {Object.keys(gruposFunc).length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum funcionário ativo cadastrado</p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2 — Folha de Pagamento */}
      {activeTab === 'folha' && (
        <>
          {/* Filtro competência */}
          <div className="flex items-center gap-3 mb-5">
            <p className="text-sm font-semibold text-muted-foreground">Competência:</p>
            <div className="flex gap-2 flex-wrap">
              {competencias.map(c => (
                <button key={c} onClick={() => setCompetencia(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${competencia === c ? 'bg-primary text-primary-foreground shadow' : 'border hover:bg-muted text-muted-foreground'}`}>
                  {c}
                </button>
              ))}
              <Input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="h-8 text-xs w-36" />
            </div>
          </div>

          {/* Resumo totais */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Bruto', value: totalBruto, color: 'text-foreground' },
              { label: 'Comissões', value: totalComissao, color: 'text-blue-700' },
              { label: 'Total Líquido', value: totalLiquido, color: 'text-foreground' },
              { label: 'Total Pago', value: totalPago, color: 'text-green-700' },
              { label: 'Saldo a Pagar', value: totalSaldo, color: totalSaldo > 0 ? 'text-orange-700' : 'text-green-700' },
            ].map(item => (
              <div key={item.label} className="bg-card rounded-xl border p-3">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className={`text-base font-bold tabular-nums ${item.color}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>

          {/* Tabela por setor */}
          {folhasMes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma folha para {competencia}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(gruposFolha).sort().map(([setor, itens]) => {
                const sc = SETOR_CONFIG[setor] || { label: setor, color: 'bg-slate-100 text-slate-700' };
                const setorBruto  = itens.reduce((s,f)=>s+(f.salario_bruto||0),0);
                const setorLiq    = itens.reduce((s,f)=>s+(f.salario_liquido||0),0);
                const setorComiss = itens.reduce((s,f)=>s+(f.comissao||0),0);
                const setorPago   = itens.filter(f=>f.status==='pago').reduce((s,f)=>s+(f.salario_liquido||0),0);
                return (
                  <div key={setor}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border ${sc.color}`}>{sc.label}</span>
                    </div>
                    <div className="bg-card rounded-xl border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30 text-xs">
                              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Funcionário</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Bruto</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Extras</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Comissão</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Descontos</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Líquido</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Pago</th>
                              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Saldo</th>
                              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itens.map(f => {
                              const desc = (f.desconto_inss||0)+(f.desconto_irrf||0)+(f.desconto_vt||0)+(f.desconto_vr||0)+(f.outros_descontos||0);
                              const pago = f.status === 'pago' ? f.salario_liquido : 0;
                              const saldo = (f.salario_liquido||0) - pago;
                              const sc2 = FOLHA_STATUS[f.status] || FOLHA_STATUS.pendente;
                              return (
                                <tr key={f.id} className="border-b hover:bg-muted/20 transition-colors">
                                  <td className="px-4 py-2.5 font-semibold">{f.funcionario_nome}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(f.salario_bruto)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-blue-600">{f.horas_extras > 0 ? formatCurrency(f.horas_extras) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-blue-600">{f.comissao > 0 ? formatCurrency(f.comissao) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{desc > 0 ? formatCurrency(-desc) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-green-700">{formatCurrency(f.salario_liquido)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-green-600">{pago > 0 ? formatCurrency(pago) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">{saldo > 0 ? formatCurrency(saldo) : '—'}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${sc2.color}`}>{sc2.label}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 bg-muted/40 text-xs font-bold">
                              <td className="px-4 py-2.5">Subtotal {sc.label}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(setorBruto)}</td>
                              <td className="px-3 py-2.5"></td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-blue-600">{setorComiss > 0 ? formatCurrency(setorComiss) : '—'}</td>
                              <td className="px-3 py-2.5"></td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{formatCurrency(setorLiq)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-green-600">{formatCurrency(setorPago)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">{formatCurrency(setorLiq - setorPago)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Total geral */}
              <div className="bg-muted/50 rounded-xl border-2 border-primary/20 p-4 flex flex-wrap gap-6 items-center justify-between">
                <p className="font-bold text-sm">TOTAL GERAL — {competencia}</p>
                <div className="flex gap-6 flex-wrap text-sm">
                  <span>Bruto: <b>{formatCurrency(totalBruto)}</b></span>
                  <span className="text-blue-700">Comissões: <b>{formatCurrency(totalComissao)}</b></span>
                  <span className="text-green-700">Líquido: <b>{formatCurrency(totalLiquido)}</b></span>
                  <span className="text-green-600">Pago: <b>{formatCurrency(totalPago)}</b></span>
                  <span className="text-orange-700">A Pagar: <b>{formatCurrency(totalSaldo)}</b></span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal detalhe funcionário */}
      <FuncModal func={selectedFunc} folhas={folhas} onClose={() => setSelectedFunc(null)} />

      {/* Form novo funcionário */}
      <Dialog open={showFuncForm} onOpenChange={setShowFuncForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
          <form onSubmit={handleFuncSubmit} className="space-y-4">
            <div><Label>Nome</Label><Input value={funcForm.nome} onChange={e => setFuncForm({...funcForm, nome: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CPF</Label><Input value={funcForm.cpf} onChange={e => setFuncForm({...funcForm, cpf: e.target.value})} /></div>
              <div><Label>Cargo</Label><Input value={funcForm.cargo} onChange={e => setFuncForm({...funcForm, cargo: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Setor</Label>
                <Select value={funcForm.setor} onValueChange={v => setFuncForm({...funcForm, setor: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{SETOR_CONFIG[s]?.label || s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Empresa</Label>
                <Select value={funcForm.empresa} onValueChange={v => setFuncForm({...funcForm, empresa: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Admissão</Label><Input type="date" value={funcForm.data_admissao} onChange={e => setFuncForm({...funcForm, data_admissao: e.target.value})} required /></div>
              <div><Label>Tipo Contrato</Label>
                <Select value={funcForm.tipo_contrato} onValueChange={v => setFuncForm({...funcForm, tipo_contrato: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_CONTRATO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Salário Base</Label><Input type="number" step="0.01" value={funcForm.salario_base} onChange={e => setFuncForm({...funcForm, salario_base: e.target.value})} required /></div>
            <Button type="submit" className="w-full">Salvar Funcionário</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form nova folha */}
      <Dialog open={showFolhaForm} onOpenChange={setShowFolhaForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lançar Folha de Pagamento</DialogTitle></DialogHeader>
          <form onSubmit={handleFolhaSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Funcionário</Label>
                <Select value={folhaForm.funcionario_nome} onValueChange={v => {
                  const f = funcionarios.find(fn => fn.nome === v);
                  setFolhaForm({...folhaForm, funcionario_nome: v, salario_bruto: f?.salario_base?.toString() || '', empresa: f?.empresa || ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{funcionarios.filter(f=>f.status==='ativo').map(f => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Competência</Label><Input type="month" value={folhaForm.competencia} onChange={e => setFolhaForm({...folhaForm, competencia: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Salário Bruto</Label><Input type="number" step="0.01" value={folhaForm.salario_bruto} onChange={e => setFolhaForm({...folhaForm, salario_bruto: e.target.value})} required /></div>
              <div><Label>Horas Extras</Label><Input type="number" step="0.01" value={folhaForm.horas_extras} onChange={e => setFolhaForm({...folhaForm, horas_extras: e.target.value})} /></div>
              <div><Label>Comissão</Label><Input type="number" step="0.01" value={folhaForm.comissao} onChange={e => setFolhaForm({...folhaForm, comissao: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[['desconto_inss','INSS'],['desconto_irrf','IRRF'],['desconto_vt','VT'],['desconto_vr','VR']].map(([k,l]) => (
                <div key={k}><Label className="text-xs">{l}</Label><Input type="number" step="0.01" value={folhaForm[k]} onChange={e => setFolhaForm({...folhaForm, [k]: e.target.value})} /></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>FGTS</Label><Input type="number" step="0.01" value={folhaForm.fgts_valor} onChange={e => setFolhaForm({...folhaForm, fgts_valor: e.target.value})} /></div>
              <div><Label>Data Pagamento</Label><Input type="date" value={folhaForm.data_pagamento} onChange={e => setFolhaForm({...folhaForm, data_pagamento: e.target.value})} /></div>
              <div><Label>Status</Label>
                <Select value={folhaForm.status} onValueChange={v => setFolhaForm({...folhaForm, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="adiantamento">Adiantamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Folha</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}