import { useState, useEffect } from 'react';
import { consolidarProLabore } from '@/functions/consolidarProLabore';
import { Wallet, CreditCard, Landmark, Users, TrendingUp } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator from '../components/shared/MonthNavigator';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency, formatDate } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';
import ProLaboreTimeline from '../components/prolabore/ProLaboreTimeline';
import ProLaboreRankingCartoes from '../components/prolabore/ProLaboreRankingCartoes';
import ProLaboreListaOrigem from '../components/prolabore/ProLaboreListaOrigem';

export default function ProLabore() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);

  async function load() {
    setLoading(true);
    const res = await consolidarProLabore(isAnnual ? {} : { mes_referencia: selectedMonth });
    setDados(res?.data || null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [selectedMonth, isAnnual]); // eslint-disable-line

  const pl = dados?.pro_labore;
  const folha = dados?.folha_pagamento_empresa;

  return (
    <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Pró-labore Unificado" subtitle="Tudo que sai do seu bolso — retiradas + gastos pessoais em todos os cartões">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
        />
      </PageHeader>

      {/* Aviso conceitual — separa pró-labore de folha */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
        <p className="text-sm text-violet-900 font-semibold mb-1">💡 Como esta página separa os conceitos</p>
        <p className="text-xs text-violet-800 leading-relaxed">
          <strong>Pró-labore</strong> = o que é <strong>seu</strong> (retiradas no extrato + gastos pessoais nos cartões — KaBuM, restaurantes, compras suas). Sai do seu bolso.
          <br /><strong>Folha de Pagamento</strong> = salário de funcionários = <strong>despesa da empresa</strong>. Mostrada à parte, nunca somada ao pró-labore.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !dados ? (
        <p className="text-center py-20 text-muted-foreground">Não foi possível carregar os dados.</p>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <GradientCard title="Pró-labore Total" value={formatCurrency(pl.total)} sub="Seu, das 3 fontes" icon={Wallet} gradient="purple" />
            <GradientCard title="Retiradas (Extrato)" value={formatCurrency(pl.retiradas_extrato.total)} sub={`${pl.retiradas_extrato.itens.length} lançamento(s)`} icon={Landmark} gradient="blue" />
            <GradientCard title="Gastos nos Cartões" value={formatCurrency(pl.gastos_cartao.total)} sub={`${pl.gastos_cartao.itens.length} lançamento(s)`} icon={CreditCard} gradient="orange" />
            <GradientCard title="Folha (Empresa)" value={formatCurrency(folha.total)} sub="Despesa da empresa — à parte" icon={Users} gradient="green" />
          </div>

          {/* Timeline mensal (só na visão anual) */}
          {isAnnual && dados.timeline?.length > 0 && (
            <ProLaboreTimeline timeline={dados.timeline} />
          )}

          {/* Ranking de cartões */}
          {dados.ranking_cartoes?.length > 0 && (
            <ProLaboreRankingCartoes ranking={dados.ranking_cartoes} totalCartao={pl.gastos_cartao.total} />
          )}

          {/* Detalhamento por origem */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <ProLaboreListaOrigem
              titulo="Gastos Pessoais nos Cartões"
              icon={CreditCard}
              cor="orange"
              total={pl.gastos_cartao.total}
              itens={pl.gastos_cartao.itens}
            />
            <ProLaboreListaOrigem
              titulo="Retiradas no Extrato"
              icon={Landmark}
              cor="blue"
              total={pl.retiradas_extrato.total}
              itens={pl.retiradas_extrato.itens}
              emptyHint="Nenhuma retirada classificada como Pró-labore no extrato. Classifique lançamentos como 'Pró-labore' no Extrato Bancário."
            />
          </div>

          {/* Folha — separada visualmente */}
          <div className="mt-6 bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold">Folha de Pagamento — Despesa da Empresa</h3>
              <span className="ml-auto text-sm font-bold text-emerald-600">{formatCurrency(folha.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground italic mb-3">{folha.observacao}</p>
            {(folha.extrato.length === 0 && folha.rh.length === 0) ? (
              <p className="text-xs text-muted-foreground py-2">Sem folha registrada no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {[...folha.extrato, ...folha.rh].map(f => (
                      <tr key={f.id} className="border-b last:border-b-0">
                        <td className="py-1.5 whitespace-nowrap w-24 text-muted-foreground">{f.data ? formatDate(f.data) : f.mes}</td>
                        <td className="py-1.5">{f.descricao}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{formatCurrency(f.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}