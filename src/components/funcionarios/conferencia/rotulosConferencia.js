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
export const NATUREZAS = {
  possivel_comissao: { label: 'Possível comissão', hint: 'Termo no texto do PIX (prêmio, bônus, meta, venda) ou PIX a partir do dia 10 — não confirmado', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  comissao_informada: { label: 'Comissão informada', hint: 'Identificada na observação ou descrição bancária', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  adiantamento: { label: 'Adiantamento', hint: 'Identificado no vínculo ou descrição bancária', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  nao_classificado: { label: 'Não classificado', hint: 'Fora da janela, antes do dia 10, sem identificação', cls: 'bg-muted text-muted-foreground border-border' },
};
export const SITUACOES = {
  sem_folha: { label: 'Sem folha', cls: 'text-muted-foreground' },
  sem_vinculo: { label: 'Sem vínculo bancário', cls: 'text-amber-700' },
  com_divergencia: { label: 'Com divergência', cls: 'text-destructive' },
  conferido: { label: 'Conferido', cls: 'text-emerald-700' },
};
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const TIPOS = { mensal: 'Mensal', ferias: 'Férias', decimo_terceiro: '13º', rescisao: 'Rescisão' };