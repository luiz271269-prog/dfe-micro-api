import { base44 } from '@/api/base44Client';
import { extrairTermoChave } from '@/lib/autoCategorizacao';

// Aplica as regras de categorização aprendidas (RegraCategorizacao) a um lote de
// registros recém-extraídos, ANTES de depender da IA para a categoria.
// Tudo que o histórico já conhece é resolvido localmente — economiza IA.
//
// escopo: 'extrato' (LancamentoBancario) ou 'cartao' (LancamentoCartao)
// records: array de { data: {...} } (formato da tela de importação) ou objetos crus.
// Retorna { records, aplicados, totalComCategoria }.
export async function aplicarRegrasHistorico({ escopo, records }) {
  if (!records?.length) return { records, aplicados: 0, totalComCategoria: 0 };

  // Carrega todas as regras do escopo uma única vez e indexa por termo.
  const regras = await base44.entities.RegraCategorizacao.filter({ escopo }).catch(() => []);
  const mapa = new Map();
  for (const r of regras) {
    if (r.termo_chave) mapa.set(r.termo_chave, r.categoria);
  }
  if (mapa.size === 0) return { records, aplicados: 0, totalComCategoria: 0 };

  const campoDesc = escopo === 'cartao' ? 'estabelecimento' : 'descricao';
  let aplicados = 0;
  let totalComCategoria = 0;

  const out = records.map(rec => {
    const data = rec?.data ? rec.data : rec;
    const desc = data?.[campoDesc];
    const jaTem = data?.categoria && String(data.categoria).trim() !== '';
    if (jaTem) totalComCategoria++;

    const termo = extrairTermoChave(desc);
    const categoria = termo ? mapa.get(termo) : null;

    if (categoria && categoria !== data.categoria) {
      aplicados++;
      const novoData = { ...data, categoria, _categoriaPorHistorico: true };
      return rec?.data ? { ...rec, data: novoData } : novoData;
    }
    return rec;
  });

  return { records: out, aplicados, totalComCategoria: totalComCategoria + aplicados };
}