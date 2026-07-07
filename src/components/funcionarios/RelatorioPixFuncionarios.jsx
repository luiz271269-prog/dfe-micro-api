import { useEffect, useState } from 'react';
import { relatorioPixFuncionarios } from '@/functions/relatorioPixFuncionarios';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import RelatorioPixLinha from './RelatorioPixLinha';

export default function RelatorioPixFuncionarios() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const res = await relatorioPixFuncionarios({});
      setDados(res?.data || null);
    } catch (err) {
      setErro(err.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function exportar() {
    const lines = ['Funcionário,Competência,Tipo,Devido,PIX Salário,PIX Comissão,Adiantamentos,Total Pago,Saldo,5º dia útil,Data real'];
    dados.funcionarios.forEach(f => f.competencias.forEach(c => {
      lines.push([f.funcionario, c.competencia, c.tipo, c.liquido, c.pix_salario, c.pix_comissao, c.pix_adiantamentos, c.total_pago, c.diferenca, c.pontualidade?.data_esperada || '', c.pontualidade?.data_real || ''].join(','));
    }));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rastreio_pix_funcionarios.csv';
    a.click();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (erro) return <p className="text-sm text-red-600 py-8 text-center">Erro ao gerar relatório: {erro}</p>;
  if (!dados) return null;

  const totalDevido = dados.funcionarios.reduce((s, f) => s + f.total_liquido, 0);
  const totalPago = dados.funcionarios.reduce((s, f) => s + f.total_pago, 0);
  const totalVales = dados.funcionarios.reduce((s, f) => s + f.total_adiantamentos, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-4 text-sm flex-wrap">
          <span>Devido: <b>{formatCurrency(totalDevido)}</b></span>
          <span className="text-green-700">Rastreado: <b>{formatCurrency(totalPago)}</b></span>
          <span className="text-yellow-700">Vales/Adiant.: <b>{formatCurrency(totalVales)}</b></span>
          <span className={totalDevido - totalPago > 50 ? 'text-orange-700' : 'text-green-700'}>
            Saldo: <b>{formatCurrency(totalDevido - totalPago)}</b>
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</Button>
        </div>
      </div>

      {dados.funcionarios.map(f => (
        <div key={f.funcionario} className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">
                {f.funcionario.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <p className="font-bold text-sm">{f.funcionario}</p>
            </div>
            <div className="flex gap-4 text-xs tabular-nums">
              <span>Devido: <b>{formatCurrency(f.total_liquido)}</b></span>
              <span className="text-green-700">Pago: <b>{formatCurrency(f.total_pago)}</b></span>
              {f.total_adiantamentos > 0 && <span className="text-yellow-700">Vales: <b>{formatCurrency(f.total_adiantamentos)}</b></span>}
            </div>
          </div>
          {f.competencias.map(c => <RelatorioPixLinha key={`${c.competencia}-${c.tipo}`} comp={c} />)}
        </div>
      ))}

      {dados.pix_nao_rastreados.length > 0 && (
        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-100/60 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-700" />
            <p className="font-bold text-sm text-yellow-900">
              {dados.pix_nao_rastreados.length} PIX nominal(is) sem folha vinculada — {formatCurrency(dados.pix_nao_rastreados.reduce((s, p) => s + p.valor, 0))}
            </p>
          </div>
          <div className="divide-y divide-yellow-200 max-h-72 overflow-y-auto">
            {dados.pix_nao_rastreados.map((p, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs">
                <span className="font-mono text-muted-foreground w-20 shrink-0">{formatDate(p.data)}</span>
                <span className="font-semibold w-40 shrink-0 truncate">{p.funcionario}</span>
                <span className="flex-1 truncate text-muted-foreground">{p.descricao}</span>
                <span className="font-bold tabular-nums shrink-0">{formatCurrency(p.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dados.funcionarios.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma folha registrada para rastrear</p>
        </div>
      )}
    </div>
  );
}