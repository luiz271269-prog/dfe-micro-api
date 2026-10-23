import { useRef,useState,useEffect } from 'react';
import { chamarBaixas } from '@/components/baixas/baixasService';
const inicial={tipo:'DespesaOperacional',mes:'',empresa:'todas',estado:'todos',canal:'todos',busca:''};
export default function useBaixas() {
  const [filtros,setFiltros]=useState(inicial),[items,setItems]=useState([]),[pagina,setPagina]=useState({}),[detalhe,setDetalhe]=useState(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState(''),[confirmacao,setConfirmacao]=useState(null);
  const aplicados=useRef(inicial),seq=useRef(0),seqDetalhe=useRef(0);
  async function consultar(mais=false,f=aplicados.current){const n=++seq.current;setLoading(true);setErro('');try{const p=await chamarBaixas({acao:'listar',...f,cursor:mais?pagina.next_cursor:undefined});if(n!==seq.current)return;setItems(prev=>mais?[...prev,...p.items]:p.items);setPagina(p);aplicados.current=f;}catch(e){setErro(e.response?.data?.error||e.message);}finally{if(n===seq.current)setLoading(false);}}
  async function selecionar(r){const n=++seqDetalhe.current;setDetalhe(null);setErro('');try{const p=await chamarBaixas({acao:'detalhe',tipo:r.tipo,id:r.id});if(n===seqDetalhe.current)setDetalhe(p);}catch(e){setErro(e.response?.data?.error||e.message);}}
  function solicitar(payload,resumo){setConfirmacao({payload:{...payload,pedidoId:crypto.randomUUID(),tipo:detalhe.registro.tipo,id:detalhe.registro.id,versao:detalhe.registro.versao},resumo});setErro('');setSucesso('');}
  async function executar(){if(busy||!confirmacao)return;setBusy(true);setErro('');try{await chamarBaixas(confirmacao.payload);const {tipo,id}=confirmacao.payload;setConfirmacao(null);setSucesso('Operação registrada. A origem e o histórico foram atualizados.');window.dispatchEvent(new Event('neuralfinRefresh'));await Promise.all([consultar(false),selecionar({tipo,id})]);}catch(e){setErro(e.response?.data?.error||e.message);}finally{setBusy(false);}}
  useEffect(()=>{consultar(false,inicial);return()=>{seq.current++;seqDetalhe.current++;};},[]);
  return {filtros,setFiltros,items,pagina,detalhe,loading,busy,erro,sucesso,confirmacao,setConfirmacao,consultar,selecionar,solicitar,executar,aplicar:()=>{seqDetalhe.current++;setDetalhe(null);consultar(false,filtros);}};
}