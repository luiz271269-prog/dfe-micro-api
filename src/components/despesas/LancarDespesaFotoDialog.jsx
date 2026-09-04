import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Save, Sparkles } from 'lucide-react';
import CampoClassificacao from '@/components/shared/CampoClassificacao';
import CapturaFoto from './CapturaFoto';
import AssinaturaCanvas from './AssinaturaCanvas';

const CATEGORIAS = ['aluguel','energia','agua','internet','telefone','manutencao','limpeza','marketing','contabilidade','juridico','seguro','transporte','alimentacao','material_escritorio','outro'];
const FORMAS_PAG = ['pix','boleto','cartao','debito_automatico','dinheiro','transferencia'];
const hoje = () => new Date().toISOString().slice(0, 10);
const VAZIO = { data: hoje(), descricao: '', fornecedor: '', categoria: 'outro', valor: '', forma_pagamento: 'pix', status: 'pago', data_vencimento: '', empresa: 'NeuralTec', origem_compra: 'empresa', tipo_compra: 'despesas', assinante_nome: '' };

const SCHEMA_EXTRACAO = {
  type: 'object',
  properties: {
    data: { type: 'string', description: 'Data da compra/emissão no formato YYYY-MM-DD' },
    fornecedor: { type: 'string', description: 'Nome do estabelecimento/fornecedor' },
    descricao: { type: 'string', description: 'Resumo curto do que foi comprado/pago' },
    valor: { type: 'number', description: 'Valor total pago em reais' },
    categoria: { type: 'string', enum: CATEGORIAS },
    forma_pagamento: { type: 'string', enum: FORMAS_PAG },
    data_vencimento: { type: 'string', description: 'Data de vencimento (boletos/contas) YYYY-MM-DD, se houver' },
  },
};

// Lançar despesa por foto: câmera → extração automática dos dados → revisão → assinatura.
export default function LancarDespesaFotoDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState(VAZIO);
  const [foto, setFoto] = useState(null); // { url, nome }
  const [extraindo, setExtraindo] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const assinatura = useRef(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function onFoto(url, nome) {
    setFoto({ url, nome });
    setExtraindo(true);
    const res = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url: url, json_schema: SCHEMA_EXTRACAO });
    setExtraindo(false);
    if (res.status !== 'success' || !res.output) return;
    const d = Array.isArray(res.output) ? res.output[0] : res.output;
    setForm(p => ({ ...p,
      data: d.data || p.data, fornecedor: d.fornecedor || p.fornecedor, descricao: d.descricao || p.descricao,
      valor: d.valor != null ? String(d.valor) : p.valor, categoria: CATEGORIAS.includes(d.categoria) ? d.categoria : p.categoria,
      forma_pagamento: FORMAS_PAG.includes(d.forma_pagamento) ? d.forma_pagamento : p.forma_pagamento, data_vencimento: d.data_vencimento || p.data_vencimento,
    }));
  }

  function fechar() { setForm(VAZIO); setFoto(null); setErro(''); onClose(); }

  async function salvar(e) {
    e.preventDefault();
    if (!form.assinante_nome.trim() || assinatura.current?.isEmpty()) { setErro('Informe o nome de quem assina e assine no campo.'); return; }
    setErro('');
    setSalvando(true);
    const blob = await assinatura.current.toBlob();
    const { file_url: assinatura_url } = await base44.integrations.Core.UploadFile({ file: new File([blob], `assinatura-${Date.now()}.png`, { type: 'image/png' }) });
    await base44.entities.DespesaOperacional.create({
      ...form, valor: parseFloat(form.valor) || 0, data_vencimento: form.data_vencimento || undefined,
      foto_url: foto?.url, comprovante_drive_url: foto?.url, comprovante_nome: foto?.nome, assinatura_url,
    });
    setSalvando(false);
    onSaved?.();
    window.dispatchEvent(new Event('neuralfinRefresh'));
    fechar();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && fechar()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Lançar despesa por foto</DialogTitle></DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <CapturaFoto titulo="Foto do cupom / nota / boleto" ajuda="Os dados do comprovante são lidos automaticamente." onFoto={onFoto} extraindo={extraindo} />
          {foto && !extraindo && <p className="text-xs text-emerald-700 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Dados preenchidos — revise antes de salvar.</p>}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => set('data', e.target.value)} required /></div>
            <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" inputMode="decimal" value={form.valor} onChange={e => set('valor', e.target.value)} required /></div>
          </div>
          <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => set('descricao', e.target.value)} required /></div>
          <div><Label>Fornecedor / Estabelecimento</Label><Input value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria *</Label>
              <Select value={form.categoria} onValueChange={v => set('categoria', v)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => set('forma_pagamento', v)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAG.map(f => <SelectItem key={f} value={f}>{f.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoClassificacao eixo="origem" label="Quem comprou" value={form.origem_compra} onChange={v => set('origem_compra', v)} />
            <CampoClassificacao eixo="tipo" label="Tipo de compra" value={form.tipo_compra} onChange={v => set('tipo_compra', v)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Empresa</Label>
              <Select value={form.empresa} onValueChange={v => set('empresa', v)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NeuralTec">NeuralTec</SelectItem><SelectItem value="Liesch">Liesch</SelectItem></SelectContent></Select></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pago">Pago</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="vencido">Vencido</SelectItem></SelectContent></Select></div>
            <div><Label>Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} /></div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div><Label>Nome de quem assina *</Label><Input value={form.assinante_nome} onChange={e => set('assinante_nome', e.target.value)} placeholder="Nome do responsável no local" /></div>
            <AssinaturaCanvas ref={assinatura} />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" disabled={salvando || extraindo} className="w-full gap-2">
            {salvando ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Salvar despesa
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}