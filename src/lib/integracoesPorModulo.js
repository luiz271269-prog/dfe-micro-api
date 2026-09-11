const TIPOS_POR_MODULO = {
  faturamento: ['contrato_locacao', 'contrato_assistencia', 'ordem_servico'],
  cobrancas: ['recebimento_aluguel', 'recebimento_servico'],
  contasPagar: ['despesa_condominio'],
  comprasDespesas: ['despesa_condominio'],
};

const STATUS_LIQUIDADOS = ['pago', 'paga', 'liquidado', 'liquidada', 'cancelado', 'cancelada'];

export function filtrarIntegradosModulo(registros, modulo) {
  const tipos = TIPOS_POR_MODULO[modulo] || [];
  return registros.filter((item) => {
    if (!tipos.includes(item.tipo_registro)) return false;
    if (modulo !== 'contasPagar') return true;
    return !STATUS_LIQUIDADOS.includes(String(item.status || '').toLowerCase());
  });
}