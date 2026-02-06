import { useState } from 'react';
import { Images } from 'lucide-react';
import Lightbox from './Lightbox';

export default function Gallery({ items }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  if (!items || items.length === 0) return null;

  const images = items.map(item => ({
    src: item.image.large || item.image.original,
    caption: item.caption,
  }));

  return (
    <div className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <Images className="w-5 h-5 text-sky-600" />
        <h2 className="text-2xl font-bold text-gray-900">Фотогалерея</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item, i) => (
          <div key={item.id || i} className="cursor-pointer group rounded-xl overflow-hidden" onClick={() => setLightboxIndex(i)}>
            <img src={item.image.thumbnail || item.image.large} alt={item.caption}
              className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500" />
            {item.caption && <p className="text-xs text-gray-500 mt-1 px-1 truncate">{item.caption}</p>}
          </div>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
