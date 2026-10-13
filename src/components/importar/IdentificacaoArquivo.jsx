import PapelArquivo from '@/components/importar/PapelArquivo';
export default function IdentificacaoArquivo({identificando,identificacao,tipo,tipos}){
 if(identificando)return <div role="status" className="my-3 rounded-lg border bg-card p-3 text-sm">Primeira regra: identificando o tipo pelo conteúdo do arquivo…</div>;
 if(!identificacao)return null;
 const detectado=tipos.find(t=>t.id===identificacao.tipo);
 return <section className="my-3 space-y-2 rounded-lg border bg-card p-3 text-sm"><strong>Tipo identificado: {detectado?.label || 'Não identificado com segurança'}</strong><p className="text-xs text-muted-foreground">{identificacao.motivo}</p>{identificacao.evidencia&&<blockquote className="border-l-2 pl-2 text-xs">{identificacao.evidencia}</blockquote>}{!identificacao.seguro&&<p className="text-warning">Confira o conteúdo e selecione o tipo manualmente antes de extrair.</p>}{tipo&&tipo!==identificacao.tipo&&<p className="text-warning">Tipo confirmado manualmente: {tipos.find(t=>t.id===tipo)?.label}. A identificação original fica registrada.</p>}<PapelArquivo tipo={tipo} /></section>;
}