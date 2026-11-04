import { useState } from 'react';
import { Button } from '@/components/ui/button';
import useElegibilidadeCompras from '@/components/contas-pagar/useElegibilidadeCompras';
import ComprasElegibilidadeLista from '@/components/contas-pagar/ComprasElegibilidadeLista';

const CATEGORIAS = { incompleto: 'Cadastro incompleto', aptos_abertos: 'Aptos · estado aberto', aptos_pagos: 'Aptos · estado pago', cartao_vinculado: 'Vinculados ao cartão', cartao_sem_vinculo: 'Cartão sem vínculo', estado_revisao: 'Estado em revisão' };
export default function ComprasElegibilidade({ mes, anual, empresa, natureza, versao, onSaved }) {
  const [categoria, setCategoria] = useState('incompleto');
  const [todosPeriodos, setTodosPeriodos] = useState(false);
  const consulta = useElegibilidadeCompras({ mes, anual, empresa, natureza, categoria, todosPeriodos }, versao);
  function atualizar() { consulta.refetch(); onSaved?.(); }
  return <section className="mb-4 space-y-3 rounded-xl border bg-card p-4" aria-label="Elegibilidade das compras locais">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Compras locais · elegibilidade da carteira</h3><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={todosPeriodos} onChange={e => setTodosPeriodos(e.target.checked)} />Todos os períodos</label></div>
    <p className="text-xs text-muted-foreground">{todosPeriodos ? 'Todos os períodos, mantendo os filtros de empresa e natureza.' : 'Vencimento ou emissão no período selecionado; na consulta atual, inclui pendências anteriores e sem data.'} Contagens por item, não por título. Não incluem consultas externas nem previsões.</p>
    <p className="text-xs text-muted-foreground">Sem nota ou vencimento, o item fica em revisão, não vira dívida confirmada nem desaparece como quitado. Cartão informado sem vínculo exige conferência; cartão vinculado compõe a fatura, sem somar novamente como pagamento direto.</p>
    <div className="flex flex-wrap gap-2">{Object.entries(CATEGORIAS).map(([key, label]) => <Button key={key} variant={key === categoria ? 'default' : 'outline'} size="sm" onClick={() => setCategoria(key)}>{label}{consulta.resumo ? ` (${consulta.resumo[key]})` : ''}</Button>)}</div>
    {consulta.total !== undefined && <p className="text-xs text-muted-foreground">{consulta.total} item(ns) no recorte, em categorias sem sobreposição. Valores abaixo são cadastrais, não saldo certificado.</p>}
    <ComprasElegibilidadeLista consulta={consulta} onSaved={atualizar} />
  </section>;
}