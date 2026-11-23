import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { T } from './i18n';

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title}. OilGasCity` : T('OilGasCity: малые города нефтегазового Севера. Проект РНФ 25-27-00022');
  }, [title]);
}

// Прокрутка к якорю, когда содержимое страницы загрузилось (ссылки вида /materials#talks).
// Встроенные разделы (фототека, карты, экспедиции, коллектив) догружаются уже после текста страницы и сдвигают
// якорь вниз, поэтому, пока раскладка меняется, якорь возвращается к верху экрана. Ручная прокрутка посетителя
// или 8 секунд это прекращают. Якорь может и появиться позже вместе со своим разделом.
const STOP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

export function useHashScroll(ready) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return undefined;
    const id = decodeURIComponent(hash.slice(1));
    let stopped = false;
    const go = () => {
      if (stopped) return;
      document.getElementById(id)?.scrollIntoView();
    };
    const stop = () => { stopped = true; };
    const ro = new ResizeObserver(() => requestAnimationFrame(go));
    ro.observe(document.body);
    for (const ev of STOP_EVENTS) window.addEventListener(ev, stop, { passive: true });
    const timer = setTimeout(stop, 8000);
    requestAnimationFrame(go);
    return () => {
      stopped = true;
      ro.disconnect();
      clearTimeout(timer);
      for (const ev of STOP_EVENTS) window.removeEventListener(ev, stop);
    };
  }, [ready, hash]);
}
