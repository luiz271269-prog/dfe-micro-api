export async function lerCompleto(db, entidade, query, fields) {
  const out = []; let cursor;
  for (let p = 0; p < 10; p++) {
    const page = await db[entidade].filter(query, { sort: 'id', limit: 500, cursor, ...(fields ? { fields } : {}) });
    if (!Array.isArray(page.items)) throw new Error(`Leitura paginada inválida: ${entidade}`);
    out.push(...page.items);
    if (!page.has_more) return out;
    if (!page.next_cursor || page.next_cursor === cursor) throw new Error(`Paginação incompleta: ${entidade}`);
    cursor = page.next_cursor;
  }
  throw new Error(`Volume excede o limite seguro em ${entidade}. Nenhuma conciliação foi iniciada.`);
}
export const vazio = campo => ({ $or: [{ [campo]: { $exists: false } }, { [campo]: null }, { [campo]: '' }] });
export const centavos = v => Math.round(Number(v || 0) * 100);
export const normConciliacao = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const dataMaisDias = (data, dias) => new Date(Date.parse(`${data.slice(0, 10)}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);