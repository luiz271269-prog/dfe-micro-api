import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validarCadastroFuncionario } from '../../shared/funcionarioCadastro.ts';
import { revisarDuplicataFuncionario, excluirDuplicataFuncionario } from '../../shared/excluirDuplicataFuncionario.ts';
export default async function(req) {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Somente administradores podem gerenciar os cadastros de funcionários.' }, { status: 403 });
    const { action, data, id, manter_id, cursor, validate_only } = await req.json();
    const entities = client.entities;
    if (action === 'criar') {
      const payload = await validarCadastroFuncionario(entities, data);
      if (validate_only === true) return Response.json({ ok: true, mode: 'validation' });
      const funcionario = await entities.Funcionario.create(payload);
      return Response.json({ ok: true, funcionario });
    }
    if (typeof id !== 'string' || !id) throw new Error('Selecione o cadastro do funcionário.');
    if (action === 'revisar_duplicata') return Response.json(await revisarDuplicataFuncionario(entities, id, cursor));
    if (action === 'excluir_duplicata') {
      if (typeof manter_id !== 'string' || !manter_id) throw new Error('Escolha o cadastro que será mantido.');
      return Response.json(await excluirDuplicataFuncionario(entities, id, manter_id, validate_only === true));
    }
    return Response.json({ error: 'Operação inválida.' }, { status: 400 });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}