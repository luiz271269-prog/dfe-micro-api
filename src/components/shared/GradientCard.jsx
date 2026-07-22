import { Link } from 'react-router-dom';

const GRADIENTS = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-emerald-500 to-teal-600',
  red: 'from-rose-500 to-red-600',
  purple: 'from-purple-500 to-violet-600',
  orange: 'from-orange-500 to-amber-600',
  teal: 'from-teal-500 to-cyan-600',
  indigo: 'from-indigo-500 to-blue-700',
  slate: 'from-slate-500 to-slate-700',
  amber: 'from-amber-500 to-yellow-600',
  sky: 'from-sky-500 to-blue-500',
  lime: 'from-lime-500 to-green-600',
  pink: 'from-pink-500 to-rose-600'
};

const SECTION_GRADIENTS = {
  blue: 'from-blue-600 to-blue-700',
  green: 'from-emerald-600 to-teal-700',
  red: 'from-rose-600 to-red-700',
  purple: 'from-purple-600 to-violet-700',
  orange: 'from-orange-500 to-amber-600',
  teal: 'from-teal-600 to-cyan-700',
  indigo: 'from-indigo-600 to-blue-800',
  slate: 'from-slate-600 to-slate-800',
  amber: 'from-amber-600 to-yellow-700',
  sky: 'from-sky-600 to-blue-600',
  lime: 'from-lime-600 to-green-700'
};

export function GradientCard({ title, value, sub, icon: Icon, gradient = 'blue', href, onClick, active }) {
  const grad = GRADIENTS[gradient] || GRADIENTS.blue;

  const inner =
  <div
    onClick={onClick}
    className={`group relative bg-white dark:bg-card rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${onClick || href ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-primary/40 border-primary/30' : 'border-border/60'}`}>
    
      <div className={`h-1 w-full bg-gradient-to-r ${grad}`} />
      <div className="px-5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
          {Icon &&
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
        }
        </div>
        <p className="text-xl font-bold text-foreground tracking-tight leading-none mb-1">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>;


  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

export function SectionHeader({ icon: Icon, label, gradient = 'blue' }) {
  const grad = SECTION_GRADIENTS[gradient] || SECTION_GRADIENTS.blue;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r ${grad} mb-3 mt-6 first:mt-0`}>
      {Icon && <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-white" /></div>}
      <h2 className="text-xs font-bold text-white uppercase tracking-widest">{label}</h2>
    </div>);

}

export function TableHeader({ children }) {
  return (
    <thead>
      <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
        {children}
      </tr>
    </thead>);

}