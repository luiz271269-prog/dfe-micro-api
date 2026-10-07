import { useEffect, useRef, useState } from 'react';
import { conciliarCartoesDespesas } from '@/functions/conciliarCartoesDespesas';
export default function useConciliacaoComprasCartao(mes) {
  const mesAtual=useRef(mes);mesAtual.current=mes;
  const [resultado,setResultado]=useState(null),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[feedback,setFeedback]=useState(''),[cursor,setCursor]=useState(undefined);
  useEffect(()=>{setResultado(null);setErro('');setFeedback('');setCursor(undefined);},[mes]);
  async function executar(acao='analisar',extra={},pagina=cursor) {
    if(busy)return;
    setBusy(true);setErro('');setFeedback('');
    try {
      const res=await conciliarCartoesDespesas({mes,acao,cursor:pagina,...extra});
      const d=res.data;
      if(mesAtual.current!==mes)return;
      if(d.error)throw new Error(d.error);
      if(acao==='analisar'){setResultado(d);setCursor(pagina);}
      else {
        setFeedback(`${d.aplicados?.length||0} vínculo(s) salvo(s).`);
        if(d.erros?.length)setErro(d.erros.map(e=>e.error).join(' · '));
        const novo=await conciliarCartoesDespesas({mes,acao:'analisar',cursor:pagina});
        if(mesAtual.current===mes)setResultado(novo.data);
        window.dispatchEvent(new Event('neuralfinRefresh'));
      }
    }catch(e){setErro(e.response?.data?.error||e.message);}
    finally{setBusy(false);}
  }
  return {resultado,busy,erro,feedback,executar};
}