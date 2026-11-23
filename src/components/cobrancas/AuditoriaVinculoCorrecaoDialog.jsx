import { useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/formatters';
import { corrigirVinculoNFBoleto } from '@/functions/corrigirVinculoNFBoleto';

export default function AuditoriaVinculoCorrecaoDialog({ achado, onClose, onCorrigido }) {
  const [justificativa, setJustificativa] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState(null);
  const boleto = achado.boleto || {};
  const nfAtual = achado.nota || {};
  const candidato = achado.candidato || {};

  async function confirmar() {
    if (!justificativa.trim()) { setErro('Informe a justificativa da correção.'); return; }
    setAplicando(true); setErro(null);
    try {
      await corrigirVinculoNFBoleto({
        titulo_id: boleto.id,
        nota_fiscal_id_atual: nfAtual.id,
        nova_nota_fiscal_id: candidato.nota_id || candidato.id,
        justificativa: justificativa.trim(),
      });
      onCorrigido();
      onClose();
    } catch (e) {
      setErro(e.response?.data?.error || e.message || 'Não foi possível aplicar a correção.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Corrigir vínculo de boleto</DialogTitle>
          <DialogDescription>
            Esta operação move o boleto para outra NF. Não altera valores, pagamentos ou liquidações. A mudança fica registrada para auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Boleto</p>
            <p className="font-mono font-medium">{boleto.nosso_numero}</p>
            <p className="text-xs text-muted-foreground">Ref: {boleto.seu_numero || '—'} · {formatCurrency(boleto.valor_titulo || 0)}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-red-200 bg-red-50/60 p-2 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Vínculo atual</p>
              <p className="font-mono font-semibold text-red-700">NF {nfAtual.numero}</p>
              <p className="text-xs text-muted-foreground truncate">{nfAtual.cliente}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 rounded-lg border border-green-200 bg-green-50/60 p-2 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Novo vínculo</p>
              <p className="font-mono font-semibold text-green-700">NF {candidato.numero}</p>
              <p className="text-xs text-muted-foreground truncate">{candidato.cliente}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="just">Justificativa da correção *</Label>
            <Textarea id="just" value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Ex: Boleto com referência DOC107 foi vinculado incorretamente à NF 113." rows={3} className="mt-1" />
          </div>

          {erro && <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="w-3.5 h-3.5" /> {erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aplicando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={aplicando || !justificativa.trim()} className="gap-1.5">
            {aplicando ? 'Aplicando…' : 'Confirmar correção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}