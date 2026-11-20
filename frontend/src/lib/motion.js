// Немного движения: проявление блоков при прокрутке и разбор чисел для набегающих цифр.
// Текст никогда не прячется полностью (начальная прозрачность 0,35, а не 0), чтобы страница читалась
// и без анимации; при настройке «уменьшить движение» эффекты не включаются.
import { useEffect } from 'react';

const REVEAL = '.part-head, .goal-card, .step, .years > *, .door, .shelf, .log > *, .res, .chart, .entry, .plate, .fig, .card, .trip, .crew > div, .portal h2';
const NBSP = String.fromCharCode(160);

export const motionOk = () => typeof window !== 'undefined'
  && 'IntersectionObserver' in window
  && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

// Подключается один раз в Layout: следит за новыми блоками (контент приходит из API позже) и проявляет их
export function useRevealOnScroll() {
  useEffect(() => {
    if (!motionOk()) return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('rv-in');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    const mark = (root) => {
      const nodes = root.matches?.(REVEAL) ? [root] : [];
      root.querySelectorAll?.(REVEAL).forEach((n) => nodes.push(n));
      for (const n of nodes) {
        if (n.classList.contains('rv')) continue;
        n.classList.add('rv');
        // в скрытой вкладке (фон, предзагрузка, роботы) наблюдатель может не сработать: блок сразу виден целиком
        if (document.visibilityState !== 'visible') n.classList.add('rv-in');
        else io.observe(n);
      }
    };
    mark(document.body);
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n.nodeType === 1 && mark(n));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
}

// «4,7 км²», «около 6 000», «10 из 10»: анимируется первое число, остальное остаётся как есть.
// \s в JavaScript покрывает и неразрывный пробел.
const NUM = /(\d[\d\s]*(?:[.,]\d+)?)/;

export function parseFigure(text) {
  const m = String(text).match(NUM);
  if (!m) return null;
  const raw = m[1].trim();
  const decimals = (raw.split(/[.,]/)[1] || '').length;
  const value = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  // пробел после числа («1041 тыс. м²») остаётся в хвосте строки
  const after = text.slice(m.index + m[1].trimEnd().length);
  return { before: text.slice(0, m.index), after, value, decimals, grouped: /\s/.test(raw) };
}

export function formatFigure(v, p) {
  let s = v.toFixed(p.decimals).replace('.', ',');
  if (p.grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${p.before}${s}${p.after}`;
}
