import { useState, useEffect } from 'react';
import { consolidarDREOperacional } from '@/functions/consolidarDREOperacional';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, FileDown, Scale } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import MonthNavigator from '@/components/shared/MonthNavigator';
import DRELinhaDupla from '@/components/dre/DRELinhaDupla';
import DrilldownDREDialog from '@/components/dre/DrilldownDREDialog';
import { formatCurrency } from '@/lib/formatters';

const ROTULOS = {
  receita_bruta: 'Receita Bruta de Vendas',
  das: '(–) DAS — Simples Nacional',
  cmv: '(–) Custo das Mercadorias Vendidas (CMV)',
  folha: 'Folha de pagamento (bruto + FGTS)',
  prolabore: 'Pró-labore',
  despesas: 'Despesas administrativas e operacionais',
  obras: 'Obras e reformas',
  outros_tributos: 'Outros tributos (INSS, IPTU, taxas)',
};

export default function DREOperacional() {
  const [mes, setMes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [drill, setDrill] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await consolidarDREOperacional({ mes_referencia: mes });
      setDados(res?.data || null);
    } catch (e) {
      setErro(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [mes]); // eslint-disable-line

  function exportarCSV() {
    if (!dados) return;
    const c = dados.competencia;
    const k = dados.caixa;
    const linha = (label, campo) => [label, c[campo].toFixed(2), k[campo].toFixed(2)];
    const rows = [
      ['DRE OPERACIONAL CONSOLIDADO — NeuralTec + Liesch'],
      ['Mês', dados.mes_referencia],
      ['Regime', 'Simples Nacional'],
      [],
      ['LINHA', 'COMPETÊNCIA (R$)', 'CAIXA (R$)'],
      linha('Receita Bruta de Vendas', 'receita_bruta'),
      linha('(–) DAS', 'das'),
      linha('= Receita Líquida', 'receita_liquida'),
      linha('(–) CMV', 'cmv'),
      linha('= Lucro Bruto', 'lucro_bruto'),
      linha('(–) Folha de pagamento', 'folha'),
      linha('(–) Pró-labore', 'prolabore'),
      linha('(–) Despesas administrativas', 'despesas'),
      linha('(–) Obras e reformas', 'obras'),
      linha('(–) Outros tributos', 'outros_tributos'),
      linha('= Total Despesas Operacionais', 'total_despesas_operacionais'),
      linha('= LUCRO OPERACIONAL', 'lucro_operacional'),
      [],
      ['Margem bruta (%)', c.margem_bruta.toFixed(2), k.margem_bruta.toFixed(2)],
      ['Margem operacional (%)', c.margem_operacional.toFixed(2), k.margem_operacional.toFixed(2)],
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dre_operacional_${dados.mes_referencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const abrir = (campo) =>
    setDrill({ titulo: ROTULOS[campo] || campo, itens: dados.itens?.[campo] });

  const c = dados?.competencia;
  const k = dados?.caixa;

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="DRE Operacional"
        subtitle="Resultado consolidado do grupo (NeuralTec + Liesch) — Simples Nacional, competência × caixa"
      >
        <MonthNavigator selectedMonth={mes} onSelectMonth={setMes} />
        <Button variant="outline" onClick={carregar} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
        {dados?.tem_dados && (
          <Button variant="outline" onClick={exportarCSV} className="gap-2">
            <FileDown className="w-4 h-4" /> Exportar
          </Button>
        )}
      </PageHeader>

      {loading && (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      )}

      {erro && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
          {erro}
        </div>
      )}

      {!loading && dados && !dados.tem_dados && (
        <div className="bg-card border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum movimento encontrado no mês {dados.mes_referencia}.
          </p>
        </div>
      )}

      {!loading && dados?.tem_dados && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-blue-700">Receita bruta</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(c.receita_bruta)}</p>
              <p className="text-[10px] text-muted-foreground">competência</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-amber-700">Lucro bruto</p>
              <p className="text-xl font-bold text-amber-700">{formatCurrency(c.lucro_bruto)}</p>
              <p className="text-[10px] text-muted-foreground">
                margem {c.margem_bruta.toFixed(1)}%
              </p>
            </div>
            <div
              className={`border rounded-xl p-3 ${
                c.lucro_operacional < 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <p
                className={`text-[10px] font-bold uppercase ${
                  c.lucro_operacional < 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                Lucro operacional
              </p>
              <p
                className={`text-xl font-bold ${
                  c.lucro_operacional < 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(c.lucro_operacional)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                margem {c.margem_operacional.toFixed(1)}%
              </p>
            </div>
            <div className="bg-card border rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Resultado no caixa
              </p>
              <p className="text-xl font-bold">{formatCurrency(k.lucro_operacional)}</p>
              <p className="text-[10px] text-muted-foreground">efetivamente pago/recebido</p>
            </div>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-2">
              <Scale className="w-5 h-5" />
              <div>
                <p className="text-sm font-bold">
                  Demonstração do Resultado — {dados.mes_referencia}
                </p>
                <p className="text-[10px] opacity-90">
                  Grupo consolidado · Simples Nacional · CMV a partir de{' '}
                  {dados.origem_cmv === 'nfe_analise' ? 'XMLs de NF-e (com ICMS-ST e IPI)' : 'compras registradas'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-muted/50 border-b text-[10px] font-bold uppercase">
              <span>Linha</span>
              <span className="w-40 text-right text-blue-700">Competência</span>
              <span className="w-40 text-right text-emerald-700">Caixa</span>
            </div>

            <div>
              <DRELinhaDupla
                label={ROTULOS.receita_bruta}
                comp={c.receita_bruta}
                caixa={k.receita_bruta}
                isSub
                onClick={() => abrir('receita_bruta')}
              />
              <DRELinhaDupla
                label={ROTULOS.das}
                comp={c.das}
                caixa={k.das}
                negative
                indent={1}
                onClick={() => abrir('das')}
              />
              <DRELinhaDupla
                label="= Receita Líquida"
                comp={c.receita_liquida}
                caixa={k.receita_liquida}
                isTotal
              />

              <DRELinhaDupla
                label={ROTULOS.cmv}
                comp={c.cmv}
                caixa={k.cmv}
                negative
                isSub
                onClick={() => abrir('cmv')}
              />
              <DRELinhaDupla
                label="= Lucro Bruto"
                comp={c.lucro_bruto}
                caixa={k.lucro_bruto}
                destaque
              />

              <DRELinhaDupla
                label="(–) Despesas Operacionais"
                comp={c.total_despesas_operacionais}
                caixa={k.total_despesas_operacionais}
                isSub
                negative
              />
              {['folha', 'prolabore', 'despesas', 'obras', 'outros_tributos'].map((campo) => (
                <DRELinhaDupla
                  key={campo}
                  label={ROTULOS[campo]}
                  comp={c[campo]}
                  caixa={k[campo]}
                  negative
                  indent={1}
                  onClick={() => abrir(campo)}
                />
              ))}

              <DRELinhaDupla
                label="= Lucro Operacional"
                comp={c.lucro_operacional}
                caixa={k.lucro_operacional}
                destaque
              />
            </div>

            <div className="px-4 py-3 bg-muted/30 border-t flex flex-wrap gap-8 text-xs">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Margem bruta</p>
                <p className="text-lg font-bold text-blue-700">{c.margem_bruta.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">
                  Margem operacional
                </p>
                <p
                  className={`text-lg font-bold ${
                    c.margem_operacional < 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {c.margem_operacional.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">
                  Diferença competência × caixa
                </p>
                <p className="text-lg font-bold">
                  {formatCurrency(c.lucro_operacional - k.lucro_operacional)}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground px-1">
            Clique em qualquer linha para ver os lançamentos que a compõem. A coluna Caixa usa os
            vínculos do extrato bancário como fonte da verdade, com as datas de pagamento próprias
            como complemento. Faturas de cartão são tratadas como meio de pagamento, não como
            despesa, para evitar dupla contagem.
          </p>
        </div>
      )}

      <DrilldownDREDialog
        aberto={!!drill}
        onFechar={() => setDrill(null)}
        titulo={drill?.titulo}
        itens={drill?.itens}
      />
    </div>
  );
}