const campos=[['data','Competência'],['data_emissao','Emissão'],['valor','Valor'],['valor_total','Valor total'],['status','Status'],['status_pagamento','Status do fornecedor'],['forma_pagamento','Instrumento'],['tipo_compra','Tipo'],['origem_compra','Origem'],['lancamento_cartao_id','Compra do cartão']];
export default function HistoricoVinculoCartao({historico=[]}) {
  return historico.map(h=><div className="border rounded-lg p-3 text-xs space-y-2" key={h.id}>
    <p className="font-semibold">Trilha: {h.origem} · {h.fase}</p><p>{h.motivo}</p>{h.erro&&<p className="text-destructive">{h.erro}</p>}
    <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="text-left">Campo</th><th className="text-left">Antes</th><th className="text-left">Depois previsto/aplicado</th></tr></thead><tbody>{campos.filter(([k])=>h.antes[k]!=null||h.depois[k]!=null).map(([k,label])=><tr key={k} className="border-t"><td className="py-1 pr-3">{label}</td><td className="pr-3">{String(h.antes[k]??'—')}</td><td>{String(h.depois[k]??'—')}</td></tr>)}</tbody></table></div>
  </div>);
}