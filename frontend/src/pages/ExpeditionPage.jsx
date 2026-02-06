import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Calendar } from 'lucide-react';
import { getPage } from '../api/client';
import Gallery from '../components/Gallery';
import AnimatedSection from '../components/AnimatedSection';

export default function ExpeditionPage() {
  const { id } = useParams();
  const [page, setPage] = useState(null);

  useEffect(() => { getPage(id).then(res => setPage(res.data)); }, [id]);

  if (!page) return <div className="text-center py-20 text-gray-400">Загрузка...</div>;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{page.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{page.date_start}{page.date_end ? ' — ' + page.date_end : ''}</span>
            {page.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{page.location}</span>}
          </div>
        </AnimatedSection>
        <AnimatedSection delay={0.2}>
          <div className="prose-light text-justify" dangerouslySetInnerHTML={{ __html: page.description }} />
        </AnimatedSection>
        <AnimatedSection delay={0.3}>
          <Gallery items={page.expedition_gallery} />
        </AnimatedSection>
      </div>
    </div>
  );
}
