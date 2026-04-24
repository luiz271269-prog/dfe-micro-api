import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Bell, X, CheckCircle2, AlertTriangle, FileCode, ExternalLink } from 'lucide-react';

const TIPO_LABELS = {
  score_baixo: 'Score baixo',
  ncm_invalido: 'NCM inválido',
  aliquota_atipica: 'Alíquota atípica',
  valor_divergente: 'Valor divergente',
  cst_inconsistente: 'CST/CFOP',
  aritmetica_icms: 'Aritmética ICMS',
  sem_pedido: 'Sem pedido',
};

const SEV_COR = {
  alta: 'border-rose-300 bg-rose-50',
  media: 'border-amber-300 bg-amber-50',
  baixa: 'border-blue-300 bg-blue-50',
};

function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const diffMin = Math.floor((hoje - d) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString('pt-BR');
}

export default function PainelNotificacoes() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  async function carregar() {
    try {
      const list = await base44.entities.NotificacaoConformidade.filter({ resolvida: false }, '-created_date', 30);
      setNotifs(Array.isArray(list) ? list : []);
    } catch {
      // silencioso: rede instável ou entidade ainda não disponível
    }
  }

  useEffect(() => {
    carregar();
    let unsub = () => {};
    try {
      unsub = base44.entities.NotificacaoConformidade.subscribe(() => carregar());
    } catch {}
    const interval = setInterval(carregar, 60000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const naoLidas = notifs.filter(n => !n.lida).length;

  async function marcarLida(n) {
    if (!n.lida) {
      await base44.entities.NotificacaoConformidade.update(n.id, { lida: true });
      carregar();
    }
  }

  async function resolver(e, n) {
    e.stopPropagation();
    e.preventDefault();
    await base44.entities.NotificacaoConformidade.update(n.id, { resolvida: true, lida: true });
    carregar();
  }

  async function marcarTodasLidas() {
    await Promise.all(notifs.filter(n => !n.lida).map(n => base44.entities.NotificacaoConformidade.update(n.id, { lida: true })));
    carregar();
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
        title="Notificações de conformidade"
      >
        <Bell className="w-4 h-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-rose-600 text-white rounded-full flex items-center justify-center">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-4 top-12 z-50 w-[380px] max-h-[520px] bg-card border rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div>
                <p className="text-sm font-bold">Conformidade Fiscal</p>
                <p className="text-[10px] text-muted-foreground">{notifs.length} alerta(s) ativo(s) · {naoLidas} não lida(s)</p>
              </div>
              <div className="flex items-center gap-1">
                {naoLidas > 0 && (
                  <button onClick={marcarTodasLidas} className="text-[10px] text-indigo-600 hover:underline px-2">
                    Marcar todas
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Nenhum alerta ativo</p>
                  <p className="text-[10px] text-muted-foreground">Todas as NF-e processadas estão em conformidade.</p>
                </div>
              ) : (
                notifs.map(n => (
                  <Link
                    key={n.id}
                    to="/analise-nfe"
                    onClick={() => { marcarLida(n); setOpen(false); }}
                    className={`block p-3 border-b border-l-4 ${SEV_COR[n.severidade] || SEV_COR.media} ${!n.lida ? 'font-semibold' : 'opacity-80'} hover:bg-muted/20 transition-colors`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${n.severidade === 'alta' ? 'text-rose-600' : n.severidade === 'media' ? 'text-amber-600' : 'text-blue-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-card border font-mono uppercase">{TIPO_LABELS[n.tipo] || n.tipo}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${n.severidade === 'alta' ? 'bg-rose-600 text-white' : n.severidade === 'media' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'}`}>
                            {n.severidade}
                          </span>
                          {n.score_conformidade !== undefined && (
                            <span className="text-[9px] text-muted-foreground">score {n.score_conformidade}/100</span>
                          )}
                          <span className="text-[9px] text-muted-foreground ml-auto">{fmtData(n.created_date)}</span>
                        </div>
                        <p className="text-xs mt-1 truncate">{n.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                        {n.detalhes && n.detalhes.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {n.detalhes.slice(0, 3).map((d, i) => (
                              <p key={i} className="text-[10px] text-muted-foreground truncate">• {d.descricao}</p>
                            ))}
                            {n.detalhes.length > 3 && <p className="text-[10px] text-muted-foreground">+{n.detalhes.length - 3} mais…</p>}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-indigo-600 flex items-center gap-0.5">
                            <FileCode className="w-3 h-3" /> NF {n.nfe_numero} · {n.emitente_nome}
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </span>
                          <button
                            onClick={(e) => resolver(e, n)}
                            className="ml-auto text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Resolver
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}