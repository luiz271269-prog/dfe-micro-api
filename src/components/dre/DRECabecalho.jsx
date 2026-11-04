export default function DRECabecalho() {
  return (
    <div className="hidden sm:grid grid-cols-[1fr_auto_auto] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] items-end gap-3 px-3 py-2 bg-muted/50 border-b text-[10px] font-bold uppercase">
      <span>Linha</span>
      {[
        { label: 'Competência', cor: 'text-info' },
        { label: 'Caixa', cor: 'text-success' },
      ].map(regime => (
        <div key={regime.label} className={`w-40 xl:w-auto text-right ${regime.cor}`}>
          <span className="block xl:text-center">{regime.label}</span>
          <div className="hidden xl:grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-2 mt-2 text-[9px] font-medium text-muted-foreground normal-case">
            <span>Valor (R$)</span>
            <span title="Percentual sobre a receita bruta">% R. bruta</span>
            <span title="Percentual sobre a receita líquida gerencial">% R. líquida</span>
            <span title="Percentual sobre o lucro operacional">% L. oper.</span>
          </div>
        </div>
      ))}
    </div>
  );
}