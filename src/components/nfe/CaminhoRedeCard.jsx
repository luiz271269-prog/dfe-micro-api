import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Network, Save, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';

const TIPOS = [
  { v: 'drive_sincronizado', l: 'Pasta sincronizada com Google Drive (recomendado)' },
  { v: 'disco_local', l: 'Disco local (ex: E:\\...)' },
  { v: 'unc_rede', l: 'Compartilhamento de rede (\\\\servidor\\...)' },
  { v: 'outro', l: 'Outro' },
];

export default function CaminhoRedeCard() {
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    caminho_rede: '',
    tipo_caminho: 'drive_sincronizado',
    host_servidor: '',
    folder_name: '',
    observacoes: '',
  });

  useEffect(() => {
    (async () => {
      const lista = await base44.entities.ConfigDrivePastaXML.filter({ ativo: true });
      const cfg = lista?.[0] || null;
      setConfig(cfg);
      if (cfg) {
        setForm({
          caminho_rede: cfg.caminho_rede || '',
          tipo_caminho: cfg.tipo_caminho || 'drive_sincronizado',
          host_servidor: cfg.host_servidor || '',
          folder_name: cfg.folder_name || '',
          observacoes: cfg.observacoes || '',
        });
      } else {
        setEditing(true);
      }
    })();
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      if (config) {
        const upd = await base44.entities.ConfigDrivePastaXML.update(config.id, form);
        setConfig(upd);
      } else {
        // Sem folder_id ainda — cria como placeholder; folder_id real é preenchido pela Varredura
        const novo = await base44.entities.ConfigDrivePastaXML.create({
          ...form,
          folder_id: 'pendente',
          ativo: true,
        });
        setConfig(novo);
      }
      setEditing(false);
    } catch (e) {
      alert('Falha ao salvar: ' + e.message);
    }
    setSaving(false);
  }

  const temCaminho = !!form.caminho_rede;
  const tipoLabel = TIPOS.find(t => t.v === form.tipo_caminho)?.l || '—';

  return (
    <div className="bg-card border rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
            <Network className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Caminho de Rede / Pasta de Origem</h3>
            <p className="text-[11px] text-muted-foreground">Onde os XMLs ficam armazenados na sua rede/servidor — referência operacional</p>
          </div>
        </div>
        {!editing && config && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Edit2 className="w-3 h-3" /> Editar
          </Button>
        )}
      </div>

      {!editing && temCaminho && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-bold text-emerald-700">Caminho configurado</p>
              <p className="text-sm font-mono text-emerald-900 truncate">{form.caminho_rede}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/40 rounded p-2">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</p>
              <p className="font-semibold">{tipoLabel}</p>
            </div>
            {form.host_servidor && (
              <div className="bg-muted/40 rounded p-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Servidor</p>
                <p className="font-semibold font-mono">{form.host_servidor}</p>
              </div>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800">
              <strong>Importante:</strong> o sistema roda na nuvem e não acessa diretamente este caminho.
              Para automação, mantenha esta pasta <strong>sincronizada com o Google Drive</strong> (cliente Drive Desktop) — o sistema lê via Drive.
            </p>
          </div>
        </div>
      )}

      {!editing && !temCaminho && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">Nenhum caminho de rede configurado.</p>
          <Button onClick={() => setEditing(true)} size="sm">Configurar agora</Button>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase font-bold">Caminho de rede</Label>
            <Input
              value={form.caminho_rede}
              onChange={(e) => setForm({ ...form, caminho_rede: e.target.value })}
              placeholder="ex: E:\Ellitte\XMLs\Retorno  ou  \\servidor\xmls"
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase font-bold">Tipo</Label>
              <Select value={form.tipo_caminho} onValueChange={(v) => setForm({ ...form, tipo_caminho: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold">Servidor/Host (se UNC)</Label>
              <Input
                value={form.host_servidor}
                onChange={(e) => setForm({ ...form, host_servidor: e.target.value })}
                placeholder="ex: WTS-NEURALTEC"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase font-bold">Observações</Label>
            <Input
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Notas para a equipe"
              className="text-xs"
            />
          </div>
          <div className="flex gap-2 justify-end">
            {config && <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>}
            <Button size="sm" onClick={salvar} disabled={saving} className="gap-1.5">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}