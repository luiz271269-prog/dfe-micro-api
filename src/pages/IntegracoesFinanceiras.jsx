import { RefreshCw } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import IntegracaoStatusCards from '@/components/integracoes/IntegracaoStatusCards';
import RegistrosIntegradosTable from '@/components/integracoes/RegistrosIntegradosTable';
import useIntegracoesFinanceiras from '@/hooks/useIntegracoesFinanceiras';

export default function IntegracoesFinanceiras() {
  const { registros, carregando, sincronizando, mensagem, sincronizar, alterar } = useIntegracoesFinanceiras();
  return <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
    <PageHeader title="Integrações Financeiras" subtitle="Locações, condomínio, assistência técnica e contratos sincronizados entre aplicativos">
      <Button onClick={sincronizar} disabled={sincronizando}><RefreshCw className={sincronizando ? 'animate-spin' : ''} />{sincronizando ? 'Sincronizando' : 'Sincronizar agora'}</Button>
    </PageHeader>
    <IntegracaoStatusCards registros={registros} sincronizando={sincronizando} />
    {mensagem && <p className="mb-3 rounded-md border bg-muted px-3 py-2 text-sm">{mensagem}</p>}
    {carregando ? <p className="py-8 text-center text-muted-foreground">Carregando integrações...</p> : <RegistrosIntegradosTable registros={registros} onChange={alterar} />}
  </div>;
}