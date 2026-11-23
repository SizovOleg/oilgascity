// Страницы из блоков: «Результаты» по годам и «Материалы проекта»
import { Navigate, useParams } from 'react-router-dom';
import { LLink as Link, T, currentLang, localePath } from '../lib/i18n';
import { api, useData } from '../lib/api';
import { useHashScroll, useTitle } from '../lib/hooks';
import { buildToc, numberBlocks, splitSections } from '../lib/numbering';
import { Loading, PageHead, Toc } from '../components/Common';
import { BlockList, Section } from '../blocks/Blocks';

function ReportBody({ page, crumbs, tabs }) {
  const blocks = numberBlocks(page.body);
  const parts = splitSections(blocks);
  return (
    <main>
      <div className="wrap">
        <PageHead crumbs={crumbs} title={page.title} deck={page.intro} image={page.header_image}
          caption={page.header_caption} meta={page.header_meta} />
        {tabs}
        <div className="doc">
          <Toc items={buildToc(blocks)} />
          <div>
            {parts.map((p, i) => (p.section
              ? <Section key={p.section.anchor || i} section={p.section}><BlockList blocks={p.blocks} /></Section>
              : <div key={i} className="sec"><BlockList blocks={p.blocks} /></div>))}
          </div>
        </div>
      </div>
    </main>
  );
}

const hasResults = (r) => (r.body || []).some((b) => b.type === 'result');
const SUMMARY = 'summary';

// Вкладки результатов: города по годам и «Общие выводы» (страница результатов без года, адрес /results/summary)
function ResultTabs({ pages, current }) {
  return (
    <nav className="result-tabs" aria-label={T('Результаты проекта')}>
      {pages.map((r) => {
        const label = r.year ? <>{r.city_label}<small>{r.year}</small></> : (r.city_label || T('Общие выводы'));
        return r === current
          ? <b key={r.id} aria-current="page">{label}</b>
          : <Link key={r.id} to={`/results/${r.year || SUMMARY}`}>{label}</Link>;
      })}
    </nav>
  );
}

export function Results() {
  const { year } = useParams();
  const { data, error } = useData(() => api.reports());
  const all = (data || []).filter((r) => r.kind === 'results');
  const years = all.filter((r) => r.year).sort((a, b) => a.year - b.year);
  const summary = all.find((r) => !r.year);
  const page = year === SUMMARY ? summary : year ? years.find((r) => String(r.year) === year) : null;
  useTitle(page?.title || T('Результаты'));
  useHashScroll(Boolean(page));
  if (!data) return <Loading error={error} />;
  if (!year) {
    // «Результаты» без года: последний год, по которому уже есть результаты
    const latest = [...years].reverse().find(hasResults) || years[years.length - 1];
    return latest ? <Navigate to={localePath(currentLang(), `/results/${latest.year}`)} replace /> : <Loading error />;
  }
  if (!page) return <Loading error />;
  const pages = [...years, ...(summary ? [summary] : [])];
  const tabs = pages.length > 1 ? <ResultTabs pages={pages} current={page} /> : null;
  return <ReportBody page={page} tabs={tabs} crumbs={<><Link to="/">{T('Главная')}</Link> / {T('Результаты')}</>} />;
}

export function Materials() {
  const { data, error } = useData(() => api.reports());
  const page = (data || []).find((r) => r.kind === 'materials');
  useTitle(page?.title || T('Материалы проекта'));
  useHashScroll(Boolean(page));
  if (!data) return <Loading error={error} />;
  if (!page) return <Loading error />;
  return <ReportBody page={page} crumbs={<><Link to="/">{T('Главная')}</Link> / {T('Материалы')}</>} />;
}
