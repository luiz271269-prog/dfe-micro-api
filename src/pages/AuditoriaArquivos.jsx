import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { FolderOpen, CheckCircle, AlertCircle, Clock, Upload, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '../components/shared/PageHeader';

// Mapa pasta → batch_type
const FOLDER_MAP = {
  'BOLETOS LIQUIDADOS':            'boletos_liquidados',
  'CARTOES':                       'fatura_cartao',
  'COMPRAS POR FORNECEDOR':        'compras_fornecedor',
  'DDA - BOLETOS A VENCER':        'dda_boletos',
  'EXTRATO BANCARIO SICREDI':      'extrato_bancario',
  'FOLHA DE PAGAMENTO':            'folha_pagamento',
  'NFS EMITIDAS MÊS-LIVRO FISCAL': 'relatorio_nfs',
  'NFS EMITIDAS MES-LIVRO FISCAL': 'relatorio_nfs',
  'OBRA E REFORMA':                'obra_reforma',
  'RELATORIO DE VENDAS':           'relatorio_vendas',
};

const STATUS_CONFIG = {
  importado:  { label: 'Importado',  icon: CheckCircle,  className: 'text-green-600 bg-green-50 border-green-200' },
  pendente:   { label: 'Pendente',   icon: Clock,        className: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  sem_tipo:   { label: 'Sem tipo',   icon: AlertCircle,  className: 'text-slate-500 bg-slate-50 border-slate-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.sem_tipo;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AuditoriaArquivos() {
  const dirInputRef = useRef();
  const [folders, setFolders] = useState({}); // { folderName: [fileObj] }
  const [importHistory, setImportHistory] = useState([]); // ImportBatch records
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [scanned, setScanned] = useState(false);

  async function handleDirSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setLoading(true);

    // Agrupar por subpasta imediata
    const grouped = {};
    files.forEach(f => {
      const parts = f.webkitRelativePath.split('/');
      const sub = parts.length >= 2 ? parts[1].toUpperCase() : '__RAIZ__';
      if (!grouped[sub]) grouped[sub] = [];
      grouped[sub].push(f);
    });

    // Buscar histórico completo
    const history = await base44.entities.ImportBatch.list('-created_date', 500);
    setImportHistory(history);
    setFolders(grouped);
    setScanned(true);
    // Expandir todas as pastas por padrão
    const exp = {};
    Object.keys(grouped).forEach(k => { exp[k] = true; });
    setExpanded(exp);
    setLoading(false);
  }

  function getFileStatus(file, folderName) {
    const batchType = FOLDER_MAP[folderName];
    if (!batchType) return 'sem_tipo';
    const fileName = file.name.toLowerCase();
    const match = importHistory.find(h =>
      h.batch_type === batchType &&
      h.file_name &&
      h.file_name.toLowerCase() === fileName &&
      h.status === 'completed'
    );
    return match ? 'importado' : 'pendente';
  }

  function getFolderStats(files, folderName) {
    const importados = files.filter(f => getFileStatus(f, folderName) === 'importado').length;
    const pendentes = files.filter(f => getFileStatus(f, folderName) === 'pendente').length;
    return { importados, pendentes, total: files.length };
  }

  function goImport(file, folderName) {
    const batchType = FOLDER_MAP[folderName];
    if (!batchType) return;
    // Navegar para página de importação com o tipo pré-selecionado
    window.location.href = `/importar?tipo=${batchType}`;
  }

  const totalFiles = Object.values(folders).flat().length;
  const totalImportados = scanned
    ? Object.entries(folders).reduce((acc, [folder, files]) =>
        acc + files.filter(f => getFileStatus(f, folder) === 'importado').length, 0)
    : 0;
  const totalPendentes = totalFiles - totalImportados;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="Auditoria de Arquivos" subtitle="Varra a pasta financeira e veja o que já foi importado">
      </PageHeader>

      {/* Summary cards */}
      {scanned && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalFiles}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total de arquivos</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{totalImportados}</p>
            <p className="text-xs text-green-600 mt-0.5">Importados</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">{totalPendentes}</p>
            <p className="text-xs text-yellow-600 mt-0.5">Pendentes</p>
          </div>
        </div>
      )}

      {/* Drop zone / selector */}
      <div
        onClick={() => dirInputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-10 text-center cursor-pointer transition-all hover:bg-muted/20 mb-6"
      >
        <input
          ref={dirInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleDirSelect}
        />
        <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-foreground">
          {scanned ? 'Selecionar outra pasta' : 'Selecionar pasta Financeiro'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Selecione a pasta raiz <strong>Financeiro (\\192.168.0.2\F:)</strong>
        </p>
        <Button variant="outline" size="sm" className="mt-4 pointer-events-none">
          {loading ? 'Analisando...' : 'Abrir pasta'}
        </Button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Lendo arquivos e cruzando com banco...</p>
        </div>
      )}

      {/* Folder list */}
      {!loading && scanned && (
        <div className="space-y-3">
          {Object.entries(folders)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([folderName, files]) => {
              const stats = getFolderStats(files, folderName);
              const isExpanded = expanded[folderName];
              const batchType = FOLDER_MAP[folderName];
              return (
                <div key={folderName} className="bg-card border rounded-xl overflow-hidden">
                  {/* Folder header */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                    onClick={() => setExpanded(ex => ({ ...ex, [folderName]: !ex[folderName] }))}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-semibold text-sm flex-1">{folderName}</span>
                    {!batchType && <span className="text-[10px] text-muted-foreground italic">pasta não mapeada</span>}
                    <div className="flex items-center gap-2 shrink-0">
                      {stats.pendentes > 0 && (
                        <span className="text-[11px] bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-bold">
                          {stats.pendentes} pendente{stats.pendentes > 1 ? 's' : ''}
                        </span>
                      )}
                      {stats.importados > 0 && (
                        <span className="text-[11px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                          {stats.importados} ok
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{stats.total} arquivo{stats.total > 1 ? 's' : ''}</span>
                    </div>
                  </button>

                  {/* File list */}
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {files
                        .sort((a, b) => b.lastModified - a.lastModified)
                        .map((file, i) => {
                          const status = getFileStatus(file, folderName);
                          const date = new Date(file.lastModified);
                          return (
                            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 text-sm">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="flex-1 text-xs truncate font-medium">{file.name}</span>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </span>
                              <span className="text-[11px] text-muted-foreground shrink-0 w-16 text-right">{formatSize(file.size)}</span>
                              <StatusBadge status={status} />
                              {status === 'pendente' && batchType && (
                                <button
                                  onClick={() => goImport(file, folderName)}
                                  className="shrink-0 flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                                >
                                  <Upload className="w-3 h-3" /> Importar
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}