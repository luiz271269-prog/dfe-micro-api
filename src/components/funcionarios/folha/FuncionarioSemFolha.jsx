export default function FuncionarioSemFolha({ funcionario }) {
  return (
    <tr className="border-b bg-muted/50 text-muted-foreground" title={`Admissão: ${funcionario.data_admissao || 'não informada'}`}>
      <td className="px-4 py-2.5 font-semibold">{funcionario.nome}</td>
      {Array.from({ length: 7 }, (_, i) => <td key={i} className="px-3 py-2.5 text-right">—</td>)}
      <td className="px-3 py-2.5 text-center text-xs">Folha não gerada</td>
    </tr>
  );
}