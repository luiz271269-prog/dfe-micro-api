import { CAMPOS_PROVENTO, CAMPOS_DESCONTO } from './folhaEventos';

const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const n = (v) => Number(v) || 0;
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const compExtenso = (c = '') => { const [a, m] = c.split('-'); return m ? `${MESES[parseInt(m, 10) - 1]} de ${a}` : c; };
const dataBR = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado';

// Um evento é "por fora" quando marcado com fora_folha ou quando a descrição diz "fora".
export const isPorFora = (e) => e.fora_folha === true || /fora/i.test(e.descricao || '');

const REFERENCIAS = { desconto_inss: 'Tabela Progressiva', desconto_irrf: 'Tabela Progressiva', desconto_vt: '6%', desconto_vr: '-' };

export function montarBlocos(f) {
  const eventos = f.eventos || [];
  const naFolha = (e) => !isPorFora(e);
  const vencimentos = [
    { descricao: 'Salário Base', referencia: '30 Dias', valor: n(f.salario_bruto) },
    ...CAMPOS_PROVENTO.map(([k, l]) => ({ descricao: l, referencia: '-', valor: n(f[k]) })),
    ...eventos.filter(e => e.tipo === 'provento' && naFolha(e)).map(e => ({ descricao: e.descricao, referencia: '-', valor: n(e.valor) })),
  ].filter(e => e.valor > 0);
  const descontos = [
    ...CAMPOS_DESCONTO.map(([k, l]) => ({ descricao: l, referencia: REFERENCIAS[k] || '-', valor: n(f[k]) })),
    ...eventos.filter(e => e.tipo === 'desconto' && naFolha(e)).map(e => ({ descricao: e.descricao, referencia: '-', valor: n(e.valor) })),
  ].filter(e => e.valor > 0);
  const foraProventos = eventos.filter(e => isPorFora(e) && e.tipo === 'provento').filter(e => n(e.valor) > 0);
  const foraDescontos = eventos.filter(e => isPorFora(e) && e.tipo === 'desconto').filter(e => n(e.valor) > 0);
  const soma = (l) => l.reduce((s, e) => s + n(e.valor), 0);
  const totalVenc = soma(vencimentos), totalDesc = soma(descontos);
  const totalForaV = soma(foraProventos), totalForaD = soma(foraDescontos);
  return {
    vencimentos, descontos, foraProventos, foraDescontos,
    totalVenc, totalDesc, liquido: totalVenc - totalDesc,
    totalForaV, totalForaD, liquidoFora: totalForaV - totalForaD,
  };
}

const tabela = (titulo, cor, list, totalLabel, total) => `
<div class="col">
  <h3 class="${cor}">${titulo}</h3>
  <table>
    <thead><tr><th class="cod">Cód.</th><th>Descrição</th><th>Referência</th><th class="r">Valor (R$)</th></tr></thead>
    <tbody>${list.length ? list.map((e, i) => `<tr><td class="cod">${String(i + 1).padStart(3, '0')}</td><td>${e.descricao}</td><td class="ref">${e.referencia || '-'}</td><td class="r ${cor}">${brl(e.valor)}</td></tr>`).join('')
      : '<tr><td colspan="4" class="ref">Nenhum lançamento</td></tr>'}</tbody>
    <tfoot><tr class="tot ${cor}-bg"><td colspan="3">${totalLabel}</td><td class="r">${brl(total)}</td></tr></tfoot>
  </table>
</div>`;

export function imprimirFolha(f, funcionario = null) {
  const b = montarBlocos(f);
  const fgts = b.totalVenc * 0.08;
  const prov13 = b.totalVenc / 12;
  const provFer = b.totalVenc / 12;
  const provTerco = provFer / 3;
  const temFora = b.foraProventos.length || b.foraDescontos.length;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Recibo ${f.funcionario_nome} — ${f.competencia}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:24px;font-size:11px}
  .page{max-width:800px;margin:0 auto}
  .empresa{text-align:center;border-bottom:1px solid #d1d5db;padding-bottom:10px}
  .empresa h1{font-size:19px;margin:0;letter-spacing:.5px}
  .empresa p{margin:2px 0 0;color:#6b7280;font-size:11px}
  .titulo{text-align:center;margin:16px 0}
  .titulo h2{font-size:15px;margin:0;text-transform:uppercase}
  .titulo p{margin:3px 0 0;color:#4b5563;font-size:12px}
  .box{background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;margin-bottom:14px}
  .box h4{margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#374151}
  .grid4{display:flex;flex-wrap:wrap}
  .grid4 div{width:25%;margin-bottom:6px}
  .lbl{color:#6b7280;font-size:10px}
  .val{font-weight:bold}
  .cols{display:flex;gap:14px;margin-bottom:14px}
  .col{flex:1}
  h3{font-size:12px;text-transform:uppercase;margin:0 0 6px;padding-bottom:3px;border-bottom:2px solid currentColor}
  .g{color:#15803d}.d{color:#b91c1c}
  .g-bg{background:#f0fdf4}.d-bg{background:#fef2f2}
  table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden}
  th,td{padding:5px 7px;text-align:left;border-bottom:1px solid #f1f5f9}
  th{background:#f8fafc;font-size:9px;text-transform:uppercase;color:#6b7280}
  .cod{width:34px;color:#6b7280}
  .ref{color:#6b7280}
  .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .tot td{font-weight:bold;border-bottom:none;border-top:1px solid #e5e7eb}
  .resumo{display:flex;justify-content:space-between;padding:2px 0;color:#4b5563}
  .liq{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #d1d5db;margin-top:6px;padding-top:6px;font-size:14px;font-weight:bold}
  .liq span:last-child{color:#1d4ed8}
  .prov{display:flex;text-align:center}
  .prov div{flex:1}
  .rodape{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #d1d5db;margin-top:26px;padding-top:8px;color:#6b7280}
  .assin{border-top:1px solid #374151;padding-top:4px;width:250px;text-align:center}
  .tag{display:inline-block;font-size:9px;font-weight:bold;border:1px solid currentColor;border-radius:10px;padding:1px 7px;vertical-align:middle}
  .quebra{page-break-before:always}
  @media print{body{padding:0}}
</style></head><body>

<div class="page">
  <div class="empresa"><h1>${f.empresa || 'FINANCEIRO PRO'}</h1><p>Gestão e Fluxos ADM e Financeiro</p></div>
  <div class="titulo"><h2>Recibo de Pagamento de Salário</h2><p>Competência: ${compExtenso(f.competencia)}</p></div>

  <div class="box"><h4>Dados do Funcionário</h4>
    <div class="grid4">
      <div><div class="lbl">Nome:</div><div class="val">${f.funcionario_nome}</div></div>
      <div><div class="lbl">Cargo:</div><div class="val">${funcionario?.cargo || 'Não informado'}</div></div>
      <div><div class="lbl">Setor:</div><div class="val">${funcionario?.setor || 'Não informado'}</div></div>
      <div><div class="lbl">Contrato:</div><div class="val">${funcionario?.tipo_contrato || 'Não informado'}</div></div>
      <div><div class="lbl">CPF:</div><div class="val">${funcionario?.cpf || 'Não informado'}</div></div>
      <div><div class="lbl">Admissão:</div><div class="val">${dataBR(funcionario?.data_admissao)}</div></div>
      <div><div class="lbl">Salário Base:</div><div class="val">${brl(f.salario_bruto)}</div></div>
      <div><div class="lbl">Tipo de Folha:</div><div class="val">${f.tipo || 'mensal'}</div></div>
    </div>
  </div>

  <div class="cols">
    ${tabela('Vencimentos', 'g', b.vencimentos, 'Total de Vencimentos', b.totalVenc)}
    ${tabela('Descontos', 'd', b.descontos, 'Total de Descontos', b.totalDesc)}
  </div>

  <div class="cols">
    <div class="col box"><h4>Bases de Cálculo</h4>
      <div class="resumo"><span>Base INSS:</span><b>${brl(b.totalVenc)}</b></div>
      <div class="resumo"><span>Base FGTS:</span><b>${brl(b.totalVenc)}</b></div>
      <div class="resumo"><span>Base Férias/13º:</span><b>${brl(b.totalVenc)}</b></div>
    </div>
    <div class="col box"><h4>Resumo do Holerite</h4>
      <div class="resumo"><span>Total de Proventos:</span><b class="g">${brl(b.totalVenc)}</b></div>
      <div class="resumo"><span>Total de Descontos:</span><b class="d">${brl(b.totalDesc)}</b></div>
      <div class="liq"><span>Salário Líquido:</span><span>${brl(b.liquido)}</span></div>
    </div>
  </div>

  <div class="box"><h4>Provisões da Empresa (Informativo)</h4>
    <div class="prov">
      <div><div class="lbl">FGTS do Mês</div><div class="val">${brl(fgts)}</div></div>
      <div><div class="lbl">Provisão de 13º (1/12)</div><div class="val">${brl(prov13)}</div></div>
      <div><div class="lbl">Provisão de Férias (1/12)</div><div class="val">${brl(provFer)}</div></div>
      <div><div class="lbl">Provisão de 1/3 Férias</div><div class="val">${brl(provTerco)}</div></div>
    </div>
  </div>

  <div class="rodape">
    <div>Recibo gerado em: ${new Date().toLocaleString('pt-BR')}<br>Pagamento: ${f.forma_pagamento || '—'} · Valor pago: ${brl(f.valor_pago)}</div>
    <div class="assin">Assinatura do Funcionário</div>
  </div>
</div>

${temFora ? `
<div class="page quebra">
  <div class="empresa"><h1>${f.empresa || 'FINANCEIRO PRO'}</h1><p>Gestão e Fluxos ADM e Financeiro</p></div>
  <div class="titulo"><h2>Recibo Complementar <span class="tag d">POR FORA</span></h2><p>Competência: ${compExtenso(f.competencia)} · ${f.funcionario_nome}</p></div>
  <p class="ref">Valores pagos fora da folha registrada — não integram o holerite oficial, bases de cálculo ou provisões.</p>
  <div class="cols">
    ${tabela('Valores Recebidos', 'g', b.foraProventos, 'Total Recebido', b.totalForaV)}
    ${tabela('Descontos', 'd', b.foraDescontos, 'Total de Descontos', b.totalForaD)}
  </div>
  <div class="box">
    <div class="liq"><span>Líquido por fora:</span><span>${brl(b.liquidoFora)}</span></div>
    <div class="liq"><span>Total geral (folha + por fora):</span><span>${brl(b.liquido + b.liquidoFora)}</span></div>
  </div>
  <div class="rodape">
    <div>Recibo gerado em: ${new Date().toLocaleString('pt-BR')}</div>
    <div class="assin">Assinatura do Funcionário</div>
  </div>
</div>` : ''}

<script>window.onload=()=>window.print()</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=880,height=940');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}