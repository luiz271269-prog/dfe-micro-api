export default function SectionHeader({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
      {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}