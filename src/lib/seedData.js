import { base44 } from '@/api/base44Client';

const SEED_CARTOES = [
  { nome: 'Acentra — Luiz Carlos', bandeira: 'Acentra', titular: 'Luiz Carlos', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'conta pessoal LC', is_ativo: true },
  { nome: 'Sicoob — Luiz Carlos', bandeira: 'Sicoob', titular: 'Luiz Carlos', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'conta pessoal LC', is_ativo: true },
  { nome: 'Acentra — KLI', bandeira: 'Acentra', titular: 'KLI Tecnologia', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'KLI Tecnologia', conta_bancaria_pagamento: 'conta KLI', is_ativo: true },
  { nome: 'Acentra — Liesch', bandeira: 'Acentra', titular: 'Liesch Informática', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'Liesch Informática', conta_bancaria_pagamento: 'Sicredi 37101-4', is_ativo: true },
  { nome: 'Sicoob — KLI', bandeira: 'Sicoob', titular: 'KLI Tecnologia', tipo: 'empresarial', dia_vencimento: 22, empresa_vinculada: 'KLI Tecnologia', conta_bancaria_pagamento: 'conta KLI', is_ativo: true },
  { nome: 'Sicredi — NeuralTec', bandeira: 'Sicredi', titular: 'NeuralTec Dist. Tecnologia Ltda', tipo: 'empresarial', dia_vencimento: 25, empresa_vinculada: 'NeuralTec', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true },
  { nome: 'Magalu / LuizaCred', bandeira: 'Magalu', titular: 'pessoal', tipo: 'pessoal', dia_vencimento: 27, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true },
];

const SEED_OBRAS = [
  { data: '2026-03-19', descricao: 'Reforma da loja — mão de obra', responsavel: 'Jhonatan da Rocha Vitu', tipo: 'mao_obra', local_obra: 'loja', valor: 9500.00, forma_pagamento: 'PIX' },
  { data: '2026-01-08', descricao: 'Materiais construção jan', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2798405', valor: 32.20 },
  { data: '2026-01-19', descricao: 'Materiais construção jan', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2811855', valor: 19.89 },
  { data: '2026-02-04', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2835558', valor: 498.24 },
  { data: '2026-02-06', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2835518', valor: 250.00 },
  { data: '2026-02-10', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2843008', valor: 40.15 },
  { data: '2026-02-10', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2843708', valor: 23.00 },
  { data: '2026-02-12', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2846648', valor: 31.74 },
  { data: '2026-02-12', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2846738', valor: 66.79 },
  { data: '2026-02-18', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2856608', valor: 54.00 },
  { data: '2026-02-23', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2859658', valor: 75.23 },
  { data: '2026-02-24', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2861658', valor: 27.90 },
  { data: '2026-02-25', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2862158', valor: 39.51 },
  { data: '2026-02-25', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2863728', valor: 368.39 },
  { data: '2026-02-26', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2865328', valor: 33.82 },
  { data: '2026-02-26', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2865828', valor: 294.90 },
  { data: '2026-02-27', descricao: 'Materiais construção fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2868958', valor: 201.40 },
];

const SEED_NOTAS = [
  { numero: '125', tipo: 'NF', data_emissao: '2026-02-20', cliente: 'UNIVALI', vendedor: 'Tiago', valor_total: 45000, valor_recebido: 45000, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '127', tipo: 'NF', data_emissao: '2026-02-28', cliente: 'FEESC', vendedor: 'Thais', valor_total: 57799, valor_recebido: 57799, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '131', tipo: 'NF', data_emissao: '2026-02-28', cliente: 'SESC', vendedor: 'Thais', valor_total: 20850, valor_recebido: 20850, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '132', tipo: 'NF', data_emissao: '2026-03-01', cliente: 'Sigma ABC', vendedor: 'Thais', valor_total: 39999, valor_recebido: 39999, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '133', tipo: 'NF', data_emissao: '2026-03-05', cliente: 'Frigorífico Pamplona', vendedor: 'Thais', valor_total: 1057, valor_recebido: 1057, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '139', tipo: 'NF', data_emissao: '2026-03-10', cliente: 'Cooperja UN.21', vendedor: 'Thais', valor_total: 6850, valor_recebido: 6850, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '152', tipo: 'NF', data_emissao: '2026-03-15', cliente: 'Sicoob Litorânea', vendedor: 'Thais', valor_total: 13840, valor_recebido: 13840, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '154', tipo: 'NF', data_emissao: '2026-03-15', cliente: 'SATC', vendedor: 'Thais', valor_total: 650, valor_recebido: 650, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '126', tipo: 'NF', data_emissao: '2026-02-28', cliente: 'Portonave', vendedor: 'Thais', valor_total: 5640, valor_recebido: 5640, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '114', tipo: 'NF', data_emissao: '2026-01-20', cliente: 'Betha Sistemas', vendedor: 'Tiago', valor_total: 21720, valor_recebido: 14480, valor_aberto: 7240, status: 'parcial', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-07' },
  { numero: '130', tipo: 'NF', data_emissao: '2026-02-10', cliente: 'Betha Sistemas', vendedor: 'Tiago', valor_total: 23070, valor_recebido: 7690, valor_aberto: 15380, status: 'parcial', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-06' },
  { numero: '119', tipo: 'NF', data_emissao: '2026-01-25', cliente: 'UNESC', vendedor: 'Tiago', valor_total: 20890, valor_recebido: 10445, valor_aberto: 10445, status: 'parcial', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-14' },
  { numero: '155', tipo: 'NF', data_emissao: '2026-03-18', cliente: 'Orsegups Vigilância', vendedor: 'Thais', valor_total: 1575, valor_recebido: 0, valor_aberto: 1575, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-03-25' },
  { numero: '117', tipo: 'NF', data_emissao: '2026-03-10', cliente: 'Setep Construções', vendedor: 'Thais', valor_total: 3550, valor_recebido: 0, valor_aberto: 3550, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-03-27' },
  { numero: '162', tipo: 'NF', data_emissao: '2026-03-20', cliente: 'Gilvan Advogados', vendedor: 'Thais', valor_total: 7752, valor_recebido: 0, valor_aberto: 7752, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-03-31' },
  { numero: '100041', tipo: 'CI', data_emissao: '2026-01-15', cliente: 'Senior Sistemas', vendedor: 'Tiago', valor_total: 52500, valor_recebido: 52500, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '100044', tipo: 'CI', data_emissao: '2026-02-01', cliente: 'Unimed Cascavel', vendedor: 'Thais', valor_total: 45000, valor_recebido: 45000, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  { numero: '100043', tipo: 'CI', data_emissao: '2026-02-15', cliente: 'Portonave', vendedor: 'Thais', valor_total: 24140, valor_recebido: 24140, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
];

const SICOOB_LC_ID = '69c357735465daaae827921e';

const SICOOB_LANCAMENTOS = [
  { data_lancamento: '2025-04-25', estabelecimento: 'SHOP BIKE', categoria: 'lazer', valor: 250.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2025-09-06', estabelecimento: 'MERCADOLIVRE SAMSUNG EV', categoria: 'tecnologia', valor: 333.33, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2025-08-25', estabelecimento: 'LISTO KLI TECNOLOGIA', categoria: 'tecnologia', valor: 333.33, natureza: 'empresarial', empresa_beneficiada: 'KLI' },
  { data_lancamento: '2025-10-31', estabelecimento: 'MLP KaBuM SAMSUNG V', categoria: 'tecnologia', valor: 1079.80, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-01-07', estabelecimento: 'HYPEFUL ACADEMIA LTDA', categoria: 'saude_bem_estar', valor: 339.80, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-16', estabelecimento: 'CarlaMendonca', categoria: 'servico_pessoal', valor: 315.78, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-21', estabelecimento: 'EMPORIO DA BELEZA GAROPABA', categoria: 'beleza', valor: 27.40, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-21', estabelecimento: 'Jeancarlosde GAROPABA', categoria: 'outro', valor: 60.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-21', estabelecimento: 'RESTAURANTE GOEN IMBITUBA', categoria: 'alimentacao', valor: 275.99, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-22', estabelecimento: 'BarDoZado GAROPABA', categoria: 'alimentacao', valor: 12.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-22', estabelecimento: 'Ticketmais TUBARAO', categoria: 'lazer', valor: 33.80, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-22', estabelecimento: 'LanchoneteMaria GAROPABA', categoria: 'alimentacao', valor: 12.90, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-22', estabelecimento: 'SUPERMERCADO SILVEIRA GAROPABA', categoria: 'alimentacao', valor: 386.31, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-22', estabelecimento: 'POSTO NESTOR GAROPABA', categoria: 'combustivel', valor: 150.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-24', estabelecimento: 'LANCHONETE SRM MORRO DA FUMA', categoria: 'alimentacao', valor: 37.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-24', estabelecimento: 'SOC REC MAMPITUBA CRICIUMA', categoria: 'lazer', valor: 797.50, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-25', estabelecimento: 'MERCEARIA E LANCHONETE CRICIUMA', categoria: 'alimentacao', valor: 18.85, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-25', estabelecimento: 'SAIKOO CRICIUMA', categoria: 'alimentacao', valor: 315.15, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-26', estabelecimento: 'PROTECAO PERDA OU ROUBO', categoria: 'seguro', valor: 0.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-26', estabelecimento: 'CARLESSI CRICIUMA', categoria: 'servico_pessoal', valor: 48.28, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-26', estabelecimento: 'MAGA NEWS RESTAURANTE CRICIUMA', categoria: 'alimentacao', valor: 91.70, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-27', estabelecimento: 'SUPERMERCADO SILVEIRA GAROPABA', categoria: 'alimentacao', valor: 284.86, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-27', estabelecimento: 'PADARIA E CONFEITARIA GAROPABA', categoria: 'alimentacao', valor: 20.45, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-27', estabelecimento: 'SKI DUNAS BAR Garopaba', categoria: 'lazer', valor: 15.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-27', estabelecimento: 'Jeancarlosde GAROPABA', categoria: 'outro', valor: 265.33, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-27', estabelecimento: '50191862 Andre Luiz GAROPABA', categoria: 'outro', valor: 40.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-27', estabelecimento: 'POSTO NESTOR GAROPABA', categoria: 'combustivel', valor: 200.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-28', estabelecimento: 'POSTO HANGAR 275 IMBITUBA', categoria: 'combustivel', valor: 9.99, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-02-28', estabelecimento: 'CONVENIENCIA NESTOR GAROPABA', categoria: 'alimentacao', valor: 6.99, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-01', estabelecimento: 'RESTAURANTE DUNAS PARK Garopaba', categoria: 'alimentacao', valor: 26.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-01', estabelecimento: '41740764 Wamandiry IMBITUBA', categoria: 'outro', valor: 38.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-01', estabelecimento: 'BRILHODOSOL GAROPABA', categoria: 'servico_pessoal', valor: 23.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-01', estabelecimento: 'SUPERMERCADO SILVEIRA GAROPABA', categoria: 'alimentacao', valor: 79.82, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-01', estabelecimento: 'SUPERMERCADO SILVEIRA GAROPABA', categoria: 'alimentacao', valor: 96.25, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-02', estabelecimento: 'LANCHES DO ALEMAO GAROPABA', categoria: 'alimentacao', valor: 99.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-02', estabelecimento: 'MARLISE LIMAS IMBITUBA', categoria: 'servico_pessoal', valor: 6.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-02', estabelecimento: 'SUPERMERCADO SILVEIRA GAROPABA', categoria: 'alimentacao', valor: 113.95, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-03', estabelecimento: 'PAGAMENTO BOLETO BANCARIO', categoria: 'financeiro', valor: -4951.57, natureza: 'pessoal', empresa_beneficiada: 'pessoal', observacao: 'Não faz parte do total da fatura' },
  { data_lancamento: '2026-03-04', estabelecimento: 'HORTIFRUTI CRICIUMA', categoria: 'alimentacao', valor: 85.77, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-05', estabelecimento: 'SecurityParking CRICIUMA', categoria: 'transporte', valor: 6.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-05', estabelecimento: 'POSTO 101 JAGUARUNA', categoria: 'combustivel', valor: 62.43, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-09', estabelecimento: 'PST AMIZADE IPIRANG GAROPABA', categoria: 'combustivel', valor: 150.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-10', estabelecimento: 'AUTO POSTO CIRIMBELLI FORQUILHINHA', categoria: 'combustivel', valor: 300.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-11', estabelecimento: 'MP ALIANDAPISOSE OSASCO', categoria: 'tecnologia', valor: 647.58, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-12', estabelecimento: '50191862 Andre Luiz GAROPABA', categoria: 'outro', valor: 40.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-16', estabelecimento: 'POSTO LOBO GAROPABA', categoria: 'combustivel', valor: 99.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-19', estabelecimento: 'AS MARIAS FORQUILHINHA', categoria: 'servico_pessoal', valor: 315.80, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-21', estabelecimento: 'AGAFARMA GAROPABA', categoria: 'farmacia', valor: 187.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
  { data_lancamento: '2026-03-23', estabelecimento: 'POSTO LOBO GAROPABA', categoria: 'combustivel', valor: 150.00, natureza: 'pessoal', empresa_beneficiada: 'pessoal' },
];

export async function seedSicoobFatura() {
  // Check if fatura already exists for this card/month
  const existing = await base44.entities.FaturaCartao.filter({ conta_cartao_id: SICOOB_LC_ID });
  const alreadyExists = existing.some(f => f.mes_referencia === '2026-03');
  if (alreadyExists) return;

  const fatura = await base44.entities.FaturaCartao.create({
    conta_cartao_id: SICOOB_LC_ID,
    mes_referencia: '2026-03',
    data_vencimento: '2026-04-03',
    valor_total: 8287.14,
    status: 'aberta',
    valor_pago: 0,
  });

  const lancamentos = SICOOB_LANCAMENTOS.map(l => ({ ...l, fatura_id: fatura.id }));
  await base44.entities.LancamentoCartao.bulkCreate(lancamentos);
}

export async function runSeedIfNeeded() {
  // Use ContaCartao as the seed flag — if it has data, seed already ran
  const existing = await base44.entities.ContaCartao.list();
  if (existing.length > 0) {
    // Still run Sicoob fatura seed separately (new data added after initial seed)
    await seedSicoobFatura();
    return;
  }

  // 1. Seed ContaCartao
  await base44.entities.ContaCartao.bulkCreate(SEED_CARTOES);
  const cartoes = await base44.entities.ContaCartao.list();
  const sicrediNT = cartoes.find(c => c.nome === 'Sicredi — NeuralTec');
  const magalu = cartoes.find(c => c.nome === 'Magalu / LuizaCred');

  // 2. Seed FaturaCartao (depends on ContaCartao IDs)
  const faturas = [
    sicrediNT && { conta_cartao_id: sicrediNT.id, mes_referencia: '2026-02', data_vencimento: '2026-02-25', valor_total: 257.68, status: 'paga_total', data_pagamento: '2026-02-25', valor_pago: 257.68 },
    sicrediNT && { conta_cartao_id: sicrediNT.id, mes_referencia: '2026-03', data_vencimento: '2026-03-25', valor_total: 672.85, status: 'aberta', valor_pago: 0 },
    magalu && { conta_cartao_id: magalu.id, mes_referencia: '2026-01', data_vencimento: '2026-01-27', valor_total: 7637.97, status: 'paga_total', data_pagamento: '2026-01-27', valor_pago: 7637.97 },
    magalu && { conta_cartao_id: magalu.id, mes_referencia: '2026-02', data_vencimento: '2026-02-25', valor_total: 17984.47, status: 'paga_total', data_pagamento: '2026-02-25', valor_pago: 17984.47 },
  ].filter(Boolean);
  if (faturas.length > 0) await base44.entities.FaturaCartao.bulkCreate(faturas);

  // 3. Seed ObraReforma
  await base44.entities.ObraReforma.bulkCreate(SEED_OBRAS);

  // 4. Seed NotaFiscal
  await base44.entities.NotaFiscal.bulkCreate(SEED_NOTAS);

  // 5. Seed Sicoob fatura with known card ID
  await seedSicoobFatura();
}