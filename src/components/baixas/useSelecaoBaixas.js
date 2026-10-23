import { createContext, useContext } from 'react';
export const SelecaoBaixasContext = createContext(null);
export const chaveBaixa = r => `${r.tipo}:${r.id}`;
export default function useSelecaoBaixas() { return useContext(SelecaoBaixasContext); }