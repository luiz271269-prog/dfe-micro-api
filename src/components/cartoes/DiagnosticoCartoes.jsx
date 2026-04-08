import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DiagnosticoCartoes() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function diagnose() {
      const [cartoes, faturas, lancamentos, importBatches] = await Promise.all([
        base44.entities.ContaCartao.list(),
        base44.entities.FaturaCartao.list('-created_date', 500),
        base44.entities.LancamentoCartao.list('-created_date', 500),
        base44.entities.ImportBatch.filter({ batch_type: 'fatura_cartao' }),
      ]);

      const faturasPorMes = {};
      const lancPorFatura = {};
      
      faturas.forEach(f => {
        const mes = f.mes_referencia || 'sem-mes';
        faturasPorMes[mes] = (faturasPorMes[mes] || 0) + 1;
      });

      lancamentos.forEach(l => {
        lancPorFatura[l.fatura_id] = (lancPorFatura[l.fatura_id] || 0) + 1;
      });

      const faturasSemLanc = faturas.filter(f => !lancPorFatura[f.id]).length;

      setData({
        totalCartoes: cartoes.length,
        totalFaturas: faturas.length,
        totalLancamentos: lancamentos.length,
        faturasPorMes,
        lancPorFatura,
        faturasSemLanc,
        ultimaFatura: faturas[0],
        ultimoLancamento: lancamentos[0],
        ultimoImport: importBatches[0],
      });
      setLoading(false);
    }
    diagnose();
  }, []);

  if (loading) return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
      <Loader className="w-4 h-4 animate-spin" />
      <span className="text-sm text-blue-700">Diagnosticando...</span>
    </div>
  );

  const hasData = data.totalFaturas > 0;

  return (
    <div className={`p-4 rounded-lg border ${hasData ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-start gap-3">
        {hasData ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />}
        <div className="flex-1">
          <p className={`font-semibold ${hasData ? 'text-green-900' : 'text-red-900'}`}>
            {hasData ? '✓ Dados encontrados' : '✗ Nenhuma fatura de cartão encontrada'}
          </p>
          <div className={`text-sm mt-2 space-y-1 ${hasData ? 'text-green-800' : 'text-red-800'}`}>
            <p>📊 <strong>{data.totalCartoes}</strong> cartões · <strong>{data.totalFaturas}</strong> faturas · <strong>{data.totalLancamentos}</strong> lançamentos</p>
            {data.totalFaturas > 0 && (
              <>
                <p>📅 Faturas por mês: {Object.entries(data.faturasPorMes).map(([mes, qty]) => `${mes}: ${qty}`).join(' | ')}</p>
                <p>⚠️ {data.faturasSemLanc} faturas SEM lançamentos importados</p>
                {data.ultimoImport && (
                  <p>📥 Último import: {data.ultimoImport.batch_type} em {new Date(data.ultimoImport.created_date).toLocaleDateString('pt-BR')} ({data.ultimoImport.success_count || 0} registros salvos)</p>
                )}
              </>
            )}
          </div>
          {!hasData && (
            <p className="text-sm mt-3">
              ℹ️ Parece que as faturas de cartão não foram importadas ainda. Use a página <strong>Importar Documento</strong> e selecione "Fatura de Cartão".
            </p>
          )}
        </div>
      </div>
    </div>
  );
}