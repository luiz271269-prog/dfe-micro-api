/**
 * Card compacto para representar 1 linha de tabela no mobile.
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │ [topLeft]              [topRight]│   ← linha 1: data + valor (destaque)
 *   │ [title]                          │   ← linha 2: descrição principal
 *   │ [meta]                  [badge]  │   ← linha 3: meta info + status
 *   └──────────────────────────────────┘
 */
export default function MobileListCard({
  topLeft,
  topRight,
  topRightClass = '',
  title,
  subtitle,
  meta,
  badge,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-card border rounded-xl p-3 ${onClick ? 'cursor-pointer active:bg-muted/40 transition-colors' : ''}`}
    >
      {(topLeft || topRight) && (
        <div className="flex items-center justify-between gap-2 mb-1">
          {topLeft && <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{topLeft}</span>}
          {topRight && (
            <span className={`text-base font-bold tabular-nums ${topRightClass}`}>{topRight}</span>
          )}
        </div>
      )}
      {title && (
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{title}</p>
      )}
      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</p>
      )}
      {(meta || badge) && (
        <div className="flex items-center justify-between gap-2 mt-2">
          {meta && <span className="text-[11px] text-muted-foreground truncate">{meta}</span>}
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}
    </div>
  );
}