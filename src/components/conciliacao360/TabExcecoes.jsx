import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Link2, Unlink, RefreshCw, XCircle, Copy, HelpCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

/**
 * Detecta erros de pareamento automático. Para cada problema:
 * - paga_sem_match   : Título pago, sem LancamentoBancario correspondente
 * - banco_sem_titulo : Crédito no banco sem Título/NF associado (valor típico de recebimento)
 * - multi_candidatos : Uma fatura/título com 2+ lançamentos candidatos (mesmo valor, datas próximas)
 * - duplicado        : Mesmo lançamento bancário compatível com 2+ títulos
 * - fora_tolerancia  : Título pago em data próxima mas com diferença > tolerância
 */

const TOLERANCIA_VALOR = 2.00;
const JANELA_DIAS = 7;

function diffDias(d1, d2) {
  return Math.abs((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
}

function score(titulo, lanc) {
  // score 0-100 composto: valor (60%) + data (30%) + texto (10%)
  const valorDiff = Math.abs((titulo.valor_pago || titulo.valor_titulo) - lanc.valor);
  const valorScore = valorDiff < 0.02 ? 60 : valorDiff < TOLERANCIA_VALOR ? 45 : Math.max(0, 60 - valorDiff);

  const dataDiff = diffDias(titulo.data_pagamento || titulo.data_vencimento, lanc.data);
  const dataScore = dataDiff === 0 ? 30 : dataDiff <= 3 ? 20 : dataDiff <= JANELA_DIAS ? 10 : 0;

  const desc = (lanc.descricao || '').toUpperCase();
  const cliente = (titulo.cliente || '').toUpperCase();
  const txtScore = cliente && cliente.split(' ').some(w => w.length > 3 && desc.includes(w)) ? 10 : 0;

  return Math.round(valorScore + dataScore + txtScore);
}

function detectarExcecoes({ lancamentos, titulos, notas }) {
  const excecoes = [];
  const creditos = lancamentos.filter(l => l.valor > 0);

  // 1. Título pago sem match no banco
  titulos.filter(t => t.status === 'pago').forEach(t => {
    const match = creditos.find(l => Math.abs(l.valor - (t.valor_pago || 0)) < 0.02 && diffDias(t.data_pagamento, l.data) <= JANELA_DIAS);
    if (!match) {
      excecoes.push({
        tipo: 'paga_sem_match',
        severidade: 'alta',
        titulo: `Título ${t.nosso_numero || t.seu_numero} — ${t.cliente}`,
        detalhe: `Pago em ${formatDate(t.data_pagamento)} por ${formatCurrency(t.valor_pago)}, mas não há crédito bancário compatível em ±${JANELA_DIAS}d.`,
        objeto: t,
        sugestoes: creditos.filter(l => Math.abs(l.valor - (t.valor_pago || 0)) < TOLERANCIA_VALOR),
      });
    }
  });

  // 2. Crédito no banco sem título/NF (só para valores "redondos" — filtro simples)
  creditos.forEach(l => {
    const desc = (l.descricao || '').toUpperCase();
    if (desc.includes('TRANSFER') || desc.includes('APORTE') || desc.includes('EMPRESTIMO')) return;
    const titMatch = titulos.some(t => t.status === 'pago' && Math.abs((t.valor_pago || 0) - l.valor) < 0.02 && diffDias(t.data_pagamento, l.data) <= JANELA_DIAS);
    const nfMatch = notas.some(n => Math.abs(n.valor_total - l.valor) < 0.02);
    if (!titMatch && !nfMatch && l.categoria === 'recebimento') {
      excecoes.push({
        tipo: 'banco_sem_titulo',
        severidade: 'media',
        titulo: `Crédito ${formatCurrency(l.valor)} — ${l.descricao}`,
        detalhe: `Entrada de ${formatDate(l.data)} sem NF ou Título correspondente.`,
        objeto: l,
        sugestoes: titulos.filter(t => t.status === 'em_aberto' && Math.abs(t.valor_titulo - l.valor) < TOLERANCIA_VALOR),
      });
    }
  });

  // 3. Múltiplos candidatos: título em aberto com 2+ créditos possíveis
  titulos.filter(t => t.status === 'em_aberto').forEach(t => {
    const candidatos = creditos.filter(l => Math.abs(l.valor - t.valor_titulo) < TOLERANCIA_VALOR && diffDias(t.data_vencimento, l.data) <= JANELA_DIAS);
    if (candidatos.length >= 2) {
      excecoes.push({
        tipo: 'multi_candidatos',
        severidade: 'media',
        titulo: `Título ${t.nosso_numero || t.seu_numero} — ${t.cliente}`,
        detalhe: `${candidatos.length} lançamentos bancários compatíveis. Escolha o correto.`,
        objeto: t,
        sugestoes: candidatos.map(c => ({ ...c, _score: score(t, c) })).sort((a, b) => b._score - a._score),
      });
    }
  });

  // 4. Duplicidade: mesmo lançamento bancário compatível com 2+ títulos pagos
  creditos.forEach(l => {
    const pagos = titulos.filter(t => t.status === 'pago' && Math.abs((t.valor_pago || 0) - l.valor) < 0.02 && diffDias(t.data_pagamento, l.data) <= 2);
    if (pagos.length >= 2) {
      excecoes.push({
        tipo: 'duplicado',
        severidade: 'alta',
        titulo: `Crédito ${formatCurrency(l.valor)} — ${formatDate(l.data)}`,
        detalhe: `${pagos.length} títulos marcados como pagos com este mesmo valor/data. Possível duplicidade.`,
        objeto: l,
        sugestoes: pagos,
      });
    }
  });

  return excecoes;
}

const SEVERIDADE = {
  alta: 'bg-rose-100 text-rose-700 border-rose-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baixa: 'bg-blue-100 text-blue-700 border-blue-200',
};

const TIPO_LABEL = {
  paga_sem_match: { label: 'Pago sem match', icon: Unlink },
  banco_sem_titulo: { label: 'Banco sem título', icon: HelpCircle },
  multi_candidatos: { label: 'Múltiplos candidatos', icon: Copy },
  duplicado: { label: 'Duplicidade', icon: AlertTriangle },
  fora_tolerancia: { label: 'Fora de tolerância', icon: XCircle },
};

export default function TabExcecoes({ loading, dados, onRefresh }) {
  const [detalhe, setDetalhe] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [atualizando, setAtualizando] = useState(false);

  const excecoes = useMemo(() => detectarExcecoes(dados), [dados]);
  const filtradas = filtroTipo === 'todos' ? excecoes : excecoes.filter(e => e.tipo === filtroTipo);

  const stats = useMemo(() => {
    const byTipo = {};
    excecoes.forEach(e => { byTipo[e.tipo] = (byTipo[e.tipo] || 0) + 1; });
    return { total: excecoes.length, byTipo };
  }, [excecoes]);

  async function pararTitulo(titulo, lancamento) {
    setAtualizando(true);
    await base44.entities.TituloCobranca.update(titulo.id, {
      status: 'pago',
      data_pagamento: lancamento.data,
      valor_pago: lancamento.valor,
    });
    setAtualizando(false);
    setDetalhe(null);
    onRefresh();
  }

  async function desmarcarPago(titulo) {
    setAtualizando(true);
    await base44.entities.TituloCobranca.update(titulo.id, {
      status: 'em_aberto',
      data_pagamento: null,
      valor_pago: 0,
    });
    setAtualizando(false);
    setDetalhe(null);
    onRefresh();
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <div>
      {/* Explicação + stats */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-amber-900 font-semibold mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Erros de pareamento automático detectados
        </p>
        <p className="text-xs text-amber-800">
          Esta tela mostra casos em que o motor automático falhou ou ficou em dúvida. Cada exceção pode ser resolvida manualmente clicando em "Resolver".
          Tolerâncias atuais: <strong>±{formatCurrency(TOLERANCIA_VALOR)}</strong> em valor, <strong>±{JANELA_DIAS} dias</strong> em data.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <button onClick={() => setFiltroTipo('todos')} className={`rounded-xl border p-3 text-left transition-all ${filtroTipo === 'todos' ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </button>
        {Object.entries(TIPO_LABEL).filter(([k]) => stats.byTipo[k]).map(([k, v]) => {
          const Icon = v.icon;
          return (
            <button key={k} onClick={() => setFiltroTipo(k)} className={`rounded-xl border p-3 text-left transition-all ${filtroTipo === k ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                <Icon className="w-3 h-3" /> {v.label}
              </div>
              <p className="text-xl font-bold text-rose-600">{stats.byTipo[k] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Severidade</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Item</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Motivo</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Candidatos</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e, i) => {
                const tpl = TIPO_LABEL[e.tipo];
                const Icon = tpl.icon;
                return (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${SEVERIDADE[e.severidade]}`}>
                        {e.severidade}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                        <Icon className="w-3 h-3" /> {tpl.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium max-w-[280px] truncate">{e.titulo}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[320px] truncate">{e.detalhe}</td>
                    <td className="px-3 py-2 text-center font-bold">{e.sugestoes?.length || 0}</td>
                    <td className="px-3 py-2 text-center">
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setDetalhe(e)}>
                        <Link2 className="w-3 h-3 mr-1" /> Resolver
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  ✓ Nenhuma exceção detectada. Pareamento OK!
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de resolução */}
      <Dialog open={!!detalhe} onOpenChange={() => setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detalhe && (() => {
                const Icon = TIPO_LABEL[detalhe.tipo]?.icon;
                return <>{Icon && <Icon className="w-5 h-5" />} {TIPO_LABEL[detalhe.tipo]?.label}</>;
              })()}
            </DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Problema</p>
                <p className="font-semibold">{detalhe.titulo}</p>
                <p className="text-xs mt-1">{detalhe.detalhe}</p>
              </div>

              {detalhe.tipo === 'paga_sem_match' && detalhe.sugestoes.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Créditos bancários candidatos</p>
                  <div className="space-y-2">
                    {detalhe.sugestoes.map(s => (
                      <div key={s.id} className="flex items-center justify-between border rounded-lg p-2">
                        <div>
                          <p className="text-xs font-semibold">{s.descricao}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(s.data)} · {formatCurrency(s.valor)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detalhe.tipo === 'paga_sem_match' && (
                <Button variant="outline" className="w-full" onClick={() => desmarcarPago(detalhe.objeto)} disabled={atualizando}>
                  <Unlink className="w-4 h-4 mr-2" /> Desmarcar título como pago (estava errado)
                </Button>
              )}

              {detalhe.tipo === 'banco_sem_titulo' && (
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Títulos em aberto compatíveis</p>
                  {detalhe.sugestoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhum título em aberto com este valor. Pode ser recebimento externo, aporte ou empréstimo.</p>
                  ) : (
                    <div className="space-y-2">
                      {detalhe.sugestoes.map(t => (
                        <div key={t.id} className="flex items-center justify-between border rounded-lg p-2">
                          <div>
                            <p className="text-xs font-semibold">{t.cliente}</p>
                            <p className="text-[10px] text-muted-foreground">{t.nosso_numero} · venc. {formatDate(t.data_vencimento)} · {formatCurrency(t.valor_titulo)}</p>
                          </div>
                          <Button size="sm" onClick={() => pararTitulo(t, detalhe.objeto)} disabled={atualizando}>
                            Marcar como pago
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detalhe.tipo === 'multi_candidatos' && (
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Qual lançamento é o correto?</p>
                  <div className="space-y-2">
                    {detalhe.sugestoes.map(s => (
                      <div key={s.id} className="flex items-center justify-between border rounded-lg p-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold">{s.descricao}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(s.data)} · {formatCurrency(s.valor)} · score {s._score}/100</p>
                        </div>
                        <Button size="sm" onClick={() => pararTitulo(detalhe.objeto, s)} disabled={atualizando}>
                          Este
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detalhe.tipo === 'duplicado' && (
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Títulos marcados como pagos com este crédito</p>
                  <p className="text-xs text-amber-700 mb-2">Apenas um deveria estar pago. Desmarque os incorretos:</p>
                  <div className="space-y-2">
                    {detalhe.sugestoes.map(t => (
                      <div key={t.id} className="flex items-center justify-between border rounded-lg p-2">
                        <div>
                          <p className="text-xs font-semibold">{t.cliente}</p>
                          <p className="text-[10px] text-muted-foreground">{t.nosso_numero} · {formatCurrency(t.valor_pago)}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => desmarcarPago(t)} disabled={atualizando}>
                          <Unlink className="w-3 h-3 mr-1" /> Desmarcar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}