import { useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import PeriodoRecorrentes from '@/components/recorrentes/PeriodoRecorrentes';
import FrequenciaRecorrente from '@/components/recorrentes/FrequenciaRecorrente';
import CriarRegraExtratoDialog from '@/components/recorrentes/CriarRegraExtratoDialog';
import RevisaoFixasDialog from '@/components/recorrentes/RevisaoFixasDialog';
import FixasPlanoLista from '@/components/recorrentes/FixasPlanoLista';
import useFixasPainel from '@/components/recorrentes/useFixasPainel';
import useRecorrentesData from '@/components/recorrentes/useRecorrentesData';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Sparkles } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';

import { formatCurrency, formatDate } from '../lib/formatters';
import { aprenderPadroes } from '@/lib/recurringEngine';
import CampoClassificacao from '../components/shared/CampoClassificacao';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';

const EMPRESAS = ['NeuralTec','Liesch'];
const FORMAS = ['pix','boleto','debito_automatico','cartao','transferencia'];

const vazio = {
  nome: '', padrao_descricao: '', fornecedor: '', valor_esperado: '',
  tolerancia_percentual: 5, dia_vencimento: '', categoria: 'outro',
  origem_compra: 'empresa', tipo_compra: 'despesas',
  empresa: 'NeuralTec', forma_pagamento: 'pix', is_ativa: true, observacoes: '',
  frequencia: 'mensal', data_inicio: '', mes_inicio: '', conta_bancaria: '',
};

export default function Recorrentes() {
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'));
  const [modo, setModo] = useState('mes');

  const { opcoes: tiposPermitidos } = useCadastroClassificacao('tipo');
  const { opcoes: categorias, itens: contasPlano } = useCadastroClassificacao('categoria');
  const [extratoOpen, setExtratoOpen] = useState(false);
  const [conciliarOpen, setConciliarOpen] = useState(false);
  const [formErro, setFormErro] = useState('');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(vazio);
  const [saving, setSaving] = useState(false);
  const [sugestoesOpen, setSugestoesOpen] = useState(false);

  const inicio = modo === 'ano' ? `${mes.slice(0, 4)}-01` : modo === '12meses' ? format(addMonths(new Date(`${mes}-01T12:00:00`), -11), 'yyyy-MM') : mes;
  const fim = modo === 'ano' ? `${mes.slice(0, 4)}-12` : mes;
  const painel=useFixasPainel(mes,inicio,fim);
  const historicoAtivo=extratoOpen||conciliarOpen||sugestoesOpen;
  const {regras,lancs,cartoes,sugestoes:revisoes,faturas,loading:loadingHistorico,error:errorHistorico,load:loadHistorico}=useRecorrentesData(mes,historicoAtivo);
  const admin=painel.usuario?.role==='admin';
  const loading=painel.isPending,error=painel.error;
  async function load(){await painel.load();if(historicoAtivo)await loadHistorico();}
  const lancsPeriodo = useMemo(() => lancs.filter(l => l.data?.slice(0, 7) >= inicio && l.data?.slice(0, 7) <= fim), [lancs, inicio, fim]);
  const cartoesNormalizados = useMemo(() => cartoes.filter(l => (l.valor || 0) > 0 && !/Não faz parte|PAG.*FATURA|ESTORNO|SALDO ANTERIOR|PAGAMENTO RECEBIDO/i.test(`${l.estabelecimento} ${l.observacao || ''}`)).map(l => ({ ...l, data: l.data_lancamento, descricao: l.estabelecimento, detalhe: l.observacao, valor: -l.valor, conta_bancaria: '', fatura_conta_id: faturas.find(f => f.id === l.fatura_id)?.conta_cartao_id, fonte: 'Cartão' })), [cartoes, faturas]);
  const baseRecorrencias = useMemo(() => [...lancs.filter(l => !faturas.some(f => f.lancamento_bancario_id === l.id)), ...cartoesNormalizados], [lancs, cartoesNormalizados, faturas]);

  const totaisMes=painel.totais;

  const sugestoes = useMemo(() => {
    const desde = format(addMonths(new Date(`${mes}-01T12:00:00`), -11), 'yyyy-MM');
    return aprenderPadroes(baseRecorrencias.filter(l => l.data?.slice(0, 7) >= desde && l.data?.slice(0, 7) <= mes), regras);
  }, [baseRecorrencias, regras, mes]);





  function abrirNovo() { setFormErro(''); setForm({ ...vazio, mes_inicio: mes }); setEditando('novo'); }
  function criarPeloExtrato(l) {
    setFormErro('');
    setForm({ ...vazio, nome: l.descricao, padrao_descricao: l.descricao, fornecedor: l.descricao, valor_esperado: Math.abs(l.valor), dia_vencimento: Number(l.data.slice(8, 10)), data_inicio: l.data, mes_inicio: l.data.slice(0, 7), conta_bancaria: l.conta_bancaria || '', origem_compra: l.origem_compra || 'empresa', tipo_compra: l.tipo_compra || 'despesas', categoria: l.categoria || 'outro' });
    setExtratoOpen(false); setEditando('novo');
  }
  function abrirEditar(r) {
    setFormErro('');
    setForm({ ...vazio, ...r, empresa:r.empresa||'' });
    setEditando(r.id);
  }
  function aceitarSugestao(s) {
    setFormErro('');
    setForm({
      ...vazio,
      nome: s.nome,
      padrao_descricao: s.padrao_descricao,
      valor_esperado: s.valor_esperado,
      tolerancia_percentual: s.tolerancia_percentual,
      dia_vencimento: s.dia_vencimento,
      fornecedor: s.fornecedor || '',
      mes_inicio: s.mes_inicio,
      forma_pagamento: s.forma_pagamento,
      conta_bancaria: s.conta_bancaria,
      empresa: EMPRESAS.includes(s.empresa) ? s.empresa : '',
      categoria: categorias[s.categoria] ? s.categoria : vazio.categoria,
      origem_compra: s.origem_compra || vazio.origem_compra,
      tipo_compra: tiposPermitidos[s.tipo_compra] ? s.tipo_compra : vazio.tipo_compra,
    });
    setEditando('novo');
    setSugestoesOpen(false);
  }

  async function salvar() {
    setFormErro('');
    if (!admin) { setFormErro('Somente administradores podem cadastrar despesas fixas.'); return; }
    const conta = contasPlano.find(c => c.chave === form.categoria);
    const naturezas = conta?.naturezas_vinculadas?.length ? conta.naturezas_vinculadas : [conta?.natureza_vinculada].filter(Boolean);
    if (!EMPRESAS.includes(form.empresa)||form.tipo_compra!=='despesas'||form.origem_compra!=='empresa') {setFormErro('Defina a empresa, natureza despesas operacionais e centro de custo empresa. Registros de outros módulos permanecem no histórico.');return;}
    if (!conta || !naturezas.includes('despesas')) { setFormErro('Selecione uma conta operacional ativa do plano de contas.'); return; }
    if (form.frequencia !== 'semanal' && (!(Number(form.dia_vencimento) >= 1) || !Number.isInteger(Number(form.dia_vencimento)) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.mes_inicio || ''))) { setFormErro('Informe o dia e o mês inicial da previsão.'); return; }
    if (!(Number(form.valor_esperado) > 0) || !form.origem_compra || !tiposPermitidos[form.tipo_compra]) { setFormErro('Informe um valor positivo e complete a classificação.'); return; }
    if (form.frequencia === 'semanal' && !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(form.data_inicio || '')) { setFormErro('Informe a data inicial da recorrência semanal.'); return; }
    if (['trimestral', 'anual'].includes(form.frequencia) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.mes_inicio || '')) { setFormErro('Informe o mês inicial da recorrência.'); return; }
    if (form.dia_vencimento && (Number(form.dia_vencimento) < 1 || Number(form.dia_vencimento) > 31)) { setFormErro('O dia esperado deve estar entre 1 e 31.'); return; }
    if (Number(form.tolerancia_percentual) < 0 || Number(form.tolerancia_percentual) > 100) { setFormErro('Use tolerância de 0 a 100%.'); return; }

    setSaving(true);
    try {
      const padrao=form.padrao_descricao.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
      const repetidas=await base44.entities.RegraRecorrente.count({$and:[{id:{$ne:editando},empresa:form.empresa,frequencia:form.frequencia,padrao_descricao:{$regex:`^${padrao}$`,$options:'i'},forma_pagamento:form.forma_pagamento==='cartao'?'cartao':{$ne:'cartao'}},{$or:[{conta_bancaria:form.conta_bancaria||''},...(!form.conta_bancaria?[{conta_bancaria:{$exists:false}},{conta_bancaria:null}]:[])]}]});
      if(repetidas)throw new Error('Já existe uma regra com este padrão, conta e frequência. Edite a existente.');
      const { id, created_date, updated_date, created_by, created_by_id, realizado, revisao_cadastro, conciliacao_token, conciliacao_iniciada_em, ...campos } = form;
      const data = { ...campos, nome: form.nome.trim(), padrao_descricao: form.padrao_descricao.trim(), valor_esperado: Number(form.valor_esperado), tolerancia_percentual: Number(form.tolerancia_percentual), dia_vencimento: parseInt(form.dia_vencimento) || null };
      if (editando === 'novo') await base44.entities.RegraRecorrente.create(data);
      else await base44.entities.RegraRecorrente.update(editando, data);
      setEditando(null);
      await load();
    } catch (e) { setFormErro(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  }

  async function toggleAtiva(r) {
    await base44.entities.RegraRecorrente.update(r.id, { is_ativa: !r.is_ativa });
    load();
  }
  async function excluir(r) {
    if (!confirm(`Excluir regra "${r.nome}"?`)) return;
    await base44.entities.RegraRecorrente.delete(r.id);
    load();
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;
  if (error) return <div className="p-8 text-center text-destructive"><p>{error.message}</p><Button onClick={() => load()}>Tentar novamente</Button></div>;

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Despesas Fixas" subtitle="Despesas operacionais recorrentes, organizadas pelo plano de contas. Previsão, realização e pagamento separados.">
        <Button disabled={!admin} onClick={() => setSugestoesOpen(true)} className="gap-2">
          <Sparkles className="w-4 h-4" /> Buscar recorrências ({sugestoes.length})
        </Button>
        <Button disabled={!admin} variant="outline" onClick={() => setExtratoOpen(true)}>Criar pelo extrato</Button>
        <Button disabled={!admin} variant="outline" onClick={() => setConciliarOpen(true)}>Conciliar período</Button>
        <Button disabled={!admin} variant="outline" onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4" /> Nova despesa fixa</Button>
      </PageHeader>
      <p className="text-xs text-muted-foreground mb-2">Valores mensais = previsões das despesas fixas ativas; não representam pagamentos realizados.</p>
      <PeriodoRecorrentes mes={mes} modo={modo} onMes={setMes} onModo={setModo} totais={totaisMes} />

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 text-sm space-y-1">
        <p className="font-semibold">A despesa fixa vem primeiro</p>
        <p className="text-xs text-muted-foreground">Cadastre a despesa de funcionamento da empresa antes do pagamento. O cartão reconhece a despesa operacional na competência; o extrato confirma boleto, PIX ou débito. Quitar a fatura não cria outra despesa.</p>
      </div>

      <FixasPlanoLista painel={painel} inicio={inicio} admin={admin} onEditar={abrirEditar} onToggle={toggleAtiva} onExcluir={excluir} />
      {historicoAtivo&&loadingHistorico&&<p role="status" className="text-sm text-muted-foreground mt-3">Carregando histórico para revisão...</p>}
      {historicoAtivo&&errorHistorico&&<p role="alert" className="text-sm text-destructive mt-3">{errorHistorico.message}</p>}
      <CriarRegraExtratoDialog key={`${inicio}-${fim}`} open={extratoOpen} onOpenChange={setExtratoOpen} lancamentos={lancsPeriodo} onEscolher={criarPeloExtrato} />
      <RevisaoFixasDialog key={`conciliar-${inicio}-${fim}`} open={conciliarOpen} onOpenChange={setConciliarOpen} inicio={inicio} fim={fim} sugestoes={revisoes} onRefresh={load} loading={loadingHistorico} />
      {/* Modal Form */}
      <Dialog open={!!editando} onOpenChange={() => { if (!saving) setEditando(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando === 'novo' ? 'Nova despesa fixa' : 'Editar despesa fixa'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome da regra</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel Pavilhão" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Palavra-chave no extrato ou cartão</Label>
              <Input value={form.padrao_descricao} onChange={e => setForm({ ...form, padrao_descricao: e.target.value })} placeholder="Ex: ALUGUEL SILVA" />
              <p className="text-[10px] text-muted-foreground mt-1">O motor verifica se cada palavra (len &gt; 2) aparece na descrição do débito.</p>
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor esperado (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_esperado} onChange={e => setForm({ ...form, valor_esperado: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tolerância (%)</Label>
              <Input type="number" value={form.tolerancia_percentual} onChange={e => setForm({ ...form, tolerancia_percentual: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Dia do mês esperado</Label>
              <Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} />
            </div>
            <FrequenciaRecorrente form={form} onChange={setForm} />
            <CampoClassificacao eixo="origem" label="Centro de custo" value={form.origem_compra} onChange={v => setForm({ ...form, origem_compra: v })} />
            <CampoClassificacao eixo="tipo" label="Natureza da despesa" value={form.tipo_compra} onChange={v => setForm({ ...form, tipo_compra: v })} />
            <CampoClassificacao eixo="categoria" natureza={form.tipo_compra} label="Categoria (plano de contas)" value={form.categoria} onChange={v => setForm({ ...form, categoria: v })} />
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={form.empresa} onValueChange={v => setForm({ ...form, empresa: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>{EMPRESAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          {formErro && <p role="alert" className="text-xs text-destructive">{formErro}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" disabled={saving} onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving || !form.nome || !form.padrao_descricao}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Sugestões */}
      <Dialog open={sugestoesOpen} onOpenChange={setSugestoesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Recorrências encontradas no extrato e cartão</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Histórico de até 12 meses até o mês selecionado: 2 a 5 meses consecutivos no mesmo dia, descrição similar e variação de valor de até 20%. Uma ocorrência por mês; estornos e pagamentos de fatura são excluídos.
          </p>
          {loadingHistorico ? <p role="status" className="text-sm text-muted-foreground py-8">Buscando recorrências no histórico...</p> : errorHistorico ? <p role="alert" className="text-sm text-destructive">{errorHistorico.message}</p> : sugestoes.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">Nenhuma nova recorrência atende aos critérios neste histórico. Você pode cadastrar uma previsão manualmente.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {sugestoes.map((s, i) => (
                <div key={i} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.canal === 'cartao' ? 'Cartão' : 'Extrato'} · {s.meses_distintos} meses consecutivos · dia {s.dia_vencimento} · tolerância sugerida ±{s.tolerancia_percentual}%
                    </p>
                    <p className="text-xs text-muted-foreground break-words leading-relaxed">Evidências: {s.amostra.map(a => `${formatDate(a.data)}: ${formatCurrency(Math.abs(a.valor))}`).join(' · ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(s.valor_esperado)}</p>
                    <Button size="sm" className="mt-1 h-7 text-[11px]" onClick={() => aceitarSugestao(s)}>
                      <Plus className="w-3 h-3 mr-1" /> Revisar cadastro
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}