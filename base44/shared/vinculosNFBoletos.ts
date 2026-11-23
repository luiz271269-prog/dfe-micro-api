import { centavos } from './recebimentosExtrato.ts';

// Auditoria de vínculos NF de venda × boletos.
// Exclui NFs não comerciais (transporte, devolução, retorno, troca, remessa para garantia, etc.)
// com base na natureza de operação do XML (NFeRecebida) ou na referência do boleto.

const NAO_COMERCIAL = /transporte|devolu[cç][aã]o|retorno|troca|remessa|garantia|conserto|comodato|doa[cç][aã]o|amosta|bonifica|presta[cç][aã]o de servi[cç]o|mudan[ç]a|simples remessa|exporta[cç][aã]o|importa[cç][aã]o/i;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = c => brl.format(c / 100);

// Extrai o número da NF a partir do campo seu_numero do boleto.
// Padrões: "NF-180", "DOC180", "NF-119-p3", "DOC107", "100120-2", "FAT.OS: 04"
export function extrairNumeroNF(seu_numero: string): string | null {
  if (!seu_numero) return null;
  const s = String(seu_numero).trim();
  // Padrão NF-XXX ou DOCXXX (com possível sufixo -pN)
  let m = s.match(/^(?:NF|DOC)[-\s]?(\d+)(?:[-/]p?\d+)?$/i);
  if (m) return m[1];
  // Padrão número puro com possível dígito: "100120-2"
  m = s.match(/^(\d+)(?:-\d+)?$/);
  if (m) return m[1];
  // "FAT.OS: NN" é referência de ordem de serviço, não de NF — ignorar
  if (/FAT\.OS/i.test(s)) return null;
  return null;
}

export function ehNaoComercial(natureza: string): boolean {
  if (!natureza) return false;
  return NAO_COMERCIAL.test(natureza);
}

export interface AchadoVinculo {
  chave: string;
  categoria: string;
  nota: any;
  boletos: any[];
  soma_parcelas: number;
  boleto?: any;
  candidatos?: any[];
  motivo?: string;
}

export function auditarVinculos(
  notas: any[],
  boletos: any[],
  naturezas: Map<string, string>,
): { resumo: any; achados: AchadoVinculo[] } {
  const boletosPorNF = new Map<string, any[]>();
  for (const b of boletos) {
    const key = b.nota_fiscal_id || '';
    if (!key) continue;
    const arr = boletosPorNF.get(key) || [];
    arr.push(b);
    boletosPorNF.set(key, arr);
  }

  // Índice de notas por número (normalizado sem zeros à esquerda) para busca de candidatos
  const normNum = (s: string) => String(s || '').replace(/^0+/, '') || '0';
  const notasPorNumero = new Map<string, any[]>();
  const notasPorNumeroNorm = new Map<string, any[]>();
  for (const n of notas) {
    if (!n.numero) continue;
    const arr = notasPorNumero.get(n.numero) || [];
    arr.push(n);
    notasPorNumero.set(n.numero, arr);
    const nk = normNum(n.numero);
    const arrN = notasPorNumeroNorm.get(nk) || [];
    arrN.push(n);
    notasPorNumeroNorm.set(nk, arrN);
  }

  const achados: AchadoVinculo[] = [];
  const por_categoria: Record<string, number> = {};

  for (const nf of notas) {
    const natureza = nf.id ? (naturezas.get(nf.id) || '') : '';
    const cfop = ''; // CFOP viria do XML; natureza já é suficiente para classificar
    const boletosNF = boletosPorNF.get(nf.id) || [];
    const soma = boletosNF.reduce((acc, b) => acc + centavos(b.valor_titulo || 0), 0) / 100;
    const total = nf.valor_total || 0;
    const somaCents = centavos(soma);
    const totalCents = centavos(total);

    // 1. Fora do escopo: natureza não comercial
    if (ehNaoComercial(natureza)) {
      const a: AchadoVinculo = {
        chave: `fora_escopo:${nf.id}`,
        categoria: 'fora_escopo',
        nota: { ...nf, natureza_operacao: natureza, cfop },
        boletos: boletosNF.map(resumirBoleto),
        soma_parcelas: soma,
        motivo: `Natureza "${natureza}" indica operação não comercial (transporte, devolução, etc.). Excluída da auditoria de vendas.`,
      };
      achados.push(a);
      por_categoria.fora_escopo = (por_categoria.fora_escopo || 0) + 1;
      continue;
    }

    // 2. Sem CFOP: não há natureza para classificar
    const temBoletos = boletosNF.length > 0;
    if (!natureza && !temBoletos) {
      const a: AchadoVinculo = {
        chave: `sem_cfop:${nf.id}`,
        categoria: 'sem_cfop',
        nota: { ...nf, natureza_operacao: null, cfop: null },
        boletos: [],
        soma_parcelas: 0,
        motivo: 'Sem natureza de operação no XML e sem boletos vinculados. Não é possível classificar como venda.',
      };
      achados.push(a);
      por_categoria.sem_cfop = (por_categoria.sem_cfop || 0) + 1;
      continue;
    }

    // 3. Detectar boletos com vínculo errado (referência aponta para outra NF)
    const boletosErrados: any[] = [];
    for (const b of boletosNF) {
      const numRef = extrairNumeroNF(b.seu_numero || '');
      if (numRef && normNum(numRef) !== normNum(String(nf.numero))) {
        // A referência do boleto aponta para outra NF (compara normalizado)
        const candidatos = ((notasPorNumero.get(numRef) || notasPorNumeroNorm.get(normNum(numRef)) || [])
          .filter(c => c.id !== nf.id))
          .map(c => ({
            nota_id: c.id,
            numero: c.numero,
            cliente: c.cliente,
            valor_total: c.valor_total,
            confianca: centavos(c.valor_total) === centavos(b.valor_titulo) ? 95 : 60,
            motivo: `Referência ${b.seu_numero} indica NF ${numRef}${centavos(c.valor_total) === centavos(b.valor_titulo) ? ' e valor é idêntico' : ''}`,
          }));
        boletosErrados.push({ boleto: b, candidatos });
      }
    }

    if (boletosErrados.length > 0) {
      for (const { boleto, candidatos } of boletosErrados) {
        const categoria = candidatos.length === 1 ? 'vinculo_errado' : candidatos.length > 1 ? 'ambiguo' : 'vinculo_errado';
        const a: AchadoVinculo = {
          chave: `${categoria}:${boleto.id}`,
          categoria,
          nota: { ...nf, natureza_operacao: natureza, cfop },
          boletos: boletosNF.map(resumirBoleto),
          soma_parcelas: soma,
          boleto: resumirBoleto(boleto),
          candidatos: candidatos.length ? candidatos : [{
            nota_id: null,
            numero: extrairNumeroNF(boleto.seu_numero || '') || '?',
            cliente: '(NF não encontrada)',
            valor_total: boleto.valor_titulo,
            confianca: 30,
            motivo: `Referência ${boleto.seu_numero} não corresponde a nenhuma NF cadastrada`,
          }],
          motivo: `Boleto ${boleto.nosso_numero} tem referência "${boleto.seu_numero}" que indica NF ${extrairNumeroNF(boleto.seu_numero || '')}, mas está vinculado à NF ${nf.numero}.`,
        };
        achados.push(a);
        por_categoria[categoria] = (por_categoria[categoria] || 0) + 1;
      }
      // Se também há divergência de total, registrar separadamente
      if (somaCents !== totalCents && temBoletos) {
        const a: AchadoVinculo = {
          chave: `divergencia_total:${nf.id}`,
          categoria: 'divergencia_total',
          nota: { ...nf, natureza_operacao: natureza, cfop },
          boletos: boletosNF.map(resumirBoleto),
          soma_parcelas: soma,
          motivo: `Soma das parcelas (${dinheiro(somaCents)}) não fecha com o total da NF (${dinheiro(totalCents)}).`,
        };
        achados.push(a);
        por_categoria.divergencia_total = (por_categoria.divergencia_total || 0) + 1;
      }
      continue;
    }

    // 4. Sem parcelas
    if (!temBoletos) {
      const a: AchadoVinculo = {
        chave: `sem_parcela:${nf.id}`,
        categoria: 'sem_parcela',
        nota: { ...nf, natureza_operacao: natureza, cfop },
        boletos: [],
        soma_parcelas: 0,
        motivo: 'Nota sem parcelas vinculadas. Verifique se há boleto vinculado incorretamente a outra NF.',
      };
      achados.push(a);
      por_categoria.sem_parcela = (por_categoria.sem_parcela || 0) + 1;
      continue;
    }

    // 5. Divergência de total
    if (somaCents !== totalCents) {
      const a: AchadoVinculo = {
        chave: `divergencia_total:${nf.id}`,
        categoria: 'divergencia_total',
        nota: { ...nf, natureza_operacao: natureza, cfop },
        boletos: boletosNF.map(resumirBoleto),
        soma_parcelas: soma,
        motivo: `Soma das parcelas (${dinheiro(somaCents)}) não fecha com o total da NF (${dinheiro(totalCents)}).`,
      };
      achados.push(a);
      por_categoria.divergencia_total = (por_categoria.divergencia_total || 0) + 1;
      continue;
    }

    // 6. OK
    const a: AchadoVinculo = {
      chave: `ok:${nf.id}`,
      categoria: 'ok',
      nota: { ...nf, natureza_operacao: natureza, cfop },
      boletos: boletosNF.map(resumirBoleto),
      soma_parcelas: soma,
      motivo: 'Total e vínculos conferem.',
    };
    achados.push(a);
    por_categoria.ok = (por_categoria.ok || 0) + 1;
  }

  return {
    resumo: {
      total_notas: notas.length,
      total_boletos: boletos.length,
      por_categoria,
    },
    achados,
  };
}

function resumirBoleto(b: any): any {
  return {
    id: b.id,
    nosso_numero: b.nosso_numero,
    seu_numero: b.seu_numero,
    valor_titulo: b.valor_titulo,
    valor_pago: b.valor_pago,
    data_vencimento: b.data_vencimento,
    status: b.status,
    liquidado: !!b.lancamento_bancario_id,
  };
}

// Carrega naturezas de operação do XML (NFeRecebida) cruzando por número da nota.
export async function carregarNaturezas(db: any, numerosNotas: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!numerosNotas.length) return mapa;
  // Busca NFeRecebida por numero_nota
  const lote = (items: string[]) => db.NFeRecebida.filter({ numero_nota: { $in: items } }, { limit: 500 });
  for (let i = 0; i < numerosNotas.length; i += 200) {
    const chunk = numerosNotas.slice(i, i + 200);
    const { items } = await lote(chunk);
    for (const nfe of items) {
      if (nfe.natureza_operacao) mapa.set(nfe.numero_nota, nfe.natureza_operacao);
    }
  }
  return mapa;
}