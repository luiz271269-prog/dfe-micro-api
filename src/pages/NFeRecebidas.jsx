import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Filter, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import SincronizarButton from '../components/nfe-recebidas/SincronizarButton';
import NFeRecebidaDrawer from '../components/nfe-recebidas/NFeRecebidaDrawer';

const TIPO_COLORS = {
  nfe: 'bg-blue-100 text-blue-700',
  nfe_resumo: 'bg-slate-100 text-slate-700',
  cte: 'bg-purple-100 text-purple-700',
  evento: 'bg-amber-100 text-amber-700',
  outro: 'bg-slate-100 text-slate-600',
};

const PROC_COLORS = {
  novo: 'bg-blue-100 text-blue-700',
  analisado: 'bg-amber-100 text-amber-700',
  vinculado: 'bg-emerald-100 text-emerald-700',
  ignorado: 'bg-slate-100 text-slate-500',
  erro: 'bg-red-100 text-red-700',
};

export default function NFeRecebidas() {
  const [nfes, setNfes] = useState([]);
  const [controles, setControles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  async function load() {
    setLoading(true);
    const [list, ctrls, lgs] = await Promise.all([
      base44.entities.NFeRecebida.filter({ origem_documento: 'real' }, '-data_emissao', 300).catch(() => []),
      base44.entities.ControleNSU.filter({ origem_cursor: 'real' }, '-updated_date', 5).catch(() => []),
      base44.entities.LogSyncSEFAZ.list('-data_execucao', 30).catch(() => []),
    ]);
    const logsReais = lgs.filter(l => l.origem_execucao !== 'mock' && l.endpoint !== 'mock://an').slice(0, 10);
    setNfes(list); setControles(ctrls); setLogs(logsReais);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => nfes.filter(n => {
    if (filtroEmpresa !== 'todas' && n.empresa_destinataria !== filtroEmpresa) return false;
    if (filtroStatus !== 'todos' && n.status_processamento !== filtroStatus) return false;
    return true;
  }), [nfes, filtroEmpresa, filtroStatus]);

  const total = filtered.reduce((s, n) => s + (n.valor_total || 0), 0);

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="NFes Recebidas (SEFAZ AN)"
        subtitle={`${nfes.length} documentos baixados via NFeDistribuicaoDFe`}
      >
        <SincronizarButton empresa="NeuralTec" onDone={load} />
      </PageHeader>

      {/* Painel de status do controle NSU */}
      {controles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {controles.map(c => (
            <div key={c.id} className="bg-card border rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{c.empresa}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    c.origem_cursor === 'mock'
                      ? 'bg-amber-100 text-amber-700'
                      : c.origem_cursor === 'real'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {c.origem_cursor === 'mock'
                      ? 'Teste mock'
                      : c.origem_cursor === 'real'
                        ? 'Ambiente real'
                        : 'Origem desconhecida'}
                  </span>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  c.ultimo_status === 'ok' ? 'bg-emerald-100 text-emerald-700'
                    : c.ultimo_status === 'vazio' ? 'bg-slate-100 text-slate-600'
                    : c.ultimo_status === 'rate_limit' ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {c.ultimo_status || 'novo'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-[10px]">Último NSU</p><p className="font-mono text-[10px]">{c.ultimo_nsu}</p></div>
                <div><p className="text-muted-foreground text-[10px]">Max NSU servidor</p><p className="font-mono text-[10px]">{c.max_nsu_servidor || '—'}</p></div>
                <div><p className="text-muted-foreground text-[10px]">Última consulta</p><p>{c.ultima_consulta ? new Date(c.ultima_consulta).toLocaleString('pt-BR') : '—'}</p></div>
                <div><p className="text-muted-foreground text-[10px]">Bloqueado até</p><p>{c.bloqueado_ate ? new Date(c.bloqueado_ate).toLocaleString('pt-BR') : '—'}</p></div>
              </div>
              {c.ultimo_erro && <p className="text-[10px] text-red-700 mt-1">⚠ {c.ultimo_erro}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Filtros + total */}
      <div className="bg-card border rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
          <option value="todas">Todas as empresas</option>
          <option value="NeuralTec">NeuralTec</option>
          <option value="Liesch">Liesch</option>
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
          <option value="todos">Todos os status</option>
          <option value="novo">Novo</option>
          <option value="analisado">Analisado</option>
          <option value="vinculado">Vinculado</option>
          <option value="ignorado">Ignorado</option>
        </select>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{filtered.length} de {nfes.length} · Total {formatCurrency(total)}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {nfes.length === 0
              ? 'Nenhuma NFe recebida ainda. Use "Sincronizar NeuralTec" para baixar do AN.'
              : 'Nenhum documento corresponde aos filtros.'}
          </p>
          {nfes.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Verifique se há certificado válido em /certificado-nfe.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                  <th className="text-left px-3 py-2 font-semibold">Nº / Chave</th>
                  <th className="text-left px-3 py-2 font-semibold">Emitente</th>
                  <th className="text-left px-3 py-2 font-semibold">Emissão</th>
                  <th className="text-right px-3 py-2 font-semibold">Valor</th>
                  <th className="text-center px-3 py-2 font-semibold">Status</th>
                  <th className="text-center px-3 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${TIPO_COLORS[n.tipo_documento] || 'bg-slate-100'}`}>
                        {n.tipo_documento}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold">Nº {n.numero_nota || '—'}{n.serie ? ` / S${n.serie}` : ''}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">{n.chave_acesso}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold truncate max-w-[220px]">{n.nome_emitente || '—'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{n.cnpj_emitente || '—'} · {n.uf_emitente || '—'}</p>
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {n.valor_total ? formatCurrency(n.valor_total) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PROC_COLORS[n.status_processamento] || 'bg-slate-100'}`}>
                        {n.status_processamento}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(n)} className="gap-1 text-xs h-7">
                        <Eye className="w-3 h-3" /> Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Últimos logs */}
      {logs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Últimas sincronizações</h2>
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Quando</th>
                  <th className="text-left px-3 py-2 font-semibold">Empresa</th>
                  <th className="text-center px-3 py-2 font-semibold">cStat</th>
                  <th className="text-center px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Resultado</th>
                  <th className="text-right px-3 py-2 font-semibold">ms</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                      {l.data_execucao ? new Date(l.data_execucao).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold">{l.empresa}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{l.cstat ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        l.status_final === 'ok' ? 'bg-emerald-100 text-emerald-700'
                          : l.status_final === 'sem_novos' || l.status_final === 'poc' ? 'bg-blue-100 text-blue-700'
                          : l.status_final === 'bloqueado_consumo' ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>{l.status_final}</span>
                    </td>
                    <td className="px-3 py-2 text-[11px] truncate max-w-md">{l.mensagem || l.x_motivo || '—'}</td>
                    <td className="px-3 py-2 text-right text-[10px] tabular-nums text-muted-foreground">{l.duracao_ms ? l.duracao_ms : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <NFeRecebidaDrawer nfe={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}