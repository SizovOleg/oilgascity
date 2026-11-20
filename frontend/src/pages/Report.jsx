// Страницы из блоков: «Результаты» по годам и «Материалы проекта»
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, useData } from '../lib/api';
import { useHashScroll, useTitle } from '../lib/hooks';
import { buildToc, numberBlocks, splitSections } from '../lib/numbering';
import { Loading, PageHead, Toc } from '../components/Common';
import { BlockList, Section } from '../blocks/Blocks';

function ReportBody({ page, crumbs, extraHead }) {
  const blocks = numberBlocks(page.body);
  const parts = splitSections(blocks);
  return (
    <main>
      <div className="wrap">
        <PageHead crumbs={crumbs} title={page.title} deck={page.intro} image={page.header_image}
          caption={page.header_caption} meta={page.header_meta}>{extraHead}</PageHead>
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

export function Results() {
  const { year } = useParams();
  const { data, error } = useData(() => api.reports());
  const years = (data || []).filter((r) => r.kind === 'results').sort((a, b) => a.year - b.year);
  const page = year ? years.find((r) => String(r.year) === year) : null;
  useTitle(page?.title || 'Результаты');
  useHashScroll(Boolean(page));
  if (!data) return <Loading error={error} />;
  if (!year) {
    // «Результаты» без года: последний год, по которому уже есть результаты
    const latest = [...years].reverse().find(hasResults) || years[years.length - 1];
    return latest ? <Navigate to={`/results/${latest.year}`} replace /> : <Loading error />;
  }
  if (!page) return <Loading error />;
  const tabs = years.length > 1 ? (
    <p className="year-tabs">
      {years.map((r) => (String(r.year) === year
        ? <b key={r.id}>{r.year}: {r.city_label}</b>
        : <Link key={r.id} to={`/results/${r.year}`}>{r.year}: {r.city_label}</Link>))}
    </p>
  ) : null;
  return <ReportBody page={page} extraHead={tabs} crumbs={<><Link to="/">Главная</Link> / Результаты</>} />;
}

export function Materials() {
  const { data, error } = useData(() => api.reports());
  const page = (data || []).find((r) => r.kind === 'materials');
  useTitle(page?.title || 'Материалы проекта');
  useHashScroll(Boolean(page));
  if (!data) return <Loading error={error} />;
  if (!page) return <Loading error />;
  return <ReportBody page={page} crumbs={<><Link to="/">Главная</Link> / Материалы</>} />;
}
