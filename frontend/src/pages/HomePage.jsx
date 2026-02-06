import { useState, useEffect } from 'react';
import { MapPin, Building2, Calendar, Compass, ChevronDown, ChevronUp } from 'lucide-react';
import { getPageByType } from '../api/client';
import AnimatedSection, { StaggerContainer, StaggerItem } from '../components/AnimatedSection';

const STATS = [
  { icon: MapPin, label: 'Города', value: 'Муравленко, Когалым' },
  { icon: Building2, label: 'Организация', value: 'ИКЗ ТюмНЦ СО РАН' },
  { icon: Calendar, label: 'Период', value: '2025–2027' },
  { icon: Compass, label: 'Направления', value: 'Социально-экологическое' },
];

const TOPICS = [
  { title: 'Устойчивость малых нефтегазовых городов', text: 'Анализ социально-экономической устойчивости малых городов, зависящих от нефтегазовой отрасли, в условиях энергетического перехода и изменения климата.' },
  { title: 'Климатические изменения в субарктике', text: 'Оценка влияния изменения климата на инфраструктуру и условия жизни в субарктической зоне Западной Сибири, включая деградацию вечной мерзлоты.' },
  { title: 'Социально-экологические аспекты', text: 'Исследование взаимосвязи между экологическими изменениями и социальными процессами в нефтегазовых городах — миграция, занятость, качество городской среды.' },
];

export default function HomePage() {
  const [page, setPage] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);

  useEffect(() => {
    getPageByType('home.HomePage').then(res => {
      if (res.data.items.length > 0) setPage(res.data.items[0]);
    });
  }, []);

  if (!page) return <div className="text-center py-20 text-gray-400">Загрузка...</div>;

  return (
    <div className="min-h-screen">
      <section className="relative pt-16 pb-20 overflow-hidden bg-gradient-to-b from-sky-50 to-gray-50">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="aurora-blob absolute top-20 left-1/4 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
          <div className="aurora-blob-delay absolute top-40 right-1/4 w-80 h-80 bg-cyan-200/30 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24">
          <AnimatedSection delay={0.1}>
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 text-sm font-medium">
                РНФ № 25-27-00022
              </span>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.2}>
            <h1 className="text-center text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight max-w-4xl mx-auto">
              <span className="text-gray-900">
                {page.subtitle || page.title}
              </span>
            </h1>
          </AnimatedSection>
          <AnimatedSection delay={0.35}>
            <p className="text-center text-gray-500 text-lg mt-5 max-w-2xl mx-auto">
              Центры нефтегазового освоения в меняющихся климатических условиях субарктической зоны Западной Сибири
            </p>
          </AnimatedSection>
          <StaggerContainer staggerDelay={0.1} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 max-w-4xl mx-auto">
            {STATS.map((s, i) => (
              <StaggerItem key={i}>
                <div className="glass-card p-4 text-center hover:border-sky-300 hover:shadow-md transition-all duration-300">
                  <s.icon className="w-5 h-5 text-sky-600 mx-auto mb-2" />
                  <div className="text-gray-900 font-semibold text-sm">{s.value}</div>
                  <div className="text-gray-400 text-xs mt-1">{s.label}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection><h2 className="text-2xl font-bold text-gray-900 mb-8">Научная проблематика</h2></AnimatedSection>
          <div className="space-y-3">
            {TOPICS.map((t, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="glass-card overflow-hidden">
                  <button onClick={() => setExpandedTopic(expandedTopic === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                    <span className="text-gray-900 font-medium">{t.title}</span>
                    {expandedTopic === i ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                  </button>
                  {expandedTopic === i && <div className="px-4 pb-4 text-gray-500 text-sm leading-relaxed">{t.text}</div>}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {page.body && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="prose-light text-justify" dangerouslySetInnerHTML={{ __html: page.body }} />
            </AnimatedSection>
          </div>
        </section>
      )}

      {page.expected_results && (
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Ожидаемые результаты</h2>
                <div className="prose-light" dangerouslySetInnerHTML={{ __html: page.expected_results }} />
              </div>
            </AnimatedSection>
          </div>
        </section>
      )}
    </div>
  );
}
