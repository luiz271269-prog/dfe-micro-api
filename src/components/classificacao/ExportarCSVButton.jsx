import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

function toCSV(rows) {
  const head = ['data', 'descricao', 'origem_compra', 'tipo_compra', 'entidade_tipo', 'valor_alocado'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(';'), ...rows.map((r) => head.map((h) => esc(r[h])).join(';'))].join('\n');
}

export default function ExportarCSVButton({ vinculos, lancPorId, nomeArquivo }) {
  const exportar = () => {
    const rows = vinculos.map((v) => ({
      data: lancPorId[v.lancamento_bancario_id]?.data || '',
      descricao: lancPorId[v.lancamento_bancario_id]?.descricao || '',
      origem_compra: v.origem_compra || '',
      tipo_compra: v.tipo_compra || '',
      entidade_tipo: v.entidade_tipo || '',
      valor_alocado: (v.valor_alocado || 0).toFixed(2).replace('.', ','),
    }));
    const blob = new Blob(['\uFEFF' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeArquivo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Button size="sm" variant="outline" onClick={exportar} disabled={!vinculos?.length}>
      <Download className="w-4 h-4" />
      Exportar CSV
    </Button>
  );
}