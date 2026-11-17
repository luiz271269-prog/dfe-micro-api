import { Input } from '@/components/ui/input';

// Lista de procedimentos sugeridos; o usuário escolhe explicitamente um deles.
export default function RevisaoProcedimentos({ procedimentos, escolha, alternativa, onEscolha, onAlternativa }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">Qual é o procedimento correto?</legend>
      {procedimentos.map(p => (
        <label key={p.id} className={`block cursor-pointer rounded-xl border p-3 transition-colors ${escolha === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
          <div className="flex items-start gap-3">
            <input type="radio" name="procedimento" className="mt-1" checked={escolha === p.id} onChange={() => onEscolha(p.id)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.rotulo}{p.sugerido && <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Sugerido</span>}</p>
              <p className="text-xs text-muted-foreground">{p.descricao}</p>
              {escolha === p.id && p.alternativa && (
                p.alternativa.opcoes?.length ? (
                  <select className="mt-2 h-9 w-full rounded-md border bg-background px-2 text-sm" value={alternativa} onChange={e => onAlternativa(e.target.value)}>
                    <option value="">Selecione…</option>
                    {p.alternativa.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                  </select>
                ) : (
                  <Input className="mt-2" placeholder={p.alternativa.placeholder || 'Descreva o procedimento'} value={alternativa} onChange={e => onAlternativa(e.target.value)} />
                )
              )}
            </div>
          </div>
        </label>
      ))}
    </fieldset>
  );
}