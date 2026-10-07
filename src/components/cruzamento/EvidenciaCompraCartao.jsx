import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
export default function EvidenciaCompraCartao({ motivo, onChange, erro, visivel }) {
  return <div className="space-y-2">
    {visivel && <><Label htmlFor="evidencia-compra-cartao">Evidência conferida para o cartão</Label>
      <Input id="evidencia-compra-cartao" value={motivo} maxLength={500} onChange={e => onChange(e.target.value)} placeholder="Informe o documento ou comprovante conferido" />
      <p className="text-xs text-muted-foreground">Confirmação manual: descreva a evidência em pelo menos 10 caracteres; a compra não representa a quitação bancária da fatura.</p></>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </div>;
}