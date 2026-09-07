import { MessageCircle } from 'lucide-react';

const CHAT_URL = 'https://nexus360.neuraltec360.com.br/chat?tel=';

// Normaliza telefone BR → dígitos com DDI 55. Retorna null se inválido.
export function normalizarTelefone(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+') || d.startsWith('00')) d = d.replace(/^00/, '');
  else if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^\d{12,15}$/.test(d) ? d : null;
}

// Botão estilo WhatsApp: abre a conversa no Nexus360 em nova aba.
export default function MensagemLink({ phone, compact = false, className = '' }) {
  const tel = normalizarTelefone(phone);
  const base = `inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors ${compact ? 'h-7 w-7 justify-center' : 'h-7 px-2.5 text-xs'}`;
  if (!tel) {
    return (
      <button type="button" disabled title="Cadastre um telefone válido com DDD" onClick={e => e.stopPropagation()}
        className={`${base} bg-muted text-muted-foreground/50 cursor-not-allowed ${className}`}>
        <MessageCircle className="w-3.5 h-3.5" />{!compact && 'Mensagem'}
      </button>
    );
  }
  return (
    <a href={`${CHAT_URL}${tel}`} target="_blank" rel="noopener noreferrer" title="Enviar mensagem"
      onClick={e => e.stopPropagation()}
      className={`${base} bg-emerald-500 text-white hover:bg-emerald-600 ${className}`}>
      <MessageCircle className="w-3.5 h-3.5" />{!compact && 'Mensagem'}
    </a>
  );
}