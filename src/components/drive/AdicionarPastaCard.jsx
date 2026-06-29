import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import DriveFolderPicker from './DriveFolderPicker';
import { TIPOS_IMPORTACAO } from '@/lib/tiposImportacao';

export default function AdicionarPastaCard({ tiposUsados = [], onChange }) {
  const [tipo, setTipo] = useState('');
  const [salvando, setSalvando] = useState(false);

  // só oferece tipos ainda não vinculados
  const disponiveis = TIPOS_IMPORTACAO.filter(t => !tiposUsados.includes(t.id));

  async function vincular(folder) {
    if (!tipo) return;
    setSalvando(true);
    try {
      await base44.entities.ConfigDrivePastaXML.create({
        tipo_pasta: tipo,
        folder_id: folder.id,
        folder_name: folder.name,
        ativo: true,
      });
      setTipo('');
      onChange();
    } catch (e) {
      alert('Erro ao vincular pasta: ' + e.message);
    }
    setSalvando(false);
  }

  return (
    <div className="bg-card border-2 border-dashed rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary shrink-0">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Vincular nova pasta</h3>
          <p className="text-xs text-muted-foreground">Escolha o tipo e a pasta no Drive. A leitura fica memorizada.</p>
        </div>
      </div>

      {disponiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todos os tipos já têm uma pasta vinculada.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">1. Tipo de importação</label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo de documento..." /></SelectTrigger>
              <SelectContent>
                {disponiveis.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">2. Pasta no Google Drive</label>
            {salvando ? (
              <button disabled className="inline-flex items-center gap-2 h-9 px-4 rounded-md border text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
              </button>
            ) : (
              <div className={tipo ? '' : 'opacity-50 pointer-events-none'}>
                <DriveFolderPicker onFolderSelected={vincular} label="Selecionar pasta no Drive" />
              </div>
            )}
            {!tipo && <p className="text-[11px] text-muted-foreground mt-1.5 italic">Escolha o tipo primeiro.</p>}
          </div>
        </div>
      )}
    </div>
  );
}