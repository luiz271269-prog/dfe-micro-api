import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Users } from 'lucide-react';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

const SETORES = ['vendas', 'assistencia', 'financeiro', 'compras', 'administrativo', 'telemarketing'];
const EMPRESAS = ['NeuralTec', 'Liesch'];
const TIPOS_CONTRATO = ['CLT', 'PJ', 'estagiario', 'temporario'];

export default function Funcionarios() {
  const [activeTab, setActiveTab] = useState('cadastro');
  const [funcionarios, setFuncionarios] = useState([]);
  const [folhas, setFolhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFuncForm, setShowFuncForm] = useState(false);
  const [showFolhaForm, setShowFolhaForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-03');
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterSetor, setFilterSetor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterCompetencia, setFilterCompetencia] = useState('');
  const [funcForm, setFuncForm] = useState({
    nome: '', cpf: '', cargo: '', setor: '', data_admissao: '', status: 'ativo', salario_base: '', tipo_contrato: '', empresa: ''
  });
  const [folhaForm, setFolhaForm] = useState({
    funcionario_nome: '', competencia: '', salario_bruto: '', desconto_inss: '0', desconto_irrf: '0',
    desconto_vt: '0', desconto_vr: '0', outros_descontos: '0', horas_extras: '0', comissao: '0',
    salario_liquido: '', data_pagamento: '', status: 'pendente', fgts_valor: '0', empresa: ''
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
  }, []);

  async function handleFuncSubmit(e) {
    e.preventDefault();
    await base44.entities.Funcionario.create({
      ...funcForm,
      salario_base: parseFloat(funcForm.salario_base),
    });
    setFuncForm({ nome: '', cpf: '', cargo: '', setor: '', data_admissao: '', status: 'ativo', salario_base: '', tipo_contrato: '', empresa: '' });
    setShowFuncForm(false);
    loadData();
  }

  async function handleFolhaSubmit(e) {
    e.preventDefault();
    const descontos = (parseFloat(folhaForm.desconto_inss) || 0) + (parseFloat(folhaForm.desconto_irrf) || 0) +
      (parseFloat(folhaForm.desconto_vt) || 0) + (parseFloat(folhaForm.desconto_vr) || 0) + (parseFloat(folhaForm.outros_descontos) || 0);
    const adicionais = (parseFloat(folhaForm.horas_extras) || 0) + (parseFloat(folhaForm.comissao) || 0);
    const liquido = parseFloat(folhaForm.salario_bruto) + adicionais - descontos;
    
    await base44.entities.FolhaPagamento.create({
      ...folhaForm,
      salario_bruto: parseFloat(folhaForm.salario_bruto),
      desconto_inss: parseFloat(folhaForm.desconto_inss) || 0,
      desconto_irrf: parseFloat(folhaForm.desconto_irrf) || 0,
      desconto_vt: parseFloat(folhaForm.desconto_vt) || 0,
      desconto_vr: parseFloat(folhaForm.desconto_vr) || 0,
      outros_descontos: parseFloat(folhaForm.outros_descontos) || 0,
      horas_extras: parseFloat(folhaForm.horas_extras) || 0,
      comissao: parseFloat(folhaForm.comissao) || 0,
      salario_liquido: liquido,
      fgts_valor: parseFloat(folhaForm.fgts_valor) || 0,
    });
    setFolhaForm({ funcionario_nome: '', competencia: '', salario_bruto: '', desconto_inss: '0', desconto_irrf: '0', desconto_vt: '0', desconto_vr: '0', outros_descontos: '0', horas_extras: '0', comissao: '0', salario_liquido: '', data_pagamento: '', status: 'pendente', fgts_valor: '0', empresa: '' });
    setShowFolhaForm(false);
    loadData();
  }

  const funcsFiltrados = funcionarios.filter(f => {
    if (filterSetor && f.setor !== filterSetor) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterEmpresa && f.empresa !== filterEmpresa) return false;
    return true;
  });

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = folhas.filter(f => f.competencia === m).reduce((s,f) => s+(f.salario_liquido||0), 0);
    });
    return t;
  }, [folhas]);

  const folhasFiltradas = folhas.filter(f => {
    if (!isAnnual && f.competencia !== selectedMonth) return false;
    if (filterCompetencia && f.competencia !== filterCompetencia) return false;
    return true;
  });

  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;
  const folhaAtual = folhas.filter(f => f.competencia === new Date().toISOString().slice(0, 7) && f.status === 'pago')
    .reduce((s, f) => s + (f.salario_liquido || 0), 0);
  const fgtsTotal = folhas.reduce((s, f) => s + (f.fgts_valor || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Gestão de Pessoal" subtitle={`${funcionarios.length} funcionários cadastrados`}>
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        {activeTab === 'cadastro' && <Button onClick={() => setShowFuncForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Funcionário</Button>}
        {activeTab === 'folha' && <Button onClick={() => setShowFolhaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Folha</Button>}
      </PageHeader>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Ativos</p>
          <p className="text-2xl font-bold">{funcionariosAtivos}</p>
          <p className="text-xs text-muted-foreground mt-1">funcionários ativos</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Folha Mensal</p>
          <p className="text-2xl font-bold">{formatCurrency(folhaAtual)}</p>
          <p className="text-xs text-muted-foreground mt-1">mês atual</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1">FGTS</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(fgtsTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">total acumulado</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setActiveTab('cadastro')} className={`px-4 py-2 font-semibold text-sm transition-colors ${activeTab === 'cadastro' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Cadastro
        </button>
        <button onClick={() => setActiveTab('folha')} className={`px-4 py-2 font-semibold text-sm transition-colors ${activeTab === 'folha' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Folha de Pagamento
        </button>
      </div>

      {activeTab === 'cadastro' && (
        <>
          <div className="bg-card rounded-xl border p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select value={filterSetor} onValueChange={setFilterSetor}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="desligado">Desligado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold">Cargo</th>
                    <th className="text-left px-4 py-3 font-semibold">Setor</th>
                    <th className="text-left px-4 py-3 font-semibold">Empresa</th>
                    <th className="text-left px-4 py-3 font-semibold">Tipo Contrato</th>
                    <th className="text-right px-4 py-3 font-semibold">Salário</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {funcsFiltrados.length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">Nenhum funcionário encontrado</td></tr>
                  ) : (
                    funcsFiltrados.map(f => (
                      <tr key={f.id} className="border-b">
                        <td className="px-4 py-3 font-semibold">{f.nome}</td>
                        <td className="px-4 py-3">{f.cargo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{f.setor}</td>
                        <td className="px-4 py-3 text-xs">{f.empresa}</td>
                        <td className="px-4 py-3 text-xs">{f.tipo_contrato}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(f.salario_base)}</td>
                        <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'folha' && (
        <>
          <div className="bg-card rounded-xl border p-4 mb-6">
            <Input type="month" value={filterCompetencia} onChange={e => setFilterCompetencia(e.target.value)} placeholder="Competência" className="h-8 text-sm w-32" />
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Funcionário</th>
                    <th className="text-left px-4 py-3 font-semibold">Competência</th>
                    <th className="text-right px-4 py-3 font-semibold">Bruto</th>
                    <th className="text-right px-4 py-3 font-semibold">Descontos</th>
                    <th className="text-right px-4 py-3 font-semibold">Líquido</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {folhasFiltradas.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">Nenhuma folha encontrada</td></tr>
                  ) : (
                    folhasFiltradas.map(f => {
                      const descontos = (f.desconto_inss || 0) + (f.desconto_irrf || 0) + (f.desconto_vt || 0) + (f.desconto_vr || 0) + (f.outros_descontos || 0);
                      return (
                        <tr key={f.id} className="border-b">
                          <td className="px-4 py-3 font-semibold">{f.funcionario_nome}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{f.competencia}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(f.salario_bruto)}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(-descontos)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(f.salario_liquido)}</td>
                          <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Forms */}
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
              <div>
                <Label>Setor</Label>
                <Select value={funcForm.setor} onValueChange={v => setFuncForm({...funcForm, setor: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={funcForm.empresa} onValueChange={v => setFuncForm({...funcForm, empresa: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Admissão</Label><Input type="date" value={funcForm.data_admissao} onChange={e => setFuncForm({...funcForm, data_admissao: e.target.value})} required /></div>
              <div>
                <Label>Tipo Contrato</Label>
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

      <Dialog open={showFolhaForm} onOpenChange={setShowFolhaForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lançar Folha de Pagamento</DialogTitle></DialogHeader>
          <form onSubmit={handleFolhaSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Funcionário</Label><Input value={folhaForm.funcionario_nome} onChange={e => setFolhaForm({...folhaForm, funcionario_nome: e.target.value})} required /></div>
              <div><Label>Competência</Label><Input type="month" value={folhaForm.competencia} onChange={e => setFolhaForm({...folhaForm, competencia: e.target.value})} required /></div>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={folhaForm.empresa} onValueChange={v => setFolhaForm({...folhaForm, empresa: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Bruto</Label><Input type="number" step="0.01" value={folhaForm.salario_bruto} onChange={e => setFolhaForm({...folhaForm, salario_bruto: e.target.value})} required /></div>
              <div><Label>Extras</Label><Input type="number" step="0.01" value={folhaForm.horas_extras} onChange={e => setFolhaForm({...folhaForm, horas_extras: e.target.value})} /></div>
              <div><Label>Comissão</Label><Input type="number" step="0.01" value={folhaForm.comissao} onChange={e => setFolhaForm({...folhaForm, comissao: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><Label className="text-xs">INSS</Label><Input type="number" step="0.01" value={folhaForm.desconto_inss} onChange={e => setFolhaForm({...folhaForm, desconto_inss: e.target.value})} /></div>
              <div><Label className="text-xs">IRRF</Label><Input type="number" step="0.01" value={folhaForm.desconto_irrf} onChange={e => setFolhaForm({...folhaForm, desconto_irrf: e.target.value})} /></div>
              <div><Label className="text-xs">VT</Label><Input type="number" step="0.01" value={folhaForm.desconto_vt} onChange={e => setFolhaForm({...folhaForm, desconto_vt: e.target.value})} /></div>
              <div><Label className="text-xs">VR</Label><Input type="number" step="0.01" value={folhaForm.desconto_vr} onChange={e => setFolhaForm({...folhaForm, desconto_vr: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Pagamento</Label><Input type="date" value={folhaForm.data_pagamento} onChange={e => setFolhaForm({...folhaForm, data_pagamento: e.target.value})} /></div>
              <div>
                <Label>Status</Label>
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