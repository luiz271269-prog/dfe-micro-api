export const CHAT_URL = 'https://nexus360.neuraltec360.com.br/chat?tel=';

const WIDTH = 420;
const HEIGHT = 620;
const MARGIN = 24;

// Abre o chat do Nexus360 em uma janela compacta ancorada no canto inferior direito,
// mantendo o app principal aberto e utilizável ao fundo. Reaproveita a mesma janela.
export function abrirJanelaChat(tel) {
  const url = `${CHAT_URL}${tel}`;
  const sw = window.screen.availWidth || window.innerWidth;
  const sh = window.screen.availHeight || window.innerHeight;
  const left = Math.max(0, sw - WIDTH - MARGIN);
  const top = Math.max(0, sh - HEIGHT - MARGIN);
  const features = `popup=yes,width=${WIDTH},height=${HEIGHT},left=${left},top=${top},noopener,noreferrer,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes`;
  const win = window.open(url, 'nexus360Chat', features);
  if (win) win.focus();
  else window.open(url, '_blank', 'noopener,noreferrer');
}