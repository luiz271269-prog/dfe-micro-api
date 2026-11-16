import GrupoContaBadge from '@/components/shared/GrupoContaBadge';

export default function PageHeader({ title, subtitle, grupo, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight bg-[hsl(var(--chart-4))]">{title}</h1>
          {grupo && <GrupoContaBadge grupo={grupo} className="text-xs" />}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>);

}