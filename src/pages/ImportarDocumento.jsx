import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { processDocument } from '@/functions/processDocument';
import { Upload, FileText, ShoppingCart, CreditCard, Hammer, Users, Landmark, Receipt, CheckCircle, XCircle, Clock, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency, formatDate } from '../lib/formatters';

const DOC_TYPES = [
  { id: 'extrato_bancario', label: 'Extrato Bancário Sicredi', icon: Landmark, color: 'blue', entity: 'LancamentoBancario', dedup: ['data','descricao','valor'] },
  { id: 'boletos_liquidados', label: 'Boletos Liquidados', icon: Receipt, color: 'teal', entity: 'TituloCobranca', dedup: ['nosso_numero'] },
  { id: 'relatorio_nfs', label: 'Relatório de Vendas/NFs', icon: FileText, color: 'green', entity: 'NotaFiscal', dedup: ['tipo','numero'] },
  { id: 'compras_fornecedor', label: 'Compras por Fornecedor', icon: ShoppingCart, color: 'orange', entity: 'ItemCompra', dedup: ['fornecedor','numero_nota','descricao_produto'] },
  { id: 'fatura_cartao', label: 'Fatura de Cartão', icon: CreditCard, color: 'purple', entity: 'FaturaCartao', dedup: ['conta_cartao_id','mes_referencia'] },
  { id: 'obra_reforma', label: 'Obra e Reforma', icon: Hammer, color: 'brown', entity: 'ObraReforma', dedup: ['data','responsavel','valor'] },
  { id: 'folha_pagamento', label: 'Folha de Pagamento', icon: Users, color: 'slate', entity: 'FolhaPagamento', dedup: ['funcionario_nome','competencia'] },
  { id: 'dda_boletos', label: 'DDA / Boletos a Vencer', icon: Landmark, color: 'indigo', entity: 'LancamentoBancario', dedup: ['data','beneficiario','valor'] },
];

const COLOR_MAP = {
  blue: { card: 'border-blue-200 bg-blue-50', icon: 'text-blue-600 bg-blue-100', active: 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' },
  teal: { card: 'border-teal-200 bg-teal-50', icon: 'text-teal-600 bg-teal-100', active: 'border-teal-500 bg-teal-100 ring-2 ring-teal-300' },
  green: { card: 'border-green-200 bg-green-50', icon: 'text-green-600 bg-green-100', active: 'border-green-500 bg-green-100 ring-2 ring-green-300' },
  orange: { card: 'border-orange-200 bg-orange-50', icon: 'text-orange-600 bg-orange-100', active: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300' },
  purple: { card: 'border-purple-200 bg-purple-50', icon: 'text-purple-600 bg-purple-100', active: 'border-purple-500 bg-purple-100 ring-2 ring-purple-300' },
  brown: { card: 'border-amber-200 bg-amber-50', icon: 'text-amber-700 bg-amber-100', active: 'border-amber-600 bg-amber-100 ring-2 ring-amber-400' },
  slate: { card: 'border-slate-200 bg-slate-50', icon: 'text-slate-600 bg-slate-100', active: 'border-slate-500 bg-slate-100 ring-2 ring-slate-300' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icon: 'text-indigo-600 bg-indigo-100', active: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300' },
};

function StatusBadge({ status }) {
  const map = {
    novo: 'bg-green-100 text-green-700',
    duplicata: 'bg-yellow-100 text-yellow-700',
    erro: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
  };
  const labels = { novo: 'NOVO', duplicata: 'DUPLICATA', erro: 'ERRO', completed: 'Concluído', processing: 'Processando', failed: 'Falhou' };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}

function FieldValue({ value }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number') return <span className="tabular-nums">{typeof value === 'number' && Math.abs(value) > 100 ? formatCurrency(value) : value}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sim' : 'Não'}</span>;
  return <span className="truncate max-w-[180px] block">{String(value)}</span>;
}

export default function ImportarDocumento() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselected = urlParams.get('tipo');

  const [selectedType, setSelectedType] = useState(preselected || null);
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [contasCartao, setContasCartao] = useState([]);
  const [selectedCartaoId, setSelectedCartaoId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rawText, setRawText] = useState(null);
  const [records, setRecords] = useState([]); // [{data, status, selected}]
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [step, setStep] = useState(1);
  const fileInputRef = useRef();

  useEffect(() => { loadHistory(); loadCartoes(); }, []);
  useEffect(() => { if (preselected) setSelectedType(preselected); }, [preselected]);

  async function loadCartoes() {
    const cartoes = await base44.entities.ContaCartao.filter({ is_ativo: true });
    setContasCartao(cartoes);
  }

  async function loadHistory() {
    const batches = await base44.entities.ImportBatch.list('-created_date', 20);
    setHistory(batches);
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
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      const base64 = result.split(',')[1];
      setFileData(base64);
      setFileType(f.type || 'image/jpeg');
    };
    reader.readAsDataURL(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function processWithAI() {
    if (!selectedType || !fileData) return showToast('Selecione o tipo de documento e faça upload do arquivo.', 'error');
    if (selectedType === 'fatura_cartao' && !selectedCartaoId) return showToast('Selecione o cartão antes de processar.', 'error');
    setProcessing(true);
    setRecords([]);
    setRawText(null);
    try {
      const res = await processDocument({ fileData, fileType, docType: selectedType });
      const { parsed, rawText: raw } = res.data || res;
      setRawText(raw);

      if (!parsed) {
        setProcessing(false);
        return showToast('IA retornou texto não estruturado. Verifique o resultado bruto.', 'error');
      }

      // Normalize to array
      let items;
      if (selectedType === 'fatura_cartao' && parsed && parsed.lancamentos) {
      }

      // Normaliza campos chave para evitar falhas de dedup por tipo (int vs string)
      if (selectedType === 'relatorio_nfs') {
        items = items.map(item => ({ ...item, numero: String(item.numero ?? '').trim() }));
      }
      if (selectedType === 'boletos_liquidados') {
        items = items.map(item => ({ ...item, nosso_numero: String(item.nosso_numero ?? '').trim() }));
      }

      // Deduplicate check
      const typeConfig = DOC_TYPES.find(d => d.id === selectedType);

      // Track keys seen within this batch to catch same-file duplicates
      const seenInBatch = new Set();

      // Process sequentially to catch intra-batch duplicates
      const enriched = [];
      for (const item of items) {
        let dupStatus = 'novo';
        try {
          if (selectedType === 'fatura_cartao') {
            if (item.__type === 'FaturaCartao') {
              const existing = await base44.entities.FaturaCartao.filter({ conta_cartao_id: item.conta_cartao_id, mes_referencia: item.mes_referencia });
              if (existing && existing.length > 0) dupStatus = 'duplicata';
            } else if (item.__type === 'LancamentoCartao') {
              const existing = await base44.entities.LancamentoCartao.filter({ data_lancamento: item.data_lancamento, estabelecimento: item.estabelecimento, valor: item.valor });
              if (existing && existing.length > 0) dupStatus = 'duplicata';
            }
          } else if (typeConfig?.dedup?.length) {
            const query = {};
            // Normalize values to string to avoid type mismatch (e.g. numero: 77 vs "77")
            typeConfig.dedup.forEach(k => {
              if (item[k] !== undefined && item[k] !== null) {
                query[k] = String(item[k]);
              }
            });

            // Check intra-batch duplicate first
            const batchKey = typeConfig.dedup.map(k => String(item[k] ?? '')).join('|');
            if (seenInBatch.has(batchKey)) {
              dupStatus = 'duplicata';
            } else {
              seenInBatch.add(batchKey);
              if (Object.keys(query).length > 0) {
                const existing = await base44.entities[typeConfig.entity].filter(query);
                if (existing && existing.length > 0) dupStatus = 'duplicata';
              }
            }
          }
        } catch {}
        enriched.push({ data: item, status: dupStatus, selected: dupStatus === 'novo' });
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

    // Special handling for fatura_cartao: create FaturaCartao first, then LancamentoCartao with fatura_id
    if (selectedType === 'fatura_cartao') {
      // Get all lancamentos (selected or not — save all that aren't dupes)
      const allLancs = records.filter(r => r.data.__type === 'LancamentoCartao' && r.status !== 'duplicata');
      const faturaRec = records.find(r => r.data.__type === 'FaturaCartao');
      let faturaId = null;

      // Create or find existing FaturaCartao
      if (faturaRec) {
        if (faturaRec.status === 'duplicata') {
          // Find existing fatura to link lançamentos
          setSaveProgress('Buscando fatura existente...');
          const existing = await base44.entities.FaturaCartao.filter({
            conta_cartao_id: faturaRec.data.conta_cartao_id,
            mes_referencia: faturaRec.data.mes_referencia
          });
          faturaId = existing?.[0]?.id || null;
        } else {
          setSaveProgress('Salvando fatura...');
          try {
            const { __type, ...fatData } = faturaRec.data;
            const created = await base44.entities.FaturaCartao.create(fatData);
            faturaId = created.id;
            saved++;
          } catch { errors++; }
        }
      }

      if (!faturaId) {
        showToast('Não foi possível obter o ID da fatura. Lançamentos não salvos.', 'error');
        setSaving(false);
        return;
      }

      for (let i = 0; i < allLancs.length; i++) {
        setSaveProgress(`Salvando lançamento ${i + 1} de ${allLancs.length}...`);
        try {
          const { __type, ...lancData } = allLancs[i].data;
          await base44.entities.LancamentoCartao.create({ ...lancData, fatura_id: faturaId });
          saved++;
        } catch { errors++; }
      }
    } else {
      for (let i = 0; i < toSave.length; i++) {
        setSaveProgress(`Salvando ${i + 1} de ${toSave.length}...`);
        try {
          await base44.entities[typeConfig.entity].create(toSave[i].data);
          saved++;
        } catch { errors++; }
      }
    }

    const dupes = records.filter(r => r.status === 'duplicata').length;
    await base44.entities.ImportBatch.create({
      title: `${typeConfig?.label} — ${file?.name || 'arquivo'}`,
      batch_type: selectedType,
      file_name: file?.name || '',
      total_records: records.length,
      success_count: saved,
      duplicate_count: dupes,
      error_count: errors,
      status: errors === records.length ? 'failed' : 'completed',
    });

    setSaving(false);
    setSaveProgress('');
    setStep(4);
    showToast(`✓ ${saved} novos registros salvos · ${dupes} duplicatas ignoradas`);
    loadHistory();
  }

  function reset() {
    setSelectedType(preselected || null);
    setFile(null); setFileData(null); setFileType(null);
    setRecords([]); setRawText(null); setStep(1);
  }

  const selectedTypeConfig = DOC_TYPES.find(d => d.id === selectedType);
  const selectedCount = records.filter(r => r.selected).length;
  const dupeCount = records.filter(r => r.status === 'duplicata').length;

  const recordKeys = records.length > 0
    ? [...new Set(records.flatMap(r => Object.keys(r.data)))].filter(k => k !== '__type').slice(0, 9)
    : [];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Importar Documento" subtitle="Extração de dados financeiros com IA" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {['Selecionar tipo','Fazer upload','Revisar dados','Concluído'].map((s, i) => (
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* SEÇÃO 1A — Seletor de tipo */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">1. Tipo de Documento</h2>
            <div className="grid grid-cols-1 gap-2">
              {DOC_TYPES.map(dt => {
                const isActive = selectedType === dt.id;
                const colors = COLOR_MAP[dt.color];
                return (
                  <button
                    key={dt.id}
                    onClick={() => { setSelectedType(dt.id); setStep(Math.max(step, 1)); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${isActive ? colors.active : `${colors.card} hover:shadow-sm`}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
                      <dt.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm font-semibold ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>{dt.label}</span>
                    {isActive && <span className="ml-auto text-primary text-xs font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO 1B — Upload */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">2. Arquivo</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" className="hidden"
                onChange={(e) => handleFileSelect(e.target.files[0])} />
              {file ? (
                <div>
                  <FileText className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); setFileData(null); }}
                    className="mt-2 text-xs text-red-500 hover:underline">Remover</button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">Arraste o arquivo aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, XLSX, CSV</p>
                  <Button variant="outline" size="sm" className="mt-4 pointer-events-none">Selecionar arquivo</Button>
                </>
              )}
            </div>

            {/* Card selector for fatura_cartao */}
            {selectedType === 'fatura_cartao' && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Selecionar Cartão *</label>
                <select
                  value={selectedCartaoId}
                  onChange={e => setSelectedCartaoId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— escolha o cartão —</option>
                  {contasCartao.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} {c.bandeira ? `(${c.bandeira})` : ''} — {c.titular || ''}</option>
                  ))}
                </select>
              </div>
            )}

            {file && selectedType && (
              <Button onClick={processWithAI} disabled={processing} className="w-full mt-4 gap-2 h-11">
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analisando documento com IA...
                  </>
                ) : (
                  <>✨ Processar com IA</>
                )}
              </Button>
            )}

            {/* Raw text fallback */}
            {rawText && records.length === 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-800 mb-1">Resultado bruto da IA:</p>
                <pre className="text-[11px] text-yellow-900 whitespace-pre-wrap max-h-48 overflow-y-auto">{rawText}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEÇÃO 2 — Pré-visualização */}
      {records.length > 0 && step !== 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">3. Revisar Dados Extraídos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {records.length} registros · <span className="text-green-600">{records.filter(r=>r.status==='novo').length} novos</span> · <span className="text-yellow-600">{dupeCount} duplicatas</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRecords(r => r.map(rec => ({...rec, selected: rec.status==='novo'})))}>
                Selecionar novos
              </Button>
              <Button onClick={confirmSave} disabled={saving || selectedCount === 0} className="gap-2">
                {saving ? (
                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{saveProgress}</>
                ) : (
                  `Confirmar e Salvar (${selectedCount})`
                )}
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" checked={records.every(r=>r.selected)} onChange={e => setRecords(r => r.map(rec => ({...rec, selected: e.target.checked})))} />
                    </th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-24">Status</th>
                    {recordKeys.map(k => <th key={k} className="px-2 py-2 text-left font-semibold text-muted-foreground capitalize">{k.replace(/_/g,' ')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={i} className={`border-b transition-colors ${rec.selected ? 'bg-card' : 'bg-muted/20 opacity-60'} hover:bg-muted/30`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={rec.selected} onChange={e => setRecords(r => r.map((x,j) => j===i ? {...x, selected: e.target.checked} : x))} />
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

      {/* SEÇÃO 3 — Histórico */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Histórico de Importações</h2>
        <div className="bg-card rounded-xl border overflow-hidden">
          {loadingHistory ? (
            <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma importação realizada ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">Documento</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">Arquivo</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs">Salvos</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs">Duplicatas</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const dt = DOC_TYPES.find(d => d.id === h.batch_type);
                    return (
                      <tr key={h.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(h.created_date)}</td>
                        <td className="px-4 py-3 font-semibold text-sm">{dt?.label || h.batch_type}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[180px]">{h.file_name || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{h.success_count ?? 0}</td>
                        <td className="px-4 py-3 text-right text-yellow-600">{h.duplicate_count ?? 0}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={h.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}