function Linha({ label, valor, destaque }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold tabular-nums ${destaque || ''}`}>{valor}</span>
    </div>
  );
}

export default function ReanaliseFaturaResultado({ data, formatCurrency }) {
  const { totais, conciliacao, orfaos_do_mes: orfaos, duplicidades = [], classificacao_faltante: cls, fatura } = data;
  const divOk = Math.abs(totais.divergencia) < 0.01;

  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 bg-muted/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fechamento da fatura</p>
        <Linha label={`Soma real dos lançamentos (${totais.qtd_lancamentos})`} valor={formatCurrency(totais.soma_real)} />
        <Linha label="Valor total armazenado" valor={formatCurrency(fatura.valor_total_armazenado)} />
        <Linha
          label="Divergência"
          valor={formatCurrency(totais.divergencia)}
          destaque={divOk ? 'text-emerald-700' : 'text-red-700'} />
        <Linha label={`Pagamentos de fatura anterior (${totais.qtd_pagamentos})`} valor={formatCurrency(totais.soma_real - totais.soma_despesas)} />
      </div>

      <div className="border rounded-lg p-3 bg-blue-50/40">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1">Conciliação com extrato</p>
        <Linha label={`Vínculos encontrados`} valor={conciliacao.vinculos} />
        <Linha label="Total já baixado no banco" valor={formatCurrency(conciliacao.total_vinculado)} />
        <Linha
          label="Saldo em aberto"
          valor={formatCurrency(conciliacao.saldo_aberto)}
          destaque={Math.abs(conciliacao.saldo_aberto) < 0.01 ? 'text-emerald-700' : 'text-amber-700'} />
      </div>

      <div className={`border rounded-lg p-3 ${orfaos.quantidade ? 'bg-amber-50/50' : 'bg-muted/20'}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">
          Órfãos do mês {fatura.mes_referencia}
        </p>
        <Linha label="Lançamentos sem fatura neste mês" valor={orfaos.quantidade} />
        <Linha label="Valor total dos órfãos" valor={formatCurrency(orfaos.soma)} />
        {orfaos.exemplos.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto bg-background rounded border text-[11px]">
            <table className="w-full">
              <tbody>
                {orfaos.exemplos.map((o) => (
                  <tr key={o.id} className="border-b last:border-b-0">
                    <td className="px-2 py-1 whitespace-nowrap w-20">{o.data}</td>
                    <td className="px-2 py-1 truncate">{o.estabelecimento}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(o.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`border rounded-lg p-3 ${duplicidades.length ? 'bg-red-50/50' : 'bg-muted/20'}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">Duplicidades internas</p>
        {duplicidades.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma duplicidade detectada.</p>
        ) : (
          duplicidades.slice(0, 20).map((d, i) => (
            <Linha
              key={i}
              label={`${d.data} · ${d.estabelecimento} (${d.ocorrencias}x)`}
              valor={`+${formatCurrency(d.valor_excedente)}`}
              destaque="text-red-700" />
          ))
        )}
      </div>

      <div className="border rounded-lg p-3 bg-muted/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Classificação pendente</p>
        <Linha label="Sem natureza (empresarial/pessoal)" valor={cls.sem_natureza} />
        <Linha label="Sem categoria" valor={cls.sem_categoria} />
      </div>
    </div>
  );
}