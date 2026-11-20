import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title}. OilGasCity` : 'OilGasCity: малые города нефтегазового Севера. Проект РНФ 25-27-00022';
  }, [title]);
}

// Прокрутка к якорю, когда содержимое страницы загрузилось (ссылки вида /materials#talks)
export function useHashScroll(ready) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, [ready, hash]);
}
