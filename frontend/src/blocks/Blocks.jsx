// Рендер блоков StreamField (backend/home/blocks.py). Каждому типу блока свой компонент.
import { Figure, Html, InlineHtml, Cite, Stats, Source } from '../components/Common';
import { BarChart, PairChart } from '../components/Charts';
import { Embed, PhotoLibrary } from './Embeds';

const STATUS = { done: ['выполнено', 'done'], partial: ['выполнено частично', 'wait'], progress: ['в работе', 'wait'] };

function Result({ value: v }) {
  const [label, cls] = STATUS[v.status] || STATUS.done;
  return (
    <article className="res" id={`r${v.number}`}>
      <div className="num">{v.number}</div>
      <div className="ask">
        <h3>{v.title}</h3>
        <b>Заявлено</b><InlineHtml html={v.planned} />
      </div>
      <div className="got">
        <b className="lab">Сделано <span className={`chip ${cls}`}>{label}</span></b>
        {v.key_figures?.length ? (
          <div className="keyfig">{v.key_figures.map((k, i) => <div key={i}><b>{k.value}</b>{k.label}</div>)}</div>
        ) : null}
        <ul>{(v.done || []).map((d, i) => <InlineHtml key={i} html={d} as="li" />)}</ul>
        {v.evidence ? <p className="proof"><b>Доказательства:</b> <InlineHtml html={v.evidence} /></p> : null}
        {(v.figures || []).map((f, i) => (
          <div key={i} className={f.kind === 'map' ? 'res-map' : ''}><Figure fig={f} compact={f.kind !== 'map'} /></div>
        ))}
      </div>
    </article>
  );
}

function MethodsTable({ value: v }) {
  return (
    <>
      <table className="ref wide">
        <caption><b>Табл. {v._table}.</b> {v.caption}</caption>
        <thead><tr><th>Метод</th><th>Данные и параметры</th><th>Что получено</th></tr></thead>
        <tbody>
          {v.rows.map((r, i) => (
            <tr key={i}><th>{r.method}</th><InlineHtml html={r.details} as="td" /><td>{r.output}</td></tr>
          ))}
        </tbody>
      </table>
      <Source text={v.source} />
    </>
  );
}

function Plate({ item }) {
  return (
    <div className={`plate ${item.tone || 'dark'}`}>
      {item.value ? <span className="found">{item.value}</span> : null}
      <h3>{item.title}</h3>
      <InlineHtml html={item.text} as="p" />
      {item.source ? <Source html={item.source} /> : null}
    </div>
  );
}

function Plates({ value }) {
  const items = value.items || [];
  if (items.length === 1) return <div className="plates-one"><Plate item={items[0]} /></div>;
  const pairs = items.length === 3 ? [items.slice(0, 2), items.slice(2)] : [items];
  return pairs.map((group, i) => (
    <div key={i} className={group.length > 1 ? 'pair plates-row' : 'plates-one'}>
      {group.map((it, j) => <Plate key={j} item={it} />)}
    </div>
  ));
}

function Finding({ value: v }) {
  return (
    <article className={`entry${v.flip ? ' flip' : ''}`}>
      <Figure fig={v.figure} compact />
      <div className="note">
        <span className="found">{v.value}</span>
        <h3>{v.title}</h3>
        <InlineHtml html={v.text} as="p" />
        {v.source ? <Source html={v.source} /> : null}
      </div>
    </article>
  );
}

function Talks({ value: v }) {
  return (
    <>
      <table className="ref wide talks">
        <caption><b>Табл. {v._table}.</b> Доклады по результатам проекта</caption>
        <thead><tr><th style={{ width: '2rem' }}>№</th><th>Авторы и тема</th><th>Конференция</th><th>Место и даты</th><th>Форма</th></tr></thead>
        <tbody>
          {v.items.map((t, i) => (
            <tr key={i}><th>{i + 1}</th><td>{t.authors} <b>{t.title}</b></td><td>{t.event}</td><td>{t.place}, {t.dates}</td><td>{t.form}</td></tr>
          ))}
        </tbody>
      </table>
      <details className="en bib-details">
        <summary>Те же доклады в виде библиографических записей</summary>
        <ol className="bib">
          {v.items.map((t, i) => <li key={i}>{t.authors} {t.title} : {t.form} // {t.event} ({t.place}, {t.dates}).</li>)}
        </ol>
      </details>
    </>
  );
}

function Archives({ value }) {
  return (
    <div className="cards">
      {value.items.map((a, i) => (
        <div className="card" key={i}><p className="where">{a.place}</p><h4>{a.name}</h4><InlineHtml html={a.text} as="p" /></div>
      ))}
    </div>
  );
}

function Glossary({ value }) {
  return (
    <dl className="gloss">
      {value.items.map((g, i) => <div key={i}><dt>{g.term}</dt><InlineHtml html={g.definition} as="dd" /></div>)}
    </dl>
  );
}

function LayerCards({ value }) {
  return (
    <div className="layers">
      {value.items.map((l, i) => <div className="card" key={i}><h4>{l.title}</h4><p>{l.text}</p></div>)}
    </div>
  );
}

function Status({ value }) {
  return (
    <div className="plate dark status">
      <p><span className="chip">{value.chip}</span></p>
      <InlineHtml html={value.text} as="p" className="measure" />
    </div>
  );
}

function Bibliography({ value }) {
  return <ol className="bib">{value.items.map((it, i) => <InlineHtml key={i} html={it} as="li" />)}</ol>;
}

const RENDER = {
  paragraph: ({ value }) => <Html html={value} className="measure prose" />,
  stats: ({ value }) => <Stats items={value.items} className="figures in-doc" />,
  result: Result,
  figure: ({ value }) => <Figure fig={value} />,
  atlas: ({ value }) => <div className="figs2">{value.figures.map((f, i) => <Figure key={i} fig={f} />)}</div>,
  bar_chart: BarChart,
  pair_chart: PairChart,
  methods_table: MethodsTable,
  plates: Plates,
  finding: Finding,
  bibliography: Bibliography,
  status: Status,
  talks: Talks,
  archives: Archives,
  glossary: Glossary,
  photo_library: ({ value }) => <PhotoLibrary value={value} />,
  layer_cards: LayerCards,
  embed: ({ value }) => <Embed kind={value.kind} />,
  cite: ({ value }) => <Cite text={value.text} note={value.note} />,
};

const CHART = new Set(['bar_chart', 'pair_chart']);

// Подряд идущие графики (и одна плашка сразу после них) собираются в сетку из двух колонок
function group(blocks) {
  const out = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    const joinsCharts = last?.type === '_charts'
      && (CHART.has(b.type) || (b.type === 'plates' && b.value.items?.length === 1));
    if (joinsCharts) last.items.push(b);
    else if (CHART.has(b.type)) out.push({ type: '_charts', id: b.id, items: [b] });
    else out.push(b);
  }
  return out;
}

export function BlockList({ blocks }) {
  return group(blocks || []).map((b, i) => {
    if (b.type === '_charts') {
      return (
        <div className="charts" key={b.id || i}>
          {b.items.map((c, j) => {
            if (c.type === 'plates') return <Plate key={j} item={c.value.items[0]} />;
            const C = RENDER[c.type];
            return <C key={c.id || j} value={c.value} />;
          })}
        </div>
      );
    }
    const C = RENDER[b.type];
    return C ? <C key={b.id || i} value={b.value} /> : null;
  });
}

// Раздел с заголовком и якорем
export function Section({ section, children }) {
  return (
    <section className="sec" id={section.anchor}>
      <h2>{section.title}</h2>
      {section.intro ? <InlineHtml html={section.intro} as="p" className="measure" /> : null}
      {children}
    </section>
  );
}
