import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPage } from '../api/client';
import Gallery from '../components/Gallery';
import AnimatedSection from '../components/AnimatedSection';

export default function CityPage() {
  const { id } = useParams();
  const [page, setPage] = useState(null);

  useEffect(() => { getPage(id).then(res => setPage(res.data)); }, [id]);

  if (!page) return <div className="text-center py-20 text-gray-400">Загрузка...</div>;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{page.title}</h1>
          <div className="flex gap-6 text-gray-500 text-sm mb-8">
            {page.founded && <span>Основан: {page.founded}</span>}
            {page.population && <span>Население: {page.population}</span>}
            {page.region && <span>{page.region}</span>}
          </div>
        </AnimatedSection>
        {page.header_image && (
          <AnimatedSection delay={0.1}>
            <img src={page.header_image.large} alt="" className="w-full rounded-xl mb-8" />
          </AnimatedSection>
        )}
        <AnimatedSection delay={0.2}>
          <div className="prose-light text-justify" dangerouslySetInnerHTML={{ __html: page.description }} />
        </AnimatedSection>
        <AnimatedSection delay={0.3}>
          <Gallery items={page.city_gallery} />
        </AnimatedSection>
      </div>
    </div>
  );
}
