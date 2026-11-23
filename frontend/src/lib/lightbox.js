// Открыть просмотр фото поверх страницы: окно рисует LightboxHost (components/Lightbox.jsx) из Layout.
// items: [{ src, preview, caption, width, height }]
export const LIGHTBOX_EVENT = 'ogc-lightbox';

export function openLightbox(items, index = 0) {
  window.dispatchEvent(new CustomEvent(LIGHTBOX_EVENT, { detail: { items, index } }));
}

// Снимки галереи для просмотра: подпись, место и дата съёмки в одной строке под кадром
export function galleryItems(list, place) {
  return list.map((it) => ({
    src: it.image.original,
    preview: it.image.large || it.image.thumbnail,
    width: it.image.width,
    height: it.image.height,
    caption: [it.caption, [it.place || place, it.shot_date].filter(Boolean).join(', ')].filter(Boolean).join('. '),
  }));
}
