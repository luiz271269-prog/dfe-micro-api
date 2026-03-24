import { Link } from 'react-router-dom';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', href, trend }) {
  const colorMap = {
    green: { bg: 'bg-green-500/10', text: 'text-green-600', icon: 'bg-green-500/15' },
    red: { bg: 'bg-red-500/10', text: 'text-red-600', icon: 'bg-red-500/15' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', icon: 'bg-blue-500/15' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', icon: 'bg-yellow-500/15' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-600', icon: 'bg-purple-500/15' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: 'bg-emerald-500/15' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-600', icon: 'bg-orange-500/15' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-600', icon: 'bg-slate-500/15' },
  };

  const c = colorMap[color] || colorMap.blue;

  const content = (
    <div className={`bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:shadow-black/5 transition-all duration-300 cursor-pointer group`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
          {Icon && <Icon className={`w-5 h-5 ${c.text}`} />}
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-sm font-medium text-foreground/80 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );

  if (href) return <Link to={href}>{content}</Link>;
  return content;
}