import { useTranslation } from 'react-i18next';
import { Star, Flame, Smile, CheckCircle, Gift, Trophy } from 'lucide-react';

const features = [
  {
    key: 'pointsLevels',
    icon: Star,
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    iconColor: 'text-yellow-500',
  },
  {
    key: 'streaks',
    icon: Flame,
    color: 'orange',
    bgColor: 'bg-orange-100',
    iconColor: 'text-orange-500',
  },
  {
    key: 'childFriendly',
    icon: Smile,
    color: 'blue',
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-500',
  },
  {
    key: 'approval',
    icon: CheckCircle,
    color: 'green',
    bgColor: 'bg-green-100',
    iconColor: 'text-green-500',
  },
  {
    key: 'rewards',
    icon: Gift,
    color: 'purple',
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-500',
  },
  {
    key: 'leaderboard',
    icon: Trophy,
    color: 'pink',
    bgColor: 'bg-pink-100',
    iconColor: 'text-pink-500',
  },
];

export function FeaturesSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {t('features.title')}
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            {t('features.subtitle')}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.key}
                className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-14 h-14 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {t(`features.${feature.key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
