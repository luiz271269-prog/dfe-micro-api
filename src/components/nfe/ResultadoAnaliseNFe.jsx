import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, AlertTriangle, XCircle, FileSearch, Package, Receipt } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

const STATUS_CFG = {
  match_exato:          { label: 'Match exato',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  divergencia_valor:    { label: 'Divergência valor',   color: 'bg-amber-100 text-amber-700 border-amber-200',      icon: AlertTriangle },
  divergencia_qtd:      { label: 'Divergência qtd',     color: 'bg-amber-100 text-amber-700 border-amber-200',      icon: AlertTriangle },
  divergencia_produto:  { label: 'Produto não bate',    color: 'bg-rose-100 text-rose-700 border-rose-200',         icon: XCircle },
  sem_pedido:           { label: 'Sem pedido',          color: 'bg-slate-100 text-slate-700 border-slate-200',      icon: FileSearch },
  pendente:             { label: 'Pendente',            color: 'bg-blue-100 text-blue-700 border-blue-200',         icon: FileSearch },
};

export default function ResultadoAnaliseNFe({ analises }) {
  const [detalhe, setDetalhe] = useState(null);

  if (!analises.length) return null;

  return (
    <div>
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Arquivo</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">NF-e</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Emitente</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Emissão</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Produtos</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Divergências</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {analises.map(a => {
                const cfg = STATUS_CFG[a.status_comparacao] || STATUS_CFG.pendente;
                const Icon = cfg.icon;
                return (
                  <tr key={a.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => setDetalhe(a)}>
                    <td className="px-3 py-2 font-medium truncate max-w-[200px]">{a.drive_file_name}</td>
                    <td className="px-3 py-2">{a.numero_nota || '—'}{a.serie ? `/${a.serie}` : ''}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{a.emitente_nome || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.data_emissao ? formatDate(a.data_emissao) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(a.valor_total || 0)}</td>
                    <td className="px-3 py-2 text-center">{a.produtos?.length || 0}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-bold ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.divergencias?.length > 0 ? (
                        <span className="text-rose-600 font-bold">{a.divergencias.length}</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-muted-foreground">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detalhe} onOpenChange={() => setDetalhe(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> NF-e {detalhe?.numero_nota} · {detalhe?.emitente_nome}
            </DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted rounded-lg p-2"><p className="text-muted-foreground">Chave</p><p className="font-mono text-[10px] break-all">{detalhe.chave_acesso || '—'}</p></div>
                <div className="bg-muted rounded-lg p-2"><p className="text-muted-foreground">Emissão</p><p className="font-semibold">{detalhe.data_emissao ? formatDate(detalhe.data_emissao) : '—'}</p></div>
                <div className="bg-muted rounded-lg p-2"><p className="text-muted-foreground">Valor produtos</p><p className="font-bold">{formatCurrency(detalhe.valor_produtos || 0)}</p></div>
                <div className="bg-muted rounded-lg p-2"><p className="text-muted-foreground">Valor total NF-e</p><p className="font-bold">{formatCurrency(detalhe.valor_total || 0)}</p></div>
              </div>

              {/* Impostos */}
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Impostos totais</p>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <div className="bg-blue-50 rounded-lg p-2"><p className="text-[10px] text-blue-700">ICMS</p><p className="font-bold">{formatCurrency(detalhe.icms_total || 0)}</p></div>
                  <div className="bg-blue-50 rounded-lg p-2"><p className="text-[10px] text-blue-700">ICMS-ST</p><p className="font-bold">{formatCurrency(detalhe.icms_st_total || 0)}</p></div>
                  <div className="bg-purple-50 rounded-lg p-2"><p className="text-[10px] text-purple-700">IPI</p><p className="font-bold">{formatCurrency(detalhe.ipi_total || 0)}</p></div>
                  <div className="bg-emerald-50 rounded-lg p-2"><p className="text-[10px] text-emerald-700">PIS</p><p className="font-bold">{formatCurrency(detalhe.pis_total || 0)}</p></div>
                  <div className="bg-emerald-50 rounded-lg p-2"><p className="text-[10px] text-emerald-700">COFINS</p><p className="font-bold">{formatCurrency(detalhe.cofins_total || 0)}</p></div>
                </div>
              </div>

              {/* Divergências */}
              {detalhe.divergencias?.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-rose-900 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {detalhe.divergencias.length} divergência(s) detectada(s)</p>
                  <ul className="space-y-1 text-xs text-rose-800">
                    {detalhe.divergencias.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                </div>
              )}

              {/* Produtos */}
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> {detalhe.produtos?.length || 0} produto(s)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-2 py-1">Cód</th>
                        <th className="text-left px-2 py-1">Descrição</th>
                        <th className="text-left px-2 py-1">NCM</th>
                        <th className="text-left px-2 py-1">CFOP</th>
                        <th className="text-right px-2 py-1">Qtd</th>
                        <th className="text-right px-2 py-1">Unit.</th>
                        <th className="text-right px-2 py-1">Total</th>
                        <th className="text-right px-2 py-1">ICMS</th>
                        <th className="text-right px-2 py-1">IPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalhe.produtos || []).map((p, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-2 py-1 font-mono">{p.codigo}</td>
                          <td className="px-2 py-1 max-w-[220px] truncate">{p.descricao}</td>
                          <td className="px-2 py-1 font-mono text-[10px]">{p.ncm}</td>
                          <td className="px-2 py-1 font-mono text-[10px]">{p.cfop}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.quantidade}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(p.valor_unitario)}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold">{formatCurrency(p.valor_total)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-blue-700">{formatCurrency(p.icms_valor || 0)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-purple-700">{formatCurrency(p.ipi_valor || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}