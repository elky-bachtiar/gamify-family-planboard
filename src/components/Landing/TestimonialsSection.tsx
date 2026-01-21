import { useTranslation } from 'react-i18next';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  { key: 'quote1', avatar: 'S' },
  { key: 'quote2', avatar: 'D' },
  { key: 'quote3', avatar: 'L' },
];

export function TestimonialsSection() {
  const { t } = useTranslation('landing');

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {t('testimonials.title')}
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            {t('testimonials.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 md:gap-8 mb-16 max-w-3xl mx-auto">
          <div className="text-center p-4 md:p-6 bg-green-50 rounded-2xl">
            <div className="text-3xl md:text-4xl font-bold text-green-600">
              {t('testimonials.stats.dailyActive')}
            </div>
            <div className="text-sm md:text-base text-gray-600 mt-1">
              {t('testimonials.stats.dailyActiveLabel')}
            </div>
          </div>
          <div className="text-center p-4 md:p-6 bg-yellow-50 rounded-2xl">
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl md:text-4xl font-bold text-yellow-600">
                {t('testimonials.stats.satisfaction')}
              </span>
            </div>
            <div className="text-sm md:text-base text-gray-600 mt-1">
              {t('testimonials.stats.satisfactionLabel')}
            </div>
          </div>
          <div className="text-center p-4 md:p-6 bg-purple-50 rounded-2xl">
            <div className="text-3xl md:text-4xl font-bold text-purple-600">
              {t('testimonials.stats.recommend')}
            </div>
            <div className="text-sm md:text-base text-gray-600 mt-1">
              {t('testimonials.stats.recommendLabel')}
            </div>
          </div>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.key}
              className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Quote icon */}
              <Quote className="absolute top-4 right-4 w-8 h-8 text-gray-100" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                "{t(`testimonials.quotes.${testimonial.key}.text`)}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0
                      ? 'bg-gradient-to-br from-pink-400 to-pink-600'
                      : index === 1
                      ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                      : 'bg-gradient-to-br from-purple-400 to-purple-600'
                  }`}
                >
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {t(`testimonials.quotes.${testimonial.key}.author`)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t(`testimonials.quotes.${testimonial.key}.role`)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
