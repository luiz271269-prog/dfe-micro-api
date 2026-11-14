import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { extrairTermoChave } from '@/lib/autoCategorizacao';
import { agruparPendentes, construirHistorico } from '@/lib/saneamentoExtrato';
import { formatCurrency } from '@/lib/formatters';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import SaneamentoGrupo from './SaneamentoGrupo';

const HISTORICO = 'historico';

export default function SaneamentoDialog({ open, onOpenChange, lancamentos, onDone }) {
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [categoria, setCategoria] = useState(HISTORICO);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const { opcoes } = useCadastroClassificacao('categoria');

  const grupos = useMemo(() => agruparPendentes(lancamentos, construirHistorico(lancamentos)), [lancamentos]);
  const itens = useMemo(() => grupos.flatMap(g => g.itens), [grupos]);
  const sugestoes = useMemo(
    () => Object.fromEntries(grupos.flatMap(g => g.itens.map(i => [i.id, g.sugestao]))),
    [grupos]
  );
  const totalSelecionado = itens.filter(i => selecionados.has(i.id)).reduce((s, i) => s + Math.abs(i.valor || 0), 0);

  function toggle(ids, marcar) {
    setSelecionados(prev => {
      const next = new Set(prev);
      ids.forEach(id => (marcar ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function aplicar() {
    const escolhidos = itens.filter(i => selecionados.has(i.id));
    const porCategoria = new Map();
    let semSugestao = 0;

    escolhidos.forEach(item => {
      const alvo = categoria === HISTORICO ? sugestoes[item.id] : categoria;
      if (!alvo) { semSugestao += 1; return; }
      const lista = porCategoria.get(alvo) || [];
      lista.push(item);
      porCategoria.set(alvo, lista);
    });

    if (!porCategoria.size) {
      setResultado({ erro: 'Nenhum item selecionado tem histórico. Escolha uma categoria para aplicar.' });
      return;
    }

    setRodando(true);
    let aplicados = 0;
    const regras = new Map();

    for (const [alvo, lista] of porCategoria) {
      const { data } = await revisarTiposGasto({
        action: 'aplicar_categoria_lote',
        entidade: 'LancamentoBancario',
        categoria: alvo,
        ids: lista.map(i => i.id),
      });
      aplicados += data?.aplicados || 0;
      lista.forEach(i => {
        const termo = extrairTermoChave(i.descricao);
        if (termo) regras.set(`${termo}|${alvo}`, { termo, alvo, exemplo: i.descricao });
      });
    }

    for (const regra of regras.values()) {
      const existentes = await base44.entities.RegraCategorizacao.filter({ escopo: 'extrato', termo_chave: regra.termo });
      const dados = { categoria: regra.alvo, exemplo_descricao: regra.exemplo, ultima_atualizacao: new Date().toISOString() };
      if (existentes.length) {
        await base44.entities.RegraCategorizacao.update(existentes[0].id, { ...dados, vezes_aplicada: (existentes[0].vezes_aplicada || 1) + 1 });
      } else {
        await base44.entities.RegraCategorizacao.create({ escopo: 'extrato', termo_chave: regra.termo, vezes_aplicada: 1, ...dados });
      }
    }

    setRodando(false);
    setSelecionados(new Set());
    setResultado({ aplicados, semSugestao, regras: regras.size });
    onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setResultado(null); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Saneamento de lançamentos</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          {itens.length} lançamento(s) sem classificação completa · {formatCurrency(totalSelecionado)} selecionado(s)
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Categoria do lote</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={HISTORICO}>Usar o histórico de cada descrição</SelectItem>
                {Object.entries(opcoes).map(([chave, rotulo]) => (
                  <SelectItem key={chave} value={chave}>{rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggle(itens.map(i => i.id), selecionados.size !== itens.length)}
          >
            {selecionados.size === itens.length && itens.length ? 'Limpar seleção' : 'Selecionar todos'}
          </Button>
        </div>

        {resultado?.erro && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{resultado.erro}</div>
        )}
        {resultado && !resultado.erro && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            ✓ {resultado.aplicados} lançamento(s) classificados · {resultado.regras} regra(s) de histórico salvas
            {resultado.semSugestao ? ` · ${resultado.semSugestao} sem histórico permaneceram pendentes` : ''}
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {grupos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento pendente de classificação neste período.</p>
          ) : (
            grupos.map(grupo => (
              <SaneamentoGrupo
                key={grupo.termo}
                grupo={grupo}
                opcoesCategoria={opcoes}
                selecionados={selecionados}
                onToggle={toggle}
              />
            ))
          )}
        </div>

        <Button className="w-full" onClick={aplicar} disabled={rodando || !selecionados.size}>
          {rodando ? 'Aplicando...' : `Aplicar a ${selecionados.size} selecionado(s)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}