export const reais = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
export const competenciaBR = c => c ? c.split('-').reverse().join('/') : '—';

export const ALERTAS = {
  liquido_divergente: 'Líquido diferente da composição',
  escala_suspeita: 'Líquido em escala suspeita (÷1000)',
  vinculos_excedem_proventos: 'Vínculos acima dos proventos',
  pago_sem_vinculo_bancario: 'Pago sem vínculo bancário',
  evidencias_concorrentes: 'Pago informado difere do banco',
  sem_lancamento: 'Lançamento bancário não encontrado',
  nao_debito: 'Lançamento não é débito',
  alocacao_excede_debito: 'Alocação acima do débito',
  adiantamento_fora_competencia: 'Adiantamento fora do mês da competência',
  mes_divergente: 'Pago em mês incompatível com a competência',
  antes_janela: 'Pago antes do 5º dia útil',
  identidade_ambigua: 'Cadastro com nome único: beneficiário não confirmável',
  beneficiario_nao_confirmado: 'Nome do extrato não confere',
  vinculo_duplicado: 'Vínculo duplicado no mesmo lançamento',
  folha_inexistente: 'Folha vinculada não existe',
  apos_prazo: 'Pago após o 7º dia útil',
};

export const CATEGORIAS = {
  salario: 'Salário', complemento: 'Complemento', comissao: 'Comissão',
  sem_discriminacao: 'Sem discriminação', adiantamento: 'Adiantamento', estorno: 'Estorno',
};
export const TIPOS = { mensal: 'Mensal', ferias: 'Férias', decimo_terceiro: '13º', rescisao: 'Rescisão' };