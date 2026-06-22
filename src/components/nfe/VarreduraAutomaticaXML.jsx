import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FolderSearch, Zap, CheckCircle2, AlertTriangle, FileCode2, RefreshCw } from 'lucide-react';
import { listarXMLsDrive } from '@/functions/listarXMLsDrive';
import { analisarXMLNFe } from '@/functions/analisarXMLNFe';

const BATCH_SIZE = 10; // processa de 10 em 10 XMLs por ciclo (loop forense)

export default function VarreduraAutomaticaXML({ onConcluido }) {
  const [config, setConfig] = useState(null);
  const [folderQuery, setFolderQuery] = useState('Retorno');
  const [folderIdInput, setFolderIdInput] = useState('');
  const [listando, setListando] = useState(false);
  const [resumoLista, setResumoLista] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, erro: 0, divergencias: 0 });
  const [logs, setLogs] = useState([]);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const lista = await base44.entities.ConfigDrivePastaXML.filter({ ativo: true });
    if (lista?.[0]) {
      setConfig(lista[0]);
      setFolderIdInput(lista[0].folder_id || '');
      setFolderQuery(lista[0].folder_name || 'Retorno');
    }
  }

  async function salvarConfig(folderId, folderName, quantidade, processados) {
    try {
      if (config) {
        await base44.entities.ConfigDrivePastaXML.update(config.id, {
          folder_id: folderId,
          folder_name: folderName || config.folder_name,
          ultima_varredura: new Date().toISOString(),
          ultima_quantidade: quantidade,
          ultimo_processados: processados,
        });
      } else {
        const novo = await base44.entities.ConfigDrivePastaXML.create({
          folder_id: folderId,
          folder_name: folderName,
          ativo: true,
          ultima_varredura: new Date().toISOString(),
          ultima_quantidade: quantidade,
          ultimo_processados: processados,
        });
        setConfig(novo);
      }
    } catch (e) {
      console.warn('Falha ao salvar config:', e.message);
    }
  }

  function pushLog(msg, type = 'info') {
    setLogs(l => [{ msg, type, t: new Date().toLocaleTimeString('pt-BR') }, ...l].slice(0, 50));
  }

  async function listarArquivos() {
    setListando(true);
    setErro(null);
    setResumoLista(null);
    try {
      const payload = folderIdInput?.trim()
        ? { folder_id: folderIdInput.trim(), only_new: true }
        : { folder_name_query: folderQuery, only_new: true };
      const res = await listarXMLsDrive(payload);
      const data = res?.data || res;
      if (data?.error) {
        setErro(data.error + (data.sugestao ? ` · ${data.sugestao}` : ''));
      } else {
        setResumoLista(data);
        if (data.folder_id && data.folder_id !== folderIdInput) setFolderIdInput(data.folder_id);
        pushLog(`📂 Pasta "${data.folder_name || folderQuery}" → ${data.total_na_pasta} XMLs (${data.ja_processados} já processados · ${data.novos} novos)`, 'info');
      }
    } catch (e) {
      setErro(e.message);
    }
    setListando(false);
  }

  async function processarEmLote() {
    if (!resumoLista?.arquivos?.length) return;
    setProcessando(true);
    setErro(null);
    const arquivos = resumoLista.arquivos;
    setProgress({ done: 0, total: arquivos.length, ok: 0, erro: 0, divergencias: 0 });
    pushLog(`🤖 Iniciando varredura forense de ${arquivos.length} XMLs (lotes de ${BATCH_SIZE})`, 'info');

    let ok = 0, errCount = 0, div = 0;

    for (let i = 0; i < arquivos.length; i += BATCH_SIZE) {
      const lote = arquivos.slice(i, i + BATCH_SIZE);
      const fileIds = lote.map(a => a.id);
      pushLog(`⚙️ Lote ${Math.floor(i/BATCH_SIZE)+1}: processando ${lote.length} XMLs...`, 'info');
      try {
        const res = await analisarXMLNFe({ file_ids: fileIds });
        const data = res?.data || res;
        const resultados = data?.resultados || [];
        for (const r of resultados) {
          if (r.error) {
            errCount++;
            pushLog(`✗ ${r.drive_file_name || r.file_id}: ${r.error}`, 'error');
          } else {
            ok++;
            if (r.divergencias > 0 || r.divergencias_fiscais > 0) {
              div++;
              pushLog(`⚠️ ${r.drive_file_name}: ${r.status} · ${r.divergencias} div. · score ${r.score_conformidade}`, 'warn');
            } else {
              pushLog(`✓ ${r.drive_file_name}: ${r.status} · score ${r.score_conformidade}`, 'ok');
            }
          }
        }
      } catch (e) {
        errCount += lote.length;
        pushLog(`✗ Falha no lote: ${e.message}`, 'error');
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, arquivos.length), total: arquivos.length, ok, erro: errCount, divergencias: div });
    }

    pushLog(`🏁 Concluído: ${ok} OK · ${div} com divergências · ${errCount} erros`, ok > errCount ? 'ok' : 'warn');

    // Salva snapshot da varredura
    if (resumoLista.folder_id) {
      await salvarConfig(resumoLista.folder_id, resumoLista.folder_name, arquivos.length, ok);
    }

    setProcessando(false);
    if (onConcluido) onConcluido();
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900">Super Agente — Varredura Forense em Loop</h3>
            <p className="text-xs text-indigo-700">Lê automaticamente todos os XMLs de uma pasta do Drive e processa em lote</p>
          </div>
        </div>
        {config?.ultima_varredura && (
          <div className="text-[11px] text-indigo-700 text-right">
            <p>Última varredura:</p>
            <p className="font-semibold">{new Date(config.ultima_varredura).toLocaleString('pt-BR')}</p>
            <p>{config.ultimo_processados} processados</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 mb-3">
        <div>
          <Label className="text-[10px] uppercase font-bold text-indigo-700">ID da Pasta do Drive (opcional)</Label>
          <Input
            value={folderIdInput}
            onChange={(e) => setFolderIdInput(e.target.value)}
            placeholder="cole o ID da pasta ex: 1abc2xyz..."
            className="bg-white text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase font-bold text-indigo-700">ou Nome contém</Label>
          <Input
            value={folderQuery}
            onChange={(e) => setFolderQuery(e.target.value)}
            placeholder="Retorno"
            className="bg-white text-xs"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={listarArquivos} disabled={listando || processando} variant="outline" className="gap-2 w-full">
            {listando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSearch className="w-4 h-4" />}
            Listar
          </Button>
        </div>
      </div>

      {erro && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-rose-800">{erro}</p>
        </div>
      )}

      {resumoLista && (
        <div className="bg-white rounded-lg border border-indigo-200 p-3 mb-3">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total na pasta</p>
              <p className="text-2xl font-bold text-indigo-700">{resumoLista.total_na_pasta}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Já processados</p>
              <p className="text-2xl font-bold text-emerald-700">{resumoLista.ja_processados}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Novos para processar</p>
              <p className="text-2xl font-bold text-amber-700">{resumoLista.novos}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mb-3">
            📂 {resumoLista.folder_name || folderQuery} · ID: <code className="text-[10px]">{resumoLista.folder_id?.slice(0, 16)}...</code>
          </p>
          {resumoLista.novos > 0 && (
            <Button onClick={processarEmLote} disabled={processando} className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
              {processando ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando {progress.done}/{progress.total} ({pct}%)</> : <><Zap className="w-4 h-4" /> Processar {resumoLista.novos} XMLs em lote</>}
            </Button>
          )}
          {resumoLista.novos === 0 && resumoLista.total_na_pasta > 0 && (
            <p className="text-center text-sm text-emerald-700 font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Todos os XMLs da pasta já foram processados
            </p>
          )}
        </div>
      )}

      {processando && (
        <div className="bg-white rounded-lg border border-indigo-200 p-3 mb-3">
          <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-indigo-700 font-semibold">
            <span>✓ {progress.ok} OK</span>
            <span>⚠️ {progress.divergencias} divergências</span>
            <span>✗ {progress.erro} erros</span>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <details className="bg-white rounded-lg border border-indigo-200 p-3" open={processando}>
          <summary className="text-xs font-bold text-indigo-700 cursor-pointer flex items-center gap-2">
            <FileCode2 className="w-3.5 h-3.5" /> Log forense ({logs.length})
          </summary>
          <div className="mt-2 max-h-60 overflow-y-auto space-y-1 text-[11px] font-mono">
            {logs.map((l, i) => (
              <p key={i} className={`${l.type === 'error' ? 'text-rose-700' : l.type === 'warn' ? 'text-amber-700' : l.type === 'ok' ? 'text-emerald-700' : 'text-slate-700'}`}>
                <span className="text-muted-foreground">[{l.t}]</span> {l.msg}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}