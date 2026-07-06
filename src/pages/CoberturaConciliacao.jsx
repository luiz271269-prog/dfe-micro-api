import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { migrarParaVinculoExtrato } from '@/functions/migrarParaVinculoExtrato';
import { diagnosticoConciliacao } from '@/functions/diagnosticoConciliacao';
import PainelConciliacoes from '../components/conciliacao/PainelConciliacoes';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';
import { Activity, RefreshCw, Zap, CheckCircle2, AlertTriangle, Link2, FileText, Wallet, Users, AlertCircle, Hammer, ShoppingCart, CreditCard } from 'lucide-react';

const ENTIDADES_LABEL = {
  tributos:      { label: 'Tributos',           icon: AlertCircle,   color: 'red'    },
  folhas:        { label: 'Folha de Pagamento', icon: Users,         color: 'indigo' },
  despesas:      { label: 'Despesas',           icon: Wallet,        color: 'rose'   },
  obras:         { label: 'Obras e Reformas',   icon: Hammer,        color: 'amber'  },
  faturas:       { label: 'Faturas Cartão',     icon: CreditCard,    color: 'purple' },
  itens_compra:  { label: 'Itens de Compra',    icon: ShoppingCart,  color: 'orange' },
};

function BarrinhaCobertura({ com, total }) {
  const pct = total > 0 ? (com / total) * 100 : 0;
  const corBar = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-bold text-foreground">{com} / {total}</span>
        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${corBar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CoberturaConciliacao() {
  const [diagnostico, setDiagnostico] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracao, setResultadoMigracao] = useState(null);

  async function carregar() {
    setLoading(true);
    const res = await diagnosticoConciliacao({});
    setDiagnostico(res?.data || null);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function rodarMigracao() {
    setMigrando(true);
    setResultadoMigracao(null);
    const res = await migrarParaVinculoExtrato({ desde_data: '2025-01-01' });
    setResultadoMigracao(res?.data || null);
    setMigrando(false);
    await carregar();
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const ext = diagnostico?.resumo?.lancamentos_extrato || {};
  const pctExtrato = ext.total > 0 ? (ext.com_vinculo / ext.debitos) * 100 : 0;

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Cobertura de Conciliação"
        subtitle="Quanto do extrato bancário tem vínculo com obrigações reais (VinculoExtrato)"
      >
        <Button variant="outline" onClick={carregar} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
        <Button onClick={rodarMigracao} disabled={migrando} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Zap className="w-4 h-4" /> {migrando ? 'Processando...' : 'Buscar tudo que foi pago'}
        </Button>
      </PageHeader>

      {resultadoMigracao && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
          <p className="font-bold text-emerald-900 text-sm mb-2">
            ✓ Migração concluída — {resultadoMigracao.cobertura?.conciliados} de {resultadoMigracao.cobertura?.total} lançamentos com vínculo
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.item_compra}</span> compras</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.conciliacao_item}</span> notas fiscais</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.tributo_auto}</span> tributos</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.folha_auto}</span> folhas</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.despesa_auto}</span> despesas</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.obra_auto}</span> obras</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-emerald-700 font-bold">{resultadoMigracao.stats.fatura_auto}</span> faturas</div>
            <div className="bg-white rounded px-2 py-1"><span className="text-amber-700 font-bold">{resultadoMigracao.stats.ja_existentes}</span> já existiam</div>
          </div>
        </div>
      )}

      {/* Hero card — cobertura geral do extrato */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">Extrato Bancário · Saúde Contábil</p>
            </div>
            <p className="text-4xl font-extrabold tracking-tight">{pctExtrato.toFixed(1)}%</p>
            <p className="text-sm opacity-90 mt-1">
              <strong>{ext.com_vinculo}</strong> de <strong>{ext.debitos}</strong> débitos com vínculo · {ext.creditos} créditos · {ext.total} total
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">Sem vínculo</p>
            <p className="text-3xl font-bold">{ext.sem_vinculo}</p>
            <p className="text-xs opacity-80">lançamentos</p>
          </div>
        </div>
        <div className="mt-4 h-3 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${pctExtrato}%` }} />
        </div>
      </div>

      <PainelConciliacoes onConciliado={carregar} />

      {/* Grid: cobertura por entidade */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Cobertura por Tipo de Obrigação</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {Object.entries(ENTIDADES_LABEL).map(([key, meta]) => {
          const d = diagnostico?.resumo?.[key];
          if (!d) return null;
          const Icon = meta.icon;
          return (
            <div key={key} className="bg-card rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 text-${meta.color}-600`} />
                  <p className="text-sm font-bold">{meta.label}</p>
                </div>
                {d.comVinculo === d.total && d.total > 0 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {d.semVinculo > 0 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </div>
              <BarrinhaCobertura com={d.comVinculo} total={d.total} />
              <div className="mt-3 grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-emerald-50 rounded p-1.5 text-center">
                  <p className="font-bold text-emerald-700">{d.comVinculo}</p>
                  <p className="text-emerald-600">vinculados</p>
                </div>
                <div className="bg-amber-50 rounded p-1.5 text-center">
                  <p className="font-bold text-amber-700">{d.valorNaoBate}</p>
                  <p className="text-amber-600">valor ≠ extrato</p>
                </div>
                <div className="bg-rose-50 rounded p-1.5 text-center">
                  <p className="font-bold text-rose-700">{d.semData}</p>
                  <p className="text-rose-600">sem data</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top débitos sem vínculo */}
      {diagnostico?.top_debitos_sem_vinculo?.length > 0 && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Maiores débitos sem vínculo — precisam atenção
          </h2>
          <div className="bg-card rounded-xl border overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Descrição</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Categoria</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostico.top_debitos_sem_vinculo.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2 font-medium">{l.descricao}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{l.categoria}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-rose-600 tabular-nums">{formatCurrency(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-blue-900 mb-1 flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Como interpretar
        </p>
        <ul className="text-xs text-blue-800 space-y-1 list-disc ml-5">
          <li><strong>Cobertura % alta:</strong> a maioria dos débitos do extrato tem origem rastreável (compra, despesa, tributo etc.)</li>
          <li><strong>Valor ≠ extrato:</strong> a obrigação está marcada como paga, mas nenhum débito do extrato bate com o valor — pode ter sido pago em outra conta, ou o extrato está incompleto</li>
          <li><strong>Sem data:</strong> a obrigação não tem data_pagamento preenchida — impossível casar com o extrato sem isso</li>
          <li><strong>Débitos sem vínculo:</strong> dinheiro saiu da conta sem origem identificada — pode ser despesa não cadastrada, transferência, tarifa ou empréstimo</li>
        </ul>
      </div>
    </div>
  );
}