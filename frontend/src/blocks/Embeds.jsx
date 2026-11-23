// Вставки данных других разделов в страницы материалов: публикации, экспедиции, коллектив, фототека.
import { useMemo, useRef, useState } from 'react';
import { LLink as Link, T, currentLang } from '../lib/i18n';
import { api, useData } from '../lib/api';
import { formatDate, formatRange, photoGroups, THEME_LABELS, STATUS_LABELS } from '../lib/format';
import { Html, InlineHtml, PhotoMeta } from '../components/Common';
import { ZoomLink } from '../components/Lightbox';
import { galleryItems } from '../lib/lightbox';
import { Email } from '../lib/email';

function PubEntry({ p }) {
  const status = STATUS_LABELS[p.status];
  const text = p.citation || `${p.authors} ${p.title}${p.journal ? ` // ${p.journal}` : ''}. ${p.year}.`;
  const link = p.pdf_url || p.doi || p.pdf_file?.url;
  return (
    <li>
      {text}
      {status ? <span className={`chip ${status.cls}`}>{T(status.text)}</span> : null}
      {link ? <span className="src"><a href={link}>{T('Текст статьи')}</a></span> : null}
    </li>
  );
}

function Publications() {
  const { data } = useData(() => api.publications());
  if (!data) return null;
  const pubs = data.publications || [];
  const main = pubs.filter((p) => p.group !== 'related');
  const related = pubs.filter((p) => p.group === 'related');
  return (
    <>
      <ol className="bib">{main.map((p) => <PubEntry key={p.id} p={p} />)}</ol>
      {related.length ? (
        <>
          <h3>{T('Смежные публикации участников')}</h3>
          <ol className="bib">{related.map((p) => <PubEntry key={p.id} p={p} />)}</ol>
        </>
      ) : null}
    </>
  );
}

export function Strip({ items, label, limit = 8 }) {
  if (!items?.length) return null;
  return (
    <div className="strip" tabIndex={0} aria-label={label}>
      {items.slice(0, limit).map((it, i) => (
        <figure key={it.id}>
          <ZoomLink items={galleryItems(items.slice(0, limit))} index={i}><img src={it.image.large} alt={it.caption} loading="lazy" /></ZoomLink>
          <figcaption className="slate">{it.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Expeditions() {
  const { data } = useData(() => api.expeditions());
  if (!data) return null;
  return data.map((e) => (
    <article className="trip" key={e.id}>
      <div className="trip-head">
        <h3><Link to={`/expeditions/${e.id}`}>{e.location || e.title}</Link></h3>
        <span className="when">{formatRange(e.date_start, e.date_end)}</span>
      </div>
      <Html html={e.description} className="measure prose" />
      <Strip items={e.expedition_gallery} label={`${T('Снимки экспедиции:')} ${e.title}`} />
    </article>
  ));
}

const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');

function Team() {
  const { data } = useData(() => api.team());
  if (!data) return null;
  return (
    <div className="crew">
      {(data.members || []).map((m) => (
        <div key={m.id}>
          {m.photo ? <img src={m.photo.large} alt={m.name} loading="lazy" /> : <div className="nophoto initials" aria-hidden="true">{initials(m.name)}</div>}
          <h4>{m.name}</h4>
          {m.role ? <p className="role">{m.role}</p> : null}
          {m.position ? <p>{m.position}</p> : null}
          {m.email ? <p className="small"><Email hidden={m.email} /></p> : null}
          <p className="small links">
            {m.orcid ? <a href={m.orcid}>ORCID</a> : null}
            {m.elibrary ? <a href={m.elibrary}>eLIBRARY</a> : null}
            {m.scopus ? <a href={m.scopus}>Scopus</a> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export function NewsLog({ posts, limit = 4 }) {
  if (!posts?.length) return null;
  const [lead, ...rest] = posts;
  return (
    <div className="log">
      <article className="log-lead">
        {lead.header_image ? <Link to={`/news/${lead.id}`}><img src={lead.header_image.large} alt="" loading="lazy" /></Link> : null}
        <span className="day">{formatDate(lead.date)}</span>
        <h3><Link to={`/news/${lead.id}`}>{lead.title}</Link></h3>
      </article>
      <div>
        <ul className="log-list">
          {rest.slice(0, limit - 1).map((p) => (
            <li key={p.id}>
              {p.header_image ? <img src={p.header_image.thumbnail} alt="" loading="lazy" /> : <span className="noimg" />}
              <div><span className="day">{formatDate(p.date)}</span><h3><Link to={`/news/${p.id}`}>{p.title}</Link></h3></div>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: '0.9rem' }}><Link className="more" to="/news">{T('Все новости проекта')}</Link></p>
      </div>
    </div>
  );
}

function News() {
  const { data } = useData(() => api.news());
  return data ? <NewsLog posts={data} /> : null;
}

export function Embed({ kind }) {
  if (kind === 'publications') return <Publications />;
  if (kind === 'expeditions') return <Expeditions />;
  if (kind === 'team') return <Team />;
  if (kind === 'news') return <News />;
  return null;
}

// ------------------------------------------------------------------ фототека

const cityOf = (place) => (/когалым|kogalym/i.test(place) ? 'kog' : 'mur');
const yearOf = (date) => (date.match(/20\d\d/) || [''])[0];
const COLLAPSED = 12; // снимков в свёрнутой фототеке: три ряда по четыре

// Рисунки и схемы из статей (файлы fig-…) стоят в галереях новостей, но в фототеке только полевые снимки.
// Подпись проверяется на обоих языках: в английском переводе страниц «Рисунок из статьи» = «Figure from the paper»
const isFigure = (it) => /\/fig[-_][^/]*$/i.test(it.image.original) || /рисунок из статьи|figure from the paper/i.test(it.caption || '');

function collectPhotos(cities, expeditions, posts) {
  const seen = new Set();
  const out = [];
  const add = (items, place) => {
    for (const it of items || []) {
      if (seen.has(it.image.original) || isFigure(it)) continue;
      seen.add(it.image.original);
      out.push({ ...it, place, city: cityOf(place), year: yearOf(it.shot_date || '') });
    }
  };
  for (const e of expeditions) add(e.expedition_gallery, /когалым|kogalym/i.test(e.title + e.location) ? T('Когалым') : T('Муравленко'));
  for (const c of cities) add(c.city_gallery, c.title);
  for (const p of posts) add(p.blog_gallery, /когалым|kogalym/i.test(p.title) ? T('Когалым') : T('Муравленко'));
  return out;
}

// options: [значение, подпись, число снимков]; кнопка без снимков при текущих фильтрах неактивна
function FilterGroup({ label, group, options, state, setState }) {
  return (
    <div>
      <span>{label}</span>
      {options.map(([value, text, count]) => (
        <button key={value} type="button" aria-pressed={state[group] === value} disabled={count === 0 && state[group] !== value}
          onClick={() => setState({ ...state, [group]: value })}>{text}{count !== undefined ? <small> {count}</small> : null}</button>
      ))}
    </div>
  );
}

export function PhotoLibrary({ value }) {
  const { data } = useData(() => Promise.all([api.cities(), api.expeditions(), api.news()]));
  const [state, setState] = useState({ city: 'all', theme: 'all', year: 'all' });
  const photos = useMemo(() => (data ? collectPhotos(...data) : []), [data]);
  const themes = useMemo(() => [...new Set(photos.map((p) => p.theme).filter(Boolean))], [photos]);
  const years = useMemo(() => [...new Set(photos.map((p) => p.year).filter(Boolean))].sort(), [photos]);
  const [open, setOpen] = useState(false); // сетка свёрнута до трёх рядов, чтобы не листать сотни снимков
  const topRef = useRef(null);
  const pass = (p, skip) => (skip === 'city' || state.city === 'all' || p.city === state.city)
    && (skip === 'theme' || state.theme === 'all' || p.theme === state.theme)
    && (skip === 'year' || state.year === 'all' || p.year === state.year);
  const shown = photos.filter((p) => pass(p));
  // число снимков у кнопки фильтра при остальных выбранных фильтрах
  const countBy = (group, value) => photos.filter((p) => pass(p, group) && (value === 'all' || p[group] === value)).length;
  const visible = open ? shown : shown.slice(0, COLLAPSED);
  const fmt = (n) => n.toLocaleString(currentLang() === 'en' ? 'en-GB' : 'ru-RU');
  const groups = photoGroups(value.counts);
  const archived = groups.reduce((s, g) => s + g.total, 0);
  const collapse = () => {
    setOpen(false);
    // после перерисовки (сетка уже короче) страница возвращается к фильтрам
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start' }));
  };

  return (
    <>
      <InlineHtml html={value.intro} as="p" className="measure" />
      {photos.length && archived ? (
        <p className="measure archive-note">
          {T('Всего в экспедициях получено')} <b>{fmt(archived)}</b> {T('снимков. На сайте опубликовано')} <b>{fmt(photos.length)}</b>:
          {' '}{T('отобранные кадры с подписями. Остальные хранятся в архиве проекта.')}
        </p>
      ) : null}
      {groups.map((g) => (
        <div key={g.key} className="count-group">
          <h3>{g.key}: {fmt(g.total)} {T('снимков в архиве')}, {fmt(photos.filter((p) => p.city === cityOf(g.key)).length)} {T('на сайте')}</h3>
          {g.items.length ? (
            <ul className="counts">{g.items.map((c, i) => <li key={i}>{c.theme} <b>{c.count}</b></li>)}</ul>
          ) : null}
        </div>
      ))}
      <div className="filters" role="group" aria-label={T('Фильтры фототеки')} ref={topRef}>
        <FilterGroup label={T('Город')} group="city" state={state} setState={setState}
          options={[['all', T('все')], ['mur', T('Муравленко')], ['kog', T('Когалым')]].map(([v, t]) => [v, t, countBy('city', v)])} />
        <FilterGroup label={T('Тема')} group="theme" state={state} setState={setState}
          options={[['all', T('все')], ...themes.map((t) => [t, T(THEME_LABELS[t] || t)])].map(([v, t]) => [v, t, countBy('theme', v)])} />
        <FilterGroup label={T('Год')} group="year" state={state} setState={setState}
          options={[['all', T('все')], ...years.map((y) => [y, y])].map(([v, t]) => [v, t, countBy('year', v)])} />
      </div>
      <p className="shown">{T('Показано снимков:')} <b>{shown.length}</b></p>
      <ul className="shots">
        {visible.map((p, i) => (
          <li key={p.image.original}>
            <ZoomLink items={galleryItems(shown)} index={i}><img src={p.image.thumbnail} alt={p.caption} loading="lazy" /></ZoomLink>
            <span className="slate">{p.caption}
              <PhotoMeta place={p.place} date={p.shot_date} theme={T(THEME_LABELS[p.theme] || '')} author={p.author} />
            </span>
          </li>
        ))}
      </ul>
      {shown.length > COLLAPSED ? (
        <p className="shots-more">
          {open
            ? <button type="button" onClick={collapse}>{T('Свернуть фототеку')}</button>
            : <button type="button" onClick={() => setOpen(true)}>{T('Показать все {n} снимков').replace('{n}', fmt(shown.length))}</button>}
        </p>
      ) : null}
    </>
  );
}
