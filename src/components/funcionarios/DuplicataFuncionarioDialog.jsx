import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
export default function DuplicataFuncionarioDialog({ open, onClose, revisao, manterId, onSelect, loading, saving, erro, onConfirm, onMore }) {
  return <Dialog open={open} onOpenChange={valor => { if (!valor && !saving) onClose(); }}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Excluir cadastro duplicado</DialogTitle></DialogHeader>
      {loading && !revisao ? <p className="text-sm text-muted-foreground">Conferindo duplicatas e vínculos...</p> : revisao && <div className="space-y-4">
        <p className="text-sm">Cadastro a excluir: <strong>{revisao.origem.nome}</strong> · {revisao.origem.empresa} · admissão {formatDate(revisao.origem.data_admissao)}.</p>
        {!revisao.candidatos.length ? <p className="text-sm text-muted-foreground">Nenhuma duplicata encontrada para esta pessoa, empresa e admissão. O único cadastro não pode ser excluído por esta opção.</p> : <>
          <label className="block text-sm font-medium">Cadastro que será mantido
            <Select value={manterId} onValueChange={onSelect} disabled={saving}>
              <SelectTrigger><SelectValue placeholder="Escolha o cadastro para manter" /></SelectTrigger>
              <SelectContent>{revisao.candidatos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome} · {c.cargo} · {formatDate(c.data_admissao)} · final {c.id.slice(-6)}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          {revisao.has_more && <Button variant="outline" onClick={onMore} disabled={loading || saving}>{loading ? 'Carregando...' : 'Carregar mais duplicatas'}</Button>}
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p>Vínculos que serão transferidos, sem excluir registros:</p>
            <p>{revisao.vinculos.FolhaPagamento} folhas · {revisao.vinculos.FeriasFuncionario} férias · {revisao.vinculos.RescisaoFuncionario} rescisões · {revisao.vinculos.BancoHoras} lançamentos de horas.</p>
          </div>
          <p className="text-xs text-muted-foreground">Os dados do cadastro escolhido prevalecem; campos vazios serão completados com os do duplicado. Valores, pagamentos e conciliações ficam preservados. Confirme que os dois cadastros são da mesma pessoa, especialmente quando não há CPF.</p>
          <Button variant="destructive" onClick={onConfirm} disabled={!manterId || saving}>{saving ? 'Transferindo vínculos...' : 'Confirmar exclusão do duplicado'}</Button>
        </>}
      </div>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
    </DialogContent>
  </Dialog>;
}