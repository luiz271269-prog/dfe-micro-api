import VinculoConferenciaLinha from './VinculoConferenciaLinha';

export default function OrfaosConferencia({ orfaos }) {
  if (!orfaos.length) return null;
  return <div className="rounded-xl border border-destructive/30 bg-card p-4">
    <p className="text-sm font-semibold">Vínculos para folhas inexistentes ({orfaos.length})</p>
    <p className="mb-2 text-xs text-muted-foreground">Débitos entre o início da competência e o fim do mês de pagamento. Não certificam nenhuma competência até serem revisados.</p>
    <div className="overflow-x-auto"><table className="w-full"><tbody>{orfaos.map(v => <VinculoConferenciaLinha key={v.id} v={v} />)}</tbody></table></div>
  </div>;
}