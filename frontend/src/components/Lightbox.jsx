import { useState, useEffect } from 'react';

export default function Lightbox({ images, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  const img = images[index];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl hover:text-sky-400 z-10">&times;</button>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIndex(i => (i - 1 + images.length) % images.length); }}
            className="absolute left-4 text-white text-5xl hover:text-sky-400 z-10">&lsaquo;</button>
          <button onClick={(e) => { e.stopPropagation(); setIndex(i => (i + 1) % images.length); }}
            className="absolute right-4 text-white text-5xl hover:text-sky-400 z-10">&rsaquo;</button>
        </>
      )}
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={img.src} alt={img.caption || ''} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        {img.caption && <p className="text-white text-center mt-3">{img.caption}</p>}
        {images.length > 1 && <p className="text-gray-400 text-sm mt-1">{index + 1} / {images.length}</p>}
      </div>
    </div>
  );
}
