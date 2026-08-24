import { Link } from 'react-router-dom';

const ORIGENS = [
  { label: 'Compras (estoque/revenda)', color: '#0EA5E9', href: '/compras' },
  { label: 'Despesas fixas/variáveis', color: '#10B981', href: '/despesas' },
  { label: 'Impostos (vendas + folha)', color: '#F97316', href: '/tributos' },
  { label: 'Folha', color: '#6366F1', href: '/funcionarios' },
  { label: 'Obras / Reformas', color: '#F59E0B', href: '/obras' },
  { label: 'Pró-labore', color: '#A855F7', href: '/prolabore' },
];

const H = 180;
const YS = [15, 45, 75, 105, 135, 165];
const CX = 55;
const CY = 90;

export default function PipelineFluxo() {
  return (
    <div
      className="bg-white border rounded-lg px-4 py-3 overflow-x-auto"
      title='Item comprado no cartão não fica "a pagar" individualmente — a obrigação evapora para a fatura do cartão, que é paga no extrato. Compras são produtos para estoque/revenda (não são despesas operacionais). Pró-labore (retirada de lucros) é identificado no extrato e nos cartões pessoais, com projeção pela média dos últimos 3 meses.'
    >
      <div className="flex items-center justify-center min-w-[640px]">
        {/* Origens */}
        <div className="flex flex-col items-end gap-1 shrink-0" style={{ height: H, justifyContent: 'center' }}>
          {ORIGENS.map(o => o.href ? (
            <Link key={o.label} to={o.href}
              className="h-6 flex items-center px-3 rounded-full text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap hover:opacity-90"
              style={{ backgroundColor: o.color }}>
              {o.label}
            </Link>
          ) : (
            <span key={o.label}
              className="h-6 flex items-center px-3 rounded-full text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap"
              style={{ backgroundColor: o.color }}>
              {o.label}
            </span>
          ))}
        </div>

        {/* Conexões */}
        <svg width="110" height={H} viewBox={`0 0 110 ${H}`} className="shrink-0">
          <defs>
            <marker id="pf-arrow-purple" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8" fill="none" stroke="#9333EA" strokeWidth="1.5" />
            </marker>
            <marker id="pf-arrow-blue" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8" fill="none" stroke="#2563EB" strokeWidth="1.5" />
            </marker>
          </defs>
          {ORIGENS.map((o, i) => (
            <path key={o.label}
              d={`M0,${YS[i]} C28,${YS[i]} 32,${CY} ${CX - 7},${CY}`}
              fill="none" stroke={o.color} strokeWidth="1.5" opacity="0.65" />
          ))}
          <circle cx={CX} cy={CY} r="5" fill="#6366F1" />
          <path d={`M${CX + 7},${CY - 3} C80,${CY - 22} 82,54 100,54`}
            fill="none" stroke="#9333EA" strokeWidth="1.5" markerEnd="url(#pf-arrow-purple)" />
          <path d={`M${CX + 7},${CY + 3} C80,${CY + 22} 82,126 100,126`}
            fill="none" stroke="#2563EB" strokeWidth="1.5" markerEnd="url(#pf-arrow-blue)" />
        </svg>

        {/* Destinos */}
        <div className="flex flex-col justify-center gap-10 shrink-0" style={{ height: H }}>
          <span className="h-8 flex items-center px-4 rounded-full text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap" style={{ backgroundColor: '#9333EA' }}>
            No cartão → vira Fatura
          </span>
          <span className="h-8 flex items-center px-4 rounded-full text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}>
            Direto → cruza com Extrato
          </span>
        </div>
      </div>
    </div>
  );
}