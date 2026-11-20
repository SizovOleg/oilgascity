import { Link, useParams } from 'react-router-dom';
import { api, useData } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { formatDate, formatRange, plain } from '../lib/format';
import { Html, Loading, PageHead, PhotoMeta } from '../components/Common';

function Sheet({ items, place }) {
  if (!items?.length) return null;
  return (
    <section className="sec">
      <h2 className="sheet-title">Снимки</h2>
      <div className="sheet">
        {items.map((it) => (
          <figure key={it.id}>
            <a href={it.image.original} target="_blank" rel="noreferrer"><img src={it.image.large} alt={it.caption} loading="lazy" /></a>
            <figcaption className="slate">{it.caption}<PhotoMeta place={place} date={it.shot_date} author={it.author} /></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function NewsList() {
  useTitle('Новости');
  const { data, error } = useData(() => api.news());
  if (!data) return <Loading error={error} />;
  return (
    <main>
      <div className="wrap">
        <PageHead crumbs={<><Link to="/">Главная</Link> / Новости</>} title="Новости проекта"
          deck="Экспедиции, доклады на конференциях, публикации и итоги этапов гранта." />
        <ul className="news-list">
          {data.map((p) => (
            <li key={p.id}>
              {p.header_image ? <Link to={`/news/${p.id}`}><img src={p.header_image.thumbnail} alt="" loading="lazy" /></Link> : <span className="noimg" />}
              <div>
                <span className="day">{formatDate(p.date)}</span>
                <h2><Link to={`/news/${p.id}`}>{p.title}</Link></h2>
                <p>{plain(p.body, 220)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export function NewsPost() {
  const { id } = useParams();
  const { data, error } = useData(() => api.post(id), [id]);
  useTitle(data?.title);
  if (!data) return <Loading error={error} />;
  const place = /когалым/i.test(data.title) ? 'Когалым' : 'Муравленко';
  return (
    <main>
      <div className="wrap">
        <PageHead crumbs={<><Link to="/">Главная</Link> / <Link to="/news">Новости</Link></>} title={data.title}>
          <p className="day post-date">{formatDate(data.date)}</p>
        </PageHead>
        <article className="post">
          {data.header_image ? <img className="post-cover" src={data.header_image.large} alt="" /> : null}
          <Html html={data.body} className="measure prose" />
        </article>
        <Sheet items={data.blog_gallery} place={place} />
        <p className="sec"><Link className="more" to="/news">Все новости</Link></p>
      </div>
    </main>
  );
}

export function Expedition() {
  const { id } = useParams();
  const { data, error } = useData(() => api.expedition(id), [id]);
  useTitle(data?.title);
  if (!data) return <Loading error={error} />;
  return (
    <main>
      <div className="wrap">
        <PageHead crumbs={<><Link to="/">Главная</Link> / <Link to="/materials#expeditions">Экспедиции</Link></>}
          title={data.title} deck={`${formatRange(data.date_start, data.date_end)}, ${data.location}`}
          image={data.header_image} />
        <article className="post">
          <Html html={data.description} className="measure prose" />
        </article>
        <Sheet items={data.expedition_gallery} place={data.location} />
      </div>
    </main>
  );
}
