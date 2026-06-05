import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import UploadCertificadoForm from '../components/certificado-nfe/UploadCertificadoForm';
import POCConexaoCard from '../components/certificado-nfe/POCConexaoCard';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, AlertTriangle } from 'lucide-react';

const STATUS_STYLE = {
  valido:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', Icon: ShieldCheck, label: 'Válido' },
  pendente: { bg: 'bg-slate-50 border-slate-200',     text: 'text-slate-700',   Icon: ShieldAlert, label: 'Pendente' },
  invalido: { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     Icon: ShieldX,    label: 'Inválido' },
  expirado: { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     Icon: ShieldX,    label: 'Expirado' },
  erro:     { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     Icon: ShieldX,    label: 'Erro' },
};

const LOG_STATUS_STYLE = {
  ok: 'bg-emerald-100 text-emerald-700',
  sem_novos: 'bg-blue-100 text-blue-700',
  poc: 'bg-blue-100 text-blue-700',
  bloqueado_consumo: 'bg-amber-100 text-amber-700',
  erro: 'bg-red-100 text-red-700',
};

export default function CertificadoNFe() {
  const [certs, setCerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [cs, ls] = await Promise.all([
      base44.entities.CertificadoDigitalNFe.list('-updated_date', 20).catch(() => []),
      base44.entities.LogSyncSEFAZ.list('-data_execucao', 15).catch(() => []),
    ]);
    setCerts(cs); setLogs(ls);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Certificado Digital — NF-e"
        subtitle="Cadastro do A1 e POC de conexão com a SEFAZ (Ambiente Nacional / NFeDistribuicaoDFe)"
      />

      <UploadCertificadoForm onSaved={load} />

      {/* Lista de certificados cadastrados */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : certs.length === 0 ? (
        <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground">
          Nenhum certificado cadastrado ainda. Use o formulário acima.
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Certificados Cadastrados ({certs.length})
          </h2>
          <div className="space-y-3">
            {certs.map(c => {
              const st = STATUS_STYLE[c.status_validacao] || STATUS_STYLE.pendente;
              return (
                <div key={c.id} className="bg-card rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold">{c.empresa}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${st.bg} ${st.text}`}>
                          <st.Icon className="w-3 h-3" /> {st.label}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {c.ambiente}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {c.tipo || 'A1'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.cnpj}</p>
                      {c.titular && <p className="text-[11px] text-muted-foreground truncate max-w-xl">{c.titular}</p>}
                      {c.validade && (
                        <p className="text-[11px] mt-0.5">
                          Validade: <span className="font-semibold">{c.validade}</span>
                          {c.ultima_validacao && (
                            <span className="text-muted-foreground ml-2">
                              · validado em {new Date(c.ultima_validacao).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {c.ultimo_erro && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 text-[11px] text-red-800 flex items-start gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {c.ultimo_erro}
                    </div>
                  )}
                  <POCConexaoCard certificado={c} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimos logs */}
      {logs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Últimos logs de sync ({logs.length})
          </h2>
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Quando</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Empresa</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">cStat</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Mensagem</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                        {l.data_execucao ? new Date(l.data_execucao).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2 font-semibold">{l.empresa}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{l.cstat ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${LOG_STATUS_STYLE[l.status_final] || 'bg-slate-100 text-slate-600'}`}>
                          {l.status_final}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] truncate max-w-md">{l.mensagem || l.x_motivo || '—'}</td>
                      <td className="px-3 py-2 text-right text-[10px] tabular-nums text-muted-foreground">
                        {l.duracao_ms ? `${l.duracao_ms}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}