import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { InvokeLLM, UploadFile } from '@/integrations/Core';
import { Upload, FileText, ShoppingCart, CreditCard, Hammer, Users, Landmark, Receipt, CheckCircle, AlertTriangle, X, Trash2, Calendar } from 'lucide-react';
import { deduplicarImportacoes } from '@/functions/deduplicarImportacoes';
import { deduplicateRecords, saveDeduplicatedRecords } from '@/lib/deduplicationEngine';
import { Button } from '@/components/ui/button';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';

const DOC_TYPES = [
  { id: 'extrato_bancario',   label: 'Extrato Bancário Sicredi',  icon: Landmark,     color: 'blue',   entity: 'LancamentoBancario', dedup: ['data','valor'] },
  { id: 'boletos_liquidados', label: 'Boletos Liquidados',         icon: Receipt,      color: 'teal',   entity: 'TituloCobranca',    dedup: ['nosso_numero'] },
  { id: 'relatorio_nfs',      label: 'NFes Emitidas no Mês (Fiscal)',   icon: FileText,     color: 'green',  entity: 'NotaFiscal',        dedup: ['tipo','numero'] },
  { id: 'relatorio_vendas',   label: 'Relatório de Vendas (Fabris/Ellitte)', icon: FileText, color: 'teal', entity: 'RelatorioFaturamento', dedup: ['mes'] },
  { id: 'compras_fornecedor', label: 'Compras por Fornecedor',    icon: ShoppingCart, color: 'orange', entity: 'ItemCompra',        dedup: ['fornecedor','numero_nota','descricao_produto'] },
  { id: 'fatura_cartao',      label: 'Fatura de Cartão',          icon: CreditCard,   color: 'purple', entity: 'FaturaCartao',      dedup: ['conta_cartao_id','mes_referencia'] },
  { id: 'obra_reforma',       label: 'Obra e Reforma',            icon: Hammer,       color: 'brown',  entity: 'ObraReforma',       dedup: ['data','responsavel','valor'] },
  { id: 'folha_pagamento',    label: 'Folha de Pagamento',        icon: Users,        color: 'slate',  entity: 'FolhaPagamento',    dedup: ['funcionario_nome','competencia'] },
  { id: 'dda_boletos',        label: 'DDA / Boletos a Vencer',   icon: Landmark,     color: 'indigo', entity: 'LancamentoBancario', dedup: ['data','descricao','valor'] },
];

const COLOR_MAP = {
  blue:   { card: 'border-blue-200 bg-blue-50',     icon: 'text-blue-600 bg-blue-100',     active: 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' },
  teal:   { card: 'border-teal-200 bg-teal-50',     icon: 'text-teal-600 bg-teal-100',     active: 'border-teal-500 bg-teal-100 ring-2 ring-teal-300' },
  cyan:   { card: 'border-cyan-200 bg-cyan-50',      icon: 'text-cyan-600 bg-cyan-100',      active: 'border-cyan-500 bg-cyan-100 ring-2 ring-cyan-300' },
  green:  { card: 'border-green-200 bg-green-50',   icon: 'text-green-600 bg-green-100',   active: 'border-green-500 bg-green-100 ring-2 ring-green-300' },
  orange: { card: 'border-orange-200 bg-orange-50', icon: 'text-orange-600 bg-orange-100', active: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300' },
  purple: { card: 'border-purple-200 bg-purple-50', icon: 'text-purple-600 bg-purple-100', active: 'border-purple-500 bg-purple-100 ring-2 ring-purple-300' },
  brown:  { card: 'border-amber-200 bg-amber-50',   icon: 'text-amber-700 bg-amber-100',   active: 'border-amber-600 bg-amber-100 ring-2 ring-amber-400' },
  slate:  { card: 'border-slate-200 bg-slate-50',   icon: 'text-slate-600 bg-slate-100',   active: 'border-slate-500 bg-slate-100 ring-2 ring-slate-300' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icon: 'text-indigo-600 bg-indigo-100', active: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300' },
};

const PROMPTS = {
  extrato_bancario: `Você é um sistema de extração de dados bancários. Analise este extrato bancário Sicredi e extraia TODOS os lançamentos em JSON.
Retorne APENAS um array JSON válido, sem texto adicional, no formato:
[{"data":"YYYY-MM-DD","descricao":"descrição exata do extrato","valor":numero_positivo_ou_negativo,"categoria":"recebimento ou fornecedor ou pessoal ou tributo ou despesa_operacional ou financeiro ou saque ou transferencia ou interno","saldo_apos":numero,"conta_bancaria":"NeuralTec 36092-2","detalhe":"documento ex: COB000001 ou PIX_DEB ou vazio"}]
Regras: Créditos=valor POSITIVO, Débitos=valor NEGATIVO, incluir TODOS os lançamentos, ignorar apenas "SALDO ANTERIOR".`,

  boletos_liquidados: `Analise este comprovante de boletos liquidados e extraia os pagamentos em JSON.
Retorne APENAS array JSON:
[{"nosso_numero":"26/100XXX-X","seu_numero":"NF-XXX","cliente":"NOME DO CLIENTE","data_vencimento":"YYYY-MM-DD","data_pagamento":"YYYY-MM-DD","valor_titulo":numero,"valor_pago":numero,"status":"pago","canal_cobranca":"sicredi"}]`,

  relatorio_nfs: `Analise este relatório/XML/PDF de notas fiscais emitidas (sistema fiscal, SEFAZ ou contabilidade) e extraia TODAS as NFs em JSON.
Retorne APENAS array JSON:
[{"numero":"77","tipo":"NF","data_emissao":"YYYY-MM-DD","cliente":"NOME COMPLETO DO CLIENTE","valor_total":numero,"vendedor":"Thais ou Tiago ou Fat.Direto","status":"pago","valor_recebido":numero,"valor_aberto":numero}]`,

  relatorio_vendas: `Analise este relatório de vendas do mês (sistema Fabris/Ellitte ou planilha de vendas) e extraia o resumo mensal em JSON.
Retorne APENAS um objeto JSON:
{"mes":"YYYY-MM","ano":YYYY,"mes_nome":"Março 2026","saidas":numero_vendas_tiago,"servicos":numero_vendas_thais,"outros":numero_fat_direto,"total":numero_total_geral,"fonte":"fabris","observacoes":"observacao opcional"}
Onde: saidas=vendas Tiago (V-01), servicos=vendas Thais (V-05), outros=faturamento direto, total=soma geral.`,

  compras_fornecedor: `Analise este relatório de compras e extraia todos os itens em JSON.
Retorne APENAS array JSON:
[{"fornecedor":"NOME","numero_nota":"XXXXX","data_emissao":"YYYY-MM-DD","descricao_produto":"NOME DO PRODUTO","categoria_produto":"notebook ou tablet ou componente ou periferico ou software ou outro","quantidade":numero,"valor_unitario":numero,"valor_total":numero}]`,

  fatura_cartao: `Analise esta fatura de cartão de crédito e extraia as informações em JSON.
Retorne APENAS um objeto JSON válido:
{"fatura":{"mes_referencia":"YYYY-MM","data_vencimento":"YYYY-MM-DD","valor_total":numero},"lancamentos":[{"data_lancamento":"YYYY-MM-DD","estabelecimento":"NOME","descricao":"descrição completa","valor":numero,"parcela_numero":1,"parcela_total":1,"natureza":"empresarial ou pessoal","categoria":"outro"}]}
Incluir TODOS os lançamentos. Valor sempre positivo (estornos negativos).`,

  obra_reforma: `Analise este comprovante de pagamento de obra/reforma e extraia em JSON.
Retorne APENAS objeto JSON:
{"data":"YYYY-MM-DD","responsavel":"NOME","valor":numero,"descricao":"descrição","fornecedor_cnpj_cpf":"CPF ou CNPJ","tipo_profissional":"serralheiro ou pedreiro ou pintor ou vidros ou eletricista ou hidraulico ou material ou outros","local_obra":"loja ou pavilhao ou terraco ou outro","forma_pagamento":"PIX ou boleto","tipo":"mao_obra ou material"}`,

  folha_pagamento: `Analise esta folha de pagamento e extraia os dados de TODOS os funcionários em JSON.
Retorne APENAS array JSON:
[{"funcionario_nome":"NOME","competencia":"YYYY-MM","salario_bruto":numero,"horas_extras":numero,"comissao":numero,"outros_descontos":numero,"salario_liquido":numero,"status":"pago ou pendente","empresa":"NeuralTec"}]`,

  dda_boletos: `Analise este DDA/boletos a vencer e extraia em JSON.
Retorne APENAS array JSON:
[{"data":"YYYY-MM-DD","descricao":"NOME DO BENEFICIÁRIO","valor":numero_negativo,"categoria":"fornecedor ou tributo ou financeiro ou despesa_operacional","conta_bancaria":"NeuralTec 36092-2 ou Liesch 37101-4","detalhe":"código se disponível"}]`,
};

function StatusBadge({ status }) {
  const map = {
    novo: 'bg-green-100 text-green-700', duplicata: 'bg-yellow-100 text-yellow-700',
    erro: 'bg-red-100 text-red-700', completed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-700', failed: 'bg-red-100 text-red-700',
  };
  const labels = { novo: 'NOVO', duplicata: 'DUPLICATA', erro: 'ERRO', completed: 'Concluído', processing: 'Processando', failed: 'Falhou' };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}

function FieldValue({ value }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number') return <span className="tabular-nums">{Math.abs(value) > 100 ? formatCurrency(value) : value}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sim' : 'Não'}</span>;
  return <span className="truncate max-w-[180px] block">{String(value)}</span>;
}

export default function ImportarDocumento() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselected = urlParams.get('tipo');

  const [selectedType, setSelectedType] = useState(preselected || null);
  const [file, setFile] = useState(null);
  const [contasCartao, setContasCartao] = useState([]);
  const [selectedCartaoId, setSelectedCartaoId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [rawText, setRawText] = useState(null);
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deduping, setDeduping] = useState(false);
  const [lastImports, setLastImports] = useState({});
  const [fileUrl, setFileUrl] = useState(null);

  async function handleDedup() {
    setDeduping(true);
    const res = await deduplicarImportacoes({});
    const total = res?.data?.total || 0;
    showToast(total > 0 ? `✓ ${total} duplicatas removidas` : '✓ Nenhuma duplicata encontrada', 'success');
    window.dispatchEvent(new Event('neuralfinRefresh'));
    loadHistory();
    setDeduping(false);
  }
  const [step, setStep] = useState(1);
  const fileInputRef = useRef();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadHistory();
    loadCartoes();
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) handleFileSelect(new File([f], `print_${Date.now()}.png`, { type: f.type }));
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []); // eslint-disable-line

  async function loadCartoes() {
    const cartoes = await base44.entities.ContaCartao.filter({ is_ativo: true });
    setContasCartao(cartoes);
  }

  async function loadHistory() {
    const batches = await base44.entities.ImportBatch.list('-created_date', 100);
    setHistory(batches.slice(0, 20));
    // Última importação por tipo
    const map = {};
    batches.forEach(b => {
      if (!map[b.batch_type] && b.status === 'completed') map[b.batch_type] = b;
    });
    setLastImports(map);
    setLoadingHistory(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  function handleFileSelect(f) {
    if (!f) return;
    setFile(f);
    setStep(Math.max(step, 2));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function processWithAI() {
    if (!selectedType || !file) return showToast('Selecione o tipo de documento e faça upload do arquivo.', 'error');
    // selectedCartaoId é opcional para fatura_cartao — a IA tentará identificar automaticamente
    setProcessing(true);
    setProcessingStage('upload');
    setRecords([]);
    setRawText(null);
    setFileUrl(null);
    try {
      // 1. Upload via integração nativa Base44
      const { file_url } = await UploadFile({ file });
      setFileUrl(file_url);
      setProcessingStage('ai');

      // 2. Extrair com InvokeLLM nativo Base44
      const result = await InvokeLLM({
        prompt: PROMPTS[selectedType],
        file_urls: [file_url],
        model: 'claude_sonnet_4_6',
      });

      const rawStr = typeof result === 'string' ? result.trim() : JSON.stringify(result);
      setRawText(rawStr);

      // 3. Parse robusto
      let parsed;
      const clean = rawStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsed = JSON.parse(clean);
      } catch {
        const match = clean.match(/[\[{][\s\S]*[\]|}]/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (!parsed) {
        setProcessing(false);
        return showToast('IA retornou texto não estruturado. Verifique o resultado bruto.', 'error');
      }

      // 4. Normalizar para array de itens
      let items;
      if (selectedType === 'fatura_cartao') {
        // Auto-identificação do cartão se nenhum foi selecionado
        let cartaoIdFinal = selectedCartaoId;
        if (!cartaoIdFinal && parsed.fatura) {
          const fatTitular = (parsed.fatura.titular || parsed.fatura.portador || parsed.fatura.nome_cartao || '').toLowerCase();
          const fatBandeira = (parsed.fatura.bandeira || parsed.fatura.operadora || '').toLowerCase();
          const match = contasCartao.find(c => {
            const titular = (c.titular || '').toLowerCase();
            const bandeira = (c.bandeira || '').toLowerCase();
            const nomePartes = c.nome.toLowerCase().split('—').map(p => p.trim());
            if (fatTitular && titular && fatTitular.split(' ').some(w => w.length > 3 && titular.includes(w))) return true;
            if (fatBandeira && bandeira && fatBandeira.includes(bandeira)) return true;
            if (fatTitular && nomePartes.some(p => fatTitular.includes(p) || p.split(' ').some(w => w.length > 3 && fatTitular.includes(w)))) return true;
            return false;
          });
          if (match) {
            cartaoIdFinal = match.id;
            setSelectedCartaoId(match.id);
            showToast(`✓ Cartão identificado automaticamente: ${match.nome}`, 'success');
          }
        }
        const fatData = { ...parsed.fatura, __type: 'FaturaCartao', conta_cartao_id: cartaoIdFinal };
        const lancs = (parsed.lancamentos || []).map(l => ({ ...l, __type: 'LancamentoCartao' }));
        items = [fatData, ...lancs];
      } else {
        items = Array.isArray(parsed) ? parsed : [parsed];
      }

      if (selectedType === 'relatorio_nfs') items = items.map(i => ({ ...i, numero: String(i.numero ?? '').trim() }));
      if (selectedType === 'boletos_liquidados') items = items.map(i => ({ ...i, nosso_numero: String(i.nosso_numero ?? '').trim() }));

      // 5. Deduplicação via motor genérico
      const typeConfig = DOC_TYPES.find(d => d.id === selectedType);
      let enriched = [];

      if (selectedType === 'fatura_cartao') {
        // Caso especial: 2 tipos de entidade — deduplicar em paralelo
        const fats = items.filter(i => i.__type === 'FaturaCartao');
        const lancs = items.filter(i => i.__type === 'LancamentoCartao');

        const [dedupFats, dedupLancs] = await Promise.all([
          deduplicateRecords(fats, 'FaturaCartao'),
          deduplicateRecords(lancs, 'LancamentoCartao'),
        ]);

        enriched = [...dedupFats, ...dedupLancs];
      } else {
        // Caso genérico: aplica deduplicação via motor
        enriched = await deduplicateRecords(items, typeConfig.entity);
      }

      setRecords(enriched);
      setStep(3);
    } catch (err) {
      showToast(`Erro ao processar: ${err.message}`, 'error');
    }
    setProcessing(false);
  }

  async function confirmSave() {
    const toSave = records.filter(r => r.selected && r.status !== 'erro');
    if (toSave.length === 0) return showToast('Nenhum registro selecionado para salvar.', 'error');
    setSaving(true);
    const typeConfig = DOC_TYPES.find(d => d.id === selectedType);
    let saved = 0, errors = 0;

    // Usar motor de deduplicação para salvar
    if (selectedType === 'fatura_cartao') {
      const faturaRec = records.find(r => r.data.__type === 'FaturaCartao' && r.selected && r.status !== 'erro');
      const lancRecs = records.filter(r => r.data.__type === 'LancamentoCartao' && r.selected && r.status !== 'erro');

      let faturaId = null;

      if (faturaRec) {
        if (faturaRec.status === 'duplicata') {
          // Fatura já existe — buscar pelo cartão + mês
          const { __type, ...fatData } = faturaRec.data;
          const ex = await base44.entities.FaturaCartao.filter({
            conta_cartao_id: fatData.conta_cartao_id,
            mes_referencia: fatData.mes_referencia,
          });
          faturaId = ex?.[0]?.id || null;
          if (faturaId) saved++;
        } else {
          // Criar fatura nova e capturar o ID retornado
          const { __type, ...fatData } = faturaRec.data;
          const createdFatura = await base44.entities.FaturaCartao.create(fatData);
          faturaId = createdFatura?.id || null;
          if (faturaId) saved++;
          else errors++;
        }
      }

      if (faturaId) {
        for (let i = 0; i < lancRecs.length; i++) {
          setSaveProgress(`Salvando lançamento ${i + 1} de ${lancRecs.length}...`);
          const { __type, ...lancData } = lancRecs[i].data;
          await base44.entities.LancamentoCartao.create({ ...lancData, fatura_id: faturaId });
          saved++;
        }
      }
    } else {
      // Caso genérico: usar motor genérico
      const stats = await saveDeduplicatedRecords(typeConfig.entity, toSave);
      saved = stats.saved;
      errors = stats.errors;
    }

    const dupes = records.filter(r => r.status === 'duplicata').length;

    // Salvar metadados extras no notes como JSON conforme tipo
    let notesValue = fileUrl || '';
    if (selectedType === 'folha_pagamento') {
      const competencias = [...new Set(
        records.filter(r => r.data.competencia).map(r => r.data.competencia)
      )];
      notesValue = JSON.stringify({
        file_url: fileUrl || '',
        competencias,
        competencia: competencias[0] || null,
      });
    } else if (selectedType === 'fatura_cartao') {
      const faturaRec2 = records.find(r => r.data.__type === 'FaturaCartao');
      const cartaoInfo = contasCartao.find(c => c.id === (faturaRec2?.data?.conta_cartao_id || selectedCartaoId));
      notesValue = JSON.stringify({
        file_url: fileUrl || '',
        valor_total: faturaRec2?.data?.valor_total || null,
        data_vencimento: faturaRec2?.data?.data_vencimento || null,
        nome_cartao: cartaoInfo?.nome || null,
        bandeira: cartaoInfo?.bandeira || null,
        dia_vencimento: cartaoInfo?.dia_vencimento || null,
      });
    }

    await base44.entities.ImportBatch.create({
      title: `${typeConfig?.label} — ${file?.name || 'arquivo'}`,
      batch_type: selectedType,
      file_name: file?.name || '',
      total_records: records.length,
      success_count: saved,
      duplicate_count: dupes,
      error_count: errors,
      status: errors === records.length ? 'failed' : 'completed',
      notes: notesValue,
    });

    setSaving(false);
    setSaveProgress('');
    setStep(4);
    showToast(`✓ ${saved} novos registros salvos · ${dupes} duplicatas ignoradas`);
    loadHistory();
    // Disparar evento para atualizar dashboard (página atual) + sinalizar para quando navegar
    window.dispatchEvent(new Event('neuralfinRefresh'));
    localStorage.setItem('neuralfinPendingRefresh', Date.now().toString());
  }

  function reset() {
    setSelectedType(preselected || null);
    setFile(null);
    setFileUrl(null);
    setRecords([]); setRawText(null); setStep(1);
  }

  const selectedCount = records.filter(r => r.selected).length;
  const dupeCount = records.filter(r => r.status === 'duplicata').length;
  const recordKeys = records.length > 0
    ? [...new Set(records.flatMap(r => Object.keys(r.data)))].filter(k => k !== '__type').slice(0, 9)
    : [];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Importar Documento" subtitle="Extração de dados financeiros com IA">
        <Button variant="outline" size="sm" onClick={handleDedup} disabled={deduping} className="gap-2">
          <Trash2 className="w-4 h-4" />{deduping ? 'Deduplicando...' : 'Deduplicar Dados'}
        </Button>
      </PageHeader>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {['Selecionar tipo', 'Fazer upload', 'Revisar dados', 'Concluído'].map((s, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${step === i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
            {i < 3 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-green-400' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {step === 4 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Importação Concluída!</h2>
          <p className="text-muted-foreground mb-6">Os registros foram salvos com sucesso.</p>
          <Button onClick={reset}>Nova Importação</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 mb-8">
          {/* Tipo de documento */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">1. Tipo de Documento</h2>
            <div className="grid grid-cols-1 gap-2">
              {DOC_TYPES.map(dt => {
                const isActive = selectedType === dt.id;
                const colors = COLOR_MAP[dt.color];
                return (
                  <button key={dt.id} onClick={() => { setSelectedType(dt.id); setStep(Math.max(step, 1)); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${isActive ? colors.active : `${colors.card} hover:shadow-sm`}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
                      <dt.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold block ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>{dt.label}</span>
                      {lastImports[dt.id] ? (
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {new Date(lastImports[dt.id].created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} · {lastImports[dt.id].created_by?.split('@')[0] || '—'} · {lastImports[dt.id].success_count ?? 0} registros
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 block">Nunca importado</span>
                      )}
                    </div>
                    {isActive && <span className="ml-auto text-primary text-xs font-bold shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload + Calendário + Histórico */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">2. Arquivo</h2>

            {selectedType === 'fatura_cartao' && (
              <div className="mb-4">
                {/* Calendário visual de vencimentos */}
                <div className="bg-muted/30 rounded-xl border p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Calendário de Vencimentos — clique para selecionar
                  </p>
                  <div className="flex items-start gap-3 overflow-x-auto pb-1">
                    {[...contasCartao].sort((a,b)=>(a.dia_vencimento||0)-(b.dia_vencimento||0)).map(c => {
                      const isSelected = selectedCartaoId === c.id;
                      const lastImp = history.find(h => h.batch_type === 'fatura_cartao' && h.status === 'completed' && (h.title || '').toLowerCase().includes(c.nome.split('—')[0].trim().toLowerCase()));
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCartaoId(isSelected ? '' : c.id)}
                          className="flex flex-col items-center gap-1 min-w-[62px] shrink-0"
                        >
                          <div className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-md'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300'
                          }`}>
                            <span className="text-base font-bold leading-none">{c.dia_vencimento}</span>
                            <span className="text-[8px] font-medium">dia</span>
                          </div>
                          <p className="text-[9px] text-center text-muted-foreground leading-tight max-w-[62px] truncate font-medium">{c.nome.split('—')[0].trim()}</p>
                          {lastImp ? (
                            <p className="text-[8px] text-center text-emerald-600 leading-tight max-w-[62px]">
                              {new Date(lastImp.created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {lastImp.success_count > 0 && <> · {lastImp.success_count}reg</>}
                            </p>
                          ) : (
                            <p className="text-[8px] text-center text-muted-foreground/40 leading-tight">nunca</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedCartaoId && (
                    <p className="text-xs text-primary font-semibold mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> {contasCartao.find(c=>c.id===selectedCartaoId)?.nome}
                    </p>
                  )}
                  {!selectedCartaoId && (
                    <p className="text-[10px] text-muted-foreground/60 mt-2 italic">Nenhum cartão selecionado — a IA tentará identificar automaticamente</p>
                  )}
                </div>
              </div>
            )}

            {/* Drop zone — abaixo do calendário */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" className="hidden"
                onChange={(e) => handleFileSelect(e.target.files[0])} />
              {file ? (
                <div>
                  <FileText className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-2 text-xs text-red-500 hover:underline">Remover</button>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">Arraste o arquivo aqui</p>
                  <p className="text-[11px] text-muted-foreground">PDF, PNG, JPG, XLSX, CSV</p>
                  <Button variant="outline" size="sm" className="mt-2 pointer-events-none text-xs h-7">Selecionar arquivo</Button>
                </>
              )}
            </div>

            {file && selectedType && (
              <Button onClick={processWithAI} disabled={processing} className="w-full mt-4 gap-2 h-11">
                {processing ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {processingStage === 'upload' ? 'Enviando arquivo...' : 'Analisando com IA (pode levar ~30s)...'}
                  </>
                ) : <>✨ Processar com IA</>}
              </Button>
            )}

            {rawText && records.length === 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-800 mb-1">Resultado bruto da IA:</p>
                <pre className="text-[11px] text-yellow-900 whitespace-pre-wrap max-h-48 overflow-y-auto">{rawText}</pre>
              </div>
            )}

            {/* Histórico inline — abaixo do drop zone */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Histórico de Importações</h2>
                {selectedType && (
                  <span className="text-[10px] text-primary font-semibold">{DOC_TYPES.find(d=>d.id===selectedType)?.label}</span>
                )}
              </div>
              <div className="bg-card rounded-xl border overflow-hidden">
                {loadingHistory ? (
                  <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
                ) : (() => {
                  const filtered = selectedType ? history.filter(h => h.batch_type === selectedType) : history;
                  if (filtered.length === 0) return (
                    <div className="p-6 text-center text-muted-foreground text-xs">
                      {selectedType ? 'Nenhuma importação deste tipo ainda' : 'Nenhuma importação realizada ainda'}
                    </div>
                  );
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                       <thead>
                         <tr className="border-b bg-muted/30">
                           <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px] w-8">Img</th>
                           <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px]">Data/Hora</th>
                           {!selectedType && <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px]">Documento</th>}
                           <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px]">Arquivo</th>
                           <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-[10px]">Salvos</th>
                           {selectedType === 'fatura_cartao' && <>
                             <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-[10px]">Total</th>
                             <th className="text-center px-3 py-2 font-semibold text-muted-foreground text-[10px]">Vencimento</th>
                           </>}
                           {selectedType === 'folha_pagamento' && (
                             <th className="text-center px-3 py-2 font-semibold text-muted-foreground text-[10px]">Competência</th>
                           )}
                           <th className="text-center px-3 py-2 font-semibold text-muted-foreground text-[10px]">Status</th>
                         </tr>
                       </thead>
                       <tbody>
                         {filtered.map(h => {
                           const dt = DOC_TYPES.find(d => d.id === h.batch_type);
                           // Parse notes: pode ser JSON (fatura_cartao) ou URL direta
                           let notesData = null;
                           let imgUrl = null;
                           if (h.notes) {
                             try {
                               notesData = JSON.parse(h.notes);
                               imgUrl = notesData.file_url && notesData.file_url.startsWith('http') ? notesData.file_url : null;
                             } catch {
                               imgUrl = h.notes.startsWith('http') ? h.notes : null;
                             }
                           }
                           const isImage = imgUrl && /\.(png|jpg|jpeg|gif|webp)/i.test(imgUrl);
                           return (
                             <tr key={h.id} className="border-b hover:bg-muted/20 transition-colors">
                               <td className="px-3 py-1.5">
                                 {isImage ? (
                                   <a href={imgUrl} target="_blank" rel="noreferrer">
                                     <img src={imgUrl} alt="thumb" className="w-8 h-8 object-cover rounded-lg border shadow-sm hover:scale-110 transition-transform" />
                                   </a>
                                 ) : imgUrl ? (
                                   <a href={imgUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg border bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                                     <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                   </a>
                                 ) : (
                                   <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center">
                                     {dt && <dt.icon className="w-3.5 h-3.5 text-muted-foreground/40" />}
                                   </div>
                                 )}
                               </td>
                               <td className="px-3 py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                                 {h.created_date ? new Date(h.created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                 {notesData?.nome_cartao && (
                                   <p className="text-[9px] text-purple-600 font-semibold">
                                     {notesData.nome_cartao.split('—')[0].trim()}{notesData.bandeira ? ` · ${notesData.bandeira}` : ''}{notesData.dia_vencimento ? ` · dia ${notesData.dia_vencimento}` : ''}
                                   </p>
                                 )}
                                 {notesData?.competencia && (
                                   <p className="text-[9px] text-blue-600 font-semibold">Competência: {notesData.competencia}</p>
                                 )}
                               </td>
                               {!selectedType && <td className="px-3 py-1.5 font-semibold text-[10px]">{dt?.label || h.batch_type}</td>}
                               <td className="px-3 py-1.5 text-[10px] text-primary font-medium truncate max-w-[120px]">{h.file_name || '—'}</td>
                               <td className="px-3 py-1.5 text-right font-bold text-green-700 text-[10px]">{h.success_count ?? 0}</td>
                               {selectedType === 'fatura_cartao' && <>
                                 <td className="px-3 py-1.5 text-right font-bold text-[10px]">
                                   {notesData?.valor_total ? formatCurrency(notesData.valor_total) : '—'}
                                 </td>
                                 <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                                   {notesData?.data_vencimento
                                     ? new Date(notesData.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                                     : '—'}
                                 </td>
                               </>}
                               {selectedType === 'folha_pagamento' && (
                                 <td className="px-3 py-1.5 text-center text-[10px] font-semibold text-blue-700">
                                   {notesData?.competencia || '—'}
                                 </td>
                               )}
                               <td className="px-3 py-1.5 text-center"><StatusBadge status={h.status} /></td>
                             </tr>
                           );
                         })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tabela de revisão */}
      {records.length > 0 && step !== 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">3. Revisar Dados Extraídos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {records.length} registros · <span className="text-green-600">{records.filter(r => r.status === 'novo').length} novos</span> · <span className="text-yellow-600">{dupeCount} duplicatas</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRecords(r => r.map(rec => ({ ...rec, selected: rec.status === 'novo' })))}>
                Selecionar novos
              </Button>
              <Button onClick={confirmSave} disabled={saving || selectedCount === 0} className="gap-2">
                {saving ? (
                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{saveProgress}</>
                ) : `Confirmar e Salvar (${selectedCount})`}
              </Button>
            </div>
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" checked={records.every(r => r.selected)}
                        onChange={e => setRecords(r => r.map(rec => ({ ...rec, selected: e.target.checked })))} />
                    </th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-24">Status</th>
                    {recordKeys.map(k => <th key={k} className="px-2 py-2 text-left font-semibold text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={i} className={`border-b transition-colors ${rec.selected ? 'bg-card' : 'bg-muted/20 opacity-60'} hover:bg-muted/30`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={rec.selected}
                          onChange={e => setRecords(r => r.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))} />
                      </td>
                      <td className="px-2 py-2"><StatusBadge status={rec.status} /></td>
                      {recordKeys.map(k => (
                        <td key={k} className="px-2 py-2 max-w-[180px]">
                          <FieldValue value={rec.data[k]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}