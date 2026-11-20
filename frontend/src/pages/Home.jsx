import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, useData } from '../lib/api';
import { useHashScroll, useTitle } from '../lib/hooks';
import { photoGroups, splitFigure } from '../lib/format';
import { GeoBand, Html, Loading, PhotoMeta, Stats } from '../components/Common';
import { NewsLog } from '../blocks/Embeds';

const passportValue = (city, label) => city.passport?.find((r) => r.value.label === label)?.value.value;

// Номер гранта не переносится по дефисам
function NoBreakGrant({ text }) {
  const parts = text.split(/(№\s?\d{2}-\d{2}-\d{5})/);
  return parts.map((p, i) => (i % 2 ? <span key={i} className="nw">{p}</span> : p));
}

function Cover({ home }) {
  return (
    <section className="cover">
      {home.header_image ? (
        <img className="hero-img" src={home.header_image.large}
          srcSet={`${home.header_image.large} 1200w, ${home.header_image.original} 2400w`} sizes="100vw"
          alt={home.header_caption || ''} />
      ) : null}
      <div className="wrap cover-wrap">
        <div className="cover-plate">
          <h1>{home.hero_title || home.title}</h1>
          {home.lead ? <p className="deck"><NoBreakGrant text={home.lead} /></p> : null}
        </div>
        {home.header_caption ? (
          <p className="slate cover-slate">{home.header_caption}<PhotoMeta text={home.header_meta} /></p>
        ) : null}
      </div>
    </section>
  );
}

// Абзацы и пункты из HTML редактора CMS: текст без тегов и без подписи вида «Новизна:»
function htmlParts(html, selector) {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll(selector)].map((el) => el.textContent.trim()).filter(Boolean);
}
const stripLabel = (t) => t.replace(/^[^:]{2,40}:\s*/, '');
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1).replace(/[;.]\s*$/, '.');

// Короткое название задачи для заголовка раскрываемого блока: без скобок, до двоеточия,
// а у длинных формулировок до первой запятой
function shortTask(text) {
  let t = text.replace(/\s*\([^)]*\)/g, '').replace(/[;.]\s*$/, '');
  t = t.split(':')[0];
  if (t.length > 90) {
    const comma = t.indexOf(', ', 30);
    if (comma > 0) t = t.slice(0, comma);
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const GOAL_KICKERS = ['Цель проекта', 'Почему это важно', 'Научная новизна'];

function About({ home }) {
  const goal = useMemo(() => htmlParts(home.goal, 'p'), [home.goal]);
  const tasks = useMemo(() => htmlParts(home.expected_results, 'li'), [home.expected_results]);
  const keywords = (home.keywords_ru || '').split(',').map((k) => k.trim()).filter(Boolean);
  return (
    <section className="part" id="about">
      <div className="wrap">
        <div className="part-head"><h2>Цель и задачи</h2></div>
        <div className="goal-grid">
          {goal.map((text, i) => (
            <article key={i} className={`goal-card${i === 0 ? ' main' : ''}`}>
              <span className="kicker">{GOAL_KICKERS[i] || ''}</span>
              <p>{i === 0 || i === 2 ? capital(stripLabel(text)) : text}</p>
            </article>
          ))}
        </div>
        {tasks.length ? (
          <div className="tasks">
            <h3 className="sub">Задачи: что даст проект</h3>
            <ol className="task-list">
              {tasks.map((t, i) => (
                <li key={i} className="step">
                  <details>
                    <summary>
                      <span className="step-n">{String(i + 1).padStart(2, '0')}</span>
                      <span className="task-title">{shortTask(t)}</span>
                    </summary>
                    <p>{capital(t)}</p>
                  </details>
                </li>
              ))}
            </ol>
            {home.expected_source ? <p className="src">{home.expected_source}</p> : null}
          </div>
        ) : null}
        <div className="kw-row">
          {keywords.length ? (
            <ul className="kw-chips" aria-label="Ключевые слова">
              {keywords.map((k, i) => <li key={k} style={{ '--i': i }}>{k}</li>)}
            </ul>
          ) : null}
          {home.abstract_en ? (
            <details className="en" lang="en">
              <summary>Abstract and keywords in English</summary>
              <Html html={home.abstract_en} />
              {home.keywords_en ? <p className="kw-en"><b>Keywords:</b> {home.keywords_en}</p> : null}
            </details>
          ) : null}
          <p className="small about-links">
            <Link className="more" to="/materials#team">Авторский коллектив</Link>, <Link className="more" to="/materials#expeditions">экспедиции</Link>, <Link className="more" to="/results/2025#methods">методы и данные</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Years({ home, reports }) {
  const years = reports.filter((r) => r.kind === 'results').sort((a, b) => a.year - b.year);
  if (!years.length) return null;
  const withResults = years.filter((r) => (r.body || []).some((b) => b.type === 'result')).length;
  return (
    <section className="part fog" id="years">
      <div className="wrap">
        <div className="part-head">
          <h2>Результаты по годам</h2>
          {home.years_intro ? <p>{home.years_intro}</p> : null}
        </div>
        <div className={`years${withResults > 1 ? ' two' : ''}`}>
          {years.map((r) => {
            const results = (r.body || []).filter((b) => b.type === 'result').map((b) => b.value);
            if (!results.length) {
              return (
                <div className="year dark" key={r.id}>
                  <div className="year-head"><h3>{r.year}</h3><span>{r.city_label}</span></div>
                  {r.status_label ? <p><span className="chip">{r.status_label}</span></p> : null}
                  {r.summary ? <p>{r.summary}</p> : null}
                  <Link className="more" to={`/results/${r.year}`}>Подробнее о {r.year} годе</Link>
                </div>
              );
            }
            const allDone = results.every((x) => x.status === 'done');
            return (
              <div className="year" key={r.id}>
                <div className="year-head">
                  <h3>{r.year}</h3><span>{r.city_label}</span>
                  {r.status_label ? <span className={`chip ${allDone ? 'done' : 'wait'}`}>{r.status_label}</span> : null}
                </div>
                <ol className="ten">
                  {results.map((x) => (
                    <li key={x.number} className={x.status === 'progress' ? 'pending' : ''}>
                      <Link to={`/results/${r.year}#r${x.number}`}>{x.short_title}</Link><b>{x.headline}</b>
                    </li>
                  ))}
                </ol>
                <p className="src" style={{ margin: '0.9rem 0 1rem' }}>Источник: отчёт о выполнении проекта в {r.year} году. Пояснения к цифрам на странице результатов.</p>
                <Link className="more" to={`/results/${r.year}`}>Все результаты {r.year} года: заявлено и сделано</Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CityDoor({ city }) {
  const founded = splitFigure(city.founded).value;
  const people = splitFigure(city.population).value;
  const photos = passportValue(city, 'Снимков в архиве');
  const work = passportValue(city, 'Полевые работы проекта');
  return (
    <Link className="door" to={`/cities/${city.meta.slug}`}>
      {city.header_image ? <img src={city.header_image.large} alt="" loading="lazy" /> : null}
      {city.header_caption ? <span className="slate">{city.header_caption}</span> : null}
      <div className="door-plate">
        <h3>{city.title}</h3>
        <p className="where">{city.region}</p>
        <ul className="door-facts">
          {founded ? <li><b>{founded}</b>год основания</li> : null}
          {people ? <li><b>{people}</b>жителей</li> : null}
          {photos ? <li><b>{photos}</b>снимков{work ? `, ${work.replace(/^[\d-]+\s/, '')}` : ''}</li> : null}
        </ul>
        <span className="door-go">Открыть страницу города</span>
      </div>
    </Link>
  );
}

function Shelves({ materials, pubs, expeditions, team }) {
  const body = materials?.body || [];
  const find = (type) => body.filter((b) => b.type === type).map((b) => b.value);
  const photoTotal = photoGroups(find('photo_library').flatMap((v) => v.counts)).reduce((s, g) => s + g.total, 0);
  const maps = find('figure').filter((f) => f.kind === 'map').length + find('atlas').reduce((s, a) => s + a.figures.length, 0);
  const talks = find('talks')[0]?.items.length || 0;
  const archives = find('archives')[0]?.items.length || 0;
  const terms = find('glossary')[0]?.items.length || 0;
  const pubCount = (pubs?.publications || []).filter((p) => p.group !== 'related').length;
  const libImg = materials?.header_image;
  const shelf = (anchor, count, title, text) => (
    <Link className="shelf" to={`/materials#${anchor}`} key={anchor}><b>{count}</b><strong>{title}</strong><span>{text}</span></Link>
  );
  return (
    <section className="part fog" id="shelves">
      <div className="wrap">
        <div className="part-head">
          <h2>Материалы проекта</h2>
          <p>Вся накопленная фактура: снимки, карты, публикации, доклады и архивные источники.</p>
        </div>
        <div className="shelves">
          <Link className="shelf photo" to="/materials#photos">
            {libImg ? <img src={libImg.large} alt="" loading="lazy" /> : null}
            <b>{photoTotal.toLocaleString('ru-RU')}</b><strong>Фототека</strong>
            <span>Полевые снимки двух экспедиций с подписями: парки и скверы, площадки, геоботаника, пески, свалки</span>
          </Link>
          {shelf('maps', maps, 'Карты и схемы', 'Рисунки из статьи о Муравленко и слои геопортала')}
          {shelf('publications', pubCount, 'Публикации', 'Статьи по результатам проекта')}
          {shelf('talks', talks, 'Доклады', 'Выступления на конференциях')}
          {shelf('archives', archives, 'Архивы и источники', 'Генеральные планы, проектная документация, документы о благоустройстве')}
          {shelf('expeditions', expeditions.length, 'Экспедиции', 'Муравленко, 2025. Когалым, 2026')}
          {shelf('glossary', terms, 'Глоссарий', 'Термины проекта')}
          {shelf('team', team?.members?.length || 0, 'Авторский коллектив', 'Институт криосферы Земли ТюмНЦ СО РАН')}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useTitle('');
  const { data, error } = useData(() => Promise.all([
    api.home(), api.reports(), api.cities(), api.news(), api.publications(), api.expeditions(), api.team(),
  ]));
  useHashScroll(Boolean(data));
  if (!data) return <Loading error={error} />;
  const [home, reports, cities, news, pubs, expeditions, team] = data;
  const ordered = ['muravlenko', 'kogalym'].map((s) => cities.find((c) => c.meta.slug === s)).filter(Boolean);
  const materials = reports.find((r) => r.kind === 'materials');
  const stats = (home.stats || []).map((s) => s.value);
  return (
    <main>
      <Cover home={home} />
      {stats.length ? <section className="wrap" aria-label="Проект в цифрах"><Stats items={stats} /></section> : null}
      <About home={home} />
      <Years home={home} reports={reports} />
      <section className="part" id="cities">
        <div className="wrap">
          <div className="part-head"><h2>Два модельных города</h2></div>
          <div className="doors">{ordered.map((c) => <CityDoor key={c.id} city={c} />)}</div>
        </div>
      </section>
      <Shelves materials={materials} pubs={pubs} expeditions={expeditions} team={team} />
      <section className="part" id="news">
        <div className="wrap">
          <div className="part-head"><h2>Новости</h2></div>
          <NewsLog posts={news} />
        </div>
      </section>
      <GeoBand />
    </main>
  );
}
