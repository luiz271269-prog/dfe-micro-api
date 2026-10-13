import { useLocation, Link } from 'react-router-dom';
const ENTRADAS = ['/faturamento','/cobrancas'];
const SAIDAS = ['/contas-a-pagar','/compras','/despesas','/tributos','/funcionarios','/prolabore','/recorrentes','/obras','/cartoes','/cruzamento-compras'];
export default function IndicadorDirecao() {
  const { pathname } = useLocation();
  const titulo = ENTRADAS.includes(pathname) ? 'Entradas · Contas a receber' : SAIDAS.includes(pathname) ? 'Saídas · Contas a pagar' : 'Visão consolidada · Entradas e Saídas separadas';
  return <div className="mr-auto flex min-w-0 items-center gap-3 text-xs"><span className="truncate font-medium">{titulo}</span><Link to="/conciliacao360" className="hidden text-primary sm:inline">Conciliações</Link></div>;
}