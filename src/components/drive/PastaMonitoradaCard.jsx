import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FolderCheck, FolderX, Clock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import DriveFolderPicker from './DriveFolderPicker';

const TIPO_LABELS = {
  xml: { titulo: 'Pasta de XMLs de NF-e', desc: 'Importa e analisa notas fiscais automaticamente', cor: 'indigo' },
  comprovante: { titulo: 'Pasta de Comprovantes', desc: 'PDFs e fotos viram um inbox deduplicado', cor: 'emerald' },
};

export default function PastaMonitoradaCard({ tipo, config, onChange }) {
  const [salvando, setSalvando] = useState(false);
  const info = TIPO_LABELS[tipo];

  async function vincularPasta(folder) {
    setSalvando(true);
    try {
      if (config) {
        await base44.entities.ConfigDrivePastaXML.update(config.id, { folder_id: folder.id, folder_name: folder.name, ativo: true });
      } else {
        await base44.entities.ConfigDrivePastaXML.create({ tipo_pasta: tipo, folder_id: folder.id, folder_name: folder.name, ativo: true });
      }
      onChange();
    } catch (e) {
      alert('Erro ao vincular pasta: ' + e.message);
    }
    setSalvando(false);
  }

  async function toggleAtivo(val) {
    if (!config) return;
    setSalvando(true);
    await base44.entities.ConfigDrivePastaXML.update(config.id, { ativo: val });
    onChange();
    setSalvando(false);
  }

  const isErro = config?.ultimo_status?.startsWith('erro');

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config?.folder_id ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
            {config?.folder_id ? <FolderCheck className="w-5 h-5" /> : <FolderX className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-foreground">{info.titulo}</h3>
            <p className="text-xs text-muted-foreground">{info.desc}</p>
          </div>
        </div>
        {config?.folder_id && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{config.ativo ? 'Ativa' : 'Pausada'}</span>
            <Switch checked={!!config.ativo} onCheckedChange={toggleAtivo} disabled={salvando} />
          </div>
        )}
      </div>

      {config?.folder_id ? (
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
      ) : (
        <p className="text-sm text-muted-foreground mb-3">Nenhuma pasta vinculada ainda.</p>
      )}

      <div className="flex items-center gap-2">
        {salvando ? (
          <Button variant="outline" disabled className="gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</Button>
        ) : (
          <DriveFolderPicker
            onFolderSelected={vincularPasta}
            label={config?.folder_id ? 'Trocar pasta' : 'Vincular pasta'}
          />
        )}
      </div>
    </div>
  );
}