// Calendário bancário brasileiro: seg–sex, feriados nacionais e dias sem expediente bancário.
const fixos = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];
function feriados(ano) {
  const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const n=h+l-7*m+114, pascoa=new Date(Date.UTC(ano,Math.floor(n/31)-1,n%31+1));
  return new Set([...fixos.map(v=>`${ano}-${v}`), ...[-48,-47,-2,60].map(delta=>new Date(pascoa.getTime()+delta*86400000).toISOString().slice(0,10))]);
}
export function periodoPagamentoFolha(competencia) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia || '')) return null;
  const [ano,mes]=competencia.split('-').map(Number), data=new Date(Date.UTC(ano,mes,1));
  const bloqueados=feriados(data.getUTCFullYear()), mesPagamento=data.toISOString().slice(0,7);
  let uteis=0, inicio, fim;
  while (uteis<7) {
    const dia=data.toISOString().slice(0,10), semana=data.getUTCDay();
    if (semana!==0 && semana!==6 && !bloqueados.has(dia)) {
      uteis++; if (uteis===5) inicio=dia; if (uteis===7) fim=dia;
    }
    data.setUTCDate(data.getUTCDate()+1);
  }
  return { competencia, mes_pagamento:mesPagamento, inicio, fim, calendario:'bancario_nacional', feriados_locais_incluidos:false };
}
export function vencimentoFolha(folha) {
  return (folha.tipo || 'mensal') === 'mensal' ? periodoPagamentoFolha(folha.competencia)?.fim || null : folha.data_pagamento || null;
}
export function dataNoMesPagamento(folha, data) {
  if ((folha.tipo || 'mensal') !== 'mensal') return true;
  const periodo=periodoPagamentoFolha(folha.competencia);
  return !!periodo && data?.slice(0,7) === periodo.mes_pagamento;
}