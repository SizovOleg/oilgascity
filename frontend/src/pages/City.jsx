import { Navigate, useParams } from 'react-router-dom';
import { LLink as Link, T, currentLang, localePath } from '../lib/i18n';
import { api, useData } from '../lib/api';
import { useHashScroll, useTitle } from '../lib/hooks';
import { splitFigure } from '../lib/format';
import { Counter, buildToc, numberBlocks, splitSections } from '../lib/numbering';
import { Figure, GeoBand, Html, Loading, PhotoMeta, Toc, UntranslatedNote } from '../components/Common';
import { ZoomLink } from '../components/Lightbox';
import { galleryItems } from '../lib/lightbox';
import { BlockList, Section } from '../blocks/Blocks';

const OTHER = { muravlenko: 'kogalym', kogalym: 'muravlenko' };

function FactsRow({ city }) {
  // строка паспорта по названию: на английской странице название переведено (EN в lib/strings-en.js)
  const row = (label) => city.passport?.find((r) => r.value.label === label || r.value.label === T(label))?.value.value;
  const founded = splitFigure(city.founded);
  const people = splitFigure(city.population);
  const facts = [];
  if (founded.value) facts.push([founded.value, `${T('год основания')}${founded.rest ? `, ${founded.rest.replace(/[()]/g, '')}` : ''}`]);
  if (people.value) facts.push([people.value, `${T('жителей')} ${people.rest.replace(/^(чел\.?|people|residents|inhabitants)\s*/i, '')}`.trim()]);
  const interviews = row('Интервью');
  if (interviews) {
    const s = splitFigure(interviews);
    facts.push([s.value, `${T('интервью с жителями')}${s.rest ? ` ${s.rest.replace(/^,\s*/, ', ')}` : ''}`]);
  } else if (row('Полевые работы проекта')) facts.push([row('Полевые работы проекта'), T('полевые работы проекта')]);
  if (row('Снимков в архиве')) facts.push([row('Снимков в архиве'), T('полевых снимков в архиве')]);
  return <ul className="facts-row">{facts.map(([v, l], i) => <li key={i}><b>{v}</b>{l}</li>)}</ul>;
}

function Gallery({ city }) {
  const items = city.city_gallery || [];
  if (!items.length) return null;
  return (
    <section className="sec" id="gallery">
      <h2>{T('Город в снимках')}</h2>
      <p className="measure">{T('Открытые пространства города. Все снимки проекта собраны в разделе')} <Link to="/materials#photos">{T('«Фототека»')}</Link>.</p>
      <div className="sheet">
        {items.map((it, i) => (
          <figure key={it.id}>
            <ZoomLink items={galleryItems(items, city.title)} index={i}><img src={it.image.large} alt={it.caption} loading="lazy" /></ZoomLink>
            <figcaption className="slate">{it.caption}<PhotoMeta place={city.title} date={it.shot_date} author={it.author} /></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function OtherCity({ city }) {
  if (!city) return null;
  return (
    <section className="sec">
      <div className="pair">
        <Link className="door" to={`/cities/${city.meta.slug}`}>
          {city.header_image ? <img src={city.header_image.large} alt="" loading="lazy" style={{ height: '15rem' }} /> : null}
          {city.header_caption ? <span className="slate">{city.header_caption}</span> : null}
        </Link>
        <div className="plate fogged">
          <p className="small mute" style={{ marginBottom: '0.4rem' }}>{T('Второй модельный город')}</p>
          <h3 className="other-title"><Link to={`/cities/${city.meta.slug}`}>{city.title}</Link></h3>
          <p>{city.lead || city.region}</p>
          <Link className="more" to={`/cities/${city.meta.slug}`}>{T('Открыть страницу города')}</Link>
        </div>
      </div>
    </section>
  );
}

export default function City() {
  const { slug } = useParams();
  const { data, error } = useData(() => Promise.all([api.cities()]), [slug]);
  const cities = data?.[0];
  const city = cities?.find((c) => c.meta.slug === slug || String(c.id) === slug);
  useTitle(city?.title);
  useHashScroll(Boolean(city));
  if (!data) return <Loading error={error} />;
  if (!city) return <Loading error />;
  // старые ссылки вида /cities/11 ведут на адрес со слагом
  if (String(city.id) === slug) return <Navigate to={localePath(currentLang(), `/cities/${city.meta.slug}`)} replace />;

  const counter = new Counter();
  const mapFig = city.passport_map
    ? { image: city.passport_map, kind: 'map', caption: city.passport_map_caption, source: city.passport_map_source, _fig: counter.nextFig() }
    : null;
  const passportTable = counter.nextTable();
  const blocks = numberBlocks(city.sections, counter);
  const parts = splitSections(blocks);
  const intro = parts[0] && !parts[0].section ? parts.shift().blocks : [];
  const hasSources = parts.some((p) => p.section?.anchor === 'sources');
  const toc = [
    city.passport?.length ? { anchor: 'passport', title: T('Паспорт города') } : null,
    city.description ? { anchor: 'history', title: city.history_title || T('О городе') } : null,
    ...buildToc(blocks).filter((t) => t.anchor !== 'sources' && t.anchor !== 'cite'),
    city.city_gallery?.length ? { anchor: 'gallery', title: T('Город в снимках') } : null,
    ...buildToc(blocks).filter((t) => t.anchor === 'sources' || t.anchor === 'cite'),
  ].filter(Boolean);
  const other = cities.find((c) => c.meta.slug === OTHER[city.meta.slug]);

  return (
    <main>
      <section className={`cover city-cover city-${city.meta.slug}`}>
        {city.header_image ? <img src={city.header_image.large} alt={city.header_caption || ''} /> : null}
        <div className="wrap cover-wrap">
          <div className="cover-plate">
            <p className="crumbs"><Link to="/">{T('Главная')}</Link> / {T('Модельные города')}</p>
            <UntranslatedNote show={city._untranslated} />
            <h1 lang={city._untranslated ? 'ru' : undefined}>{city.title}</h1>
            {city.lead ? <p className="deck">{city.lead}</p> : null}
          </div>
          {city.header_caption ? <p className="slate cover-slate">{city.header_caption}<PhotoMeta text={city.header_meta} /></p> : null}
          <FactsRow city={city} />
        </div>
      </section>

      <div className="wrap">
        <div className="doc">
          <Toc items={toc} />
          <div>
            {city.passport?.length ? (
              <section className="sec" id="passport">
                <h2>{T('Паспорт города')}</h2>
                <div className={mapFig ? 'figs2 passport' : 'passport'}>
                  <table className="ref">
                    <caption><b>{T('Табл.')} {passportTable}.</b> {T('Справочные сведения:')} {city.title}</caption>
                    <tbody>
                      {city.passport.map((r) => (
                        <tr key={r.id}><th>{r.value.label}</th><td>{r.value.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {mapFig ? <Figure fig={mapFig} /> : null}
                </div>
                {city.passport_source ? <p className="src">{city.passport_source}</p> : null}
              </section>
            ) : null}

            {city.description ? (
              <section className="sec" id="history">
                <h2>{city.history_title || T('О городе')}</h2>
                <Html html={city.description} className="measure prose" />
                <BlockList blocks={intro} />
              </section>
            ) : null}

            {parts.map((p, i) => (
              <div key={p.section?.anchor || i}>
                {p.section?.anchor === 'sources' ? <Gallery city={city} /> : null}
                <Section section={p.section}><BlockList blocks={p.blocks} /></Section>
              </div>
            ))}
            {hasSources ? null : <Gallery city={city} />}
            <OtherCity city={other} />
          </div>
        </div>
      </div>

      <GeoBand title={`${city.title} ${T('на геопортале')}`} to={`/geoportal?city=${city.meta.slug}`}
        image={`/img/geoportal-${city.meta.slug}.jpg`}
        text={T('Карты из статей проекта в интерактивном виде: типы поверхности, NDVI, зелёные пространства, пешеходная доступность.')} />
    </main>
  );
}
