import { useState,useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { processDocument } from '@/functions/processDocument';
export default function useArquivoIdentificacao(){
 const [identificacao,setIdentificacao]=useState(null),[identificando,setIdentificando]=useState(false),versao=useRef(0);
 async function identificar(file){const v=++versao.current;setIdentificacao(null);setIdentificando(true);let file_uri;try{
  if(file.size>25*1024*1024)throw new Error('Limite de 25 MB por arquivo.');
  ({file_uri}=await base44.integrations.Core.UploadPrivateFile({file}));
  const {signed_url}=await base44.integrations.Core.CreateFileSignedUrl({file_uri,expires_in:3600});
  const r=await processDocument({acao:'identificar',fileUrl:signed_url,fileName:file.name,fileSize:file.size});
  if(!r.data?.success)throw new Error(r.data?.error || 'Não foi possível identificar o documento.');
  if(v!==versao.current)return null;
  setIdentificacao(r.data.identificacao);return {uri:file_uri,url:signed_url,identificacao:r.data.identificacao};
 }catch(e){e.file_uri=file_uri;throw e;} // o original já enviado continua disponível para ser guardado
 finally{if(v===versao.current)setIdentificando(false);}}
 function limpar(){versao.current++;setIdentificacao(null);setIdentificando(false);}
 return {identificacao,identificando,identificar,limpar};
}