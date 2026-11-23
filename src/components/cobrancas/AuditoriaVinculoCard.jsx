import { useState } from 'react';
import { ChevronRight, ChevronDown, Link2Off, AlertTriangle, HelpCircle, FileX, FileQuestion, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

const categoriaIcone = {
  divergencia_total: AlertTriangle,
  vinculo_errado: Link2Off,
  ambiguo: HelpCircle,
  sem_parcela: FileX,
  sem_cfop: FileQuestion,
  fora_escopo: FileX,
  ok: CheckCircle2,
};

const categoriaCor = {
  divergencia_total: 'text-red-600 bg-red-50/60 border-red-200',
  vinculo_errado: 'text-red-600 bg-red-50/60 border-red-200',
  ambiguo: 'text-orange-600 bg-orange-50/60 border-orange-200',
  sem_parcela: 'text-blue-600 bg-blue-50/60 border-blue-200',
  sem_cfop: 'text-yellow-600 bg-yellow-50/60 border-yellow-200',
  fora_escopo: 'text-slate-500 bg-slate-50/60 border-slate-200',
  ok: 'text-green-600 bg-green-50/60 border-green-200',
};

const categoriaRotulo = {
  divergencia_total: 'Divergência de total',
  vinculo_errado: 'Vínculo incorreto',
  ambiguo: 'Ambíguo',
  sem_parcela: 'Sem parcelas',
  sem_cfop: 'Sem CFOP',
  fora_escopo: 'Fora do escopo',
  ok: 'OK',
};

export default function AuditoriaVinculoCard({ achado, onCorrigir }) {
  const [aberto, setAberto] = useState(achado.categoria !== 'ok' && achado.categoria !== 'fora_escopo');
  const nf = achado.nota || {};
  const boletos = achado.boletos || [];
  const soma = achado.soma_parcelas || 0;
  const Icone = categoriaIcone[achado.categoria] || AlertTriangle;
  const cor = categoriaCor[achado.categoria] || categoriaCor.ok;
  const diverge = achado.categoria === 'divergencia_total' || achado.categoria === 'vinculo_errado';

  return (
    <div className={`border-l-4 ${achado.categoria === 'ok' ? 'border-l-green-400' : diverge ? 'border-l-red-500' : 'border-l-orange-400'}`}>
      <button
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        {aberto ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-sm font-semibold">{nf.numero || '—'}</span>
          <span className="truncate text-sm text-muted-foreground">{nf.cliente || ''}</span>
        </div>
        {nf.cfop && <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">CFOP {nf.cfop}</span>}
        <span className="shrink-0 tabular-nums text-sm font-medium">{formatCurrency(nf.valor_total || 0)}</span>
        <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cor}`}>
          <Icone className="w-3 h-3" />
          {categoriaRotulo[achado.categoria]}
        </span>
      </button>

      {aberto && (
        <div className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Natureza de operação" valor={nf.natureza_operacao || '—'} />
            <Campo label="Empresa" valor={nf.empresa || '—'} />
            <Campo label="Data de emissão" valor={formatDate(nf.data_emissao) || '—'} />
            <Campo label="Status" valor={nf.status || '—'} />
          </div>

          {achado.motivo && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${cor}`}>
              <strong>{categoriaRotulo[achado.categoria]}:</strong> {achado.motivo}
            </div>
          )}

          {boletos.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-semibold">Nosso Nº</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Seu Nº (ref.)</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Pago</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Vencimento</th>
                    <th className="px-2 py-1.5 text-center font-semibold">Status</th>
                    <th className="px-2 py-1.5 text-center font-semibold">Liquidado</th>
                  </tr>
                </thead>
                <tbody>
                  {boletos.map(b => {
                    const refErrada = achado.categoria === 'vinculo_errado' && b.id === achado.boleto?.id;
                    return (
                      <tr key={b.id} className={`border-b ${refErrada ? 'bg-red-50/60' : ''}`}>
                        <td className="px-2 py-1.5 font-mono">{b.nosso_numero}</td>
                        <td className={`px-2 py-1.5 font-mono ${refErrada ? 'font-bold text-red-700' : ''}`}>{b.seu_numero || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(b.valor_titulo || 0)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-green-700">{formatCurrency(b.valor_pago || 0)}</td>
                        <td className="px-2 py-1.5">{formatDate(b.data_vencimento) || '—'}</td>
                        <td className="px-2 py-1.5 text-center">{b.status || '—'}</td>
                        <td className="px-2 py-1.5 text-center">{b.liquidado ? '✓' : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-medium">
                    <td colSpan={2} className="px-2 py-1.5">Soma das parcelas</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(soma)}</td>
                    <td colSpan={4} className={`px-2 py-1.5 ${Math.abs(soma - (nf.valor_total || 0)) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                      {Math.abs(soma - (nf.valor_total || 0)) > 0.01 ? `≠ ${formatCurrency(nf.valor_total || 0)}` : `= ${formatCurrency(nf.valor_total || 0)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum boleto vinculado a esta nota.</p>
          )}

          {achado.categoria === 'vinculo_errado' && achado.candidatos?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Candidatos de vínculo correto:</p>
              {achado.candidatos.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="font-mono font-semibold">NF {c.numero}</span>
                    <span className="text-muted-foreground">{c.cliente}</span>
                    <span className="tabular-nums">{formatCurrency(c.valor_total || 0)}</span>
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">{c.confianca}%</span>
                  </div>
                  <span className="text-muted-foreground">{c.motivo}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onCorrigir({ ...achado, candidato: c })}
                  >
                    <ArrowRight className="w-3 h-3" /> Mover boleto para NF {c.numero}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {achado.categoria === 'ambiguo' && (
            <p className="rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2 text-xs text-orange-700">
              Múltiplas notas candidatas — correção automática bloqueada. Verifique manualmente qual é a nota correta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}