export default function DashboardColumn({ title, children }) {
  return (
    <section className="dashboard-sequence-column min-w-0 space-y-3 rounded-xl border border-border bg-muted/40 p-2">
      <h2 className="border-b border-border px-2 pb-2 pt-1 text-sm font-bold uppercase tracking-wide text-primary">{title}</h2>
      {children}
    </section>
  );
}