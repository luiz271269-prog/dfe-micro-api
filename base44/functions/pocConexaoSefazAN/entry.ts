import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { consultarDistribuicaoDFeMicroApi, consultarSaudeDFeMicroApi } from '../../shared/dfeMicroApi.ts';

export default async function(req) {
  const t0 = Date.now();
  const requestId = `poc_${Date.now()}`;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { certificado_id } = body || {};
    if (!certificado_id) return Response.json({ ok: false, motivo: 'certificado_id obrigatório' }, { status: 400 });

    const certs = await base44.asServiceRole.entities.CertificadoDigitalNFe.filter({ id: certificado_id });
    const certificado = certs?.[0];
    if (!certificado) return Response.json({ ok: false, motivo: 'Certificado não encontrado' }, { status: 404 });
    if (certificado.status_validacao !== 'valido') {
      return Response.json({
        ok: false,
        motivo: `Certificado precisa estar com status "valido" para rodar a POC (atual: ${certificado.status_validacao})`,
      }, { status: 400 });
    }

    const url = secrets.get('DFE_MICRO_API_URL');
    const token = secrets.get('DFE_MICRO_API_TOKEN');
    const health = await consultarSaudeDFeMicroApi({ url, token, requestId });

    if (!health.ok) {
      const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
        request_id: requestId,
        empresa: certificado.empresa,
        cnpj_sem_mascara: certificado.cnpj_sem_mascara,
        data_execucao: new Date().toISOString(),
        duracao_ms: Date.now() - t0,
        status_final: 'poc',
        mensagem: health.motivo,
        endpoint: health.endpoint,
      });
      return Response.json({
        ok: false,
        micro_api_online: false,
        motivo: health.motivo,
        http_status: health.http_status || null,
        endpoint: health.endpoint || null,
        latencia_ms: Date.now() - t0,
        log_id: log.id,
      }, { status: 502 });
    }

    const fiscal = await consultarDistribuicaoDFeMicroApi({
      empresa: certificado.empresa,
      cnpj: certificado.cnpj_sem_mascara,
      ambiente: certificado.ambiente,
      ultNSU: '000000000000000',
      requestId,
      url,
      token,
    });
    const motivo = fiscal.xMotivo || fiscal.motivo || 'Consulta concluída.';
    const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
      request_id: requestId,
      empresa: certificado.empresa,
      cnpj_sem_mascara: certificado.cnpj_sem_mascara,
      data_execucao: new Date().toISOString(),
      duracao_ms: Date.now() - t0,
      nsu_inicial: '000000000000000',
      nsu_final: fiscal.ultNSU || '000000000000000',
      max_nsu_servidor: fiscal.maxNSU || '000000000000000',
      documentos_baixados: fiscal.docZips?.length || 0,
      cstat: fiscal.cstat,
      x_motivo: fiscal.xMotivo,
      status_final: 'poc',
      mensagem: motivo,
      endpoint: fiscal.endpoint,
    });

    return Response.json({
      ok: fiscal.ok === true,
      micro_api_online: true,
      cstat_real: fiscal.cstat,
      cstat: fiscal.cstat,
      x_motivo: fiscal.xMotivo || null,
      motivo: fiscal.ok ? motivo : fiscal.motivo || motivo,
      http_status: fiscal.http_status || health.http_status || null,
      ult_nsu: fiscal.ultNSU || null,
      max_nsu: fiscal.maxNSU || null,
      endpoint: fiscal.endpoint || null,
      latencia_ms: Date.now() - t0,
      log_id: log.id,
    }, { status: fiscal.ok ? 200 : 502 });
  } catch (error) {
    console.error('pocConexaoSefazAN erro:', error);
    return Response.json({ ok: false, micro_api_online: false, motivo: error.message }, { status: 500 });
  }
}