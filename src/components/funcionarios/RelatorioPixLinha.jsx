import { useState } from 'react';
import { ChevronDown, ChevronUp, Palmtree, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { SITUACAO_RASTREIO, CLASSIFICACAO_AUDITORIA, TIPO_PIX } from './rastreioPixRotulos';

const v = n => (n > 0 ? formatCurrency(n) : '—');

export default function RelatorioPixLinha({ comp }) {
  const [aberto, setAberto] = useState(false);
  const sit = SITUACAO_RASTREIO[comp.situacao] || SITUACAO_RASTREIO.vencida;
  const clsAud = CLASSIFICACAO_AUDITORIA[comp.classificacao_auditoria] || null;
  const naoConta = (comp.pix_a_confirmar || 0) + (comp.pix_suspeito || 0);
  const candidatos = comp.candidatos_pix || [];

  return (
    <div className="border-b last:border-b-0">
      <button onClick={() => setAberto(!aberto)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/20 text-left">
        <span className="font-mono text-xs font-bold w-16 shrink-0">{comp.competencia}</span>
        {comp.tipo === 'ferias' && <Palmtree className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-8 gap-2 text-xs tabular-nums">
          <span>Devido: <b>{formatCurrency(comp.liquido)}</b></span>
          <span className="text-muted-foreground" title="5º ao 7º dia útil do mês seguinte">
            5º DU: <b className="text-foreground">{comp.janela_inicio ? formatDate(comp.janela_inicio) : (comp.vencimento ? formatDate(comp.vencimento) : '—')}</b>
          </span>
          <span className="text-green-700">PIX Salário: <b>{v(comp.pix_salario + comp.pix_complemento)}</b></span>
          <span className="text-indigo-700">Baixa manual: <b>{v(comp.baixa_manual || 0)}</b></span>
          <span className="text-blue-700">Comissão: <b>{v(comp.pix_comissao)}</b></span>
          <span className="text-yellow-700">Vales: <b>{v(comp.pix_adiantamentos)}</b></span>
          <span className="text-sky-700">
            {candidatos.length > 0 ? <>Candidato: <b>{formatCurrency(candidatos.reduce((s, c) => s + c.valor, 0))}</b></> : <>A conferir: <b>{v(naoConta)}</b></>}
          </span>
          <span className={comp.diferenca > 50 ? 'text-orange-700' : 'text-green-700'}>Saldo: <b>{formatCurrency(comp.diferenca)}</b></span>
        </div>
        {clsAud && (
          <span className={`hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${clsAud.cls}`}>
            {clsAud.label}
          </span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${sit.cls}`}>{sit.label}</span>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {aberto && (
        <div className="px-4 pb-3 bg-muted/10 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
            <span>
              Janela esperada (5º ao 7º dia útil do mês seguinte):{' '}
              <b className="text-foreground">{comp.janela_inicio ? `${formatDate(comp.janela_inicio)} a ${formatDate(comp.vencimento)}` : (comp.vencimento ? formatDate(comp.vencimento) : 'sem janela fixa')}</b>
              {comp.data_salario && ` · PIX salário em ${formatDate(comp.data_salario)}`}
              {comp.cobertura_extrato && ` · Cobertura do extrato no mês de pagamento: ${comp.cobertura_extrato}`}
            </span>
            {comp.motivo_auditoria && (
              <span className="inline-flex items-center gap-1 text-foreground font-medium">
                <Info className="w-3.5 h-3.5 text-primary" /> {comp.motivo_auditoria}
              </span>
            )}
          </div>

          {comp.pix.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum PIX ou baixa registrado nesta competência.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vínculos e Evidências Atuais</p>
              {comp.pix.map((px, i) => {
                const tc = TIPO_PIX[px.tipo] || TIPO_PIX.complemento;
                return (
                  <div key={i} className="text-xs bg-card border rounded px-2.5 py-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-muted-foreground w-20 shrink-0">{formatDate(px.data)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${tc.color}`}>{tc.label}</span>
                      {px.tipo_vinculo_original && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          vínculo: {px.tipo_vinculo_original}
                        </span>
                      )}
                      <span className="flex-1 truncate text-muted-foreground">{px.descricao}</span>
                      <span className="font-bold tabular-nums shrink-0">{formatCurrency(px.valor)}</span>
                    </div>
                    <p className="pl-[5.5rem] text-[11px] text-muted-foreground">{px.motivo}</p>
                    {(px.alertas || []).map((a, idx) => (
                      <p key={idx} className="pl-[5.5rem] text-[11px] text-orange-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />{a}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {candidatos.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> PIX Candidato(s) Não Vinculado(s) no Extrato do Mês Seguinte
              </p>
              {candidatos.map((cand, idx) => (
                <div key={idx} className="text-xs bg-sky-50/80 border border-sky-200 rounded px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sky-900 font-semibold w-20 shrink-0">{formatDate(cand.data)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-200/70 text-sky-900 font-bold shrink-0">
                      {cand.na_janela_quinto_dia ? 'No 5º–7º dia útil' : 'Mês de pagamento'} · Evidência {cand.grau_evidencia || 'alta'}
                    </span>
                    <span className="flex-1 truncate text-sky-950">{cand.descricao}</span>
                    <span className="font-bold tabular-nums text-sky-900 shrink-0">{formatCurrency(cand.valor)}</span>
                  </div>
                  <p className="pl-[5.5rem] text-[11px] text-sky-800">{cand.motivo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}