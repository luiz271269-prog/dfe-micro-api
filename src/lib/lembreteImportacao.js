function dataBrasilia(data){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(data);return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
export const hojeImportacao=()=>dataBrasilia(new Date());
export function avancarLembrete(data,frequencia){
 const d=new Date(`${data}T12:00:00Z`);
 if(frequencia==='mensal'){const dia=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const ultimo=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(dia,ultimo));}
 else d.setUTCDate(d.getUTCDate()+(frequencia==='diaria'?1:7));
 return d.toISOString().slice(0,10);
}
export function proximoLembrete(config,ultimo){
 const ultimaData=ultimo?.created_date ? dataBrasilia(new Date(ultimo.created_date)) : '';
 return ultimaData>=config.primeira_data ? avancarLembrete(ultimaData,config.frequencia) : config.primeira_data;
}