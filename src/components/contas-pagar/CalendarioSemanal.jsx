import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Landmark, Users, CreditCard, ShoppingCart, Hammer, Briefcase, Calendar, Link2, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import SeletorClassificacao from '../shared/SeletorClassificacao';
import { mapearTipoEntidade } from '../../lib/contasPagarEngine';

const ORIGEM_CONFIG = {
  despesa: { icon: Wallet,     color: 'bg-emerald-100 text-emerald-700', label: 'Despesa', href: '/despesas' },
  tributo: { icon: Landmark,   color: 'bg-orange-100 text-orange-700',   label: 'Tributo', href: '/tributos' },
  folha:   { icon: Users,      color: 'bg-indigo-100 text-indigo-700',   label: 'Folha',   href: '/funcionarios' },
  fatura:  { icon: CreditCard, color: 'bg-purple-100 text-purple-700',   label: 'Cartão',  href: '/cartoes' },
  compra:  { icon: ShoppingCart, color: 'bg-sky-100 text-sky-700',        label: 'Compra',  href: '/compras' },
  obra:    { icon: Hammer,     color: 'bg-amber-100 text-amber-700',     label: 'Obra',    href: '/obras' },
  pro_labore: { icon: Briefcase, color: 'bg-fuchsia-100 text-fuchsia-700', label: 'Pró-labore', href: '/prolabore' },
};
const ORIGEM_FALLBACK = { icon: Wallet, color: 'bg-muted text-muted-foreground', label: 'Outro', href: '/contas-a-pagar' };

// dado um YYYY-MM, retorna semanas do mês (cada uma com ISO start/end)
function gerarSemanasDoMes(mesRef) {
  const [yyyy, mm] = mesRef.split('-').map(Number);
  const primeiro = new Date(Date.UTC(yyyy, mm - 1, 1));
  const ultimo  = new Date(Date.UTC(yyyy, mm, 0));
  const semanas = [];
  let cur = new Date(primeiro);
  while (cur <= ultimo) {
    // Início da semana = segunda-feira (ou dia 1 se for o primeiro)
    const inicio = new Date(cur);
    // Fim = domingo da mesma semana ou último dia do mês
    const dow = cur.getUTCDay(); // 0=dom, 1=seg, ...
    const diasParaDomingo = (7 - dow) % 7; // dias até domingo
    const fim = new Date(cur);
    fim.setUTCDate(cur.getUTCDate() + diasParaDomingo);
    if (fim > ultimo) fim.setTime(ultimo.getTime());
    semanas.push({
      inicio: inicio.toISOString().slice(0, 10),
      fim: fim.toISOString().slice(0, 10),
    });
    cur = new Date(fim);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return semanas;
}

export default function CalendarioSemanal({ itens, conciliadosSet, mesReferencia, modo = 'aberto' }) {
  const porEmissao = modo === 'pagos';
  const hoje = new Date().toISOString().slice(0, 10);

  const grupos = useMemo(() => {
    const semanas = gerarSemanasDoMes(mesReferencia);
    const buckets = semanas.map((s, idx) => ({
      ...s,
      idx: idx + 1,
      itens: [],
    }));
    const vencidos = [];
    const semData = [];
    itens.forEach(i => {
      const dv = i.data_vencimento;
      if (!dv) { semData.push(i); return; }
      // Vencidos: antes de hoje E não pertencem ao mês referência
      if (dv < hoje && dv.slice(0, 7) < mesReferencia) { vencidos.push(i); return; }
      // Se o vencimento é no mês de referência, distribui por semana
      if (dv.slice(0, 7) === mesReferencia) {
        const b = buckets.find(s => dv >= s.inicio && dv <= s.fim);
        if (b) b.itens.push(i);
        else if (dv < hoje) vencidos.push(i);
        return;
      }
      // Fora do mês (passado de meses anteriores, ainda em aberto)
      if (dv < hoje) vencidos.push(i);
      // Datas futuras de outros meses não entram aqui (o filtro de mês já trata)
    });
    return { semanas: buckets, vencidos, semData };
  }, [itens, mesReferencia, hoje]);

  function renderItem(i) {
    const cfg = ORIGEM_CONFIG[i.origem_tipo] || ORIGEM_FALLBACK;
    const OIcon = cfg.icon;
    const entityName = mapearTipoEntidade(i.origem_tipo);
    const ok = conciliadosSet.has(i);
    return (
      <div key={i.id} className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
        <span className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded ${cfg.color}`}>
          <OIcon className="w-3 h-3" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{i.descricao}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            <span>{i.data_vencimento ? formatDate(i.data_vencimento) : 'Sem data'}</span>
            {i.fornecedor && <span className="truncate">· {i.fornecedor}</span>}
            {ok ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold"><Link2 className="w-2.5 h-2.5" /> {porEmissao ? 'Conciliado' : 'OK'}</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-amber-700 font-semibold"><AlertTriangle className="w-2.5 h-2.5" /> Pendente</span>
            )}
          </div>
          {/* Classificação unificada — só para itens com entidade real (projeções não têm) */}
          {entityName && !i.is_planejado && (
            <div className="flex items-center gap-1.5 mt-1">
              <SeletorClassificacao
                eixo="origem"
                entityName={entityName}
                record={{ id: i.origem_id, origem_compra: i.origem_compra }}
                field="origem_compra"
              />
              <SeletorClassificacao
                eixo="tipo"
                entityName={entityName}
                record={{ id: i.origem_id, tipo_compra: i.tipo_compra }}
                field="tipo_compra"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-bold text-rose-600 tabular-nums whitespace-nowrap">{formatCurrency(i.valor)}</span>
          <Link to={cfg.href} className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
            ver <ArrowRight className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>
    );
  }

  function renderBucket(title, list, color = 'bg-muted/40') {
    if (!list || list.length === 0) return null;
    const total = list.reduce((a, b) => a + (b.valor || 0), 0);
    return (
      <div className="border-b last:border-b-0">
        <div className={`px-3 py-1.5 ${color} flex items-center justify-between text-xs font-semibold`}>
          <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {title}</span>
          <span className="tabular-nums">{formatCurrency(total)} <span className="font-normal text-muted-foreground">· {list.length}</span></span>
        </div>
        {list.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')).map(renderItem)}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border overflow-hidden flex flex-col">
      <div className="bg-slate-50 border-b px-4 py-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> Calendário do Mês — por Semana</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {porEmissao ? 'Pagos, distribuídos pela data de emissão' : 'Obrigações distribuídas semana a semana'} de {mesReferencia}
        </p>
      </div>
      <div className="overflow-y-auto max-h-[600px]">
        {renderBucket(porEmissao ? 'Meses anteriores' : 'Vencidos (meses anteriores)', grupos.vencidos, porEmissao ? 'bg-muted/40' : 'bg-red-50 text-red-700')}
        {grupos.semanas.map(s => renderBucket(
          `Semana ${s.idx} · ${formatDate(s.inicio)} → ${formatDate(s.fim)}`,
          s.itens,
          'bg-blue-50 text-blue-700'
        ))}
        {renderBucket('Sem data de vencimento', grupos.semData, 'bg-muted/40')}
        {grupos.vencidos.length === 0 && grupos.semData.length === 0 && grupos.semanas.every(s => s.itens.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-sm">{porEmissao ? 'Nenhum pagamento com emissão neste mês.' : 'Nenhuma conta a pagar neste mês.'}</div>
        )}
      </div>
    </div>
  );
}