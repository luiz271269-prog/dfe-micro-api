import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

/**
 * Botão de filtros que abre um drawer pela direita no mobile.
 * Desktop: renderiza filtros inline (children).
 *
 * Uso:
 *   <MobileFilterDrawer activeCount={2}>
 *     <Select ...>...</Select>
 *     <Select ...>...</Select>
 *   </MobileFilterDrawer>
 */
export default function MobileFilterDrawer({ children, activeCount = 0, title = 'Filtros' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: botão que abre drawer */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
              <Filter className="w-4 h-4" />
              <span>{title}</span>
              {activeCount > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85%] sm:max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {children}
              <Button onClick={() => setOpen(false)} className="w-full mt-4">Aplicar</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: filtros inline */}
      <div className="hidden md:flex flex-wrap gap-3 items-center">{children}</div>
    </>
  );
}