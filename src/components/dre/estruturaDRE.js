// Ordem de apresentação, sem valores ou regras de apuração. Cada visão projeta somente suas linhas.
const catalogo = [
 ['receita_bruta','Receita bruta de vendas e serviços','grupo'],['produtos','Vendas de produtos','detalhe'],['servicos','Serviços / Assistência','detalhe'],['locacoes','Locações','detalhe'],['entradas','Entradas de caixa','grupo'],['recebimentos','Recebimentos operacionais','detalhe'],
 ['deducoes','Deduções e custos da operação','grupo'],['tributos','Tributos','detalhe'],['das','Tributos sobre vendas · DAS'],['receita_liquida','Receita líquida','total'],['cmv','Custo das mercadorias vendidas (CMV)'],['comprasCartao','Pagamentos a fornecedores e de faturas'],['compras','Compras de fornecedores'],['estoque','Custos / estoque'],['fretes','Fretes'],['cartoes','Faturas de cartão'],['lucro_bruto','Lucro bruto','total'],
 ['total_despesas_operacionais','Despesas operacionais','grupo'],['folha','Folha de pagamento','detalhe'],['despesas','Despesas administrativas e operacionais','detalhe'],['outros_tributos','Outros tributos (exceto DAS)','detalhe'],['manutencao','Manutenção de obras e instalações','detalhe'],['prolabore','Pró-labore','detalhe'],['investimentos','Obras e investimentos','detalhe'],['lucro_operacional','Resultado operacional','total'],['saidas','Saídas de caixa','total'],['caixa_operacional','Caixa operacional líquido','total'],
 ['movimentos','Movimentos financeiros e de investimento','grupo'],['pessoal','Retiradas pessoais','detalhe'],['financeiro','Movimentos financeiros','detalhe'],['aplicacoes','Aplicações / resgates','detalhe'],['transferencias','Transferências fora do perímetro','detalhe'],['pendente','Não classificado (requer revisão)','detalhe'],['resultado_caixa','Resultado líquido de caixa no período','total'],['carteira','Total de contas a pagar','total']
];
export const estruturaDRE = catalogo.map(([key,label,kind='item'])=>({key,label,kind}));
export const porChaveDRE = Object.fromEntries(estruturaDRE.map(l=>[l.key,l]));
export const estiloDRE = {total:'border-t bg-primary/5 font-bold',grupo:'bg-muted/50 font-semibold',item:'bg-card',detalhe:'bg-card'};
export const projetarDRE = dados => estruturaDRE.filter(l=>Object.hasOwn(dados,l.key)).map(l=>({...l,...dados[l.key]}));
const tipos = {impostos:'tributos',pro_labore:'prolabore',obras:'investimentos',sem_classificacao:'pendente'};
const chaveTipo = tipo => tipos[tipo] || tipo;
export const nomeTipoDRE = (tipo,padrao) => porChaveDRE[chaveTipo(tipo)]?.label || padrao || tipo.replace(/_/g,' ');
export function ordenarTiposDRE(lista,tipo=x=>x){
 const pos=x=>{const i=estruturaDRE.findIndex(l=>l.key===chaveTipo(tipo(x)));return i<0?Infinity:i;};
 return [...lista].sort((a,b)=>pos(a)-pos(b)||tipo(a).localeCompare(tipo(b),'pt-BR'));
}