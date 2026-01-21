import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

interface CTASectionProps {
  onGetStarted: () => void;
}

export function CTASection({ onGetStarted }: CTASectionProps) {
  const { t } = useTranslation('landing');

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-purple-600 via-purple-700 to-blue-700 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="text-white/90 font-medium">Join thousands of happy families</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          {t('cta.title')}
        </h2>

        <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
          {t('cta.subtitle')}
        </p>

        <button
          onClick={onGetStarted}
          className="px-10 py-4 bg-white hover:bg-gray-100 text-purple-700 font-bold text-lg rounded-full transition-all transform hover:scale-105 shadow-xl"
        >
          {t('cta.button')}
        </button>

        <p className="mt-4 text-white/60 text-sm">
          {t('cta.note')}
        </p>
      </div>
    </section>
  );
}
