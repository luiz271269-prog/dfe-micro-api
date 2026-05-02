/**
 * Wrapper responsivo de listagem:
 *  - Desktop (md+): renderiza <table> tradicional usando `desktop` (children).
 *  - Mobile (<md):  renderiza lista de cards usando `mobileRender(item, index)`.
 *
 * Uso:
 *   <ResponsiveListView
 *     items={filtered}
 *     loading={loading}
 *     emptyMessage="Nenhum lançamento encontrado"
 *     mobileRender={(item) => <MobileListCard ... />}
 *     desktop={<table>...</table>}
 *   />
 */
export default function ResponsiveListView({
  items = [],
  loading = false,
  emptyMessage = 'Nenhum registro encontrado',
  mobileRender,
  desktop,
  mobileFooter,
}) {
  return (
    <>
      {/* Mobile: cards empilhados */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm bg-card border rounded-xl">{emptyMessage}</div>
        ) : (
          <>
            {items.map((item, idx) => (
              <div key={item.id || idx}>{mobileRender(item, idx)}</div>
            ))}
            {mobileFooter}
          </>
        )}
      </div>

      {/* Desktop: tabela tradicional */}
      <div className="hidden md:block bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">{desktop}</div>
      </div>
    </>
  );
}