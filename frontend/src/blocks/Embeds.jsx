// Вставки данных других разделов в страницы материалов: публикации, экспедиции, коллектив, фототека.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useData } from '../lib/api';
import { formatDate, formatRange, photoGroups, THEME_LABELS, STATUS_LABELS } from '../lib/format';
import { Html, InlineHtml, PhotoMeta } from '../components/Common';
import { ZoomLink } from '../components/Lightbox';
import { galleryItems } from '../lib/lightbox';

function PubEntry({ p }) {
  const status = STATUS_LABELS[p.status];
  const text = p.citation || `${p.authors} ${p.title}${p.journal ? ` // ${p.journal}` : ''}. ${p.year}.`;
  const link = p.pdf_url || p.doi || p.pdf_file?.url;
  return (
    <li>
      {text}
      {status ? <span className={`chip ${status.cls}`}>{status.text}</span> : null}
      {link ? <span className="src"><a href={link}>Текст статьи</a></span> : null}
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
          <h3>Смежные публикации участников</h3>
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
      <Strip items={e.expedition_gallery} label={`Снимки экспедиции: ${e.title}`} />
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
        <p style={{ marginTop: '0.9rem' }}><Link className="more" to="/news">Все новости проекта</Link></p>
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

const cityOf = (place) => (/когалым/i.test(place) ? 'kog' : 'mur');
const yearOf = (date) => (date.match(/20\d\d/) || [''])[0];

function collectPhotos(cities, expeditions, posts) {
  const seen = new Set();
  const out = [];
  const add = (items, place) => {
    for (const it of items || []) {
      if (seen.has(it.image.original)) continue;
      seen.add(it.image.original);
      out.push({ ...it, place, city: cityOf(place), year: yearOf(it.shot_date || '') });
    }
  };
  for (const e of expeditions) add(e.expedition_gallery, /когалым/i.test(e.title + e.location) ? 'Когалым' : 'Муравленко');
  for (const c of cities) add(c.city_gallery, c.title);
  for (const p of posts) add(p.blog_gallery, /когалым/i.test(p.title) ? 'Когалым' : 'Муравленко');
  return out;
}

function FilterGroup({ label, group, options, state, setState }) {
  return (
    <div>
      <span>{label}</span>
      {options.map(([value, text]) => (
        <button key={value} type="button" aria-pressed={state[group] === value}
          onClick={() => setState({ ...state, [group]: value })}>{text}</button>
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
  const shown = photos.filter((p) => (state.city === 'all' || p.city === state.city)
    && (state.theme === 'all' || p.theme === state.theme)
    && (state.year === 'all' || p.year === state.year));

  return (
    <>
      <InlineHtml html={value.intro} as="p" className="measure" />
      {photoGroups(value.counts).map((g) => (
        <div key={g.key} className="count-group">
          <h3>{g.key}: {g.total.toLocaleString('ru-RU')} снимков</h3>
          {g.items.length ? (
            <ul className="counts">{g.items.map((c, i) => <li key={i}>{c.theme} <b>{c.count}</b></li>)}</ul>
          ) : null}
        </div>
      ))}
      <div className="filters" role="group" aria-label="Фильтры фототеки">
        <FilterGroup label="Город" group="city" state={state} setState={setState}
          options={[['all', 'все'], ['mur', 'Муравленко'], ['kog', 'Когалым']]} />
        <FilterGroup label="Тема" group="theme" state={state} setState={setState}
          options={[['all', 'все'], ...themes.map((t) => [t, THEME_LABELS[t] || t])]} />
        <FilterGroup label="Год" group="year" state={state} setState={setState}
          options={[['all', 'все'], ...years.map((y) => [y, y])]} />
      </div>
      <p className="shown">Показано снимков: <b>{shown.length}</b></p>
      <ul className="shots">
        {shown.map((p, i) => (
          <li key={p.image.original}>
            <ZoomLink items={galleryItems(shown)} index={i}><img src={p.image.thumbnail} alt={p.caption} loading="lazy" /></ZoomLink>
            <span className="slate">{p.caption}
              <PhotoMeta place={p.place} date={p.shot_date} theme={THEME_LABELS[p.theme]} author={p.author} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
