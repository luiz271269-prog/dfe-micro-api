import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    // Lista todas as variáveis de ambiente disponíveis (apenas nomes, sem valores)
    const envObj = Deno.env.toObject();
    const todasKeys = Object.keys(envObj).sort();

    // Filtra apenas as relacionadas a CERT_ ou que parecem secrets
    const certKeys = todasKeys.filter(k => /CERT|PFX|NEURAL|LIESCH/i.test(k));

    // Testa o nome exato esperado
    const senhaEsperada = Deno.env.get('CERT_PFX_NEURALTEC');
    const senhaExisteEhVazia = senhaEsperada === '';
    const senhaExisteEhNull = senhaEsperada === null;
    const senhaExisteEhUndefined = senhaEsperada === undefined;
    const senhaLength = typeof senhaEsperada === 'string' ? senhaEsperada.length : null;

    // Mostra os primeiros e últimos 2 chars (sem expor a senha completa)
    let preview = null;
    if (typeof senhaEsperada === 'string' && senhaEsperada.length > 4) {
      preview = `${senhaEsperada.slice(0, 2)}***${senhaEsperada.slice(-2)} (len=${senhaLength})`;
    } else if (typeof senhaEsperada === 'string') {
      preview = `(string vazia, len=${senhaLength})`;
    }

    return Response.json({
      total_env_vars: todasKeys.length,
      cert_related_keys: certKeys,
      teste_CERT_PFX_NEURALTEC: {
        existe: typeof senhaEsperada !== 'undefined' && senhaEsperada !== null,
        eh_undefined: senhaExisteEhUndefined,
        eh_null: senhaExisteEhNull,
        eh_string_vazia: senhaExisteEhVazia,
        length: senhaLength,
        preview,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});