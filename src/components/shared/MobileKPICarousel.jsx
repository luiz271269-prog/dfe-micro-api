import { Children, useRef, useState, useEffect } from 'react';

/**
 * Carrossel horizontal scroll-snap para KPIs no mobile.
 * Cada filho ocupa ~85% da viewport e tem snap-center.
 * Desktop: renderiza grid normal (filhos como children diretos).
 *
 * Uso:
 *   <MobileKPICarousel desktopGridClass="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
 *     <GradientCard ... />
 *     <GradientCard ... />
 *   </MobileKPICarousel>
 */
export default function MobileKPICarousel({ children, desktopGridClass = 'sm:grid-cols-3 lg:grid-cols-5' }) {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const items = Children.toArray(children);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const w = el.clientWidth;
      const idx = Math.round(el.scrollLeft / (w * 0.88));
      setActiveIdx(Math.min(idx, items.length - 1));
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [items.length]);

  return (
    <>
      {/* Mobile: scroll horizontal com snap */}
      <div className="md:hidden mb-4">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((child, i) => (
            <div key={i} className="snap-center shrink-0 w-[85%]">{child}</div>
          ))}
        </div>
        {items.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-1">
            {items.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === activeIdx ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: grid normal */}
      <div className={`hidden md:grid ${desktopGridClass} gap-3 mb-6`}>{children}</div>
    </>
  );
}