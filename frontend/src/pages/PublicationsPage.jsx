import { useState, useEffect } from 'react';
import { BookOpen, FileText, ExternalLink } from 'lucide-react';
import { getPageByType } from '../api/client';
import AnimatedSection, { StaggerContainer, StaggerItem } from '../components/AnimatedSection';

export default function PublicationsPage() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    getPageByType('home.PublicationsPage').then(res => {
      if (res.data.items.length > 0) setPage(res.data.items[0]);
    });
  }, []);

  if (!page) return <div className="text-center py-20 text-gray-400">Загрузка...</div>;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Публикации</h1>
          </div>
        </AnimatedSection>
        {page.publications && page.publications.length > 0 ? (
          <StaggerContainer staggerDelay={0.1} className="space-y-4">
            {page.publications.map(pub => (
              <StaggerItem key={pub.id}>
                <div className="glass-card p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-sky-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-gray-900 font-semibold leading-snug">{pub.title}</h3>
                      <p className="text-gray-500 text-sm mt-1">{pub.authors}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                        {pub.journal && <span>{pub.journal}</span>}
                        <span>{pub.year}</span>
                      </div>
                      {pub.abstract && <div className="mt-3 text-gray-500 text-sm leading-relaxed prose-light" dangerouslySetInnerHTML={{ __html: pub.abstract }} />}
                      {pub.doi && (
                        <a href={pub.doi} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-sm text-sky-600 hover:text-sky-700 transition-colors">
                          Ссылка на публикацию <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Публикации будут добавлены позже</p>
          </div>
        )}
      </div>
    </div>
  );
}
