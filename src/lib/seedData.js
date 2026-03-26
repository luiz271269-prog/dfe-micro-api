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
  { data: '2026-03-30', descricao: 'Materiais construção mar', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DDA-202603', valor: 606.29, forma_pagamento: 'DDA' },
];

const SEED_NOTAS = [
   { numero: '125', tipo: 'NF', data_emissao: '2026-02-20', cliente: 'UNIVALI', vendedor: 'Tiago', valor_total: 45000, valor_recebido: 45000, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
   { numero: '127', tipo: 'NF', data_emissao: '2026-02-28', cliente: 'FEESC', vendedor: 'Thais', valor_total: 57799, valor_recebido: 57799, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
   { numero: '146', tipo: 'NF', data_emissao: '2026-03-19', cliente: 'EASE IND. E COM. DE CONFECCOES LTDA', vendedor: 'Thais', valor_total: 2589, valor_recebido: 2589, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
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

const SEED_TITULOS = [
  { nosso_numero: '26/100125-0', seu_numero: 'NF-125', cliente: 'UNIVALI', data_vencimento: '2026-03-20', data_pagamento: '2026-03-23', valor_titulo: 45000, valor_pago: 45000, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100132-0', seu_numero: 'NF-132', cliente: 'Sigma ABC', data_vencimento: '2026-03-25', data_pagamento: '2026-03-23', valor_titulo: 39999, valor_pago: 39999, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100087-3', seu_numero: 'NF-87-p3', cliente: 'Jackson Zanette', data_vencimento: '2026-03-25', data_pagamento: '2026-03-24', valor_titulo: 1437, valor_pago: 1437, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 3, parcela_total: 5 },
  { nosso_numero: '26/100093-3', seu_numero: 'NF-93-p3', cliente: 'Tex Cotton', data_vencimento: '2026-03-23', data_pagamento: '2026-03-23', valor_titulo: 1596, valor_pago: 1596, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 3, parcela_total: 5 },
  { nosso_numero: '26/100094-3', seu_numero: 'NF-94-p3', cliente: 'Tex Cotton', data_vencimento: '2026-03-23', data_pagamento: '2026-03-23', valor_titulo: 2394, valor_pago: 2394, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 3, parcela_total: 5 },
  { nosso_numero: '26/100143-1', seu_numero: 'NF-143-p1', cliente: 'Sical Siderúrgica', data_vencimento: '2026-03-23', data_pagamento: '2026-03-23', valor_titulo: 500, valor_pago: 500, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 3 },
  { nosso_numero: '26/100143-2', seu_numero: 'NF-143-p2', cliente: 'Sical Siderúrgica', data_vencimento: '2026-03-23', data_pagamento: '2026-03-23', valor_titulo: 1525, valor_pago: 1525, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 2, parcela_total: 3 },
  { nosso_numero: '26/100133-0', seu_numero: 'NF-133', cliente: 'Frigorífico Pamplona', data_vencimento: '2026-03-23', data_pagamento: '2026-03-23', valor_titulo: 1057, valor_pago: 1057, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100131-0', seu_numero: 'NF-131', cliente: 'SESC', data_vencimento: '2026-03-20', data_pagamento: '2026-03-20', valor_titulo: 20850, valor_pago: 20850, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100126-0', seu_numero: 'NF-126', cliente: 'Portonave', data_vencimento: '2026-03-20', data_pagamento: '2026-03-20', valor_titulo: 5640, valor_pago: 5640, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100152-0', seu_numero: 'NF-152', cliente: 'Sicoob Litorânea', data_vencimento: '2026-03-17', data_pagamento: '2026-03-17', valor_titulo: 13840, valor_pago: 13840, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100139-0', seu_numero: 'NF-139', cliente: 'Cooperja UN.21', data_vencimento: '2026-03-19', data_pagamento: '2026-03-19', valor_titulo: 6850, valor_pago: 6850, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100117-0', seu_numero: 'NF-117', cliente: 'Setep Construções', data_vencimento: '2026-03-27', valor_titulo: 3550, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100141-0', seu_numero: 'NF-141', cliente: 'Diamante Energia', data_vencimento: '2026-03-27', valor_titulo: 1371, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100142-0', seu_numero: 'NF-142', cliente: 'Setep Construções', data_vencimento: '2026-03-29', valor_titulo: 2899, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100155-0', seu_numero: 'NF-155', cliente: 'Orsegups Vigilância', data_vencimento: '2026-03-25', valor_titulo: 1575, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100162-0', seu_numero: 'NF-162', cliente: 'Gilvan Advogados', data_vencimento: '2026-03-31', valor_titulo: 7752, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100160-0', seu_numero: 'NF-160', cliente: 'Cooperja UN.21', data_vencimento: '2026-03-30', valor_titulo: 860, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100114-3', seu_numero: 'NF-114-p3', cliente: 'Betha Sistemas', data_vencimento: '2026-04-07', valor_titulo: 7240, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 3, parcela_total: 3 },
  { nosso_numero: '26/100130-2', seu_numero: 'NF-130-p2', cliente: 'Betha Sistemas', data_vencimento: '2026-04-06', valor_titulo: 7690, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 2, parcela_total: 3 },
  { nosso_numero: '26/100119-3', seu_numero: 'NF-119-p3', cliente: 'UNESC', data_vencimento: '2026-04-14', valor_titulo: 5222.50, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 3, parcela_total: 4 },
  { nosso_numero: '26/100109-3', seu_numero: 'NF-109-p3', cliente: 'MC3 Higienização', data_vencimento: '2026-04-01', valor_titulo: 1910.75, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 3, parcela_total: 4 },
  { nosso_numero: '26/100150-1', seu_numero: 'NF-150-p1', cliente: 'Anjo Química', data_vencimento: '2026-04-26', valor_titulo: 2200, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 2 },
  { nosso_numero: '26/100157-0', seu_numero: 'NF-157', cliente: 'Casefer Abrasivos', data_vencimento: '2026-04-11', valor_titulo: 4050, valor_pago: 0, status: 'em_aberto', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  { nosso_numero: '26/100146-0', seu_numero: 'NF-146', cliente: 'EASE IND. E COM. DE CONFECCOES LTDA', data_vencimento: '2026-03-24', data_pagamento: '2026-03-24', valor_titulo: 2589, valor_pago: 2589, status: 'pago', canal_cobranca: 'sicredi', parcela_numero: 1, parcela_total: 1 },
  ];

const SEED_COMPRAS = [
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '44522', data_emissao: '2026-02-02', descricao_produto: 'HEADSET LOGITECH H390 USB', categoria_produto: 'periferico', quantidade: 130, valor_unitario: 125, valor_total: 16250 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '154545', data_emissao: '2026-01-26', descricao_produto: 'HEADSET LOGITECH H390 USB', categoria_produto: 'periferico', quantidade: 142, valor_unitario: 126.88, valor_total: 18016.96 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '74651', data_emissao: '2026-02-23', descricao_produto: 'NOTEBOOK ALTO VALOR', categoria_produto: 'notebook', quantidade: 3, valor_unitario: 9735, valor_total: 29205 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '74651', data_emissao: '2026-02-23', descricao_produto: 'NOTEBOOK', categoria_produto: 'notebook', quantidade: 3, valor_unitario: 6335, valor_total: 19005 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '44522', data_emissao: '2026-02-02', descricao_produto: 'NOTEBOOK', categoria_produto: 'notebook', quantidade: 3, valor_unitario: 5510, valor_total: 16530 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '465732', data_emissao: '2026-02-20', descricao_produto: 'MEMORIA KINGSTON 16GB DDR4', categoria_produto: 'memoria', quantidade: 18, valor_unitario: 888.85, valor_total: 15999.30 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '61543', data_emissao: '2026-01-19', descricao_produto: 'TABLET SAMSUNG A9 64GB', categoria_produto: 'tablet', quantidade: 25, valor_unitario: 615, valor_total: 15375 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '74651', data_emissao: '2026-02-23', descricao_produto: 'TABLET SAMSUNG S6 LITE', categoria_produto: 'tablet', quantidade: 10, valor_unitario: 1360, valor_total: 13600 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '465732', data_emissao: '2026-02-20', descricao_produto: 'MEMORIA KINGSTON 32GB DDR5', categoria_produto: 'memoria', quantidade: 4, valor_unitario: 3117.23, valor_total: 12468.92 },
  { fornecedor: 'COMPRAS A VISTA', numero_nota: '89653', data_emissao: '2026-03-09', descricao_produto: 'WEB CAM', categoria_produto: 'periferico', quantidade: 80, valor_unitario: 110, valor_total: 8800 },
  { fornecedor: 'MERCADO LIVRE', numero_nota: '165998', data_emissao: '2026-02-16', descricao_produto: 'PROCESSADOR INTEL CORE', categoria_produto: 'componente', quantidade: 9, valor_unitario: 1448.77, valor_total: 13038.96 },
  { fornecedor: 'MERCADO LIVRE', numero_nota: '16546', data_emissao: '2026-01-27', descricao_produto: 'TABLET', categoria_produto: 'tablet', quantidade: 4, valor_unitario: 3699, valor_total: 14796 },
  { fornecedor: 'MERCADO LIVRE', numero_nota: '14360505', data_emissao: '2026-02-11', descricao_produto: 'NOTEBOOK', categoria_produto: 'notebook', quantidade: 3, valor_unitario: 3260.34, valor_total: 9781.02 },
  { fornecedor: 'MERCADO LIVRE', numero_nota: '1843978', data_emissao: '2026-02-09', descricao_produto: 'MONITOR LG 24 24MS500', categoria_produto: 'outro', quantidade: 10, valor_unitario: 489.90, valor_total: 4899 },
  { fornecedor: 'MERCADO LIVRE', numero_nota: '98866', data_emissao: '2026-03-16', descricao_produto: 'ANTI-VIRUS KASPERSKY ENDPOINT', categoria_produto: 'software', quantidade: 24, valor_unitario: 250.18, valor_total: 6004.32 },
  { fornecedor: 'MERCADO LIVRE', numero_nota: '89756', data_emissao: '2026-02-18', descricao_produto: 'HD SSD 1TB', categoria_produto: 'armazenamento', quantidade: 9, valor_unitario: 749, valor_total: 6741 },
  { fornecedor: 'PAUTA DISTRIBUIÇÃO', numero_nota: '16543', data_emissao: '2026-02-04', descricao_produto: 'PLACA DE VIDEO RTX', categoria_produto: 'componente', quantidade: 1, valor_unitario: 6936.25, valor_total: 6936.25 },
  { fornecedor: 'PAUTA DISTRIBUIÇÃO', numero_nota: '1543257', data_emissao: '2026-02-18', descricao_produto: 'PLACA DE VIDEO RTX', categoria_produto: 'componente', quantidade: 1, valor_unitario: 6936.25, valor_total: 6936.25 },
  { fornecedor: 'PAUTA DISTRIBUIÇÃO', numero_nota: '140443', data_emissao: '2026-01-28', descricao_produto: 'PROCESSADOR', categoria_produto: 'componente', quantidade: 1, valor_unitario: 2061.45, valor_total: 2061.45 },
  { fornecedor: 'PAUTA DISTRIBUIÇÃO', numero_nota: '16543', data_emissao: '2026-01-19', descricao_produto: 'TABLET', categoria_produto: 'tablet', quantidade: 1, valor_unitario: 3699, valor_total: 3699 },
];

const SEED_LANCAMENTOS = [
  { data: '2026-01-05', descricao: 'CIA Latino Americana', valor: 29634.72, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-05', descricao: 'Banco Cooperati — parcela', valor: -16940, categoria: 'financeiro', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-06', descricao: 'Cobranças lote clientes', valor: 8181, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-06', descricao: 'Thais Moreira', valor: -3000, categoria: 'pessoal', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-06', descricao: 'Tiago Alves Melechenko', valor: -3000, categoria: 'pessoal', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-06', descricao: 'Ricardo Rodolfo', valor: -3590.47, categoria: 'pessoal', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-07', descricao: 'Pamplona Alimentos TED', valor: 7000, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-12', descricao: 'CIA Latino Americana TED', valor: 10365.20, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-20', descricao: 'DAS Simples Nacional jan', valor: -13976.51, categoria: 'tributo', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-21', descricao: 'Portonave S.A.', valor: 13990, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01' },
  { data: '2026-01-27', descricao: 'LuizaCred — Fatura Magalu jan', valor: -7637.97, categoria: 'financeiro', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-01', detalhe: 'Cartão Magalu vence dia 27' },
  { data: '2026-02-03', descricao: 'KLI Tecnologia transferência', valor: -10000, categoria: 'transferencia', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02' },
  { data: '2026-02-09', descricao: 'Portonave S.A. PIX', valor: 3910, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02' },
  { data: '2026-02-13', descricao: 'CRÉDITO C63220168 Empréstimo', valor: 102275.20, categoria: 'financeiro', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02', detalhe: 'Empréstimo liberado Banco Cooperati' },
  { data: '2026-02-18', descricao: 'Cobranças lote clientes', valor: 36773.25, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02' },
  { data: '2026-02-20', descricao: 'DAS Simples Nacional fev', valor: -14835.77, categoria: 'tributo', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02' },
  { data: '2026-02-25', descricao: 'LuizaCred — Fatura Magalu fev', valor: -17984.47, categoria: 'financeiro', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02', detalhe: 'Cartão Magalu vence dia 27' },
  { data: '2026-02-25', descricao: 'DEB.CTA.FATURA — Sicredi NeuralTec', valor: -257.68, categoria: 'financeiro', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-02', detalhe: 'Cartão Sicredi NeuralTec vence dia 25' },
  { data: '2026-03-04', descricao: 'Portonave S.A. PIX', valor: 24140, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-12', descricao: 'Cobranças lote — Unimed+FEESC+Betha', valor: 54060.75, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-13', descricao: 'Cobranças lote — FEESC+Betha+Setep', valor: 58130.50, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-19', descricao: 'Cobranças lote — Cooperja', valor: 6850, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-19', descricao: 'Aplicação Fundos Captação', valor: -50000, categoria: 'interno', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: '1ª aplicação março' },
  { data: '2026-03-19', descricao: 'Jhonatan da Rocha Vitu — Reforma loja', valor: -9500, categoria: 'obras_reforma', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'Mão de obra reforma' },
  { data: '2026-03-20', descricao: 'SESC cobrança simples', valor: 20850, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-20', descricao: 'Portonave S.A. PIX — NF-126', valor: 5640, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-20', descricao: 'DAS Simples Nacional mar — competência fev', valor: -36377.72, categoria: 'tributo', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'VERIFICAR: valor 2.5x acima do padrão' },
  { data: '2026-03-23', descricao: 'UNIVALI — NF-125', valor: 45000, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-23', descricao: 'Banco Cooperati — parcela mar', valor: -12962.57, categoria: 'financeiro', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'VERIFICAR: acima do padrão ~R$9.282' },
  { data: '2026-03-24', descricao: 'Cobranças lote — Sigma+Tex+Sical', valor: 46014, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03' },
  { data: '2026-03-24', descricao: 'Jackson Zanette — NF-87 parc.3', valor: 1437, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'Cobrança Sicredi liquidada antecipado — vencia 25/03' },
  { data: '2026-03-24', descricao: 'Ease Ind. e Com. de Confecções — NF-146', valor: 2589, categoria: 'recebimento', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'Cobrança Sicredi liquidada — vencia 24/03' },
  { data: '2026-03-30', descricao: 'PJBank Pagamentos S.A.', valor: -99.90, categoria: 'despesa_operacional', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'DDA doc 528414539 — taxa/serviço financeiro' },
  { data: '2026-03-30', descricao: 'Aceville Transportes Ltda', valor: -156.75, categoria: 'fornecedor', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'DDA doc 0014213660 — frete' },
  { data: '2026-03-30', descricao: 'Everaldo Fabris', valor: -600.00, categoria: 'pessoal', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-03', detalhe: 'DDA doc 6418 — CPF 14.227.711' },
  { data: '2026-04-01', descricao: 'Alfa Transportes', valor: -68.50, categoria: 'fornecedor', conta_bancaria: 'NeuralTec 36092-2', mes_referencia: '2026-04', detalhe: 'DDA doc 0006622213 — frete' },
  { data: '2026-03-30', descricao: 'Baggio Materiais de Construção Ltda', valor: -606.29, categoria: 'obras_reforma', conta_bancaria: 'Liesch 37101-4', mes_referencia: '2026-03', detalhe: 'DDA — Liesch Comércio e Informática Ltda-ME — materiais obra' },
  { data: '2026-04-01', descricao: 'Gazin Atacado Centro-Oeste Ltda', valor: -1143.31, categoria: 'fornecedor', conta_bancaria: 'KLI Tecnologia', mes_referencia: '2026-04', detalhe: 'DDA — KLI Tecnologia da Informação Ltda — mercadoria' },
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
    // Run incremental seeds separately
    await Promise.all([
      seedSicoobFatura(),
      seedTitulosIfNeeded(),
      seedComprasIfNeeded(),
      seedLancamentosIfNeeded(),
      seedNotasFiscalMarco(),
      patchFaturasSicrediNT(),
    ]);
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

  // 5. Seed remaining entities in parallel
  await Promise.all([
    seedSicoobFatura(),
    base44.entities.TituloCobranca.bulkCreate(SEED_TITULOS),
    base44.entities.ItemCompra.bulkCreate(SEED_COMPRAS),
    base44.entities.LancamentoBancario.bulkCreate(SEED_LANCAMENTOS),
  ]);
}

async function seedTitulosIfNeeded() {
  const existing = await base44.entities.TituloCobranca.list();
  if (existing.length > 0) return;
  await base44.entities.TituloCobranca.bulkCreate(SEED_TITULOS);
}

async function seedComprasIfNeeded() {
  const existing = await base44.entities.ItemCompra.list();
  if (existing.length > 0) return;
  await base44.entities.ItemCompra.bulkCreate(SEED_COMPRAS);
}

async function patchFaturasSicrediNT() {
  // Patch Sicredi NeuralTec mar/2026 fatura to paga_total if still aberta
  const FATURA_ID = '69c357737f4d228e291fc1b1';
  const faturas = await base44.entities.FaturaCartao.filter({ id: FATURA_ID });
  const fat = faturas[0];
  if (fat && fat.status === 'aberta') {
    await base44.entities.FaturaCartao.update(FATURA_ID, {
      status: 'paga_total',
      data_pagamento: '2026-03-25',
      valor_pago: 672.85,
    });
  }
}

async function seedLancamentosIfNeeded() {
  const existing = await base44.entities.LancamentoBancario.list();
  if (existing.length > 0) return;
  const dedupSet = new Set(existing.map(l => `${l.data}|${l.descricao}|${l.valor}`));
  const toInsert = SEED_LANCAMENTOS.filter(l => !dedupSet.has(`${l.data}|${l.descricao}|${l.valor}`));
  if (toInsert.length > 0) await base44.entities.LancamentoBancario.bulkCreate(toInsert);
}

async function seedNotasFiscalMarco() {
  const NOTAS_MARCO = [
    { numero: '143', tipo: 'NF', data_emissao: '2026-03-02', cliente: 'SICAL SIDERURGICA CATARINENSE LTDA', vendedor: 'Thais', valor_total: 6100, valor_recebido: 0, valor_aberto: 6100, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '144', tipo: 'NF', data_emissao: '2026-03-02', cliente: 'TECMESTEEL INDUSTRIA METALURGICA LTDA', vendedor: 'Tiago', valor_total: 2995, valor_recebido: 2995, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
    { numero: '145', tipo: 'NF', data_emissao: '2026-03-03', cliente: 'GRAVATAL SANEAMENTO SPE S/A', vendedor: 'Thais', valor_total: 2985, valor_recebido: 0, valor_aberto: 2985, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '146', tipo: 'NF', data_emissao: '2026-03-03', cliente: 'EASE IND. E COM. DE CONFECCOES LTDA', vendedor: 'Tiago', valor_total: 2589, valor_recebido: 0, valor_aberto: 2589, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '147', tipo: 'NF', data_emissao: '2026-03-03', cliente: 'SENIOR SISTEMAS S/A', vendedor: 'Tiago', valor_total: 0, valor_recebido: 0, valor_aberto: 0, status: 'pago', canal_cobranca: 'fat_direto', descricao_obs: 'NF valor zero — bonificação ou remessa' },
    { numero: '148', tipo: 'NF', data_emissao: '2026-03-04', cliente: 'PAUTA DISTRIBUICAO E LOGISTICA SA', vendedor: 'Thais', valor_total: 1466.92, valor_recebido: 0, valor_aberto: 1466.92, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '149', tipo: 'NF', data_emissao: '2026-03-04', cliente: 'SOMBRIO SANEAMENTO', vendedor: 'Thais', valor_total: 1599, valor_recebido: 0, valor_aberto: 1599, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '150', tipo: 'NF', data_emissao: '2026-03-05', cliente: 'ANJO QUIMICA DO BRASIL LTDA', vendedor: 'Thais', valor_total: 4400, valor_recebido: 2200, valor_aberto: 2200, status: 'parcial', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-26' },
    { numero: '151', tipo: 'NF', data_emissao: '2026-03-05', cliente: 'RIOMED DISTRIBUICAO LTDA', vendedor: 'Tiago', valor_total: 1960, valor_recebido: 0, valor_aberto: 1960, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '152', tipo: 'NF', data_emissao: '2026-03-09', cliente: 'SICOOB-COOPERATIVA DE CREDITO LITORANEA', vendedor: 'Thais', valor_total: 13840, valor_recebido: 13840, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
    { numero: '153', tipo: 'NF', data_emissao: '2026-03-10', cliente: 'PORTONAVE TERMINAIS PORTUARIOS DE NAVEGANTES SA', vendedor: 'Thais', valor_total: 2530, valor_recebido: 0, valor_aberto: 2530, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '154', tipo: 'NF', data_emissao: '2026-03-10', cliente: 'SATC ASSOC BENEFICENTE DA IND CARB SC', vendedor: 'Thais', valor_total: 650, valor_recebido: 650, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
    { numero: '155', tipo: 'NF', data_emissao: '2026-03-10', cliente: 'ORSEGUPS SEGURANCA E VIGILANCIA LTDA', vendedor: 'Thais', valor_total: 1575, valor_recebido: 0, valor_aberto: 1575, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-03-25' },
    { numero: '156', tipo: 'NF', data_emissao: '2026-03-12', cliente: 'SICAL SIDERURGICA CATARINENSE LTDA', vendedor: 'Thais', valor_total: 4799, valor_recebido: 0, valor_aberto: 4799, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-02' },
    { numero: '157', tipo: 'NF', data_emissao: '2026-03-12', cliente: 'CASEFER ABRASIVOS EPIs E FERRAMENTAS', vendedor: 'Tiago', valor_total: 4050, valor_recebido: 0, valor_aberto: 4050, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-11' },
    { numero: '158', tipo: 'NF', data_emissao: '2026-03-16', cliente: 'PORTONAVE TERMINAIS PORTUARIOS DE NAVEGANTES SA', vendedor: 'Thais', valor_total: 1926, valor_recebido: 0, valor_aberto: 1926, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-15' },
    { numero: '159', tipo: 'NF', data_emissao: '2026-03-16', cliente: 'ICEPORT TERMINAL FRIGORIFICO DE NAVEGANTES', vendedor: 'Tiago', valor_total: 148, valor_recebido: 0, valor_aberto: 148, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '160', tipo: 'NF', data_emissao: '2026-03-16', cliente: 'COOP.AGROINDUSTRIAL COOPERJA - UN.21', vendedor: 'Thais', valor_total: 860, valor_recebido: 0, valor_aberto: 860, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-03-30' },
    { numero: '161', tipo: 'NF', data_emissao: '2026-03-17', cliente: 'CLAMED FARMACIAS', vendedor: 'Tiago', valor_total: 1680, valor_recebido: 0, valor_aberto: 1680, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-04-06' },
    { numero: '162', tipo: 'NF', data_emissao: '2026-03-17', cliente: 'GILVAN FRANCISCO ADVOGADOS', vendedor: 'Thais', valor_total: 7752, valor_recebido: 0, valor_aberto: 7752, status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '2026-03-31' },
    { numero: '163', tipo: 'NF', data_emissao: '2026-03-18', cliente: 'ANJO QUIMICA DO BRASIL LTDA', vendedor: 'Thais', valor_total: 638, valor_recebido: 0, valor_aberto: 638, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '164', tipo: 'NF', data_emissao: '2026-03-19', cliente: 'SOMBRIO SANEAMENTO', vendedor: 'Thais', valor_total: 550, valor_recebido: 0, valor_aberto: 550, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '165', tipo: 'NF', data_emissao: '2026-03-19', cliente: 'SBM - SUL BRASILEIRA DE MINERACAO LTDA', vendedor: 'Tiago', valor_total: 2299, valor_recebido: 0, valor_aberto: 2299, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '166', tipo: 'NF', data_emissao: '2026-03-19', cliente: 'SINDICATO TRAB.IND.METALURGICA MEC.ELETRICA', vendedor: 'Tiago', valor_total: 2635, valor_recebido: 0, valor_aberto: 2635, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '167', tipo: 'NF', data_emissao: '2026-03-20', cliente: 'FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA', vendedor: 'Tiago', valor_total: 5195, valor_recebido: 0, valor_aberto: 5195, status: 'a_vencer', canal_cobranca: 'sicredi' },
    { numero: '168', tipo: 'NF', data_emissao: '2026-03-20', cliente: 'MARIA INES DA ROSA', vendedor: 'Thais', valor_total: 9000, valor_recebido: 9000, valor_aberto: 0, status: 'pago', canal_cobranca: 'sicredi' },
  ];
  const existing = await base44.entities.NotaFiscal.list();
  const existingNumeros = new Set(existing.map(n => n.numero));
  const toInsert = NOTAS_MARCO.filter(n => !existingNumeros.has(n.numero));
  if (toInsert.length > 0) await base44.entities.NotaFiscal.bulkCreate(toInsert);
}