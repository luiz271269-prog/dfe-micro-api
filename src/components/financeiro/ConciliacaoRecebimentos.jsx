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
  const cobrancas = query.data?.cobrancas_extrato || [];
  const gruposExtrato = [
    { itens: cobrancas, id: 'sicredi-extrato', rotulo: 'Créditos de cobrança no extrato · Sicredi', mais: query.data?.sicredi_tem_mais },
    { itens: pix, id: 'pix-recebimentos', rotulo: 'PIX recebidos no extrato', mais: query.data?.pix_tem_mais },
  ].filter(g => g.itens.length);
  const prontas = linhas.filter(l => !l.baixado && !l.ambigua && l.titulo_id && l.credito_id).length;
  const faltamParcelas = linhas.filter(l => !l.baixado && !l.titulos.length).length;
  const faltamCreditos = linhas.filter(l => !l.baixado && l.titulos.length && !l.creditos.length).length;
  const jaBaixadas = linhas.filter(l => l.baixado).length;
  const revisarOpcoes = linhas.length - prontas - faltamParcelas - faltamCreditos - jaBaixadas;
  const soma = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <section className="my-4 rounded-xl border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-2 p-4">
        <div>
          <h3 className="font-semibold">Conciliação de recebimentos{arquivoHash ? ' · arquivo importado' : ''}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Esta fila reúne evidências de recebimento de todos os períodos, não o saldo a receber do mês. Uma parcela em aberto não confirma o pagamento.</p>
          <p className="text-xs text-muted-foreground">O recebimento fica pendente até você conferir a parcela e o crédito; os alertas da verificação diária são separados.</p>
        </div>
        {!query.isError && !!linhas.length && <div className="space-y-1 text-xs text-muted-foreground">
          <p><strong className="text-foreground">{query.data.total} boletos pendentes no relatório</strong> · {formatCurrency(soma)} nos boletos exibidos</p>
          <p>{prontas} aguardando confirmação · {faltamParcelas} sem parcela compatível · {faltamCreditos} sem crédito compatível · {revisarOpcoes} para conferir{jaBaixadas ? ` · ${jaBaixadas} já baixados, aguardando concluir o relatório` : ''}</p>
        </div>}
      </div>
      {!query.isError && !!gruposExtrato.length && <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-xs">
        {gruposExtrato.map(g => <a key={g.id} href={`#${g.id}`} className="font-medium text-primary hover:underline">{g.rotulo} ({g.itens.length}{g.mais ? '+' : ''})</a>)}
      </div>}
      {query.isLoading ? <p className="px-4 pb-4 text-sm text-muted-foreground">Cruzando boletos, parcelas e extrato…</p>
        : query.isError ? <p role="alert" className="px-4 pb-4 text-sm text-destructive">{query.error.response?.data?.error || query.error.message}</p>
        : !linhas.length && !pix.length && !cobrancas.length ? <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhum boleto ou crédito do extrato pendente de conciliação.</p>
        : <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide">
                <th colSpan={3} className="bg-sidebar px-3 py-2 text-left font-semibold text-sidebar-accent-foreground">Origem do recebimento</th>
                <th className="w-px bg-border" />
                <th className="bg-primary px-3 py-2 text-left font-semibold text-primary-foreground">Parcela no sistema</th>
                <th className="w-px bg-border" />
                <th colSpan={3} className="bg-sidebar px-3 py-2 text-left font-semibold text-sidebar-accent-foreground">Crédito no extrato</th>
              </tr>
              <tr className="border-b bg-muted/50">
                <th className={TH}>Data</th><th className={TH}>Pagador ou lançamento</th><th className={`${TH} text-right`}>Valor</th>
                <th className="w-px bg-border" /><th className={TH}>Nº · vencimento</th>
                <th className="w-px bg-border" /><th className={TH}>Data · valor · descrição</th><th className={TH}>Situação</th><th />
              </tr>
            </thead>
            <tbody>
              {!!linhas.length && <tr className="border-b bg-muted"><th colSpan={9} scope="rowgroup" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Boletos do relatório de baixa · Sicredi</th></tr>}
              {linhas.map(l => <ConciliacaoRecebimentoLinha key={`${l.id}:${l.titulo_id}:${l.credito_id}`} linha={l} onConfirmar={confirmar} onSalvo={atualizar} onManual={setRevisar} />)}
            </tbody>
            {gruposExtrato.map(({ itens, id, rotulo, mais }) => <tbody key={id} id={id}>
              {mais && <tr className="border-t bg-muted/50"><td colSpan={9} className="px-3 py-1 text-xs text-muted-foreground">Exibindo os créditos mais recentes.</td></tr>}
              <tr className="border-b bg-muted"><th scope="rowgroup" colSpan={9} className="px-3 py-2 text-left text-xs">{rotulo}<span className="ml-2 font-normal text-muted-foreground">Mesmo saldo em centavos e até {query.data.janela_parcela ?? 7} dias do vencimento; nome é um sinal complementar.</span></th></tr>
              {itens.map(p => <PixRecebidoLinha key={`${p.id}:${p.titulo_id}:${p.sobreposicao}`} pix={p} onReceber={receberPix} onSalvo={atualizar} onManual={setPixManual} />)}
            </tbody>)}
          </table>
        </div>}
      {linhas.length < (query.data?.total || 0) && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Mostrando os {linhas.length} mais recentes de {query.data.total}.</p>}
      {pixManual && <PixRecebidoManualDialog pix={pixManual} onReceber={receberPix} onClose={() => setPixManual(null)} onSaved={atualizar} />}
      {revisar && <BaixaManualRecebimentoDialog linha={revisar} onConfirmar={confirmar} onClose={() => setRevisar(null)} onSaved={atualizar} />}
    </section>
  );
}