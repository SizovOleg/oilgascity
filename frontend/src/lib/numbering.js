// Сквозная нумерация рисунков и таблиц страницы и оглавление по разделам.
// Номера считаются одним проходом по блокам до рендера, поэтому «Рис. N» совпадает с якорем #fig-N.

const FIGURE_BLOCKS = new Set(['figure', 'bar_chart', 'pair_chart']);
const TABLE_BLOCKS = new Set(['methods_table', 'talks']);

export class Counter {
  constructor(fig = 0, table = 0) {
    this.fig = fig;
    this.table = table;
  }

  nextFig() {
    this.fig += 1;
    return this.fig;
  }

  nextTable() {
    this.table += 1;
    return this.table;
  }
}

// Возвращает копию блоков с полями _fig (номер рисунка) и _table (номер таблицы)
export function numberBlocks(blocks, counter = new Counter()) {
  return (blocks || []).map((b) => {
    const value = structuredClone(b.value);
    if (FIGURE_BLOCKS.has(b.type)) value._fig = counter.nextFig();
    if (TABLE_BLOCKS.has(b.type)) value._table = counter.nextTable();
    if (b.type === 'result') value.figures = (value.figures || []).map((f) => ({ ...f, _fig: counter.nextFig() }));
    if (b.type === 'atlas') value.figures = (value.figures || []).map((f) => ({ ...f, _fig: counter.nextFig() }));
    if (b.type === 'finding') value.figure = { ...value.figure, _fig: counter.nextFig() };
    return { ...b, value };
  });
}

// Оглавление: разделы и вложенные в них результаты
export function buildToc(blocks) {
  const toc = [];
  for (const b of blocks || []) {
    if (b.type === 'section') {
      toc.push({ anchor: b.value.anchor, title: b.value.toc_title || b.value.title, children: [] });
    } else if (b.type === 'result' && toc.length) {
      toc[toc.length - 1].children.push({
        anchor: `r${b.value.number}`,
        title: `${b.value.number}. ${b.value.short_title}`,
      });
    }
  }
  return toc;
}

// Разбивка на разделы: [{ section, blocks }], блоки до первого раздела идут с section = null
export function splitSections(blocks) {
  const parts = [{ section: null, blocks: [] }];
  for (const b of blocks || []) {
    if (b.type === 'section') parts.push({ section: b.value, blocks: [] });
    else parts[parts.length - 1].blocks.push(b);
  }
  return parts.filter((p) => p.section || p.blocks.length);
}
