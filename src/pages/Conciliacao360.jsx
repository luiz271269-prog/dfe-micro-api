import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link2, TrendingUp, CreditCard, ArrowDownCircle, AlertTriangle, Sparkles, Upload, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageHeader from '../components/shared/PageHeader';
import MonthNavigator from '../components/shared/MonthNavigator';
import TabReceita from '../components/conciliacao360/TabReceita';
import TabPagamentos from '../components/conciliacao360/TabPagamentos';
import TabCartoes from '../components/conciliacao360/TabCartoes';
import TabExcecoes from '../components/conciliacao360/TabExcecoes';
import TabSugestoes from '../components/conciliacao360/TabSugestoes';

export default function Conciliacao360() {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [mes, setMes] = useState(mesAtual);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
    lancamentos: [], notas: [], titulos: [], faturas: [],
    lancCartao: [], despesas: [], tributos: [], cartoes: [], regrasRecorrentes: [],
  });

  async function load() {
    setLoading(true);
    const [lancamentos, notas, titulos, faturas, lancCartao, despesas, tributos, cartoes, regrasRecorrentes] = await Promise.all([
      base44.entities.LancamentoBancario.filter({ mes_referencia: mes }),
      base44.entities.NotaFiscal.list('-data_emissao', 500),
      base44.entities.TituloCobranca.list('-data_vencimento', 500),
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.LancamentoCartao.list('-data_lancamento', 500),
      base44.entities.DespesaOperacional.list('-data', 500),
      base44.entities.Tributo.list('-data_vencimento', 200),
      base44.entities.ContaCartao.filter({ is_ativo: true }),
      base44.entities.RegraRecorrente.filter({ ativa: true }),
    ]);
    setDados({ lancamentos, notas, titulos, faturas, lancCartao, despesas, tributos, cartoes, regrasRecorrentes });
    setLoading(false);
  }

  useEffect(() => { load(); }, [mes]); // eslint-disable-line

  // Estatísticas de "pendente de vínculo" para os badges das abas
  const stats = useMemo(() => {
    const creditos = dados.lancamentos.filter(l => l.valor > 0);
    const debitos = dados.lancamentos.filter(l => l.valor < 0);

    // Receita: créditos sem vínculo explícito (descrição PIX/COB sem título pago matching)
    const receitaPendente = creditos.filter(l => {
      const desc = (l.descricao || '').toUpperCase();
      if (desc.includes('TRANSFER') || desc.includes('APORTE')) return false;
      const titMatch = dados.titulos.some(t =>
        t.status === 'pago' && Math.abs((t.valor_pago || 0) - l.valor) < 0.02
        && t.data_pagamento === l.data
      );
      return !titMatch;
    }).length;

    // Pagamentos: débitos não vinculados a despesa/fatura/tributo/título
    const pagamentosPendente = debitos.filter(l => {
      const desc = (l.descricao || '').toUpperCase();
      if (desc.includes('PAGTO CARTAO') || desc.includes('FATURA CARTAO')) {
        // esperado vincular a FaturaCartao — consideramos pendente se não achar
        return !dados.faturas.some(f => Math.abs(f.valor_total - Math.abs(l.valor)) < 1);
      }
      if (l.categoria === 'tributo') {
        return !dados.tributos.some(t => Math.abs((t.valor_pago || t.valor_original) - Math.abs(l.valor)) < 0.5);
      }
      const despMatch = dados.despesas.some(d => Math.abs(d.valor - Math.abs(l.valor)) < 0.5 && d.data === l.data);
      return !despMatch;
    }).length;

    // Cartão: lançamentos empresariais sem despesa vinculada
    const cartaoEmpresarial = dados.lancCartao.filter(lc => lc.natureza === 'empresarial').length;

    return { receitaPendente, pagamentosPendente, cartaoEmpresarial };
  }, [dados]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Conciliação 360°" subtitle="Cruze extrato, notas, títulos, cartões e despesas em um só lugar">
        <MonthNavigator selectedMonth={mes} onSelectMonth={setMes} />
      </PageHeader>

      {/* Ação: importar extrato direto na fila */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 mb-4 flex items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Importar Extrato OFX / PDF</p>
            <p className="text-[11px] text-white/80">
              {dados.lancamentos.length > 0
                ? `${dados.lancamentos.length} lançamentos na fila deste mês. Envie um novo extrato para adicionar mais à conciliação.`
                : 'Nenhum lançamento no mês ainda. Faça upload do OFX/PDF do banco para começar a conciliar.'}
            </p>
          </div>
        </div>
        <Link to="/importar?tipo=extrato_bancario">
          <Button variant="secondary" className="gap-2 bg-white text-indigo-700 hover:bg-white/90">
            <Upload className="w-4 h-4" /> Importar Extrato
          </Button>
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-900 font-semibold mb-1">💡 Como usar</p>
        <p className="text-xs text-blue-800 leading-relaxed">
          O <strong>extrato bancário é o centro</strong>. Cada linha do extrato deve ter um destino claro:
          <br />• <strong>Entradas</strong> (Aba Receita): linkar com Nota Fiscal ou Título Cobrança
          <br />• <strong>Saídas</strong> (Aba Pagamentos): linkar com Despesa, Fatura de Cartão ou Tributo
          <br />• <strong>Dentro da fatura de cartão</strong> (Aba Cartões): classificar como empresarial, pessoal ou reembolso
        </p>
      </div>

      <Tabs defaultValue="pagamentos" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="receita" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Receita
            {stats.receitaPendente > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{stats.receitaPendente}</span>}
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-2">
            <ArrowDownCircle className="w-4 h-4" />
            Pagamentos do Extrato
            {stats.pagamentosPendente > 0 && <span className="ml-1 bg-rose-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{stats.pagamentosPendente}</span>}
          </TabsTrigger>
          <TabsTrigger value="cartoes" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Cartões
            {stats.cartaoEmpresarial > 0 && <span className="ml-1 bg-purple-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{stats.cartaoEmpresarial}</span>}
          </TabsTrigger>
          <TabsTrigger value="excecoes" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Exceções
          </TabsTrigger>
          <TabsTrigger value="sugestoes" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Sugestões Auto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receita">
          <TabReceita loading={loading} dados={dados} mes={mes} onRefresh={load} />
        </TabsContent>
        <TabsContent value="pagamentos">
          <TabPagamentos loading={loading} dados={dados} mes={mes} onRefresh={load} />
        </TabsContent>
        <TabsContent value="cartoes">
          <TabCartoes loading={loading} dados={dados} mes={mes} onRefresh={load} />
        </TabsContent>
        <TabsContent value="excecoes">
          <TabExcecoes loading={loading} dados={dados} mes={mes} onRefresh={load} />
        </TabsContent>
        <TabsContent value="sugestoes">
          <TabSugestoes loading={loading} dados={dados} mes={mes} onRefresh={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}