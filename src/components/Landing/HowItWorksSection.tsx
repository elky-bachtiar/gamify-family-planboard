import { useTranslation } from 'react-i18next';
import { Users, ListTodo, Gamepad2, PartyPopper } from 'lucide-react';

const steps = [
  {
    key: 'step1',
    icon: Users,
    color: 'from-green-400 to-green-600',
    number: '1',
  },
  {
    key: 'step2',
    icon: ListTodo,
    color: 'from-blue-400 to-blue-600',
    number: '2',
  },
  {
    key: 'step3',
    icon: Gamepad2,
    color: 'from-purple-400 to-purple-600',
    number: '3',
  },
  {
    key: 'step4',
    icon: PartyPopper,
    color: 'from-orange-400 to-orange-600',
    number: '4',
  },
];

export function HowItWorksSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {t('howItWorks.title')}
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="relative">
                {/* Connector line (hidden on last item and on mobile) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-gray-200 to-gray-300" />
                )}

                <div className="relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  {/* Step number badge */}
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mb-4 mx-auto`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                    {t(`howItWorks.${step.key}.title`)}
                  </h3>
                  <p className="text-gray-600 text-center leading-relaxed">
                    {t(`howItWorks.${step.key}.description`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
