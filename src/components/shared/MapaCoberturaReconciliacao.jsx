import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function MapaCoberturaReconciliacao() {
  const reconciliacoes = [
    { nome: 'Banco ↔ Faturamento', status: 'ativo', pagina: 'ConciliacaoMensal', desc: 'Extrato vs NFs emitidas' },
    { nome: 'Compras ↔ Pagamentos', status: 'ativo', pagina: 'CruzamentoCompras', desc: 'Compras vs Banco/Cartão' },
    { nome: 'Cartões ↔ Lançamentos', status: 'ativo', pagina: 'Cartoes', desc: 'Faturas vs transações internas' },
    
    { nome: 'Cartões ↔ Despesas', status: 'faltante', desc: 'Transações cartão não estão vinculadas a despesas operacionais' },
    { nome: 'Obras ↔ Cartões', status: 'faltante', desc: 'Pagamentos de obra/reforma não validados contra cartão' },
    { nome: 'Tributos ↔ Compras', status: 'faltante', desc: 'ICMS/PIS das compras não validados contra tributos registrados' },
    { nome: 'Faturamento ↔ Fluxo Caixa', status: 'faltante', desc: 'Previsão de recebimento não validada contra realizado' },
    { nome: 'Despesas ↔ Banco', status: 'faltante', desc: 'Despesas operacionais não reconciliadas contra extrato' },
    { nome: 'Folha ↔ Banco', status: 'faltante', desc: 'Pagamentos de folha não validados contra lançamentos bancários' },
    { nome: 'Cartões ↔ Fornecedores', status: 'faltante', desc: 'Transações de cartão não vinculadas a fornecedores' },
    { nome: 'Compras ↔ Itens', status: 'faltante', desc: 'Consolidação de itens de compra por fornecedor/categoria' },
    { nome: 'Cobrancas ↔ Banco', status: 'faltante', desc: 'Títulos de cobrança não validados contra recebimentos bancários' },
  ];

  const ativos = reconciliacoes.filter(r => r.status === 'ativo').length;
  const faltantes = reconciliacoes.filter(r => r.status === 'faltante').length;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-5">
        <p className="text-sm font-bold text-foreground mb-4">📊 Mapa de Cobertura — Cruzamentos de Dados Financeiros</p>
        
        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-600 font-semibold">Implementados</p>
            <p className="text-lg font-bold text-green-700">{ativos}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-orange-600 font-semibold">Faltando</p>
            <p className="text-lg font-bold text-orange-700">{faltantes}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-semibold">Cobertura</p>
            <p className="text-lg font-bold text-blue-700">{Math.round((ativos / (ativos + faltantes)) * 100)}%</p>
          </div>
        </div>

        {/* Cruzamentos ativos */}
        {ativos > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground mb-2">✅ IMPLEMENTADOS</p>
            <div className="space-y-2">
              {reconciliacoes.filter(r => r.status === 'ativo').map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-900">{r.nome}</p>
                    <p className="text-xs text-green-700">{r.desc}</p>
                  </div>
                  {r.pagina && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded shrink-0">{r.pagina}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cruzamentos faltando */}
        {faltantes > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">⚠️ FALTANDO / ROADMAP</p>
            <div className="space-y-2">
              {reconciliacoes.filter(r => r.status === 'faltante').map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-orange-900">{r.nome}</p>
                    <p className="text-xs text-orange-700">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recomendações */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">💡 Próximos Passos Recomendados</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• <strong>Prioridade Alta:</strong> Cartões ↔ Despesas (melhor auditoria de gastos)</li>
          <li>• <strong>Prioridade Alta:</strong> Despesas ↔ Banco (fechamento mensal)</li>
          <li>• <strong>Prioridade Alta:</strong> Cobrancas ↔ Banco (validar recebimentos)</li>
          <li>• <strong>Prioridade Média:</strong> Obras ↔ Cartões (rastreamento de projetos)</li>
          <li>• <strong>Prioridade Média:</strong> Folha ↔ Banco (conformidade)</li>
        </ul>
      </div>
    </div>
  );
}