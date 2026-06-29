import { base44 } from '@/api/base44Client';

// Memória de aprendizado por tipo de importação.
// Regra: a cada importação "redonda" (sem erros e com registros extraídos),
// conta-se um acerto consecutivo. Ao atingir o limite, o tipo fica
// "aguardando_aval"; o usuário dá o aval e vira "economico" (sem IA).
// Se um arquivo divergir da assinatura de layout aprendida, volta para IA.

// Assinatura do layout = conjunto ordenado de campos que aparecem nos registros
// extraídos. É como reconhecemos "o mesmo tipo de arquivo de sempre".
export function assinaturaDeRegistros(records) {
  const campos = new Set();
  for (const r of records) {
    const data = r?.data || r;
    Object.keys(data || {}).forEach(k => {
      if (k !== '__type' && k !== 'selected' && k !== 'status') campos.add(k);
    });
  }
  return [...campos].sort();
}

// Compara assinatura nova com a aprendida. Considera "bate" se a nova contém
// todos os campos aprendidos (pode trazer extras, mas não pode faltar campo-chave).
export function layoutBate(aprendida = [], atual = []) {
  if (!aprendida.length) return true; // ainda não aprendeu nada
  const setAtual = new Set(atual);
  const faltando = aprendida.filter(c => !setAtual.has(c));
  return faltando.length === 0;
}

export async function getMemoria(tipoImport, label) {
  const existentes = await base44.entities.MemoriaImportacao.filter({ tipo_import: tipoImport });
  if (existentes?.length) return existentes[0];
  return base44.entities.MemoriaImportacao.create({
    tipo_import: tipoImport,
    label: label || tipoImport,
    acertos_consecutivos: 0,
    total_importacoes: 0,
    limite_para_aval: 5,
    status: 'aprendendo',
    assinatura_layout: [],
  });
}

// Decide se este arquivo pode pular a IA. Só pula se:
// - o tipo está em modo econômico, E
// - a assinatura do arquivo bate com a aprendida.
// Como ainda não temos extração antes da IA, usamos isto em conjunto com o
// cache por hash já existente — o modo econômico é informado pela memória.
export async function podeUsarModoEconomico(tipoImport) {
  const existentes = await base44.entities.MemoriaImportacao.filter({ tipo_import: tipoImport });
  const mem = existentes?.[0];
  return { ativo: mem?.status === 'economico', memoria: mem || null };
}

// Registra o resultado de uma importação na memória.
// redonda = true quando não houve erros e ao menos 1 registro foi salvo.
export async function registrarResultado(tipoImport, label, { redonda, assinatura, user }) {
  const mem = await getMemoria(tipoImport, label);
  const updates = {
    total_importacoes: (mem.total_importacoes || 0) + 1,
    ultima_importacao: new Date().toISOString(),
  };

  if (mem.status === 'economico') {
    // Já está sem IA — se o layout divergiu, derruba para reaprender com IA.
    if (assinatura && !layoutBate(mem.assinatura_layout, assinatura)) {
      updates.status = 'aprendendo';
      updates.acertos_consecutivos = 0;
      updates.observacoes = `Layout divergente em ${new Date().toLocaleString('pt-BR')} — voltou para IA.`;
    }
    await base44.entities.MemoriaImportacao.update(mem.id, updates);
    return { ...mem, ...updates };
  }

  if (redonda) {
    const novosAcertos = (mem.acertos_consecutivos || 0) + 1;
    updates.acertos_consecutivos = novosAcertos;
    // memoriza/refina a assinatura do layout
    updates.assinatura_layout = assinatura?.length ? assinatura : mem.assinatura_layout;
    if (novosAcertos >= (mem.limite_para_aval || 5) && mem.status !== 'aguardando_aval') {
      updates.status = 'aguardando_aval';
    }
  } else {
    // deu erro / faltou algo → zera a contagem
    updates.acertos_consecutivos = 0;
    if (mem.status === 'aguardando_aval') updates.status = 'aprendendo';
  }

  await base44.entities.MemoriaImportacao.update(mem.id, updates);
  return { ...mem, ...updates };
}

// O usuário dá o aval → modo econômico.
export async function darAval(memoriaId, userEmail) {
  await base44.entities.MemoriaImportacao.update(memoriaId, {
    status: 'economico',
    data_aval: new Date().toISOString(),
    avalizado_por: userEmail || '',
  });
}

// Volta para o modo IA (desfaz o aval).
export async function reativarIA(memoriaId) {
  await base44.entities.MemoriaImportacao.update(memoriaId, {
    status: 'aprendendo',
    acertos_consecutivos: 0,
  });
}