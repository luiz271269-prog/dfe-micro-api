export function previsaoFixa(r,desde) {
  if(!r.is_ativa)return null;
  const inicio=new Date(`${desde}T12:00:00Z`);
  if(r.frequencia==='semanal'){
    if(!r.data_inicio)return null;
    const d=new Date(`${r.data_inicio}T12:00:00Z`),n=Math.max(0,Math.ceil((inicio-d)/604800000));
    return new Date(d.getTime()+n*604800000).toISOString().slice(0,10);
  }
  if(!(r.dia_vencimento>0))return null;
  const intervalo={mensal:1,trimestral:3,anual:12}[r.frequencia||'mensal'];
  if(!intervalo||intervalo>1&&!r.mes_inicio)return null;
  const [a,m]=(r.mes_inicio||desde.slice(0,7)).split('-').map(Number);
  for(let i=0;i<120;i++){
    const d=new Date(Date.UTC(inicio.getUTCFullYear(),inicio.getUTCMonth()+i,1,12)),dist=(d.getUTCFullYear()-a)*12+d.getUTCMonth()+1-m;
    d.setUTCDate(Math.min(r.dia_vencimento,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));
    if(dist>=0&&dist%intervalo===0&&d>=inicio)return d.toISOString().slice(0,10);
  }
  return null;
}
export function totaisPrevisoes(grupos,ano) {
  const totais={};
  for(let i=-12;i<24;i++){
    const mes=new Date(Date.UTC(ano,i,1)).toISOString().slice(0,7);let total=0;
    for(const g of grupos){let data=previsaoFixa({...g,is_ativa:true},`${mes}-01`);
      while(data?.slice(0,7)===mes){total+=Number(g.sum_valor_esperado)||0;data=previsaoFixa({...g,is_ativa:true},new Date(Date.parse(`${data}T12:00:00Z`)+86400000).toISOString().slice(0,10));}
    }
    totais[mes]=Math.round(total*100)/100;
  }
  return totais;
}