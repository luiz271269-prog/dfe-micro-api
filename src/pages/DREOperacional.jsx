import { useState, useEffect } from 'react';
import { consolidarDREOperacional } from '@/functions/consolidarDREOperacional';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, FileDown, Scale } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import QuadroOperacional from '@/components/dre/QuadroOperacional';
import { operacional, rotulosDRE as ROTULOS, sinalDRE } from '@/components/dre/modeloDRE';
import DrilldownDREDialog from '@/components/dre/DrilldownDREDialog';
import PeriodoDREControls from '@/components/dre/PeriodoDREControls';
import CoberturaDRE from '@/components/dre/CoberturaDRE';
import { formatCurrency } from '@/lib/formatters';
import { getCurrentMonth } from '@/lib/currentMonth';
import { percentuaisDRE, tipoPercentualDRE } from '@/components/dre/percentuaisDRE';

const params = () => new URLSearchParams(window.location.search);

export default function DREOperacional() {
  const [mes, setMes] = useState(() => /^\d{4}-(0[1-9]|1[0-2])$/.test(params().get('mes')) ? params().get('mes') : getCurrentMonth());
  const [modoPeriodo, setModoPeriodo] = useState(() => ['ano_civil','ultimos_12'].includes(params().get('modo')) ? params().get('modo') : 'mensal');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [drill, setDrill] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await consolidarDREOperacional({ mes_referencia: mes, modo_periodo: modoPeriodo });
      setDados(res?.data || null);
    } catch (e) {
      setErro(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [mes, modoPeriodo]); // eslint-disable-line

  function exportarCSV() {
    if (!dados) return;
    const c = dados.competencia;
    const k = dados.caixa;
    const linha = (row) => {
      const {label,key:campo}=row;
      const percentuais = base => {
        const valores = percentuaisDRE(base[campo], base, tipoPercentualDRE(campo));
        return ['bruta', 'liquida', 'lucro'].map(chave => {
          const item = valores.find(p => p.chave === chave);
          return item ? (item.valor === null ? 'N/D' : item.valor.toFixed(2)) : '';
        });
      };
      return [label, sinalDRE(row,c[campo]).toFixed(2), sinalDRE(row,k[campo]).toFixed(2), ...percentuais(c), ...percentuais(k)];
    };
    const rows = [
      ['DRE OPERACIONAL CONSOLIDADO — NeuralTec + Liesch'],
      ['Período', periodoLabel],
      ['Regime', 'Simples Nacional'],
      ['Premissa DAS', 'Competência: previsão de 12% da receita bruta. Caixa: pagamentos efetivos.'],
      ['Bases percentuais', 'Receita líquida = receita bruta - DAS. Lucro bruto = receita líquida - CMV. Base de lucro = lucro operacional. N/D = base zero. Sinais negativos preservados.'],
      [],
      ['LINHA', 'COMPETÊNCIA (R$)', 'CAIXA (R$)', 'COMP. / RECEITA BRUTA (%)', 'COMP. / LUCRO BRUTO (%)', 'COMP. / LUCRO OPERACIONAL (%)', 'CAIXA / RECEITA BRUTA (%)', 'CAIXA / LUCRO BRUTO (%)', 'CAIXA / LUCRO OPERACIONAL (%)'],
      ...operacional.map(linha),
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
    a.download = `dre_operacional_${dados.mes_inicio}_${dados.mes_fim || dados.mes_referencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const abrir = (campo) =>
    setDrill({ titulo: ROTULOS[campo] || campo, itens: dados.itens?.[campo] });

  const c = dados?.competencia;
  const k = dados?.caixa;
  const periodoLabel = dados
    ? dados.modo_periodo === 'ano_civil'
      ? `Ano civil de ${dados.mes_referencia.slice(0, 4)}`
      : dados.modo_periodo === 'ultimos_12'
        ? `${dados.mes_inicio} a ${dados.mes_fim} (últimos 12 meses)`
        : dados.mes_referencia
    : '';

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="DRE Operacional"
        subtitle="Resultado consolidado do grupo (NeuralTec + Liesch) — Simples Nacional, competência × caixa"
      >
        <PeriodoDREControls
          mes={mes}
          onMesChange={setMes}
          modo={modoPeriodo}
          onModoChange={setModoPeriodo}
        />
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
            Nenhum movimento encontrado no período {periodoLabel}.
          </p>
        </div>
      )}

      {!loading && dados?.tem_dados && (
        <div className="space-y-5">
          <CoberturaDRE cobertura={dados.cobertura} cmvProvisorio={dados.cmv_provisorio} />
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
                Resultado operacional pelo caixa
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
                  Demonstração do Resultado — {periodoLabel}
                </p>
                <p className="text-[10px] opacity-90">
                  Grupo consolidado · Simples Nacional · CMV a partir de{' '}
                  {dados.origem_cmv === 'compras_produtos_consolidadas' ? 'compras de produtos locais + portal, sem duplicidade — valor provisório' : dados.origem_cmv === 'nfe_analise' ? 'XMLs de NF-e (com ICMS-ST e IPI)' : 'compras e entradas de estoque registradas — valor provisório'}
                </p>
              </div>
            </div>

            <QuadroOperacional c={c} k={k} abrir={abrir} />

            <div className="px-4 py-3 bg-muted/30 border-t flex flex-wrap gap-8 text-xs">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Margem bruta · competência</p>
                <p className="text-lg font-bold text-blue-700">{c.margem_bruta.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">
                  Margem operacional · competência
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
                  Resultado operacional · competência menos caixa
                </p>
                <p className="text-lg font-bold">
                  {formatCurrency(c.lucro_operacional - k.lucro_operacional)}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground px-1">
            Competência: DAS estimado em 12% da receita; CMV provisório pelas compras; folha pelo salário líquido. Caixa: recebimentos e pagamentos do extrato; compras e pagamentos de faturas compõem a linha CMV. Pró-labore e obras integram o subtotal exibido: na competência, obras representam manutenção; no caixa, a linha representa investimentos. O resultado é gerencial, não o lucro líquido contábil. Percentuais usam a base do próprio regime; “—” indica base indisponível. A diferença no rodapé é competência menos caixa.
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