import { gerenciarFolha } from '@/functions/gerenciarFolha';
export async function validarFolha(data) {
  const res = await gerenciarFolha({ action: 'validar', data });
  return res.data;
}
export async function criarFolha(data) {
  const res = await gerenciarFolha({ action: 'criar', data });
  return res.data.folha;
}
export function erroFolha(error) {
  return error?.response?.data?.error || error.message || 'Não foi possível salvar a folha.';
}