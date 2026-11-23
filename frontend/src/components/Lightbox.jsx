// Просмотр фото и карт поверх страницы вместо открытия файла в новой вкладке.
// openLightbox(items, index) из lib/lightbox.js вызывается откуда угодно, окно показывает LightboxHost из Layout.
// items: [{ src, preview, caption, width, height }]; src полный размер, preview уже загруженная картинка страницы,
// она растянута на месте кадра, пока грузится полный. Стрелки и Esc с клавиатуры, щелчок по фону закрывает,
// фокус возвращается к ссылке, с которой открыли.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIGHTBOX_EVENT as EVENT, openLightbox } from '../lib/lightbox';

// Ссылка на полный размер: обычный щелчок открывает окно на сайте; средняя кнопка и щелчок с Ctrl
// по-прежнему открывают файл в новой вкладке
export function ZoomLink({ items, index = 0, className = 'zoom-link', children }) {
  const onClick = (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openLightbox(items, index);
  };
  return (
    <a href={items[index].src} className={className} title="Открыть в полном размере" onClick={onClick}>
      {children}
    </a>
  );
}

export function LightboxHost() {
  const [state, setState] = useState(null);
  const back = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const open = (e) => {
      back.current = document.activeElement;
      setState(e.detail);
    };
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);

  const close = useCallback(() => {
    setState(null);
    back.current?.focus?.();
  }, []);
  const go = useCallback((d) => setState((s) => ({ ...s, index: (s.index + d + s.items.length) % s.items.length })), []);

  const isOpen = Boolean(state);
  const many = (state?.items.length || 0) > 1;
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (many && e.key === 'ArrowRight') go(1);
      if (many && e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // страница под окном не прокручивается
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [isOpen, many, close, go]);

  if (!state) return null;
  const it = state.items[state.index];
  return (
    <div className="zoom" role="dialog" aria-modal="true" aria-label={it.caption || 'Просмотр'} onClick={close}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img key={it.src} src={it.src} alt={it.caption || ''} width={it.width} height={it.height}
          style={it.preview ? { backgroundImage: `url("${it.preview}")` } : undefined} />
        {it.caption || many ? (
          <figcaption>
            {it.caption}
            {many ? <span>{state.index + 1} из {state.items.length}</span> : null}
          </figcaption>
        ) : null}
      </figure>
      {many ? (
        <>
          <button type="button" className="zoom-nav prev" aria-label="Предыдущий снимок" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
          <button type="button" className="zoom-nav next" aria-label="Следующий снимок" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
        </>
      ) : null}
      <button type="button" className="zoom-close" ref={closeRef} aria-label="Закрыть" onClick={close}>×</button>
    </div>
  );
}
