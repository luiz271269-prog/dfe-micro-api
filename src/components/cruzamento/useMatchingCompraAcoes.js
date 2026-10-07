import { useState } from 'react';
import { vincularCompraPagamento } from '@/functions/vincularCompraPagamento';
import { desvincularCompraPagamento } from '@/functions/desvincularCompraPagamento';
import { acharPagamentosParaCompra, nivelConfianca } from '@/lib/compraPagamentoEngine';
const mensagem = e => e.response?.data?.error || e.message || 'Não foi possível concluir a operação.';
export default function useMatchingCompraAcoes({ compras, lancamentosBanco, lancamentosCartao, onRefresh }) {
  const [compraAberta, setCompraAberta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [motivo, setMotivo] = useState('');
  const abrirCompra = compra => { setCompraAberta(compra); setMotivo(''); setErro(''); };
  const enviar = async (fn, payload) => {
    const res = await fn(payload);
    if (res.data?.error || res.data?.success === false) throw new Error(res.data?.error || 'Operação não concluída.');
    return res.data;
  };
  async function vincular(tipo, ref_id) {
    setSalvando(true); setErro('');
    try { await enviar(vincularCompraPagamento, { item_compra_id: compraAberta.id, tipo, ref_id, motivo }); await onRefresh?.(); setCompraAberta(null); }
    catch (e) { setErro(mensagem(e)); } finally { setSalvando(false); }
  }
  async function desvincular(compra) {
    if (!window.confirm('Remover vínculo de pagamento desta compra, preservando seu histórico?')) return;
    setSalvando(true); setErro('');
    try { await enviar(desvincularCompraPagamento, { item_compra_id: compra.id }); await onRefresh?.(); }
    catch (e) { setErro(mensagem(e)); } finally { setSalvando(false); }
  }
  async function autoVincularLote() {
    setSalvando(true); setErro(''); let vinculados = 0; const pendencias = [];
    try {
      for (const c of compras.filter(c => (c.status_pagamento || 'nao_identificado') !== 'pago')) {
        const best = acharPagamentosParaCompra(c, { lancamentosBanco, lancamentosCartao })[0];
        if (!best || nivelConfianca(best.score) !== 'alta') continue;
        try { await enviar(vincularCompraPagamento, { item_compra_id: c.id, tipo: best.tipo, ref_id: best.ref.id, automatico: true }); vinculados++; }
        catch (e) { pendencias.push(`${c.fornecedor}: ${mensagem(e)}`); }
      }
      await onRefresh?.();
      if (pendencias.length) setErro(`${vinculados} vinculadas; ${pendencias.length} exigem revisão. ${pendencias[0]}`);
      else window.alert(`${vinculados} compras vinculadas automaticamente (alta confiança).`);
    } catch (e) { setErro(mensagem(e)); } finally { setSalvando(false); }
  }
  return { compraAberta, setCompraAberta, abrirCompra, salvando, erro, motivo, setMotivo, vincular, desvincular, autoVincularLote };
}