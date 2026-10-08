import { previsaoFixa } from './despesasFixasPrevisao.ts';
import { agregarCarteira, centavosCarteira, grupoCarteira } from './carteiraPagarFontes.ts';

export async function preverFixasCarteira(db, mes, empresa) {
  const [ano, numero] = mes.split('-').map(Number);
  const periodo = { $gte: `${mes}-01`, $lt: new Date(Date.UTC(ano, numero, 1)).toISOString().slice(0, 10) };
  const ativos = { is_ativa: true, ...empresa };
  const [ciclos, cadastros, documentos] = await Promise.all([
    agregarCarteira(db, 'RegraRecorrente', { query: ativos, groupBy: ['id', 'frequencia', 'dia_vencimento', 'mes_inicio'], sum: 'valor_esperado' }),
    agregarCarteira(db, 'RegraRecorrente', { query: ativos, groupBy: ['id', 'data_inicio', 'tipo_compra', 'origem_compra'] }),
    agregarCarteira(db, 'DespesaOperacional', { query: { ...empresa, recorrente: true, $or: [{ competencia: mes }, { data: periodo }, { ocorrencia_vencimento: periodo }] }, groupBy: ['regra_recorrente_id', 'ocorrencia_vencimento', 'data', 'observacoes'] }),
  ]);
  const porId = new Map(cadastros.map(r => [r.id, r]));
  const confirmados = new Map();
  for (const d of documentos) {
    const id = d.regra_recorrente_id || String(d.observacoes || '').match(/Regra recorrente ([^ ]+) ·/)?.[1];
    if (!id) continue;
    const datas = confirmados.get(id) || new Set();
    datas.add(d.ocorrencia_vencimento || d.data || `${mes}-01`);
    confirmados.set(id, datas);
  }
  const grupos = {}; let semCalendario = 0;
  for (const ciclo of ciclos) {
    const cadastro = porId.get(ciclo.id);
    if (!cadastro) throw new Error('Cadastro recorrente mudou durante o cálculo. Atualize a consulta.');
    const regra = { ...ciclo, ...cadastro, is_ativa: true };
    const frequencia = regra.frequencia || 'mensal';
    const valor = centavosCarteira(ciclo.sum_valor_esperado);
    if (valor <= 0) continue;
    const calendarioValido = frequencia === 'semanal' ? /^\d{4}-\d{2}-\d{2}$/.test(regra.data_inicio || '') : Number.isInteger(regra.dia_vencimento) && regra.dia_vencimento >= 1 && regra.dia_vencimento <= 31 && (frequencia === 'mensal' || /^\d{4}-(0[1-9]|1[0-2])$/.test(regra.mes_inicio || ''));
    if (!calendarioValido) { semCalendario += ciclo.count; continue; }
    const desde = regra.data_inicio > `${mes}-01` ? regra.data_inicio : `${mes}-01`;
    let data = previsaoFixa(regra, desde);
    const datas = confirmados.get(regra.id) || new Set();
    while (data?.slice(0, 7) === mes) {
      // Um documento pago ou pendente já materializa a ocorrência: não somar a previsão novamente.
      const realizado = frequencia === 'semanal' ? datas.has(data) : [...datas].some(d => d.slice(0, 7) === mes);
      if (!realizado) {
        const chave = grupoCarteira(regra, 'despesas');
        grupos[chave] = (grupos[chave] || 0) + valor;
      }
      data = previsaoFixa(regra, new Date(Date.parse(`${data}T12:00:00Z`) + 86400000).toISOString().slice(0, 10));
    }
  }
  return { grupos, semCalendario };
}