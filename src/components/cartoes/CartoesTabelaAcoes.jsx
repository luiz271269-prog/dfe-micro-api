import { Download } from 'lucide-react';
import { useState } from 'react';

export default function CartoesTabelaAcoes({ linhas, selecionados, limpar, nome }) {
  const [feedback, setFeedback] = useState('');
  function exportar(apenasSelecionados) {
    const registros = apenasSelecionados ? linhas.filter(l => selecionados.includes(l.id)) : linhas;
    const proteger = valor => { const texto = String(valor ?? ''); return `"${(/^[=+@\-\t\r]/.test(texto) ? "'" + texto : texto).replace(/"/g, '""')}"`; };
    const csv = [['Cartão', 'Data', 'Lançamento', 'Valor R$', 'Quem comprou', 'Tipo', 'Categoria', 'Documentos vinculados'], ...registros.map(l => [nome, l.data, l.descricao, l.valor, l.origem_compra, l.tipo_compra, l.categoria, l.documentos.map(d => `${d.entidade} ${d.numero} ${d.descricao}`).join(' | ')])].map(row => row.map(proteger).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'lancamentos-cartao.csv'; link.click(); URL.revokeObjectURL(url); setFeedback(`${registros.length} lançamentos exportados.`);
  }
  return <div className="dt1-toolwrap"><div className="dt1-tools flex justify-end"><span className="dt1-export"><button className="dt1-btn dt1-btn--beam" disabled={!linhas.length} onClick={() => exportar(false)}><span className="dt1-beam-track" aria-hidden="true"><span className="dt1-beam"/></span><Download className="w-4 h-4"/>Exportar página</button></span></div>
    <div className="dt1-bulk"><span>{selecionados.length} selecionados nesta página</span><span className="flex-1"/><button className="dt1-btn" onClick={limpar}>Limpar</button><button className="dt1-btn dt1-btn--beam" onClick={() => exportar(true)}><span className="dt1-beam-track" aria-hidden="true"><span className="dt1-beam"/></span>Exportar selecionados</button></div>
    {feedback && <p role="status" className="text-xs text-success pt-2">{feedback}</p>}
  </div>;
}