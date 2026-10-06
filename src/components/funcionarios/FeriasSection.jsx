import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { validarAdmissaoFuncionario, erroFolha } from '@/components/funcionarios/folha/folhaOperacoes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palmtree, Check } from 'lucide-react';

export default function FeriasSection({ func }) {
  const [inicio, setInicio] = useState(func.ferias_inicio || '');
  const [fim, setFim] = useState(func.ferias_fim || '');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false), [erro, setErro] = useState('');
  const motivo = !func.data_admissao ? 'Informe a admissão antes de registrar férias.' : (inicio && inicio < func.data_admissao) || (fim && fim < func.data_admissao) ? 'Férias não podem começar ou terminar antes da admissão.' : fim && inicio && fim < inicio ? 'O fim das férias deve ser igual ou posterior ao início.' : '';

  async function salvar() {
    if (salvando || motivo) return;
    setSalvando(true); setErro('');
    try {
      await validarAdmissaoFuncionario(func, [inicio, fim]);
      await base44.entities.Funcionario.update(func.id, { ferias_inicio: inicio || null, ferias_fim: fim || null });
      setSalvo(true); setTimeout(() => setSalvo(false), 3000);
    } catch (err) { setErro(erroFolha(err)); }
    finally { setSalvando(false); }
  }

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-2 flex items-center gap-1.5">
        <Palmtree className="w-3.5 h-3.5" /> Férias
      </p>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" min={func.data_admissao} value={inicio} onChange={e => setInicio(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" min={inicio > (func.data_admissao || '') ? inicio : func.data_admissao} value={fim} onChange={e => setFim(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      {(motivo || erro) && <p role="alert" className="text-xs text-destructive mb-2">{motivo || erro}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-blue-700">
          A folha de férias (salário + ⅓) é gerada automaticamente pelo botão "Gerar Folhas Pendentes".
        </p>
        <Button size="sm" onClick={salvar} disabled={salvando || !inicio || !!motivo} className="h-7 text-xs gap-1 shrink-0">
          {salvo ? <><Check className="w-3 h-3" /> Salvo</> : salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}