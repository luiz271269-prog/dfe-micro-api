import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/formatters';

export default function DASAlertBar({ mesReferencia }) {
  const [alerta, setAlerta] = useState(null);

  useEffect(() => {
    async function verificar() {
      try {
        const tributos = await base44.entities.Tributo.filter({ tipo: 'DAS' });
        const mesAlvo = mesReferencia || new Date().toISOString().slice(0, 7);
        const tributoMes = tributos.find(t => (t.competencia || '').startsWith(mesAlvo));
        if (tributoMes && (tributoMes.valor_pago || tributoMes.valor_original) > 30000) {
          setAlerta({
            competencia: tributoMes.competencia,
            valor: tributoMes.valor_pago || tributoMes.valor_original,
            id: tributoMes.id,
          });
        } else {
          setAlerta(null);
        }
      } catch {
        setAlerta(null);
      }
    }
    verificar();
  }, [mesReferencia]);

  if (!alerta) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
      <p className="text-sm text-red-800 font-medium">
        DAS {alerta.competencia}: <strong>{formatCurrency(alerta.valor)}</strong> — verificar valor elevado
      </p>
    </div>
  );
}