export function validateExtratoRecords(records, referenceDate) {
  const future = records.filter((r) => r.data && r.data > referenceDate);
  const accepted = records.filter((r) => !r.data || r.data <= referenceDate);
  const dailyMap = new Map();
  const sequenceErrors = [];

  accepted.forEach((record, index) => {
    const day = dailyMap.get(record.data) || { data: record.data, entradas: 0, saidas: 0, quantidade: 0 };
    const value = Number(record.valor || 0);
    if (value >= 0) day.entradas += value;
    else day.saidas += Math.abs(value);
    day.quantidade += 1;
    dailyMap.set(record.data, day);

    if (index === 0 || record.saldo_apos == null || accepted[index - 1].saldo_apos == null) return;
    const expected = Number(accepted[index - 1].saldo_apos) + value;
    if (Math.abs(expected - Number(record.saldo_apos)) > 0.02) {
      sequenceErrors.push({ data: record.data, esperado: expected, informado: Number(record.saldo_apos) });
    }
  });

  const daily = [...dailyMap.values()].map((day) => ({
    ...day,
    entradas: Math.round(day.entradas * 100) / 100,
    saidas: Math.round(day.saidas * 100) / 100,
    liquido: Math.round((day.entradas - day.saidas) * 100) / 100,
  }));

  return { records: accepted, daily, future, sequenceErrors, ok: sequenceErrors.length === 0 };
}