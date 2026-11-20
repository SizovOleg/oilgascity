// Набегающие цифры: при появлении на экране число плавно растёт от нуля до значения
import { useEffect, useRef, useState } from 'react';
import { formatFigure, motionOk, parseFigure } from '../lib/motion';

export function CountUp({ text, duration = 1100 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const p = parseFigure(text);
    if (!p || !motionOk() || !ref.current) return undefined;
    let raf = 0;
    let safety = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      // во фоновой вкладке кадры анимации не идут: итоговое значение показывается по таймеру в любом случае
      safety = window.setTimeout(() => setShown(text), duration + 200);
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / duration);
        const eased = 1 - (1 - k) ** 3;
        setShown(k < 1 ? formatFigure(p.value * eased, p) : text);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [text, duration]);
  return <span ref={ref}>{shown}</span>;
}
