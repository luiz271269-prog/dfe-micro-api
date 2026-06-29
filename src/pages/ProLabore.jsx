import { useState, useEffect } from 'react';
import { consolidarProLabore } from '@/functions/consolidarProLabore';
import { Wallet, CreditCard, Landmark } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator from '../components/shared/MonthNavigator';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';
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

      {/* Aviso conceitual */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
        <p className="text-sm text-violet-900 font-semibold mb-1">💡 O que entra no Pró-labore</p>
        <p className="text-xs text-violet-800 leading-relaxed">
          <strong>Pró-labore</strong> = o que é <strong>seu</strong> (retiradas no extrato + gastos pessoais nos cartões — KaBuM, restaurantes, compras suas). Sai do seu bolso.
          <br />A <strong>folha de pagamento de funcionários</strong> é despesa da empresa e fica na página <strong>Folha de Pagamento</strong>, não aqui.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <GradientCard title="Pró-labore Total" value={formatCurrency(pl.total)} sub="Seu, das 2 fontes" icon={Wallet} gradient="purple" />
            <GradientCard title="Retiradas (Extrato)" value={formatCurrency(pl.retiradas_extrato.total)} sub={`${pl.retiradas_extrato.itens.length} lançamento(s)`} icon={Landmark} gradient="blue" />
            <GradientCard title="Gastos nos Cartões" value={formatCurrency(pl.gastos_cartao.total)} sub={`${pl.gastos_cartao.itens.length} lançamento(s)`} icon={CreditCard} gradient="orange" />
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
        </>
      )}
    </div>
  );
}