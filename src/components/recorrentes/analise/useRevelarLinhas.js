import { useEffect } from 'react';
import { formatCurrency } from '@/lib/formatters';

const PASSO = 90, ATRASO = 120, BARRA = 900, DIGITOS = 620, SUBIDA = 500, FIO = 600;

// cubic-bezier(0.22, 1, 0.36, 1): a mesma curva para barra, dígitos, texto e fio.
function curva(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = ((1.58 * t - 1.24) * t + 0.66) * t - x;
    const s = (4.74 * t - 2.48) * t + 0.66;
    if (Math.abs(d) < 1e-5 || Math.abs(s) < 1e-6) break;
    t -= d / s;
  }
  t = Math.min(1, Math.max(0, t));
  return ((-0.92 * t - 1.08) * t + 3) * t;
}
const parte = (decorrido, inicio, duracao) => curva((decorrido - inicio) / duracao);

// Revelação única: a marcação já é o bloco pronto; o script só o esconde para reproduzi-lo.
export default function useRevelarLinhas(ref, chave) {
  useEffect(() => {
    const raiz = ref.current;
    const linhas = raiz ? [...raiz.querySelectorAll('[data-sc8-row]')] : [];
    if (!linhas.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const trilhas = linhas.map((linha, i) => {
      const num = linha.querySelector('[data-sc8-num]');
      return { sobe: [...linha.querySelectorAll('[data-sc8-rise]')], fill: linha.querySelector('[data-sc8-fill]'), fio: linha.querySelector('[data-sc8-rule]'), num, alvo: Number(num.dataset.sc8Num) || 0, final: num.textContent, d: Math.min(i, 8) * PASSO };
    });
    const fim = Math.max(...trilhas.map(t => t.d)) + ATRASO + BARRA;
    const pintar = (decorrido) => trilhas.forEach(t => {
      const sobe = parte(decorrido, t.d, SUBIDA);
      t.sobe.forEach(el => { el.style.opacity = sobe; el.style.transform = `translateY(${6 * (1 - sobe)}px)`; });
      t.fill.style.transform = `scaleX(${parte(decorrido, t.d + ATRASO, BARRA)})`;
      t.num.textContent = formatCurrency(t.alvo * parte(decorrido, t.d + ATRASO, DIGITOS));
      t.num.style.opacity = decorrido >= t.d + ATRASO ? 1 : 0;
      if (t.fio) t.fio.style.transform = `scaleX(${parte(decorrido, t.d + 300, FIO)})`;
    });
    trilhas.forEach(t => { t.num.style.minWidth = `${t.num.getBoundingClientRect().width}px`; });
    pintar(-1);
    let quadro, pronto = false;
    const concluir = () => {
      if (pronto) return;
      pronto = true;
      trilhas.forEach(t => {
        [...t.sobe, t.fill, t.fio, t.num].filter(Boolean).forEach(el => { el.style.opacity = ''; el.style.transform = ''; el.style.minWidth = ''; });
        t.num.textContent = t.final;
      });
    };
    const tocar = () => {
      let t0 = 0;
      const passo = (agora) => {
        t0 ||= agora;
        if (agora - t0 >= fim) return concluir();
        pintar(agora - t0);
        quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    };
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); tocar(); } });
    io.observe(raiz);
    return () => { io.disconnect(); cancelAnimationFrame(quadro); concluir(); };
  }, [ref, chave]);
}