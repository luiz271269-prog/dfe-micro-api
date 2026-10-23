import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import useArquivoIdentificacao from '@/components/importar/useArquivoIdentificacao';
import IdentificacaoArquivo from '@/components/importar/IdentificacaoArquivo';
import PapelArquivo from '@/components/importar/PapelArquivo';
import ContratoImportacaoIntro from '@/components/importar/ContratoImportacaoIntro';
import HistoricoImportacoes from '@/components/importar/HistoricoImportacoes';
import EditorReleitura from '@/components/importar/EditorReleitura';
import CorrecaoImportacao from '@/components/importar/CorrecaoImportacao';
import { arquivoDoLote } from '@/lib/papelImportacao';
import validarLeituraImportacao from '@/lib/validarLeituraImportacao';
import { processDocument } from '@/functions/processDocument';

import { Upload, FileText, ShoppingCart, CreditCard, Hammer, Users, Landmark, Receipt, CheckCircle, AlertTriangle, XIcon, Calendar, Wallet, Trash2 } from 'lucide-react';
import { deduplicarImportacoes } from '@/functions/deduplicarImportacoes';

import { deduplicateRecords } from '@/lib/deduplicationEngine';
import useContratoImportacao from '@/hooks/useContratoImportacao';
import salvarImportacao from '@/components/importar/salvarImportacao';
import ResumoImportacao from '@/components/importar/ResumoImportacao';
import { Button } from '@/components/ui/button';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';
import TabelaRevisaoVendasDetalhado from '../components/importar/TabelaRevisaoVendasDetalhado';
import PainelMemoriaImportacao from '../components/importar/PainelMemoriaImportacao';
import ExtratoValidationCard from '../components/importar/ExtratoValidationCard';

import { aplicarRegrasHistorico } from '../lib/aplicarRegrasHistorico';
import { validateExtratoRecords } from '../lib/extratoValidation';
// A matriz funcional é obtida do contrato canônico do servidor.

import FontesFinanceirasPanel from '@/components/financeiro/FontesFinanceirasPanel';
import EvidenciasFinanceirasPanel from '@/components/financeiro/EvidenciasFinanceirasPanel';

const ICONES_IMPORTACAO = { Landmark,CreditCard,FileText,Receipt,Users,Hammer,Wallet,ShoppingCart };
const DOC_GROUPS = ['Fonte oficial','Evidência de conferência','Composição','Movimento financeiro'];


const COLOR_MAP = {
  blue: { card: 'border-blue-200 bg-blue-50', icon: 'text-blue-600 bg-blue-100', active: 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' },
  teal: { card: 'border-teal-200 bg-teal-50', icon: 'text-teal-600 bg-teal-100', active: 'border-teal-500 bg-teal-100 ring-2 ring-teal-300' },
  cyan: { card: 'border-cyan-200 bg-cyan-50', icon: 'text-cyan-600 bg-cyan-100', active: 'border-cyan-500 bg-cyan-100 ring-2 ring-cyan-300' },
  green: { card: 'border-green-200 bg-green-50', icon: 'text-green-600 bg-green-100', active: 'border-green-500 bg-green-100 ring-2 ring-green-300' },
  orange: { card: 'border-orange-200 bg-orange-50', icon: 'text-orange-600 bg-orange-100', active: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300' },
  purple: { card: 'border-purple-200 bg-purple-50', icon: 'text-purple-600 bg-purple-100', active: 'border-purple-500 bg-purple-100 ring-2 ring-purple-300' },
  brown: { card: 'border-amber-200 bg-amber-50', icon: 'text-amber-700 bg-amber-100', active: 'border-amber-600 bg-amber-100 ring-2 ring-amber-400' },
  slate: { card: 'border-slate-200 bg-slate-50', icon: 'text-slate-600 bg-slate-100', active: 'border-slate-500 bg-slate-100 ring-2 ring-slate-300' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icon: 'text-indigo-600 bg-indigo-100', active: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300' },
  rose: { card: 'border-rose-200 bg-rose-50', icon: 'text-rose-600 bg-rose-100', active: 'border-rose-500 bg-rose-100 ring-2 ring-rose-300' }
};

function StatusBadge({ status }) {
  const map = {
    novo: 'bg-green-100 text-green-700', duplicata: 'bg-yellow-100 text-yellow-700',
    erro: 'bg-red-100 text-red-700', completed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-700', failed: 'bg-red-100 text-red-700'
  };
  const labels = { novo: 'NOVO', duplicata: 'DUPLICATA', erro: 'ERRO', completed: 'Concluído', processing: 'Processando', failed: 'Falhou' };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}

async function sha256OfFile(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function FieldValue({ value }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number') return <span className="tabular-nums">{Math.abs(value) > 100 ? formatCurrency(value) : value}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sim' : 'Não'}</span>;
  return <span className="truncate max-w-[180px] block">{String(value)}</span>;
}

export default function ImportarDocumento() {
  const contrato = useContratoImportacao();
  const DOC_TYPES = (contrato.data || []).map(t => ({...t,icon:ICONES_IMPORTACAO[t.icon]}));
  const TIPOS_EVIDENCIA = DOC_TYPES.filter(t=>t.evidencia).map(t=>t.id);
  const [loteResultado,setLoteResultado] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const preselected = urlParams.get('tipo');

  const [selectedType, setSelectedType] = useState(preselected || null);
  const [empresaFonte, setEmpresaFonte] = useState('NeuralTec');
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
  const [lastImports, setLastImports] = useState({});
  const [fileUrl, setFileUrl] = useState(null);
  const [fileUri, setFileUri] = useState(null);
  const [releitura, setReleitura] = useState(null);
  const [revisaoVersao, setRevisaoVersao] = useState(0);
  const { identificacao, identificando, identificar, limpar: limparIdentificacao } = useArquivoIdentificacao();
  const [fileHash, setFileHash] = useState(null);
  const [step, setStep] = useState(1);
  const [dedupRunning, setDedupRunning] = useState(false);
  const [faturaValidacao, setFaturaValidacao] = useState(null);
  const [extratoValidacao, setExtratoValidacao] = useState(null);
  const [memoriaRefresh, setMemoriaRefresh] = useState(0);
  const fileInputRef = useRef();
  const queryClient = useQueryClient();

  async function handleDedupManual() {
    if (dedupRunning) return;
    setDedupRunning(true);
    try {
      const res = await deduplicarImportacoes({});
      const total = res?.data?.total || 0;
      showToast(total > 0 ? `🧹 ${total} duplicatas removidas do banco` : 'Nenhuma duplicata encontrada — banco limpo!', 'success');
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) {
      showToast(`Erro ao deduplicar: ${err.message}`, 'error');
    }
    setDedupRunning(false);
  }

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
  }, [contrato.data]); // eslint-disable-line

  async function loadCartoes() {
    const cartoes = await base44.entities.ContaCartao.filter({ is_ativo: true });
    setContasCartao(cartoes);
  }

  async function loadHistory() {
    const page = await base44.entities.ImportBatch.filter({}, { sort: '-created_date', limit: 50 });
    const batches = page.items;
    setHistory(batches);
    // Última importação por tipo
    const map = {};
    batches.forEach((b) => {
      if (!map[b.batch_type] && b.status === 'completed') map[b.batch_type] = b;
    });
    setLastImports(map);
    setLoadingHistory(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleFileSelect(f, batch = null) {
    if (!f || processing || saving) return;
    setFile(f);setReleitura(batch);setFileUrl(null);setFileUri(null);setRecords([]);setRawText(null);setStep(1);setSelectedType(null);setSelectedCartaoId('');
    try {
      const resultado = await identificar(f);
      if (!resultado) return;
      setFileUri(resultado.uri);setFileUrl(resultado.url);setStep(2);
      if (resultado.identificacao.seguro && DOC_TYPES.some(t => t.id === resultado.identificacao.tipo)) setSelectedType(resultado.identificacao.tipo);
      if (batch) { const meta = batch.notes?.startsWith('{') ? JSON.parse(batch.notes) : {}; const c = contasCartao.find(x => x.nome === meta.nome_cartao); if (c) setSelectedCartaoId(c.id); }
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  }

  async function relerArquivo(batch, original) {
    try {
      if (original) return await handleFileSelect(original, batch);
      const a = arquivoDoLote(batch);
      const url = a.uri ? (await base44.integrations.Core.CreateFileSignedUrl({ file_uri: a.uri })).signed_url : a.url;
      if (!url) throw new Error('Original não armazenado. Anexe o arquivo original para reler.');
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error('Original indisponível. Reanexe o arquivo para reler.');
      const blob = await res.blob();
      await handleFileSelect(new File([blob], batch.file_name || 'original.pdf', { type: blob.type }), batch);
    } catch (e) { showToast(e.message, 'error'); }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function processWithAI() {
    if (!selectedType || !file || !identificacao || identificando) return showToast('Primeiro identifique o arquivo e confirme o tipo de documento.', 'error');
    // selectedCartaoId é opcional para fatura_cartao — a IA tentará identificar automaticamente
    setProcessing(true);
    setProcessingStage('hash');
    setRecords([]);
    setRawText(null);
    setFaturaValidacao(null);
    setExtratoValidacao(null);
    try {
      // 0. Calcular hash SHA-256 do arquivo (cache exato)
      const hashCalculado = await sha256OfFile(file);
      console.log('[CACHE] Hash do arquivo:', hashCalculado.substring(0, 16) + '...', 'tipo:', selectedType);

      // 0.1 Buscar extração anterior — busca AMPLA (todos batches concluídos do mesmo tipo) para garantir match
      let rawStr = null;
      let cachedFileUrl = null;
      let cacheSource = null;

      const cache = releitura ? { items: [] } : await base44.entities.ImportBatch.filter({ batch_type: selectedType, status: 'completed', file_hash: hashCalculado }, { sort: '-created_date', limit: 1 });
      const todosBatchesDoTipo = cache.items;
      console.log('[CACHE] Batches anteriores deste tipo:', todosBatchesDoTipo?.length || 0);

      // Match 1: hash idêntico (mesmo arquivo byte-a-byte)
      let hitBatch = todosBatchesDoTipo?.find((b) => b.file_hash === hashCalculado && b.ai_extraction);
      if (hitBatch) {cacheSource = 'hash-exato';console.log('[CACHE] ✓ HIT por hash exato — batch:', hitBatch.id);}

      // Match 2: mesmo nome de arquivo
      if (!hitBatch && file?.name) {
        const nomeAlvo = file.name.toLowerCase().trim();
        hitBatch = todosBatchesDoTipo?.find((b) => {
          if (!b.ai_extraction || !b.file_name) return false;
          if (b.file_name.toLowerCase().trim() !== nomeAlvo) return false;
          if (b.file_hash && b.file_hash !== hashCalculado) return false;
          return true;
        });
        if (hitBatch) {cacheSource = 'nome-arquivo';console.log('[CACHE] ✓ HIT por nome de arquivo — batch:', hitBatch.id);}
      }

      if (hitBatch) {
        // ai_extraction pode ser: (a) o JSON inline (legado) ou (b) uma URL para o JSON salvo no storage
        const ext = hitBatch.ai_extraction;
        if (ext.startsWith('http') || (!ext.trim().startsWith('{') && !ext.trim().startsWith('['))) {
          // Baixa o JSON salvo no storage
          try {
            const extractionUrl = ext.startsWith('http') ? ext : (await base44.integrations.Core.CreateFileSignedUrl({ file_uri: ext })).signed_url;
            const resp = await fetch(extractionUrl);
            if (!resp.ok) throw new Error('Extração anterior indisponível.');
            rawStr = await resp.text();
          } catch (e) {
            console.warn('[CACHE] Falha ao baixar extração do storage, vai reprocessar:', e);
          }
        } else {
          rawStr = ext;
        }
        if (rawStr) {
          try {
            const parsed = JSON.parse(hitBatch.notes || '{}');
            cachedFileUrl = parsed.file_url || (hitBatch.notes?.startsWith('http') ? hitBatch.notes : null);
          } catch {
            cachedFileUrl = hitBatch.notes?.startsWith('http') ? hitBatch.notes : null;
          }
          showToast(`✓ Cache acionado (${cacheSource}) — reusando extração anterior sem chamar IA.`, 'success');
          // O original recém-enviado permanece disponível para futuras releituras.
        }
      }

      if (!rawStr) {
        console.log('[CACHE] ✗ MISS — nenhum batch anterior com mesmo arquivo. Processando com IA...');
        // 1. Upload via integração nativa Base44
        setProcessingStage('upload');
        const file_url = fileUri ? (await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 })).signed_url : fileUrl;
        if (!file_url) throw new Error('Identifique o arquivo novamente antes da extração.');
        setProcessingStage('ai');

        // Extração limitada ao tipo de documento, com regras mantidas no servidor.
        const resposta = await processDocument({ docType: selectedType, fileUrl: file_url, fileName: file.name, fileSize: file.size, identificacao, confirmacao_manual: selectedType !== identificacao.tipo || !identificacao.seguro });
        if (!resposta.data?.success) throw new Error(resposta.data?.error || 'Extração não concluída');
        rawStr = resposta.data.rawText;
      }
      setFileHash(hashCalculado);
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
          const match = contasCartao.find((c) => {
            const titular = (c.titular || '').toLowerCase();
            const bandeira = (c.bandeira || '').toLowerCase();
            const nomePartes = c.nome.toLowerCase().split('—').map((p) => p.trim());
            if (fatTitular && titular && fatTitular.split(' ').some((w) => w.length > 3 && titular.includes(w))) return true;
            if (fatBandeira && bandeira && fatBandeira.includes(bandeira)) return true;
            if (fatTitular && nomePartes.some((p) => fatTitular.includes(p) || p.split(' ').some((w) => w.length > 3 && fatTitular.includes(w)))) return true;
            return false;
          });
          if (match) {
            cartaoIdFinal = match.id;
            setSelectedCartaoId(match.id);
            showToast(`✓ Cartão identificado automaticamente: ${match.nome}`, 'success');
          }
        }
        const fatData = { ...parsed.fatura, __type: 'FaturaCartao', conta_cartao_id: cartaoIdFinal };
        const lancsRaw = (parsed.lancamentos || []).map((l) => ({ ...l, __type: 'LancamentoCartao' }));

        // Fidelidade: remove duplicatas internas da própria fatura (mesma data + estabelecimento normalizado + valor)
        const seenInternal = new Set();
        let dupsInternas = 0;
        const lancs = [];
        for (const l of lancsRaw) {
          const norm = (l.estabelecimento || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
          const key = `${l.data_lancamento}|${norm}|${Math.round((l.valor || 0) * 100)}`;
          if (seenInternal.has(key)) {dupsInternas++;continue;}
          seenInternal.add(key);
          lancs.push(l);
        }

        // Conferência fiscal: soma dos lançamentos deve bater com o valor_total impresso
        const totalFat = Number(parsed.fatura?.valor_total || 0);
        const somaLancs = lancs.reduce((s, l) => s + Number(l.valor || 0), 0);
        const diffSoma = Math.abs(totalFat - somaLancs);
        const somaIaInformada = Number(parsed.fatura?.soma_lancamentos || 0);
        const totalIaInformado = Number(parsed.fatura?.total_lancamentos_pdf || 0);

        setFaturaValidacao({
          totalFat,
          somaLancs,
          diffSoma,
          qtdLancs: lancs.length,
          qtdLancsIa: totalIaInformado,
          somaIaInformada,
          dupsInternas,
          ok: diffSoma <= 0.02
        });

        if (diffSoma > 0.02 || dupsInternas > 0) {
          const msgs = [];
          if (diffSoma > 0.02) msgs.push(`⚠️ Soma ${formatCurrency(somaLancs)} ≠ total impresso ${formatCurrency(totalFat)} (dif. ${formatCurrency(diffSoma)})`);
          if (dupsInternas > 0) msgs.push(`🧹 ${dupsInternas} duplicata(s) interna(s) removida(s)`);
          showToast(msgs.join(' · '), diffSoma > 0.02 ? 'error' : 'success');
        }

        items = [fatData, ...lancs];
      } else if (selectedType === 'relatorio_vendas_detalhado') {
        // Caso especial: 2 entidades — NotaFiscal + TituloCobranca
        const notas = (parsed.notas || []).map((n) => ({
          ...n,
          numero: String(n.numero ?? '').trim(),
          empresa: n.empresa || empresaFonte,
          __type: 'NotaFiscal'
        }));
        const cobrancas = (parsed.cobrancas || []).map((c) => ({
          ...c,
          nosso_numero: String(c.nosso_numero ?? '').trim(),
          empresa: c.empresa || parsed.notas?.find(n => `${n.tipo}-${n.numero}` === c.seu_numero && n.cliente === c.cliente)?.empresa || empresaFonte,
          __type: 'TituloCobranca'
        }));
        items = [...notas, ...cobrancas];
      } else {
        items = Array.isArray(parsed) ? parsed : [parsed];
      }

      if (selectedType === 'relatorio_nfs') items = items.map((i) => ({ ...i, numero: String(i.numero ?? '').trim() }));
      if (selectedType === 'boletos_liquidados') items = items.map((i) => ({ ...i, nosso_numero: String(i.nosso_numero ?? '').trim() }));
      if (selectedType === 'extrato_bancario') {
        const validation = validateExtratoRecords(items, new Date().toISOString().split('T')[0]);
        items = validation.records;
        setExtratoValidacao(validation);
      }

      // 5. Deduplicação via motor genérico
      const typeConfig = DOC_TYPES.find((d) => d.id === selectedType);
      let enriched = [];

      if (selectedType === 'fatura_cartao') {
        // Caso especial: 2 tipos de entidade — deduplicar em paralelo
        const fats = items.filter((i) => i.__type === 'FaturaCartao');
        const lancs = items.filter((i) => i.__type === 'LancamentoCartao');

        const [dedupFats, dedupLancs] = await Promise.all([
        deduplicateRecords(fats, 'FaturaCartao'),
        deduplicateRecords(lancs, 'LancamentoCartao')]
        );

        enriched = [...dedupFats, ...dedupLancs];
      } else if (selectedType === 'relatorio_vendas_detalhado') {
        // Caso especial: 2 entidades — NotaFiscal + TituloCobranca
        const notas = items.filter((i) => i.__type === 'NotaFiscal');
        const cobs = items.filter((i) => i.__type === 'TituloCobranca');

        const [dedupNotas, dedupCobs] = await Promise.all([
        deduplicateRecords(notas, 'NotaFiscal'),
        deduplicateRecords(cobs, 'TituloCobranca')]
        );

        enriched = [...dedupNotas, ...dedupCobs];
      } else if (TIPOS_EVIDENCIA.includes(selectedType)) {
        enriched = items.map(data => ({ data, selected: true, status: 'novo' }));
      } else {
        // Apenas fontes oficiais criam seus documentos de origem.
        enriched = await deduplicateRecords(items, typeConfig.entity);
      }

      // Aplica regras de categoria aprendidas do histórico — resolve localmente
      // o que a IA já "errou" no passado e foi corrigido manualmente (economiza IA).
      const escopoRegras = selectedType === 'fatura_cartao' ? 'cartao' :
      selectedType === 'extrato_bancario' ? 'extrato' : null;
      if (escopoRegras) {
        try {
          const res = await aplicarRegrasHistorico({ escopo: escopoRegras, records: enriched });
          enriched = res.records;
          if (res.aplicados > 0) {
            showToast(`🧠 ${res.aplicados} lançamento(s) categorizados pelo histórico — sem precisar de IA.`, 'success');
          }
        } catch {/* histórico é auxiliar — nunca bloqueia */}
      }

      setRecords(enriched);
      setStep(3);
    } catch (err) {
      const msg = String(err?.message || err);
      const isPdfProtegido = /password protected|password.protected|encrypted pdf|criptografad/i.test(msg);
      if (isPdfProtegido) {
        setRawText(
          '⚠️ PDF PROTEGIDO POR SENHA\n\n' +
          'O arquivo enviado está criptografado e não pode ser lido pela IA.\n\n' +
          'Como resolver:\n' +
          '1) Abra o PDF no navegador (Chrome/Edge) ou Adobe Reader com a senha.\n' +
          '2) Use "Imprimir → Salvar como PDF" para gerar uma cópia SEM senha.\n' +
          '3) Faça upload da cópia sem senha aqui.\n\n' +
          'Alternativa: tire prints (PNG/JPG) das páginas da fatura e envie as imagens — a IA também extrai a partir delas.'
        );
        showToast('PDF protegido por senha. Veja as instruções abaixo para remover a senha.', 'error');
      } else {
        showToast(`Erro ao processar: ${msg}`, 'error');
      }
    }
    setProcessing(false);
  }

  async function confirmSave() {
    const erroLeitura=validarLeituraImportacao(selectedType,records);
    if(erroLeitura)return showToast(erroLeitura,'error');
    if(selectedType==='extrato_bancario'&&extratoValidacao&&!extratoValidacao.ok)return showToast('Corrija a sequência de saldos antes de salvar.','error');
    if(!records.some(r=>r.selected))return showToast('Selecione registros para salvar.','error');
    setSaving(true);
    try{
      const result=await salvarImportacao({tipo:selectedType,records,file,fileUri,fileHash,identificacao,empresa:empresaFonte,rawText,onProgress:setSaveProgress});
      setLoteResultado(result.batch);setStep(4);
      showToast(result.buscaErro?`Arquivo salvo, mas a busca precisa ser refeita: ${result.buscaErro}`:'Arquivo persistido sem baixas. Revise a conferência e autorize cada proposta.',result.buscaErro?'error':'success');
      loadHistory();queryClient.invalidateQueries();window.dispatchEvent(new Event('neuralfinRefresh'));
    }catch(err){showToast(`Importação interrompida: ${err.message}. Consulte o histórico antes de repetir.`,'error');}
    finally{setSaving(false);setSaveProgress('');}
  }

  function reset() {
    setLoteResultado(null);
    setSelectedType(preselected || null);
    setFile(null);
    setFileUri(null);setReleitura(null);limparIdentificacao();
    setFileUrl(null);
    setFileHash(null);
    setRecords([]);setRawText(null);setStep(1);
    setFaturaValidacao(null);
    setExtratoValidacao(null);
  }

  const selectedCount = records.filter((r) => r.selected).length;
  const dupeCount = records.filter((r) => r.status === 'duplicata').length;

  // Ordem oficial das colunas da folha de pagamento (segue a planilha original)
  const FOLHA_COL_ORDER = [
  'funcionario_nome', 'setor', 'admissao', 'folha', 'por_fora', 'salarios_total',
  'vantagem', 'extras', 'premio', 'comissao', 'salario_total', 'dias_trabalhados',
  'desconto_folha', 'compras', 'vales', 'salario_liquido', 'valor_pago',
  'saldo_a_receber', 'competencia', 'status', 'empresa'];


  const allKeys = records.length > 0 ?
  [...new Set(records.flatMap((r) => Object.keys(r.data)))].filter((k) => k !== '__type') :
  [];

  const isFolha = selectedType === 'folha_pagamento';
  const recordKeys = records.length === 0 ? [] :
  isFolha
  // Folha: mantém a ordem da planilha e mostra TODAS as colunas presentes
  ? [...FOLHA_COL_ORDER.filter((k) => allKeys.includes(k)), ...allKeys.filter((k) => !FOLHA_COL_ORDER.includes(k))] :
  allKeys.slice(0, 9);

  // Totais brutos e líquidos (folha) — somente registros selecionados
  const folhaTotais = isFolha ? records.reduce((acc, r) => {
    if (!r.selected) return acc;
    acc.bruto += Number(r.data.salario_total ?? r.data.salarios_total ?? r.data.salario_bruto ?? 0) || 0;
    acc.liquido += Number(r.data.salario_liquido ?? 0) || 0;
    acc.pago += Number(r.data.valor_pago ?? 0) || 0;
    return acc;
  }, { bruto: 0, liquido: 0, pago: 0 }) : null;

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Importar Documento" subtitle="Extração de dados financeiros com IA · deduplicação automática">
        <Button variant="outline" size="sm" onClick={handleDedupManual} disabled={dedupRunning} className="gap-2">
          {dedupRunning ?
          <><div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Limpando…</> :

          <><Trash2 className="w-3.5 h-3.5" /> Limpar duplicatas</>
          }
        </Button>
      </PageHeader>

      <ContratoImportacaoIntro />
      {contrato.isLoading&&<p className="mb-4 text-sm text-muted-foreground">Carregando contrato dos 11 tipos…</p>}
      {contrato.isError&&<p role="alert" className="mb-4 text-destructive">Não foi possível carregar as regras: {contrato.error.message}</p>}
      <FontesFinanceirasPanel />
      {TIPOS_EVIDENCIA.includes(selectedType) && <EvidenciasFinanceirasPanel direcao={selectedType === 'dda_boletos' ? 'saida' : 'entrada'} />}
      {toast &&
      <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)}><XIcon className="w-4 h-4" /></button>
        </div>
      }

      {/* Steps + Upload compacto ao lado */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
          {['Identificar arquivo', 'Confirmar tipo', 'Revisar dados', 'Concluído'].map((s, i) =>
          <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all ${step > i + 1 ? 'bg-gradient-to-br from-violet-600 to-indigo-600' : step === i + 1 ? 'bg-gradient-to-br from-fuchsia-600 to-indigo-600 ring-4 ring-violet-200 shadow-md' : 'bg-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-foreground' : step > i + 1 ? 'text-violet-700' : 'text-muted-foreground'}`}>{s}</span>
              {i < 3 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-border'}`} />}
            </div>
          )}
        </div>

        {step !== 4 &&
        <div
          onDragOver={(e) => {e.preventDefault();setDragging(true);}}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-all py-2 px-3 flex items-center gap-2 shrink-0 w-full lg:w-[260px] ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.ofx,.qfx,.txt" className="hidden"
          onChange={(e) => handleFileSelect(e.target.files[0])} />
            {file ?
          <>
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <span className="text-xs font-semibold truncate flex-1 text-left">{file.name}</span>
              <button onClick={(e) => {e.stopPropagation();setFile(null);setFileUri(null);setFileUrl(null);setSelectedType(null);setRecords([]);setRawText(null);limparIdentificacao();}} className="text-red-500 shrink-0"><XIcon className="w-4 h-4" /></button>
            </> :
          <>
              <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-semibold text-foreground text-left leading-tight">Arraste o arquivo aqui<span className="block text-[10px] text-muted-foreground font-normal">PDF, PNG, JPG, XLSX, CSV, OFX</span></span>
            </>
          }
          </div>
        }
      </div>

      {step === 4 ?
      (loteResultado ? <ResumoImportacao batchId={loteResultado.id} tipo={loteResultado.batch_type} onNova={reset}/> : <div className="rounded-xl border bg-card p-5"><p>Revisão histórica registrada. Pagamentos e vínculos preservados.</p><Button className="mt-3" onClick={reset}>Nova importação</Button></div>) :

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 mb-8">
          {/* Tipo de documento */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">1. Tipo de Documento</h2>
            <div className="space-y-4">
              {DOC_GROUPS.map((groupLabel) => {
              const groupTypes = DOC_TYPES.filter((dt) => dt.grupo === groupLabel);
              if (groupTypes.length === 0) return null;
              return (
                <div key={groupLabel}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">{groupLabel}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {groupTypes.map((dt) => {
                      const isActive = selectedType === dt.id;
                      const colors = COLOR_MAP[dt.color];
                      return (
                        <button key={dt.id} disabled={identificando || processing || saving} onClick={() => {setSelectedType(dt.id);setRecords([]);setRawText(null);setStep(file ? 2 : 1);}}
                        className={`flex items-center gap-3 rounded-xl border text-left transition-all pr-1 pl-1 ${isActive ? colors.active : `${colors.card} hover:shadow-sm`}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
                              <dt.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-semibold block ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>{dt.label}</span>
                              <PapelArquivo tipo={dt.id} compacto />
                              {lastImports[dt.id] ?
                            <span className="text-[10px] text-muted-foreground block truncate">
                                  {new Date(lastImports[dt.id].created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} · {lastImports[dt.id].created_by?.split('@')[0] || '—'} · {lastImports[dt.id].success_count ?? 0} registros
                                </span> :

                            <span className="text-[10px] text-muted-foreground/50 block">Sem importação recente</span>
                            }
                            </div>
                            {isActive && <span className="ml-auto text-primary text-xs font-bold shrink-0">✓</span>}
                          </button>);

                    })}
                    </div>
                  </div>);

            })}
            </div>
          </div>

          {/* Upload + Calendário + Histórico */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">2. Arquivo</h2>

            {selectedType && <label className="block mb-4 text-sm">Empresa da fonte, quando não impressa no arquivo<select className="mt-1 w-full rounded-md border bg-background p-2" value={empresaFonte} onChange={e => setEmpresaFonte(e.target.value)}><option>NeuralTec</option><option>Liesch</option></select><span className="block mt-1 text-xs text-muted-foreground">Notas e parcelas têm identidade por empresa. Pagamentos informados aguardam conciliação bancária.</span></label>}
            <PainelMemoriaImportacao
            tipoImport={selectedType}
            label={DOC_TYPES.find((d) => d.id === selectedType)?.label}
            refreshKey={memoriaRefresh} />
          

            {selectedType === 'fatura_cartao' &&
          <div className="mb-4">
                {/* Calendário visual de vencimentos */}
                <div className="bg-muted/30 rounded-xl border p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Calendário de Vencimentos — clique para selecionar
                  </p>
                  <div className="flex items-start gap-3 overflow-x-auto pb-1">
                    {[...contasCartao].sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0)).map((c) => {
                  const isSelected = selectedCartaoId === c.id;
                  const lastImp = history.find((h) => h.batch_type === 'fatura_cartao' && h.status === 'completed' && (h.title || '').toLowerCase().includes(c.nome.split('—')[0].trim().toLowerCase()));
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCartaoId(isSelected ? '' : c.id)}
                      className="flex flex-col items-center gap-1 min-w-[62px] shrink-0">
                      
                          <div className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all ${
                      isSelected ?
                      'bg-primary border-primary text-primary-foreground scale-110 shadow-md' :
                      'bg-slate-100 border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300'}`
                      }>
                            <span className="text-base font-bold leading-none">{c.dia_vencimento}</span>
                            <span className="text-[8px] font-medium">dia</span>
                          </div>
                          <p className="text-[9px] text-center text-muted-foreground leading-tight max-w-[62px] truncate font-medium">{c.nome.split('—')[0].trim()}</p>
                          {lastImp ?
                      <p className="text-[8px] text-center text-emerald-600 leading-tight max-w-[62px]">
                              {new Date(lastImp.created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {lastImp.success_count > 0 && <> · {lastImp.success_count}reg</>}
                            </p> :

                      <p className="text-[8px] text-center text-muted-foreground/40 leading-tight">nunca</p>
                      }
                        </button>);

                })}
                  </div>
                  {selectedCartaoId &&
              <p className="text-xs text-primary font-semibold mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> {contasCartao.find((c) => c.id === selectedCartaoId)?.nome}
                    </p>
              }
                  {!selectedCartaoId &&
              <p className="text-[10px] text-muted-foreground/60 mt-2 italic">Nenhum cartão selecionado — a IA tentará identificar automaticamente</p>
              }
                </div>
              </div>
          }

            <IdentificacaoArquivo identificando={identificando} identificacao={identificacao} tipo={selectedType} tipos={DOC_TYPES} />
            {file && !identificando && !identificacao && <Button variant="outline" onClick={() => handleFileSelect(file, releitura)}>Tentar identificar novamente</Button>}
            {file && selectedType && identificacao &&
          <Button onClick={processWithAI} disabled={processing || identificando} className="w-full mt-4 gap-2 h-11">
                {processing ?
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {processingStage === 'hash' ? 'Verificando cache...' : processingStage === 'upload' ? 'Enviando arquivo...' : 'Analisando com IA (pode levar ~30s)...'}
                  </> :
            <>✨ Processar com IA</>}
              </Button>
          }

            {rawText && records.length === 0 &&
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-800 mb-1">Resultado bruto da IA:</p>
                <pre className="text-[11px] text-yellow-900 whitespace-pre-wrap max-h-48 overflow-y-auto">{rawText}</pre>
              </div>
          }

            <HistoricoImportacoes tipos={DOC_TYPES} tipo={selectedType} onReler={relerArquivo} onResultado={b=>{setLoteResultado(b);setSelectedType(b.batch_type);setStep(4);}} busy={identificando || processing || saving} refresh={memoriaRefresh} />

          </div>
        </div>
      }

      {/* Tabela de revisão */}
      {records.length > 0 && step !== 4 &&
      <div className="mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">3. Revisar Dados Extraídos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {records.length} registros · <span className="text-green-600">{records.filter((r) => r.status === 'novo').length} novos</span> · <span className="text-yellow-600">{dupeCount} duplicatas</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRecords((r) => r.map((rec) => ({ ...rec, selected: rec.status === 'novo' })))}>
                Selecionar novos
              </Button>
              {!releitura && <Button onClick={confirmSave} disabled={saving || selectedCount === 0} className="gap-2">
                {saving ?
              <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{saveProgress}</> :
              `Confirmar e Salvar (${selectedCount})`}
              </Button>}
            </div>
          </div>
          {releitura && <><EditorReleitura records={records} setRecords={setRecords} onChange={() => setRevisaoVersao(v => v + 1)} /><CorrecaoImportacao key={revisaoVersao} batch={releitura} tipo={selectedType} entity={DOC_TYPES.find(t => t.id === selectedType)?.entity} arquivoUri={fileUri} records={records} onNova={() => setReleitura(null)} onSaved={() => {showToast('Correções confirmadas com auditoria; pagamentos e vínculos preservados.');setStep(4);setMemoriaRefresh(v => v + 1);queryClient.invalidateQueries();window.dispatchEvent(new Event('neuralfinRefresh'));}} /></>}
          {selectedType === 'extrato_bancario' && <ExtratoValidationCard validation={extratoValidacao} />}
          {selectedType === 'fatura_cartao' && faturaValidacao &&
        <div className={`mb-3 rounded-xl border p-3 ${faturaValidacao.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                {faturaValidacao.ok ?
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> :
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                <div className="flex-1 text-xs">
                  <p className={`font-bold ${faturaValidacao.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                    {faturaValidacao.ok ?
                '✓ Extração fiel — soma dos lançamentos bate com o total impresso' :
                '⚠️ Divergência detectada — soma não bate com o total impresso da fatura'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px]">
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Total impresso</p>
                      <p className="font-bold tabular-nums">{formatCurrency(faturaValidacao.totalFat)}</p>
                    </div>
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Soma extraída</p>
                      <p className="font-bold tabular-nums">{formatCurrency(faturaValidacao.somaLancs)}</p>
                    </div>
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Diferença</p>
                      <p className={`font-bold tabular-nums ${faturaValidacao.ok ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(faturaValidacao.diffSoma)}</p>
                    </div>
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Lançamentos</p>
                      <p className="font-bold tabular-nums">
                        {faturaValidacao.qtdLancs}
                        {faturaValidacao.qtdLancsIa > 0 && faturaValidacao.qtdLancsIa !== faturaValidacao.qtdLancs + faturaValidacao.dupsInternas &&
                    <span className="text-[10px] text-amber-600 ml-1">(IA contou {faturaValidacao.qtdLancsIa})</span>
                    }
                        {faturaValidacao.dupsInternas > 0 &&
                    <span className="text-[10px] text-purple-600 ml-1 block">🧹 {faturaValidacao.dupsInternas} dup removidas</span>
                    }
                      </p>
                    </div>
                  </div>
                  {!faturaValidacao.ok &&
              <p className="text-[11px] text-red-700 mt-2">
                      Sugestão: tente reenviar o arquivo (a IA pode ter pulado lançamentos) ou verifique se o PDF está completo. Não salve até a soma bater.
                    </p>
              }
                </div>
              </div>
            </div>
        }
          {selectedType === 'relatorio_vendas_detalhado' ?
        <TabelaRevisaoVendasDetalhado records={records} setRecords={setRecords} /> :

        <div className="bg-card rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" checked={records.every((r) => r.selected)}
                    onChange={(e) => setRecords((r) => r.map((rec) => ({ ...rec, selected: e.target.checked })))} />
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-24">Status</th>
                      {recordKeys.map((k) => <th key={k} className="px-2 py-2 text-left font-semibold text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec, i) =>
                <tr key={i} className={`border-b transition-colors ${rec.selected ? 'bg-card' : 'bg-muted/20 opacity-60'} hover:bg-muted/30`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={rec.selected}
                    onChange={(e) => setRecords((r) => r.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))} />
                        </td>
                        <td className="px-2 py-2"><StatusBadge status={rec.status} /></td>
                        {recordKeys.map((k) =>
                  <td key={k} className="px-2 py-2 max-w-[180px]">
                            <FieldValue value={rec.data[k]} />
                          </td>
                  )}
                      </tr>
                )}
                  </tbody>
                  {isFolha && folhaTotais &&
              <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-bold">
                        <td className="px-3 py-2" />
                        <td className="px-2 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Totais</td>
                        {recordKeys.map((k) => {
                    let content = null;
                    if (k === 'salario_total' || k === 'salarios_total' || k === 'salario_bruto') {
                      content = <span className="tabular-nums text-blue-700">{formatCurrency(folhaTotais.bruto)}</span>;
                    } else if (k === 'salario_liquido') {
                      content = <span className="tabular-nums text-emerald-700">{formatCurrency(folhaTotais.liquido)}</span>;
                    } else if (k === 'valor_pago') {
                      content = <span className="tabular-nums text-purple-700">{formatCurrency(folhaTotais.pago)}</span>;
                    }
                    return <td key={k} className="px-2 py-2">{content}</td>;
                  })}
                      </tr>
                    </tfoot>
              }
                </table>
              </div>
            </div>
        }
        </div>
      }

    </div>);

}