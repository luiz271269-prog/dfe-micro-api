import { validateExtratoRecords } from '@/lib/extratoValidation';
export default function validarLeituraImportacao(tipo,records){
 const dados=records.map(r=>r.data);
 if(tipo==='extrato_bancario'&&!validateExtratoRecords(dados,new Date().toISOString().slice(0,10)).ok)return 'A sequência de saldos não bate. Corrija a leitura antes de aplicar.';
 if(tipo==='fatura_cartao'){const fat=dados.find(r=>r.__type==='FaturaCartao');const soma=dados.filter(r=>r.__type==='LancamentoCartao').reduce((s,r)=>s+Number(r.valor || 0),0);if(!fat || Math.abs(soma-Number(fat.valor_total || 0))>0.02)return 'A soma dos lançamentos não bate com o total da fatura. Corrija a leitura antes de aplicar.';}
 return null;
}