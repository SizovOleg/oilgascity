import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Calendar } from 'lucide-react';
import { getPageByType, getChildren } from '../api/client';
import AnimatedSection, { StaggerContainer, StaggerItem } from '../components/AnimatedSection';

export default function BlogPage() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    getPageByType('home.BlogIndexPage').then(res => {
      if (res.data.items.length > 0) {
        getChildren(res.data.items[0].id).then(r => setPosts(r.data.items));
      }
    });
  }, []);

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Новости</h1>
          </div>
        </AnimatedSection>
        {posts.length > 0 ? (
          <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <StaggerItem key={post.id}>
                <Link to={'/blog/' + post.id}
                  className="group glass-card overflow-hidden hover:border-sky-300 hover:shadow-md transition-all duration-300 block">
                  {post.header_image && (
                    <div className="aspect-video overflow-hidden">
                      <img src={post.header_image.large} alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-gray-400 text-xs mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{post.date}</p>
                    <h3 className="text-gray-900 font-semibold group-hover:text-sky-600 transition-colors">{post.title}</h3>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <AnimatedSection>
            <div className="glass-card p-8 text-center">
              <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Новости будут добавлены позже</p>
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
