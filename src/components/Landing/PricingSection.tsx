import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

interface PricingSectionProps {
  onGetStarted: () => void;
}

const plans = [
  {
    key: 'free',
    features: [
      { key: 'members', included: true },
      { key: 'tasks', included: true },
      { key: 'achievements', included: true },
      { key: 'recurring', included: true },
      { key: 'support', included: true },
    ],
    popular: false,
  },
  {
    key: 'family',
    features: [
      { key: 'members', included: true },
      { key: 'tasks', included: true },
      { key: 'achievements', included: true },
      { key: 'recurring', included: true },
      { key: 'rewards', included: true },
      { key: 'support', included: true },
    ],
    popular: true,
  },
  {
    key: 'familyPro',
    features: [
      { key: 'members', included: true },
      { key: 'tasks', included: true },
      { key: 'achievements', included: true },
      { key: 'recurring', included: true },
      { key: 'rewards', included: true },
      { key: 'analytics', included: true },
      { key: 'support', included: true },
    ],
    popular: false,
  },
];

export function PricingSection({ onGetStarted }: PricingSectionProps) {
  const { t } = useTranslation('landing');

  return (
    <section id="pricing" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {t('pricing.title')}
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            {t('pricing.subtitle')}
          </p>
          <p className="mt-2 text-green-600 font-medium">
            {t('pricing.annually')}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative bg-white rounded-2xl p-6 ${
                plan.popular
                  ? 'ring-2 ring-green-500 shadow-xl scale-105'
                  : 'border border-gray-200 shadow-sm'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
                    {t('pricing.mostPopular')}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t(`pricing.${plan.key}.name`)}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {t(`pricing.${plan.key}.price`)}
                  </span>
                  {plan.key !== 'free' && (
                    <span className="text-gray-500">{t('pricing.perMonth')}</span>
                  )}
                </div>
                <p className="mt-2 text-gray-600 text-sm">
                  {t(`pricing.${plan.key}.description`)}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature.key} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={
                        feature.included ? 'text-gray-700' : 'text-gray-400'
                      }
                    >
                      {t(`pricing.${plan.key}.features.${feature.key}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={onGetStarted}
                className={`w-full py-3 px-4 rounded-full font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                {t('pricing.getStarted')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
