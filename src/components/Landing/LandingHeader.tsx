import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Menu, X } from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface LandingHeaderProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export function LandingHeader({ onGetStarted, onLogin }: LandingHeaderProps) {
  const { t } = useTranslation('landing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Taskaroo</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection('features')}
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              {t('nav.features')}
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              {t('nav.howItWorks')}
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              {t('nav.pricing')}
            </button>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={onLogin}
              className="px-4 py-2 text-gray-700 font-medium hover:text-gray-900 transition-colors"
            >
              {t('nav.login')}
            </button>
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-colors shadow-sm"
            >
              {t('nav.getStarted')}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-slide-in">
            <nav className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection('features')}
                className="text-left px-2 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                {t('nav.features')}
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-left px-2 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                {t('nav.howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-left px-2 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                {t('nav.pricing')}
              </button>
              <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                <LanguageSwitcher />
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogin();
                  }}
                  className="px-4 py-2 text-gray-700 font-medium"
                >
                  {t('nav.login')}
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onGetStarted();
                  }}
                  className="px-5 py-2.5 bg-green-500 text-white font-semibold rounded-full"
                >
                  {t('nav.getStarted')}
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
