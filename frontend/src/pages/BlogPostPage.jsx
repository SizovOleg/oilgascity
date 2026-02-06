import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { getPage } from '../api/client';
import Gallery from '../components/Gallery';
import AnimatedSection from '../components/AnimatedSection';

export default function BlogPostPage() {
  const { id } = useParams();
  const [page, setPage] = useState(null);

  useEffect(() => { getPage(id).then(res => setPage(res.data)); }, [id]);

  if (!page) return <div className="text-center py-20 text-gray-400">Загрузка...</div>;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <p className="text-gray-400 text-sm mb-2 flex items-center gap-1"><Calendar className="w-4 h-4" />{page.date}</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-8">{page.title}</h1>
        </AnimatedSection>
        {page.header_image && (
          <AnimatedSection delay={0.1}>
            <img src={page.header_image.large} alt="" className="w-full rounded-xl mb-8" />
          </AnimatedSection>
        )}
        <AnimatedSection delay={0.2}>
          <div className="prose-light text-justify" dangerouslySetInnerHTML={{ __html: page.body }} />
        </AnimatedSection>
        <AnimatedSection delay={0.3}>
          <Gallery items={page.blog_gallery} />
        </AnimatedSection>
      </div>
    </div>
  );
}
