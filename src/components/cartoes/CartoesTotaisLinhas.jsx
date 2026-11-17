import { useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import GrupoContaBadge from '@/components/shared/GrupoContaBadge';
import { grupoDeCompraCartao } from '@/lib/gruposContasPagar';
import useRegrasEventuais from '@/hooks/useRegrasEventuais';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';
import ComponenteFaturaDocumentos from '@/components/cartoes/ComponenteFaturaDocumentos';

export default function CartoesTotaisLinhas({ linhas, sort, ordenar, selecionados, setSelecionados }) {
  const wrap = useRef(null), [marker, setMarker] = useState(null);
  const eventuais = useRegrasEventuais(), { opcoes: categorias } = useCadastroClassificacao('categoria'), { opcoes: origens } = useCadastroClassificacao('origem'), { opcoes: tipos } = useCadastroClassificacao('tipo');
  function destacar(event) { const row = event.currentTarget.getBoundingClientRect(), table = wrap.current.getBoundingClientRect(); setMarker({ top: row.top - table.top, height: row.height }); }
  const colunas = [['data_lancamento', 'Data'], ['estabelecimento', 'Lançamento'], [null, 'Vínculos · Contas a Pagar'], [null, 'Classificação'], ['valor', 'Valor']];
  return <div ref={wrap} className="dt1-zone" onPointerLeave={() => setMarker(null)}>
    <div className="dt1-marker" data-on={marker ? '1' : '0'} aria-hidden="true" style={{ height: marker?.height || 0, translate: `0 ${marker?.top || 0}px` }}/>
    <table className="dt1-table"><thead className="dt1-thead"><tr><th className="dt1-th"><input type="checkbox" aria-label="Selecionar esta página" checked={linhas.length > 0 && linhas.every(l => selecionados.includes(l.id))} onChange={e => setSelecionados(e.target.checked ? linhas.map(l => l.id) : [])}/></th>{colunas.map(([campo, titulo]) => <th className="dt1-th" key={titulo} aria-sort={campo && sort.replace('-', '') === campo ? sort.startsWith('-') ? 'descending' : 'ascending' : undefined}>{campo ? <button className="dt1-sort" onClick={() => ordenar(campo)}>{titulo}<ArrowDown className="w-3 h-3"/></button> : titulo}</th>)}</tr></thead>
      <tbody className="dt1-tbody">{linhas.map((l, i) => <tr key={l.id} className="dt1-row" data-dt1-row data-status={l.documentos.length ? 'vinculado' : 'sem_vinculo'} data-order={l.id} data-customer={l.descricao} data-total={l.valor} data-dt1-sel={selecionados.includes(l.id) ? '1' : '0'} style={{ '--dt1-i': i }} onPointerEnter={destacar}>
        <td className="dt1-cell dt1-cell--pick"><span className="dt1-rowline" aria-hidden="true"/><input type="checkbox" aria-label={`Selecionar ${l.descricao}`} checked={selecionados.includes(l.id)} onChange={e => setSelecionados(e.target.checked ? [...selecionados, l.id] : selecionados.filter(id => id !== l.id))}/></td>
        <td className="dt1-cell">{formatDate(l.data)}</td><td className="dt1-cell"><p className="font-medium">{l.descricao}</p><p className="text-xs text-muted-foreground">{l.situacao}</p></td>
        <td className="dt1-cell"><span className={`dt1-badge ${l.documentos.length ? 'text-success bg-success/10' : 'text-muted-foreground bg-muted'}`}>{l.documentos.length ? 'Documento vinculado' : 'Sem documento localizado'}</span><ComponenteFaturaDocumentos documentos={l.documentos} situacao={l.situacao_relacionada}/></td>
        <td className="dt1-cell"><GrupoContaBadge grupo={grupoDeCompraCartao(l, eventuais)}/><p className="mt-1 text-xs">{origens[l.origem_compra] || l.origem_compra || 'Quem comprou não definido'}</p><p className="text-xs text-muted-foreground">{tipos[l.tipo_compra] || l.tipo_compra || 'Tipo não definido'} · {categorias[l.categoria] || l.categoria || 'Categoria não definida'}</p>{l.documentos.length > 1 && <p className="text-xs text-warning">Múltiplos documentos: conferir classificação.</p>}</td>
        <td className="dt1-cell dt1-total whitespace-nowrap">{formatCurrency(l.valor)}</td>
      </tr>)}</tbody></table>
  </div>;
}