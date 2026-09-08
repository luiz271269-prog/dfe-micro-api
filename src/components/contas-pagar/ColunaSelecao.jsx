export default function ColunaSelecao({
  titulo, itens, getKey, selecionadoKey, onSelect,
  renderTitulo, renderSub, renderValor, comparar,
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 border-b">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      </div>
      <div className="max-h-[45vh] overflow-y-auto divide-y">
        {itens.length === 0 ? (
          <p className="text-xs text-center py-8 text-muted-foreground">Nenhum registro</p>
        ) : itens.map(item => {
          const key = getKey(item);
          const selecionado = key === selecionadoKey;
          const bate = comparar?.(item);
          return (
            <button
              key={key}
              onClick={() => onSelect(item)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                selecionado ? 'bg-primary/10 ring-1 ring-inset ring-primary' : bate ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-muted/40'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{renderTitulo(item)}</p>
                <p className="text-[11px] text-muted-foreground truncate">{renderSub(item)}</p>
              </div>
              <p className={`text-sm font-bold tabular-nums shrink-0 ${bate ? 'text-green-700' : ''}`}>{renderValor(item)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}