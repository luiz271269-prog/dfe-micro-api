import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingDown, TrendingUp, ArrowRight, Calculator, Scale } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { calcularCustoEfetivo, simularTrocaFornecedor } from '../../lib/custoSimulacaoEngine';

function DiffBadge({ diff }) {
  if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-muted-foreground">sem alteração</span>;
  const isReducao = diff < 0;
  const Icon = isReducao ? TrendingDown : TrendingUp;
  const cor = isReducao ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-bold ${cor}`}>
      <Icon className="w-3 h-3" />
      {isReducao ? '' : '+'}{formatCurrency(diff)}
    </span>
  );
}

function ColunaCusto({ titulo, subtitulo, custo, linha, cor = 'blue' }) {
  const cores = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
  };
  return (
    <div className={`border-2 rounded-xl p-3 ${cores[cor]}`}>
      <p className="text-[10px] font-bold uppercase opacity-70">{titulo}</p>
      <p className="text-[10px] opacity-60 mb-2">{subtitulo}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between"><span>Valor base</span><span className="tabular-nums">{formatCurrency(custo.valor_base)}</span></div>
        <div className="flex justify-between"><span>(+) ICMS-ST</span><span className="tabular-nums">{formatCurrency(custo.adicoes.icms_st)}</span></div>
        <div className="flex justify-between"><span>(+) IPI</span><span className="tabular-nums">{formatCurrency(custo.adicoes.ipi)}</span></div>
        {(custo.creditos.icms > 0 || custo.creditos.pis > 0 || custo.creditos.cofins > 0) && (
          <>
            <div className="flex justify-between text-emerald-700"><span>(–) ICMS crédito</span><span className="tabular-nums">{formatCurrency(custo.creditos.icms)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>(–) PIS crédito</span><span className="tabular-nums">{formatCurrency(custo.creditos.pis)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>(–) COFINS crédito</span><span className="tabular-nums">{formatCurrency(custo.creditos.cofins)}</span></div>
          </>
        )}
        <div className="border-t pt-1.5 mt-1.5 flex justify-between font-bold">
          <span>= Custo efetivo</span>
          <span className="tabular-nums text-base">{formatCurrency(custo.custo_efetivo)}</span>
        </div>
        <div className="flex justify-between text-[10px] opacity-70">
          <span>Unitário ({(linha.quantidade || 1).toFixed(linha.quantidade % 1 === 0 ? 0 : 2)} un)</span>
          <span className="tabular-nums">{formatCurrency(custo.custo_unitario)}</span>
        </div>
        <div className="flex justify-between text-[10px] opacity-70">
          <span>Impacto vs valor base</span>
          <span className={`tabular-nums font-bold ${custo.impacto_pct > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {custo.impacto_pct > 0 ? '+' : ''}{custo.impacto_pct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PainelSimulacao({ sku }) {
  const [regimeBase, setRegimeBase] = useState('simples_nacional');
  const [regimeSim, setRegimeSim] = useState('lucro_presumido_real');
  const [fornecedorSim, setFornecedorSim] = useState('__mesmo__');
  const [linhaRefIdx, setLinhaRefIdx] = useState(0);

  const linhaRef = sku.linhas[linhaRefIdx] || sku.linhas[0];

  const custoBase = useMemo(() => calcularCustoEfetivo(linhaRef, regimeBase), [linhaRef, regimeBase]);

  // Cenário simulado: se trocar fornecedor, recalcula linha usando médias daquele fornecedor
  const simulacao = useMemo(() => {
    if (fornecedorSim === '__mesmo__') {
      return { linha_simulada: linhaRef, custo: calcularCustoEfetivo(linhaRef, regimeSim), ocorrencias_fornecedor: sku.linhas.filter(l => l.fornecedor === linhaRef.fornecedor).length };
    }
    return simularTrocaFornecedor(sku, linhaRef, fornecedorSim, regimeSim);
  }, [sku, linhaRef, fornecedorSim, regimeSim]);

  const diffTotal = simulacao ? simulacao.custo.custo_efetivo - custoBase.custo_efetivo : 0;
  const diffUnit = simulacao ? simulacao.custo.custo_unitario - custoBase.custo_unitario : 0;

  // Extrapolação para o volume total histórico
  const impactoAnualizado = sku.qtd_total * diffUnit;

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-4 h-4" />
          <p className="text-sm font-bold">Simulação de Custo Efetivo</p>
        </div>
        <p className="text-[11px] opacity-90 truncate">{sku.descricao_canonica}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Seletor de linha de referência */}
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">NF-e de referência</label>
          <Select value={String(linhaRefIdx)} onValueChange={v => setLinhaRefIdx(Number(v))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sku.linhas.map((l, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">
                  NF {l.nfe_numero} · {l.data_emissao} · {l.fornecedor} · {formatCurrency(l.valor_total)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Seletores lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-blue-700 mb-1">Cenário Base</p>
            <Select value={regimeBase} onValueChange={setRegimeBase}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional" className="text-xs">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido_real" className="text-xs">Lucro Presumido/Real</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Fornecedor: {linhaRef.fornecedor}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-indigo-700 mb-1">Cenário Simulado</p>
            <div className="space-y-1.5">
              <Select value={regimeSim} onValueChange={setRegimeSim}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional" className="text-xs">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido_real" className="text-xs">Lucro Presumido/Real</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fornecedorSim} onValueChange={setFornecedorSim}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__mesmo__" className="text-xs">Mesmo fornecedor</SelectItem>
                  {sku.fornecedores.filter(f => f !== linhaRef.fornecedor).map(f => (
                    <SelectItem key={f} value={f} className="text-xs">Trocar para: {f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Comparativo */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <ColunaCusto
            titulo="Base"
            subtitulo={`${regimeBase === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido/Real'} · ${linhaRef.fornecedor}`}
            custo={custoBase}
            linha={linhaRef}
            cor="blue"
          />
          <div className="flex flex-col items-center justify-center">
            <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block" />
            <DiffBadge diff={diffTotal} />
          </div>
          {simulacao ? (
            <ColunaCusto
              titulo="Simulado"
              subtitulo={`${regimeSim === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido/Real'} · ${simulacao.linha_simulada.fornecedor}`}
              custo={simulacao.custo}
              linha={simulacao.linha_simulada}
              cor={diffTotal < 0 ? 'indigo' : 'purple'}
            />
          ) : (
            <div className="border-2 border-dashed border-rose-200 bg-rose-50 rounded-xl p-3 text-center text-xs text-rose-700">
              Sem histórico deste SKU com o fornecedor selecionado.
            </div>
          )}
        </div>

        {/* Impacto extrapolado */}
        {simulacao && Math.abs(diffUnit) > 0.01 && (
          <div className={`rounded-xl p-3 border-2 ${diffUnit < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Scale className={`w-4 h-4 ${diffUnit < 0 ? 'text-emerald-700' : 'text-amber-700'}`} />
              <p className="text-xs font-bold uppercase">Impacto no DRE — extrapolação</p>
            </div>
            <p className="text-xs">
              Diferença por unidade: <strong className="tabular-nums">{formatCurrency(diffUnit)}</strong> ·
              Volume histórico deste SKU: <strong>{sku.qtd_total.toFixed(0)}</strong> unidades
            </p>
            <p className={`text-lg font-bold mt-1 ${diffUnit < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {diffUnit < 0 ? 'Economia estimada: ' : 'Custo adicional estimado: '}
              {formatCurrency(Math.abs(impactoAnualizado))}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Aplicando o cenário simulado em todo o volume comprado deste SKU.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}