import { useState } from 'react';
import useConciliacaoRecebimentos from '@/components/financeiro/useConciliacaoRecebimentos';
import ConciliacaoRecebimentoLinha from '@/components/financeiro/ConciliacaoRecebimentoLinha';
import BaixaManualRecebimentoDialog from '@/components/financeiro/BaixaManualRecebimentoDialog';
import PixRecebidoLinha from '@/components/financeiro/PixRecebidoLinha';
import PixRecebidoManualDialog from '@/components/financeiro/PixRecebidoManualDialog';
import { formatCurrency } from '@/lib/formatters';

const TH = 'px-3 py-2 text-left font-semibold text-muted-foreground';

// Conciliação única de cobranças e contas a receber, usada na Importação e em Cobranças.
export default function ConciliacaoRecebimentos({ arquivoHash }) {
  const [revisar, setRevisar] = useState(null);
  const [pixManual, setPixManual] = useState(null);
  const { query, atualizar, confirmar, receberPix } = useConciliacaoRecebimentos(arquivoHash);
  const linhas = query.data?.linhas || [], pix = query.data?.pix || [];
  const prontas = linhas.filter(l => (l.titulo_id && l.credito_id) || (!l.titulos.length && l.baixado)).length;
  const soma = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <section className="my-4 rounded-xl border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-2 p-4">
        <div>
          <h3 className="font-semibold">Conciliação de recebimentos{arquivoHash ? ' · arquivo importado' : ''}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Boleto liquidado ou PIX recebido × parcela em aberto × crédito do extrato. Cada baixa só acontece ao confirmar a linha.</p>
        </div>
        {!!linhas.length && <p className="text-xs text-muted-foreground">{query.data.total} pendentes · {formatCurrency(soma)} · <span className="font-semibold text-success">{prontas} com parcela e crédito</span></p>}
      </div>
      {query.isLoading ? <p className="px-4 pb-4 text-sm text-muted-foreground">Cruzando boletos, parcelas e extrato…</p>
        : query.isError ? <p role="alert" className="px-4 pb-4 text-sm text-destructive">{query.error.response?.data?.error || query.error.message}</p>
        : !linhas.length && !pix.length ? <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhum boleto liquidado ou PIX recebido pendente de conciliação.</p>
        : <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide">
                <th colSpan={3} className="bg-sidebar px-3 py-2 text-left font-semibold text-sidebar-accent-foreground">Boleto liquidado · Sicredi</th>
                <th className="w-px bg-border" />
                <th className="bg-primary px-3 py-2 text-left font-semibold text-primary-foreground">Parcela no sistema</th>
                <th className="w-px bg-border" />
                <th colSpan={3} className="bg-sidebar px-3 py-2 text-left font-semibold text-sidebar-accent-foreground">Crédito no extrato</th>
              </tr>
              <tr className="border-b bg-muted/50">
                <th className={TH}>Pagamento</th><th className={TH}>Pagador</th><th className={`${TH} text-right`}>Valor</th>
                <th className="w-px bg-border" /><th className={TH}>Nº · vencimento</th>
                <th className="w-px bg-border" /><th className={TH}>Data · valor · descrição</th><th className={TH}>Situação</th><th />
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => <ConciliacaoRecebimentoLinha key={`${l.id}:${l.titulo_id}:${l.credito_id}`} linha={l} onConfirmar={confirmar} onSalvo={atualizar} onManual={setRevisar} />)}
              {!!pix.length && <tr className="border-b bg-muted"><td colSpan={9} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">PIX recebidos sem boleto liquidado · {query.data.total_pix} sem conciliação · {formatCurrency(pix.reduce((s, p) => s + p.disponivel, 0))}{pix.length < query.data.total_pix ? ` · mostrando os ${pix.length} mais recentes` : ''}</td></tr>}
              {pix.map(p => <PixRecebidoLinha key={`${p.id}:${p.titulo_id}`} pix={p} onReceber={receberPix} onSalvo={atualizar} onManual={setPixManual} />)}
            </tbody>
          </table>
        </div>}
      {linhas.length < (query.data?.total || 0) && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Mostrando os {linhas.length} mais recentes de {query.data.total}.</p>}
      {pixManual && <PixRecebidoManualDialog pix={pixManual} onReceber={receberPix} onClose={() => setPixManual(null)} onSaved={atualizar} />}
      {revisar && <BaixaManualRecebimentoDialog linha={revisar} onConfirmar={confirmar} onClose={() => setRevisar(null)} onSaved={atualizar} />}
    </section>
  );
}