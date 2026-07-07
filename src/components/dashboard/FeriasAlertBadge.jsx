import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { calcularSituacaoFerias } from '@/lib/feriasEngine';

// Badges de alerta de férias vencendo/vencidas para o banner de atenção do Dashboard
export default function FeriasAlertBadge() {
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.Funcionario.list('', 200),
      base44.entities.FeriasFuncionario.list('', 500),
    ]).then(([funcs, ferias]) => {
      const list = funcs
        .filter((f) => f.status !== 'desligado')
        .map((func) => ({
          func,
          sit: calcularSituacaoFerias(func, ferias.filter((fe) => fe.funcionario_nome === func.nome)),
        }))
        .filter(({ sit }) => sit.status === 'vencida' || sit.status === 'atencao');
      setAlertas(list);
    }).catch(() => setAlertas([]));
  }, []);

  if (alertas.length === 0) return null;

  return (
    <>
      {alertas.map(({ func, sit }) => (
        <Link key={func.id} to="/funcionarios">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
            sit.status === 'vencida'
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-yellow-100 text-yellow-700 border-yellow-200'
          }`}>
            🌴 {func.nome.split(' ')[0]}: {sit.status === 'vencida'
              ? 'férias VENCIDAS — pagamento em dobro'
              : `férias vencem em ${sit.diasParaLimite} dias`} ({sit.saldoDias}d de saldo)
          </span>
        </Link>
      ))}
    </>
  );
}