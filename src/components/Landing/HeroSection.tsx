import { useTranslation } from 'react-i18next';
import { ArrowRight, Star, Flame, Trophy, Gift } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const { t } = useTranslation('landing');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-yellow-200 rounded-full opacity-60 blur-xl" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-green-200 rounded-full opacity-50 blur-xl" />
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-purple-200 rounded-full opacity-40 blur-xl" />
        <div className="absolute bottom-40 right-1/3 w-16 h-16 bg-orange-200 rounded-full opacity-50 blur-xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
              {t('hero.headline')}{' '}
              <span className="gradient-text">{t('hero.headlineHighlight')}</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0">
              {t('hero.subheadline')}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={onGetStarted}
                className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-full transition-all transform hover:scale-105 shadow-lg shadow-green-500/30"
              >
                {t('hero.cta')}
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="px-8 py-4 text-gray-700 hover:text-green-600 font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
              >
                {t('hero.secondaryCta')}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right: Illustration */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Main card */}
              <div className="bg-white rounded-3xl shadow-2xl p-6 transform hover:rotate-1 transition-transform">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      E
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Emma</div>
                      <div className="text-sm text-gray-500">Level 7</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-orange-100 px-3 py-1.5 rounded-full">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="font-bold text-orange-600">12</span>
                  </div>
                </div>

                {/* XP Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress to Level 8</span>
                    <span className="text-green-600 font-semibold">1,240 / 1,500</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                      style={{ width: '83%' }}
                    />
                  </div>
                </div>

                {/* Task cards */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border-2 border-green-200">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                      <Star className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Make bed</div>
                      <div className="text-sm text-green-600">+15 points</div>
                    </div>
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                    <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Clean room</div>
                      <div className="text-sm text-yellow-600">+25 points</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border-2 border-purple-200">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Gift className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Help with dishes</div>
                      <div className="text-sm text-purple-600">+20 points</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-lg p-3 animate-bounce-in">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-gray-900">+15</span>
                </div>
              </div>

              <div className="absolute -bottom-2 -left-4 bg-white rounded-2xl shadow-lg p-3 animate-bounce-in" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500" />
                  <span className="font-bold text-orange-600">Streak!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
