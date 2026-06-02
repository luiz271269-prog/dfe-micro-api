import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '../../lib/formatters';

// Alíquota estimada Simples Nacional NeuralTec (Anexo I/II ~5.5%)
const ALIQUOTA_ESTIMADA = 0.055;
const TOLERANCIA = 0.20; // 20% de variação aceitável

export default function DASAlertBadge({ selectedMonth }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!selectedMonth) return;
    let cancelled = false;
    async function calc() {
      let nfs, tributos;
      try {
        [nfs, tributos] = await Promise.all([
          base44.entities.NotaFiscal.list(),
          base44.entities.Tributo.list(),
        ]);
      } catch (e) {
        // Rate limit ou erro de rede — silencia e não exibe badge
        return;
      }
      if (cancelled) return;

      // Filtra NFs do mês selecionado
      const nfsMes = nfs.filter(n => (n.data_emissao || '').startsWith(selectedMonth));

      const faturamento = nfsMes.reduce((sum, n) => {
        if (!n.valor_total || n.cliente === 'ANULADA') return sum;
        return sum + (n.valor_total || 0);
      }, 0);

      const dasEstimado = faturamento * ALIQUOTA_ESTIMADA;

      const dasRegistrado = tributos.find(
        t => t.tipo === 'DAS' && t.competencia === selectedMonth
      );

      if (!dasRegistrado) {
        setInfo({ tipo: 'sem_das', faturamento, dasEstimado, nfsMes: nfsMes.length });
        return;
      }

      const valorDas = dasRegistrado.valor_original || 0;
      const diferenca = Math.abs(valorDas - dasEstimado);
      const pctDif = dasEstimado > 0 ? diferenca / dasEstimado : 0;
      const aliquotaReal = faturamento > 0 ? (valorDas / faturamento) * 100 : 0;

      setInfo({
        tipo: pctDif > TOLERANCIA ? 'alerta' : 'ok',
        faturamento,
        dasEstimado,
        valorDas,
        pctDif,
        aliquotaReal,
        alerta_valor: dasRegistrado.alerta_valor,
        status: dasRegistrado.status,
        nfsMes: nfsMes.length,
      });
    }
    // Debounce para evitar disparos múltiplos em rajada
    const t = setTimeout(calc, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedMonth]);

  if (!info) return null;

  const mes = selectedMonth?.slice(0, 7);

  if (info.tipo === 'sem_das') {
    return (
      <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full font-medium">
        ⚠ DAS {mes}: sem registro — faturamento NFs: {formatCurrency(info.faturamento)} ({info.nfsMes} NFs) · estimativa: {formatCurrency(info.dasEstimado)}
      </span>
    );
  }

  if (info.tipo === 'alerta' || info.alerta_valor) {
    return (
      <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium">
        ⚠ DAS {mes}: {formatCurrency(info.valorDas)} registrado · base NFs: {formatCurrency(info.faturamento)} · estimativa: {formatCurrency(info.dasEstimado)} · alíquota real: {info.aliquotaReal.toFixed(1)}% — {info.pctDif > TOLERANCIA ? `divergência ${(info.pctDif*100).toFixed(0)}%` : 'verificar valor'}
      </span>
    );
  }

  return (
    <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
      ✅ DAS {mes}: {formatCurrency(info.valorDas)} · alíquota {info.aliquotaReal.toFixed(1)}% s/ {formatCurrency(info.faturamento)} ({info.nfsMes} NFs)
    </span>
  );
}