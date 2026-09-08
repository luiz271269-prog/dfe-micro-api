import { CAMPOS_PROVENTO, CAMPOS_DESCONTO } from './folhaEventos';

const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const n = (v) => Number(v) || 0;

// Um evento é "por fora" quando marcado com fora_folha ou quando a descrição diz "fora".
export const isPorFora = (e) => e.fora_folha === true || /fora/i.test(e.descricao || '');

export function montarBlocos(f) {
  const eventos = f.eventos || [];
  const emFolha = [
    { descricao: 'Salário Base', tipo: 'provento', valor: n(f.salario_bruto) },
    ...CAMPOS_PROVENTO.map(([k, l]) => ({ descricao: l, tipo: 'provento', valor: n(f[k]) })),
    ...eventos.filter(e => e.tipo === 'provento' && !isPorFora(e)),
    ...CAMPOS_DESCONTO.map(([k, l]) => ({ descricao: l, tipo: 'desconto', valor: n(f[k]) })),
    ...eventos.filter(e => e.tipo === 'desconto' && !isPorFora(e)),
  ].filter(e => n(e.valor) > 0);
  const porFora = eventos.filter(isPorFora).filter(e => n(e.valor) > 0);
  const soma = (list, tipo) => list.filter(e => e.tipo === tipo).reduce((s, e) => s + n(e.valor), 0);
  return {
    emFolha,
    porFora,
    folhaProventos: soma(emFolha, 'provento'),
    folhaDescontos: soma(emFolha, 'desconto'),
    foraProventos: soma(porFora, 'provento'),
    foraDescontos: soma(porFora, 'desconto'),
  };
}

const linhas = (list) => list.map(e => `
  <tr>
    <td>${e.descricao}</td>
    <td class="r ${e.tipo === 'provento' ? 'g' : ''}">${e.tipo === 'provento' ? brl(e.valor) : ''}</td>
    <td class="r ${e.tipo === 'desconto' ? 'd' : ''}">${e.tipo === 'desconto' ? brl(e.valor) : ''}</td>
  </tr>`).join('');

export function imprimirFolha(f) {
  const b = montarBlocos(f);
  const liqFolha = b.folhaProventos - b.folhaDescontos;
  const liqFora = b.foraProventos - b.foraDescontos;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Folha ${f.funcionario_nome} — ${f.competencia}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
  h1{font-size:16px;margin:0 0 2px}
  h2{font-size:13px;margin:20px 0 6px;padding-bottom:3px;border-bottom:2px solid #111;text-transform:uppercase}
  .sub{color:#555;margin-bottom:8px}
  table{width:100%;border-collapse:collapse}
  th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}
  th{background:#f2f2f2;font-size:11px;text-transform:uppercase}
  .r{text-align:right;font-variant-numeric:tabular-nums}
  .g{color:#166534}.d{color:#b91c1c}
  tfoot td{font-weight:bold;border-top:2px solid #111;border-bottom:none}
  .liq{margin-top:8px;padding:8px;background:#f7f7f7;border:1px solid #ccc;font-weight:bold;display:flex;justify-content:space-between}
  .tag{font-size:10px;font-weight:bold;padding:2px 6px;border:1px solid #111;border-radius:10px}
  .sign{margin-top:36px;display:flex;gap:40px}
  .sign div{flex:1;border-top:1px solid #111;padding-top:4px;text-align:center;font-size:11px}
  @media print{body{margin:0}}
</style></head><body>
<h1>${f.funcionario_nome}</h1>
<p class="sub">Competência <b>${f.competencia}</b> · ${f.empresa || ''} · Tipo: ${f.tipo || 'mensal'}</p>

<h2>1. Folha de pagamento (registrada em folha) <span class="tag">EM FOLHA</span></h2>
<table><thead><tr><th>Descrição</th><th class="r">Provento</th><th class="r">Desconto</th></tr></thead>
<tbody>${linhas(b.emFolha)}</tbody>
<tfoot><tr><td>Totais</td><td class="r g">${brl(b.folhaProventos)}</td><td class="r d">${brl(b.folhaDescontos)}</td></tr></tfoot></table>
<div class="liq"><span>Líquido em folha</span><span>${brl(liqFolha)}</span></div>

<h2>2. Recibo por fora (fora da folha) <span class="tag">POR FORA</span></h2>
${b.porFora.length ? `<table><thead><tr><th>Descrição</th><th class="r">Provento</th><th class="r">Desconto</th></tr></thead>
<tbody>${linhas(b.porFora)}</tbody>
<tfoot><tr><td>Totais</td><td class="r g">${brl(b.foraProventos)}</td><td class="r d">${brl(b.foraDescontos)}</td></tr></tfoot></table>
<div class="liq"><span>Líquido por fora</span><span>${brl(liqFora)}</span></div>`
  : '<p class="sub">Nenhum valor por fora nesta competência.</p>'}

<div class="liq"><span>TOTAL GERAL RECEBIDO</span><span>${brl(liqFolha + liqFora)}</span></div>
<p class="sub">Pagamento: ${f.forma_pagamento || '—'} · Valor pago: ${brl(f.valor_pago)} · Data: ${f.data_pagamento || '—'}</p>

<div class="sign"><div>Assinatura do funcionário</div><div>Assinatura da empresa</div></div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}