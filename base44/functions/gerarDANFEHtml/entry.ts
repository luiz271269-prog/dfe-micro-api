// Gera HTML imprimível (DANFE simplificado) de uma NF-e a partir do registro NFeAnalise.
// Recebe { nfe_analise_id } OU { numero_nota } e retorna { html, nfe } pronto para o navegador imprimir/exportar PDF.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function fmtMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCnpj(c) {
  if (!c) return '';
  const d = c.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return c;
}
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, dia] = s.split('-');
  if (y && m && dia) return `${dia}/${m}/${y}`;
  return s;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

function buildHtml(nfe) {
  const produtos = Array.isArray(nfe.produtos) ? nfe.produtos : [];
  const linhasProdutos = produtos.map((p, idx) => `
    <tr>
      <td class="c">${idx + 1}</td>
      <td>${esc(p.codigo || '')}</td>
      <td>${esc(p.descricao || '')}</td>
      <td class="c">${esc(p.ncm || '')}</td>
      <td class="c">${esc(p.cfop || '')}</td>
      <td class="c">${esc(p.unidade || '')}</td>
      <td class="r">${fmtMoney(p.quantidade)}</td>
      <td class="r">${fmtMoney(p.valor_unitario)}</td>
      <td class="r">${fmtMoney(p.valor_total)}</td>
      <td class="r">${fmtMoney(p.icms_valor)}</td>
      <td class="r">${fmtMoney(p.ipi_valor)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>DANFE ${esc(nfe.numero_nota || '')} — ${esc(nfe.emitente_nome || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 16px; color: #000; background: #fff; }
  .danfe { max-width: 820px; margin: 0 auto; }
  h1 { font-size: 14pt; margin: 0 0 4px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border: 1.5px solid #000; padding: 10px; margin-bottom: 0; }
  .hdr .emit { flex: 1; }
  .hdr .doc { text-align: center; border-left: 1px solid #000; padding-left: 12px; min-width: 180px; }
  .hdr .doc .big { font-size: 22pt; font-weight: bold; }
  .box { border: 1.5px solid #000; border-top: none; padding: 8px 10px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  .row > div { flex: 1; min-width: 140px; }
  .lbl { font-size: 7pt; text-transform: uppercase; color: #444; letter-spacing: 0.3px; }
  .val { font-size: 10pt; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  table th, table td { border: 1px solid #000; padding: 4px 6px; font-size: 9pt; }
  table th { background: #eee; text-align: left; font-size: 8pt; text-transform: uppercase; }
  td.r, th.r { text-align: right; }
  td.c, th.c { text-align: center; }
  .totais { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1.5px solid #000; border-top: none; }
  .totais > div { padding: 6px 8px; border-right: 1px solid #000; }
  .totais > div:last-child { border-right: none; }
  .totais .big { font-size: 13pt; font-weight: bold; }
  .chave { font-family: 'Courier New', monospace; font-size: 9pt; letter-spacing: 1px; word-break: break-all; }
  .footer { margin-top: 12px; font-size: 8pt; color: #555; text-align: center; }
  .actions { text-align: center; margin-bottom: 16px; }
  .actions button { padding: 10px 20px; margin: 0 6px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 11pt; font-weight: 600; }
  .actions button.secondary { background: #64748b; }
  @media print {
    .actions { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>
<div class="actions">
  <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  <button class="secondary" onclick="window.close()">Fechar</button>
</div>

<div class="danfe">
  <div class="hdr">
    <div class="emit">
      <h1>${esc(nfe.emitente_nome || '—')}</h1>
      <div><span class="lbl">CNPJ:</span> <span class="val">${esc(fmtCnpj(nfe.emitente_cnpj))}</span></div>
      <div><span class="lbl">UF:</span> <span class="val">${esc(nfe.emitente_uf || '')}</span></div>
      <div><span class="lbl">Natureza da Operação:</span> <span class="val">${esc(nfe.natureza_operacao || '')}</span></div>
    </div>
    <div class="doc">
      <div class="lbl">DANFE</div>
      <div class="lbl">Documento Auxiliar da NF-e</div>
      <div class="big">Nº ${esc(nfe.numero_nota || '')}</div>
      <div><span class="lbl">Série:</span> <span class="val">${esc(nfe.serie || '1')}</span></div>
      <div><span class="lbl">Emissão:</span> <span class="val">${esc(fmtDate(nfe.data_emissao))}</span></div>
    </div>
  </div>

  <div class="box">
    <div class="lbl">Chave de Acesso</div>
    <div class="chave">${esc((nfe.chave_acesso || '').replace(/(.{4})/g, '$1 ').trim() || '—')}</div>
  </div>

  <div class="box">
    <div class="lbl">Destinatário / Cliente</div>
    <div class="row">
      <div style="flex:2;">
        <div class="val">${esc(nfe.destinatario_nome || '—')}</div>
      </div>
      <div><span class="lbl">CNPJ/CPF:</span> <span class="val">${esc(fmtCnpj(nfe.destinatario_cnpj))}</span></div>
      <div><span class="lbl">UF:</span> <span class="val">${esc(nfe.destinatario_uf || '')}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c" style="width:30px;">#</th>
        <th style="width:80px;">Código</th>
        <th>Descrição do Produto / Serviço</th>
        <th class="c" style="width:70px;">NCM</th>
        <th class="c" style="width:50px;">CFOP</th>
        <th class="c" style="width:40px;">UN</th>
        <th class="r" style="width:60px;">Qtd</th>
        <th class="r" style="width:75px;">Vl. Unit.</th>
        <th class="r" style="width:80px;">Vl. Total</th>
        <th class="r" style="width:70px;">ICMS</th>
        <th class="r" style="width:60px;">IPI</th>
      </tr>
    </thead>
    <tbody>
      ${linhasProdutos || '<tr><td colspan="11" style="text-align:center; padding: 20px; color: #888;">Sem produtos detalhados no XML</td></tr>'}
    </tbody>
  </table>

  <div class="totais">
    <div><div class="lbl">Vl. Produtos</div><div class="big">R$ ${fmtMoney(nfe.valor_produtos)}</div></div>
    <div><div class="lbl">ICMS Total</div><div class="big">R$ ${fmtMoney(nfe.icms_total)}</div></div>
    <div><div class="lbl">IPI / Outros</div><div class="big">R$ ${fmtMoney((nfe.ipi_total || 0) + (nfe.valor_outras_despesas || 0))}</div></div>
    <div><div class="lbl">Valor Total da NF</div><div class="big" style="color:#1e40af;">R$ ${fmtMoney(nfe.valor_total)}</div></div>
  </div>

  <div class="footer">
    DANFE gerado pelo sistema NeuralFin · Documento auxiliar — consulte autenticidade em www.nfe.fazenda.gov.br
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { nfe_analise_id, numero_nota } = body || {};

    let nfe = null;
    if (nfe_analise_id) {
      nfe = await base44.entities.NFeAnalise.get(nfe_analise_id);
    } else if (numero_nota) {
      const arr = await base44.entities.NFeAnalise.filter({ numero_nota: String(numero_nota) });
      nfe = arr?.[0] || null;
    }

    if (!nfe) {
      return Response.json({
        error: 'NF-e não encontrada na base. Importe o XML da NF-e (módulo Análise NF-e) primeiro.',
        sugestao: 'Vá em Análise NF-e e processe os XMLs da pasta Drive antes de imprimir o DANFE.',
      }, { status: 404 });
    }

    const html = buildHtml(nfe);
    return Response.json({ html, nfe });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});