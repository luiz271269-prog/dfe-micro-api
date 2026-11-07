export default function OrigemNatureza({ n }) {
  if (!n?.origem) return null;
  return <span className="text-[11px] text-muted-foreground">
    {n.origem === 'texto' ? <>pelo texto: “{n.termo}”</> : <>pela data (dia {n.dia})</>}
  </span>;
}