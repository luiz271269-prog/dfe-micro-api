import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FolderCheck, Clock, Loader2, CheckCircle2, AlertTriangle, Trash2, Zap } from 'lucide-react';
import DriveFolderPicker from './DriveFolderPicker';
import { TIPO_INFO } from '@/lib/tiposImportacao';

export default function PastaMonitoradaCard({ config, onChange }) {
  const [salvando, setSalvando] = useState(false);
  const info = TIPO_INFO[config.tipo_pasta] || { label: config.tipo_pasta, desc: '' };

  async function trocarPasta(folder) {
    setSalvando(true);
    try {
      await base44.entities.ConfigDrivePastaXML.update(config.id, { folder_id: folder.id, folder_name: folder.name });
      onChange();
    } catch (e) {
      alert('Erro ao trocar pasta: ' + e.message);
    }
    setSalvando(false);
  }

  async function toggleAtivo(val) {
    setSalvando(true);
    await base44.entities.ConfigDrivePastaXML.update(config.id, { ativo: val });
    onChange();
    setSalvando(false);
  }

  async function remover() {
    if (!confirm(`Remover a pasta vinculada de "${info.label}"? A varredura automática deste tipo para.`)) return;
    setSalvando(true);
    await base44.entities.ConfigDrivePastaXML.delete(config.id);
    onChange();
    setSalvando(false);
  }

  const isErro = config?.ultimo_status?.startsWith('erro');

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-700 shrink-0">
            <FolderCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-foreground flex items-center gap-1.5">
              {info.label}
              {info.auto && <span className="text-[9px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> auto</span>}
            </h3>
            <p className="text-xs text-muted-foreground">{info.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">{config.ativo ? 'Ativa' : 'Pausada'}</span>
          <Switch checked={!!config.ativo} onCheckedChange={toggleAtivo} disabled={salvando} />
        </div>
      </div>

      <div className="bg-muted/40 rounded-lg p-3 mb-3">
        <p className="text-sm font-semibold text-foreground truncate">📂 {config.folder_name || 'Pasta vinculada'}</p>
        {config.ultima_varredura && (
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Última varredura: {new Date(config.ultima_varredura).toLocaleString('pt-BR')}</span>
          </div>
        )}
        {config.ultimo_status && (
          <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] font-medium ${isErro ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isErro ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            <span>{config.ultimo_status}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {salvando ? (
          <Button variant="outline" disabled className="gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</Button>
        ) : (
          <>
            <DriveFolderPicker onFolderSelected={trocarPasta} label="Trocar pasta" />
            <Button variant="ghost" size="icon" onClick={remover} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}