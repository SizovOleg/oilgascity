import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PinIcon } from './Icons';
import { ZoomLink } from './Lightbox';
import { inline } from '../lib/format';
import { CountUp } from './Motion';

export function Html({ html, className, as = 'div' }) {
  const Tag = as;
  if (!html) return null;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineHtml({ html, as = 'span', className }) {
  const Tag = as;
  if (!html) return null;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: inline(html) }} />;
}

// Справочная строка под снимком: место, дата, тема, автор
export function PhotoMeta({ place, date, theme, author, text }) {
  const parts = [];
  if (text) parts.push(text);
  else {
    const where = [place, date].filter(Boolean).join(', ');
    if (where) parts.push(`${where}.`);
    if (theme) parts.push(`Тема: ${theme}.`);
  }
  if (author) parts.push(`Фото: ${author}.`);
  if (!parts.length) return null;
  return <span className="meta">{parts.join(' ')}</span>;
}

const withSourcePrefix = (s) => (/^источник/i.test(s) ? s : `Источник: ${s}`);

export function Source({ text, html }) {
  if (html) return <span className="src" dangerouslySetInnerHTML={{ __html: inline(html) }} />;
  if (!text) return null;
  return <span className="src">{withSourcePrefix(text)}</span>;
}

// Рисунок: снимок с метаданными или карта в рамке. Щелчок открывает полный размер в окне на странице.
// ratio: общая пропорция рамки для карт одного ряда (атлас), чтобы рамки были одной высоты
export function Figure({ fig, className = '', compact = false, ratio }) {
  if (!fig?.image) return null;
  const n = fig._fig;
  const id = n ? `fig-${n}` : undefined;
  const label = n ? <b>Рис. {n}.</b> : null;
  const zoom = [{
    src: fig.image.original, preview: fig.image.large, width: fig.image.width, height: fig.image.height,
    caption: `${n ? `Рис. ${n}. ` : ''}${fig.caption || ''}`,
  }];
  if (fig.kind === 'map') {
    return (
      <figure className={`fig frame ${className}`} id={id}>
        <ZoomLink items={zoom}>
          <img src={fig.image.large} alt={fig.caption} loading="lazy" width={fig.image.width} height={fig.image.height}
            style={ratio ? { '--box-ratio': ratio } : undefined} />
        </ZoomLink>
        <figcaption className="slate">{label} {fig.caption}<Source text={fig.source} /></figcaption>
      </figure>
    );
  }
  return (
    <figure className={compact ? className : `fig ${className}`} id={id}>
      <ZoomLink items={zoom}><img src={fig.image.large} alt={fig.caption} loading="lazy" /></ZoomLink>
      <figcaption className="slate">{label} {fig.caption}
        <PhotoMeta place={fig.place} date={fig.date} theme={fig.theme} />
        <Source text={fig.source} />
      </figcaption>
    </figure>
  );
}

export function Toc({ items }) {
  if (!items?.length) return null;
  // на телефоне оглавление свёрнуто, на компьютере раскрыто
  const open = typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches;
  return (
    <details className="toc" open={open}>
      <summary>Содержание</summary>
      <ol>
        {items.map((it) => (
          <li key={it.anchor}>
            <a href={`#${it.anchor}`}>{it.title}</a>
            {it.children?.length ? (
              <ol>{it.children.map((c) => <li key={c.anchor}><a href={`#${c.anchor}`}>{c.title}</a></li>)}</ol>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function Cite({ text, note }) {
  const [status, setStatus] = useState('');
  const copy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => setStatus('Скопировано'), () => setStatus('Не удалось скопировать, выделите текст вручную'));
    } else setStatus('Не удалось скопировать, выделите текст вручную');
  };
  return (
    <>
      <div className="cite">
        <p>{text}</p>
        <button type="button" onClick={copy}>Скопировать ссылку</button>
        <output aria-live="polite">{status}</output>
      </div>
      {note ? <InlineHtml html={note} as="p" className="small mute cite-note" /> : null}
    </>
  );
}

export function Stats({ items, className = 'figures' }) {
  if (!items?.length) return null;
  return (
    <ul className={className}>
      {items.map((s, i) => (
        <li key={i}><b><CountUp text={s.value} /></b>{s.label}{s.note ? <span className="src">{s.note}</span> : null}</li>
      ))}
    </ul>
  );
}

export function GeoBand({ title = 'Геопортал', text, to = '/geoportal', image = '/img/geoportal-muravlenko.jpg' }) {
  return (
    <section className="portal" id="geoportal">
      <div className="wrap">
        <div>
          <h2>{title}</h2>
          <p>{text || 'Карты из статей проекта и возраст жилых домов на одной интерактивной карте: зелёная инфраструктура, типы поверхности, NDVI, пешеходная доступность. Открывается в полном окне.'}</p>
          <Link className="geo-btn" to={to}><PinIcon />Открыть геопортал</Link>
        </div>
        {image ? (
          <Link className="portal-shot" to={to} aria-label="Открыть геопортал">
            <img src={image} alt="Фрагмент геопортала: панель слоёв и карта города" loading="lazy" width="984" height="656" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function Loading({ error }) {
  return (
    <main className="wrap state">
      {error ? <p>Не удалось загрузить страницу. Попробуйте обновить её чуть позже.</p> : <p className="mute">Загрузка...</p>}
    </main>
  );
}

export function PageHead({ crumbs, title, deck, image, caption, meta, children }) {
  return (
    <div className={`page-head${image ? ' with-photo' : ''}`}>
      <div>
        {crumbs ? <p className="crumbs">{crumbs}</p> : null}
        <h1>{title}</h1>
        {deck ? <p className="deck">{deck}</p> : null}
        {children}
      </div>
      {image ? (
        <figure>
          <img src={image.large} alt={caption || ''} />
          {caption ? <figcaption className="slate">{caption}<PhotoMeta text={meta} /></figcaption> : null}
        </figure>
      ) : null}
    </div>
  );
}
