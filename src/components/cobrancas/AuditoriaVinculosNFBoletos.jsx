import { useState, useMemo } from 'react';
import { Search, RefreshCw, AlertTriangle, CheckCircle2, FileX, Link2Off, HelpCircle, FileQuestion, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useAuditoriaVinculos from '@/components/cobrancas/useAuditoriaVinculos';
import AuditoriaVinculoCard from '@/components/cobrancas/AuditoriaVinculoCard';
import AuditoriaVinculoCorrecaoDialog from '@/components/cobrancas/AuditoriaVinculoCorrecaoDialog';
import { formatCurrency } from '@/lib/formatters';

const CATEGORIAS = [
  { id: 'divergencia_total', label: 'Divergência de total', cor: 'red', icone: AlertTriangle },
  { id: 'vinculo_errado', label: 'Vínculo incorreto', cor: 'red', icone: Link2Off },
  { id: 'ambiguo', label: 'Ambíguo', cor: 'orange', icone: HelpCircle },
  { id: 'sem_parcela', label: 'Sem parcelas', cor: 'blue', icone: FileX },
  { id: 'sem_cfop', label: 'Sem CFOP', cor: 'yellow', icone: FileQuestion },
  { id: 'fora_escopo', label: 'Fora do escopo', cor: 'slate', icone: FileX },
  { id: 'ok', label: 'OK', cor: 'green', icone: CheckCircle2 },
];

const corClasses = {
  red: 'border-red-200 bg-red-50/60 text-red-700',
  orange: 'border-orange-200 bg-orange-50/60 text-orange-700',
  blue: 'border-blue-200 bg-blue-50/60 text-blue-700',
  yellow: 'border-yellow-200 bg-yellow-50/60 text-yellow-700',
  slate: 'border-slate-200 bg-slate-50/60 text-slate-600',
  green: 'border-green-200 bg-green-50/60 text-green-700',
};

export default function AuditoriaVinculosNFBoletos() {
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [corrigir, setCorrigir] = useState(null);
  const { dados, carregando, erro, executar, atualizar } = useAuditoriaVinculos();

  const resumo = dados?.resumo || { por_categoria: {} };
  const achados = dados?.achados || [];

  const filtrados = useMemo(() => {
    return achados.filter(a => {
      if (filtro !== 'todos' && a.categoria !== filtro) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        const nf = a.nota || {};
        const texto = `${nf.numero || ''} ${nf.cliente || ''} ${a.motivo || ''} ${a.boleto?.nosso_numero || ''} ${a.boleto?.seu_numero || ''}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [achados, filtro, busca]);

  const totalAchados = achados.length;
  const totalDivergencias = (resumo.por_categoria?.divergencia_total || 0) + (resumo.por_categoria?.vinculo_errado || 0) + (resumo.por_categoria?.ambiguo || 0);

  return (
    <section aria-labelledby="auditoria-vinculos-titulo" className="my-4 w-full overflow-hidden rounded-xl border bg-card text-card-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
      <header className="space-y-2 border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="auditoria-vinculos-titulo" className="scroll-mt-20 font-semibold">Auditoria de Vínculos NF × Boletos</h3>
            <p className="text-sm text-muted-foreground">Compara o total de cada NF de venda com as parcelas vinculadas e detecta boletos vinculados à nota errada. Exclui NFs de transporte, devolução, retorno, troca e remessa para garantia. Somente leitura: nada é corrigido sem confirmação explícita.</p>
          </div>
          <div className="flex gap-2">
            {dados && <Button size="sm" variant="outline" onClick={atualizar} disabled={carregando} className="gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar</Button>}
            <Button size="sm" onClick={executar} disabled={carregando} className="gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> {dados ? 'Reexecutar' : 'Executar auditoria'}</Button>
          </div>
        </div>
        {dados && (
          <p className="text-xs text-muted-foreground" role="status">
            {resumo.total_notas || 0} notas lidas · {resumo.total_boletos || 0} boletos · {totalAchados} apontamentos · {totalDivergencias} divergências ativas
          </p>
        )}
      </header>

      {dados && (
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          {CATEGORIAS.map(cat => {
            const count = resumo.por_categoria?.[cat.id] || 0;
            if (!count && filtro !== cat.id) return null;
            const Icone = cat.icone;
            const ativo = filtro === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFiltro(ativo ? 'todos' : cat.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${corClasses[cat.cor]} ${ativo ? 'ring-2 ring-offset-1' : 'opacity-80 hover:opacity-100'}`}
              >
                <Icone className="w-3.5 h-3.5" />
                {cat.label}
                <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {dados && (
        <div className="border-b px-4 py-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar nota, cliente ou boleto..." value={busca} onChange={e => setBusca(e.target.value)} className="h-8 pl-9 text-xs" />
          </div>
        </div>
      )}

      <div className="max-h-[600px] overflow-y-auto">
        {carregando && !dados ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cruzando notas, boletos e CFOP…</p>
        ) : erro ? (
          <p role="alert" className="px-4 py-8 text-center text-sm text-destructive">{erro}</p>
        ) : !dados ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Clique em "Executar auditoria" para cruzar todas as NFs de venda com seus boletos.</p>
        ) : filtrados.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum apontamento nesta categoria.</p>
        ) : (
          <div className="divide-y">
            {filtrados.map(a => (
              <AuditoriaVinculoCard key={a.chave} achado={a} onCorrigir={setCorrigir} />
            ))}
          </div>
        )}
      </div>

      {corrigir && (
        <AuditoriaVinculoCorrecaoDialog
          achado={corrigir}
          onClose={() => setCorrigir(null)}
          onCorrigido={atualizar}
        />
      )}
    </section>
  );
}