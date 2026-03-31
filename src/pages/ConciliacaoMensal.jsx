import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Scale, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Conciliação JS Nativa ──────────────────────────────────────────────────────
function conciliarMes(entradas, nfs) {
  const TOLERANCIA = 0.02;
  const EXTERNOS = ['LISTO TECNOLOGIA', 'CIA LATINO AMERICANA', 'LISTO TEC'];
  const EMPRESTIMO_KEYWORDS = ['CLEBER BONAT', 'EMPRESTIMO', 'MUTUO'];
  const COB_KEYWORDS = ['LIQ.COBRAN', 'LIQ.COBRANCA', 'LIQUIDACAO COBRANCA'];

  const nfsPorValor = {};
  nfs.forEach(nf => {
    const v = nf.valor_total;
    if (!nfsPorValor[v]) nfsPorValor[v] = [];
    nfsPorValor[v].push(nf);
  });

  const resultado = [];
  const nfsUsadas = new Set();

  entradas.forEach(entrada => {
    const v = entrada.valor;
    const desc = (entrada.descricao || '').toUpperCase();
    const doc = (entrada.detalhe || entrada.descricao || '').toUpperCase();

    let item = {
      mes_referencia: entrada.mes_referencia,
      data_extrato: entrada.data,
      doc_extrato: entrada.detalhe || '',
      desc_extrato: entrada.descricao,
      valor_extrato: v,
      saldo_apos: entrada.saldo_apos,
      nf_referencia: '—',
      cliente_nf: '—',
      valor_nf: null,
      emissao_nf: null,
      status_conciliacao: 'nao_identificado',
      observacao: '',
      lancamento_bancario_id: entrada.id,
      nota_fiscal_ids: []
    };

    // REGRA 1: EMPRÉSTIMO
    if (EMPRESTIMO_KEYWORDS.some(k => desc.includes(k)) ||
        (v >= 50000 && !COB_KEYWORDS.some(k => desc.includes(k)) && !EXTERNOS.some(k => desc.includes(k)))) {
      item.status_conciliacao = 'emprestimo';
      item.nf_referencia = '⚠ EMPRÉSTIMO';
      item.cliente_nf = entrada.descricao + ' — não é receita de vendas';
      item.valor_nf = v;
      item.observacao = '⚠ EMPRÉSTIMO — excluir da receita. Verificar aplicação/devolução';
      resultado.push(item);
      return;
    }

    // REGRA 2: EXTERNO
    if (EXTERNOS.some(k => desc.includes(k))) {
      item.status_conciliacao = 'externo';
      item.nf_referencia = '—';
      item.cliente_nf = 'Serviço/receita externa — sem NF NeuralTec';
      item.valor_nf = v;
      item.observacao = '~ Recebimento externo recorrente — sem NF no sistema';
      resultado.push(item);
      return;
    }

    const isCOB = COB_KEYWORDS.some(k => desc.includes(k)) || doc.startsWith('COB');
    const nfsExatas = (nfsPorValor[v] || []).filter(nf => !nfsUsadas.has(nf.id));

    // REGRA 3: MATCH EXATO
    if (nfsExatas.length > 0) {
      const nf = nfsExatas[0];
      nfsUsadas.add(nf.id);
      const emissao = nf.data_emissao ? nf.data_emissao.substring(8, 10) + '/' + nf.data_emissao.substring(5, 7) : '';
      item.status_conciliacao = 'conciliado';
      item.nf_referencia = 'NF-' + nf.numero;
      item.cliente_nf = nf.cliente;
      item.valor_nf = nf.valor_total;
      item.emissao_nf = emissao;
      item.nota_fiscal_ids = [nf.id];
      item.observacao = '✓ ' + (isCOB ? 'COB' : doc.includes('PIX') ? 'PIX' : 'TED') + ' valor exato — NF emitida ' + emissao;
      resultado.push(item);
      return;
    }

    // REGRA 4: COB sem match → tentar soma 2 NFs
    if (isCOB) {
      const todasNfDisp = nfs.filter(nf => !nfsUsadas.has(nf.id));
      let found2 = false;
      for (let i = 0; i < todasNfDisp.length && !found2; i++) {
        for (let j = i + 1; j < todasNfDisp.length && !found2; j++) {
          const soma = todasNfDisp[i].valor_total + todasNfDisp[j].valor_total;
          if (Math.abs(soma - v) <= TOLERANCIA) {
            nfsUsadas.add(todasNfDisp[i].id);
            nfsUsadas.add(todasNfDisp[j].id);
            const em_i = todasNfDisp[i].data_emissao ? todasNfDisp[i].data_emissao.substring(8, 10) + '/' + todasNfDisp[i].data_emissao.substring(5, 7) : '';
            const em_j = todasNfDisp[j].data_emissao ? todasNfDisp[j].data_emissao.substring(8, 10) + '/' + todasNfDisp[j].data_emissao.substring(5, 7) : '';
            item.status_conciliacao = 'soma_nfs';
            item.nf_referencia = 'NF-' + todasNfDisp[i].numero + '+NF-' + todasNfDisp[j].numero;
            item.cliente_nf = todasNfDisp[i].cliente + ' + ' + todasNfDisp[j].cliente.split(' ')[0];
            item.valor_nf = soma;
            item.emissao_nf = em_i + ' e ' + em_j;
            item.nota_fiscal_ids = [todasNfDisp[i].id, todasNfDisp[j].id];
            item.observacao = '✓ COB — NF-' + todasNfDisp[i].numero + ' + NF-' + todasNfDisp[j].numero + ' = R$' + soma.toFixed(2);
            found2 = true;
          }
        }
      }
      if (found2) { resultado.push(item); return; }
      item.status_conciliacao = 'cob_lote';
      item.nf_referencia = 'Lote';
      item.cliente_nf = 'Ver boletos ' + (doc || 'COB') + ' — solicitar detalhe Sicredi';
      item.valor_nf = v;
      item.observacao = '⚠ COB lote — solicitar detalhamento ao Sicredi';
      resultado.push(item);
      return;
    }

    // REGRA 5: MATCH COM TOLERÂNCIA
    const nfsAprox = nfs.filter(nf => !nfsUsadas.has(nf.id) && Math.abs(nf.valor_total - v) <= TOLERANCIA);
    if (nfsAprox.length > 0) {
      const nf = nfsAprox[0];
      nfsUsadas.add(nf.id);
      const emissao = nf.data_emissao ? nf.data_emissao.substring(8, 10) + '/' + nf.data_emissao.substring(5, 7) : '';
      item.status_conciliacao = 'conciliado';
      item.nf_referencia = 'NF-' + nf.numero;
      item.cliente_nf = nf.cliente;
      item.valor_nf = nf.valor_total;
      item.emissao_nf = emissao;
      item.nota_fiscal_ids = [nf.id];
      item.observacao = '✓ ' + (doc.includes('PIX') ? 'PIX' : 'TED') + ' exato — NF emitida ' + emissao;
      resultado.push(item);
      return;
    }

    // REGRA 6: SOMA DE 2 NFs
    const todasDisp = nfs.filter(nf => !nfsUsadas.has(nf.id));
    let found = false;
    for (let i = 0; i < todasDisp.length && !found; i++) {
      for (let j = i + 1; j < todasDisp.length && !found; j++) {
        const soma = todasDisp[i].valor_total + todasDisp[j].valor_total;
        if (Math.abs(soma - v) <= TOLERANCIA) {
          nfsUsadas.add(todasDisp[i].id);
          nfsUsadas.add(todasDisp[j].id);
          const em_i = todasDisp[i].data_emissao ? todasDisp[i].data_emissao.substring(8, 10) + '/' + todasDisp[i].data_emissao.substring(5, 7) : '';
          const em_j = todasDisp[j].data_emissao ? todasDisp[j].data_emissao.substring(8, 10) + '/' + todasDisp[j].data_emissao.substring(5, 7) : '';
          item.status_conciliacao = 'soma_nfs';
          item.nf_referencia = 'NF-' + todasDisp[i].numero + '+NF-' + todasDisp[j].numero;
          item.cliente_nf = todasDisp[i].cliente + ' + ' + todasDisp[j].cliente.split(' ')[0];
          item.valor_nf = soma;
          item.emissao_nf = em_i + ' e ' + em_j;
          item.nota_fiscal_ids = [todasDisp[i].id, todasDisp[j].id];
          item.observacao = '✓ NF-' + todasDisp[i].numero + ' + NF-' + todasDisp[j].numero + ' = R$' + soma.toFixed(2);
          found = true;
        }
      }
    }
    if (found) { resultado.push(item); return; }

    // REGRA 7: NÃO IDENTIFICADO
    item.observacao = v < 1000 ? 'Valor pequeno — não identificado' : '⚠ Verificar manualmente — sem NF correspondente';
    resultado.push(item);
  });

  return resultado;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CONFIG = {
  conciliado:       { label: '✓ Conciliado',  bg: 'bg-green-50',   badge: 'bg-green-100 text-green-800',    card: 'bg-green-50 border-green-200',  title: '✓ Conciliados' },
  soma_nfs:         { label: '✓ Soma NFs',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-800',      card: 'bg-blue-50 border-blue-200',    title: '✓ Soma de NFs' },
  cob_lote:         { label: '⚠ COB Lote',   bg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-800',  card: 'bg-yellow-50 border-yellow-200',title: '⚠ COB Lotes' },
  externo:          { label: '~ Externo',     bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-800',  card: 'bg-purple-50 border-purple-200',title: '~ Externos' },
  nao_identificado: { label: '? Verificar',   bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-800',  card: 'bg-orange-50 border-orange-200',title: '? Não identificados' },
  emprestimo:       { label: '⚠ Empréstimo', bg: 'bg-red-50',     badge: 'bg-red-100 text-red-800',        card: 'bg-red-50 border-red-200',      title: '⚠ Empréstimos' },
};

function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function fmtMesLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return nomes[parseInt(mo) - 1] + ' ' + y;
}

// ── Componente Principal ───────────────────────────────────────────────────────
export default function ConciliacaoMensal() {
  const { toast } = useToast();
  const [meses, setMeses] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [metodologiaAberta, setMetodologiaAberta] = useState(false);
  const [nfsMes, setNfsMes] = useState([]);

  // Carregar meses disponíveis
  useEffect(() => {
    base44.entities.LancamentoBancario.list('-data', 500).then(lancamentos => {
      const mesSet = new Set();
      lancamentos.filter(l => l.valor > 0).forEach(l => {
        if (l.mes_referencia) mesSet.add(l.mes_referencia);
      });
      const sorted = Array.from(mesSet).sort().reverse();
      setMeses(sorted);
      if (sorted.length > 0) setMesSelecionado(sorted[0]);
    });
  }, []);

  // Carregar dados quando mês muda — se não há dados, processa automaticamente
  useEffect(() => {
    if (!mesSelecionado) return;
    setLoading(true);
    Promise.all([
      base44.entities.ConciliacaoItem.filter({ mes_referencia: mesSelecionado }),
      base44.entities.NotaFiscal.list('-data_emissao', 200),
      base44.entities.LancamentoBancario.list('-data', 500),
    ]).then(async ([concItems, todasNfs, todosLanc]) => {
      const mesAnt = mesAnterior(mesSelecionado);
      const nfsFiltradas = todasNfs.filter(nf => {
        if (!nf.data_emissao) return false;
        return nf.data_emissao >= mesAnt + '-01' && nf.data_emissao <= mesSelecionado + '-31';
      });
      setNfsMes(nfsFiltradas);

      if (concItems.length > 0) {
        setItens(concItems.sort((a, b) => a.data_extrato > b.data_extrato ? 1 : -1));
        return;
      }

      // Sem dados → processar automaticamente
      const entradas = todosLanc.filter(l => l.mes_referencia === mesSelecionado && l.valor > 0);
      if (entradas.length === 0) return;

      setLoading(false);
      setProcessando(true);
      const resultado = conciliarMes(entradas, nfsFiltradas);
      await base44.entities.ConciliacaoItem.bulkCreate(resultado);
      const salvos = await base44.entities.ConciliacaoItem.filter({ mes_referencia: mesSelecionado });
      const sorted = salvos.sort((a, b) => a.data_extrato > b.data_extrato ? 1 : -1);
      setItens(sorted);
      const counts = {};
      resultado.forEach(r => { counts[r.status_conciliacao] = (counts[r.status_conciliacao] || 0) + 1; });
      toast({
        title: `✓ ${resultado.length} entradas processadas`,
        description: `${counts.conciliado || 0} conciliadas · ${counts.cob_lote || 0} COB lotes · ${counts.nao_identificado || 0} a verificar`,
      });
      setProcessando(false);
    }).finally(() => setLoading(false));
  }, [mesSelecionado]);

  const handleProcessar = async (reprocessar = false) => {
    setProcessando(true);
    try {
      if (reprocessar && itens.length > 0) {
        await Promise.all(itens.map(i => base44.entities.ConciliacaoItem.delete(i.id)));
      }
      const lancamentos = await base44.entities.LancamentoBancario.filter({ mes_referencia: mesSelecionado });
      const entradas = lancamentos.filter(l => l.valor > 0);
      const resultado = conciliarMes(entradas, nfsMes);

      // Salvar com deduplicação
      const existentes = await base44.entities.ConciliacaoItem.filter({ mes_referencia: mesSelecionado });
      const existKey = new Set(existentes.map(e => `${e.data_extrato}|${e.desc_extrato}|${e.valor_extrato}`));
      const novos = resultado.filter(r => !existKey.has(`${r.data_extrato}|${r.desc_extrato}|${r.valor_extrato}`));

      if (novos.length > 0) {
        await base44.entities.ConciliacaoItem.bulkCreate(novos);
      }

      const salvos = await base44.entities.ConciliacaoItem.filter({ mes_referencia: mesSelecionado });
      const sorted = salvos.sort((a, b) => a.data_extrato > b.data_extrato ? 1 : -1);
      setItens(sorted);

      const counts = {};
      resultado.forEach(r => { counts[r.status_conciliacao] = (counts[r.status_conciliacao] || 0) + 1; });
      toast({
        title: `✓ ${resultado.length} entradas processadas`,
        description: `${counts.conciliado || 0} conciliadas · ${counts.cob_lote || 0} COB lotes · ${counts.externo || 0} externos · ${counts.nao_identificado || 0} a verificar`,
      });
    } finally {
      setProcessando(false);
    }
  };

  // Métricas
  const metricas = useMemo(() => {
    const tot = (s) => itens.filter(i => i.status_conciliacao === s).reduce((a, i) => a + (i.valor_extrato || 0), 0);
    const totalEntradas = itens.reduce((a, i) => a + (i.valor_extrato || 0), 0);
    const emprestimos = tot('emprestimo');
    const receitaReal = totalEntradas - emprestimos;
    const faturadoNFs = nfsMes.reduce((a, n) => a + (n.valor_total || 0), 0);
    const diff = receitaReal - faturadoNFs;
    const diffPct = faturadoNFs > 0 ? (Math.abs(diff) / faturadoNFs) * 100 : 0;
    const saldoInicial = itens.length > 0 ? (itens[0].saldo_apos || 0) - (itens[0].valor_extrato || 0) : 0;
    const saldoFinal = itens.length > 0 ? itens[itens.length - 1].saldo_apos || 0 : 0;
    return {
      conciliado: tot('conciliado'), soma_nfs: tot('soma_nfs'), cob_lote: tot('cob_lote'),
      externo: tot('externo'), nao_identificado: tot('nao_identificado'), emprestimo: emprestimos,
      receitaReal, faturadoNFs, diff, diffPct, totalEntradas, saldoInicial, saldoFinal,
      countTotal: itens.length,
    };
  }, [itens, nfsMes]);

  const temDados = itens.length > 0;

  return (
    <div className="p-4 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Conciliação Mensal</h1>
            <p className="text-xs text-muted-foreground">Extrato Sicredi × Notas Fiscais do sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={mesSelecionado}
            onChange={e => setMesSelecionado(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {meses.map(m => <option key={m} value={m}>{fmtMesLabel(m)}</option>)}
          </select>
          {temDados ? (
            <Button variant="outline" size="sm" onClick={() => handleProcessar(true)} disabled={processando}>
              <RefreshCw className={`w-4 h-4 ${processando ? 'animate-spin' : ''}`} />
              {processando ? 'Re-processando...' : '↺ Re-processar'}
            </Button>
          ) : processando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" /> Processando...
            </div>
          ) : null}
        </div>
      </div>

      {/* Status badge */}
      {temDados && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {metricas.countTotal} entradas · Saldo inicial: {fmt(metricas.saldoInicial)} · Saldo final: {fmt(metricas.saldoFinal)}
        </div>
      )}

      {loading && <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>}

      {!loading && !temDados && !processando && (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-muted-foreground">
          <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum lançamento encontrado para {fmtMesLabel(mesSelecionado)}</p>
          <p className="text-sm mt-1">Verifique se há lançamentos bancários importados para este mês</p>
        </div>
      )}

      {temDados && (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <div key={status} className={`rounded-xl border p-3 ${cfg.card}`}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">{cfg.title}</p>
                <p className="text-sm font-bold mt-1">{fmt(metricas[status])}</p>
                <p className="text-[10px] text-muted-foreground">{itens.filter(i => i.status_conciliacao === status).length} entradas</p>
              </div>
            ))}
          </div>

          {/* Card receita real */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-green-50 border-green-200 p-4">
              <p className="text-xs font-semibold text-green-700 uppercase">Receita Real de Clientes</p>
              <p className="text-2xl font-bold text-green-800 mt-1">{fmt(metricas.receitaReal)}</p>
              <p className="text-[11px] text-green-600 mt-1">Total entradas − empréstimos</p>
            </div>
            <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase">Faturamento Declarado (Simples)</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">{fmt(metricas.faturadoNFs)}</p>
              <p className="text-[11px] text-blue-600 mt-1">{nfsMes.length} NFs emitidas no período</p>
            </div>
            <div className={`rounded-xl border p-4 ${metricas.diffPct <= 5 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-xs font-semibold uppercase ${metricas.diffPct <= 5 ? 'text-green-700' : 'text-orange-700'}`}>Diferença</p>
              <p className={`text-2xl font-bold mt-1 ${metricas.diffPct <= 5 ? 'text-green-800' : 'text-orange-800'}`}>{fmt(metricas.diff)}</p>
              <p className={`text-[11px] mt-1 ${metricas.diffPct <= 5 ? 'text-green-600' : 'text-orange-600'}`}>
                {metricas.diffPct.toFixed(1)}% de divergência {metricas.diffPct <= 5 ? '✓ OK' : '⚠ Verificar'}
              </p>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr>
                    <th colSpan={5} className="px-3 py-2 text-left text-white bg-slate-700 font-semibold text-[11px] uppercase tracking-wide">
                      Extrato Sicredi
                    </th>
                    <th className="w-px bg-slate-500" />
                    <th colSpan={5} className="px-3 py-2 text-left text-white bg-indigo-700 font-semibold text-[11px] uppercase tracking-wide">
                      NF do Sistema
                    </th>
                  </tr>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Data</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Documento</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Descrição</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Valor Entrada</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Saldo</th>
                    <th className="w-px bg-border" />
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">NF / Ref</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Cliente Sistema</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Valor NF</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Emissão</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => {
                    const cfg = STATUS_CONFIG[item.status_conciliacao] || STATUS_CONFIG.nao_identificado;
                    return (
                      <tr key={item.id || idx} className={`border-b ${cfg.bg} hover:brightness-95 transition-all`}>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{item.data_extrato ? item.data_extrato.substring(8, 10) + '/' + item.data_extrato.substring(5, 7) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{item.doc_extrato || '—'}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={item.desc_extrato}>{item.desc_extrato}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(item.valor_extrato)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(item.saldo_apos)}</td>
                        <td className="w-px bg-border" />
                        <td className="px-3 py-2 font-semibold">{item.nf_referencia}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground" title={item.cliente_nf}>{item.cliente_nf}</td>
                        <td className="px-3 py-2 text-right">{fmt(item.valor_nf)}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{item.emissao_nf || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badge}`}>{cfg.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/80 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-xs font-bold">TOTAL ENTRADAS</td>
                    <td className="px-3 py-2 text-right text-green-700 font-bold">{fmt(metricas.totalEntradas)}</td>
                    <td colSpan={2} />
                    <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">
                      Empréstimos: {fmt(metricas.emprestimo)} · Externos: {fmt(metricas.externo)}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-green-100">
                    <td colSpan={3} className="px-3 py-2 text-xs font-bold text-green-800">RECEITA REAL</td>
                    <td className="px-3 py-2 text-right text-green-800 font-bold">{fmt(metricas.receitaReal)}</td>
                    <td colSpan={7} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Metodologia colapsível */}
          <div className="rounded-xl border overflow-hidden">
            <button
              onClick={() => setMetodologiaAberta(!metodologiaAberta)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
            >
              <span>Como funciona a conciliação?</span>
              {metodologiaAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {metodologiaAberta && (
              <div className="px-4 py-3 text-sm text-muted-foreground space-y-2 bg-background">
                <p>Esta conciliação cruza linha por linha as <strong>entradas do extrato bancário Sicredi</strong> com as <strong>Notas Fiscais do sistema</strong> (Fabris/Ellitte).</p>
                <p className="font-semibold text-foreground">Lógica de matching:</p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                  <li>Busca NFs do mês atual e do mês anterior (que vencem com +30 dias no mês atual)</li>
                  <li>Para cada entrada do extrato, tenta encontrar uma NF com valor idêntico (tolerância R$0,02)</li>
                  <li>Se não encontra, tenta combinações de 2 NFs que somem o valor</li>
                  <li>Entradas COB (cobranças em lote) contêm múltiplas NFs — solicitar detalhamento ao Sicredi</li>
                  <li>Empréstimos e recebimentos externos são identificados e excluídos da receita real</li>
                </ol>
                <p><strong>Resultado:</strong> Receita real = total entradas − empréstimos. Esta deve ser próxima do faturamento declarado no Simples Nacional.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}