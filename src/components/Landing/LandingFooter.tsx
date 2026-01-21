import { useTranslation } from 'react-i18next';
import { Sparkles, Twitter, Instagram, Facebook } from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';

export function LandingFooter() {
  const { t } = useTranslation('landing');
  const currentYear = new Date().getFullYear();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="relative">
      {/* Wavy SVG transition - Duolingo style */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none -translate-y-[99%]">
        <svg
          className="relative block w-full h-24 md:h-32"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 C150,90 350,0 500,50 C650,100 800,30 1000,80 C1100,100 1150,70 1200,60 L1200,120 L0,120 Z"
            className="fill-green-500"
          />
        </svg>
      </div>

      {/* Main footer content */}
      <div className="bg-green-500 text-white pt-8 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md">
                  <Sparkles className="w-6 h-6 text-green-500" />
                </div>
                <span className="text-2xl font-bold">Taskaroo</span>
              </div>
              <p className="text-green-100 text-sm">
                {t('footer.tagline')}
              </p>
              <div className="mt-4">
                <LanguageSwitcher />
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-bold text-lg mb-4">{t('footer.product')}</h3>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => scrollToSection('features')}
                    className="text-green-100 hover:text-white transition-colors font-medium"
                  >
                    {t('footer.features')}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('pricing')}
                    className="text-green-100 hover:text-white transition-colors font-medium"
                  >
                    {t('footer.pricing')}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('how-it-works')}
                    className="text-green-100 hover:text-white transition-colors font-medium"
                  >
                    {t('footer.howItWorks')}
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-bold text-lg mb-4">{t('footer.legal')}</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="/privacy"
                    className="text-green-100 hover:text-white transition-colors font-medium"
                  >
                    {t('footer.privacy')}
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="text-green-100 hover:text-white transition-colors font-medium"
                  >
                    {t('footer.terms')}
                  </a>
                </li>
                <li>
                  <a
                    href="/coppa"
                    className="text-green-100 hover:text-white transition-colors font-medium"
                  >
                    {t('footer.coppa')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="font-bold text-lg mb-4">{t('footer.connect')}</h3>
              <div className="flex gap-3">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  aria-label={t('footer.twitter')}
                >
                  <Twitter className="w-5 h-5" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  aria-label={t('footer.instagram')}
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  aria-label={t('footer.facebook')}
                >
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-6 border-t border-green-400/30 text-center">
            <p className="text-green-100 text-sm">
              &copy; {currentYear} {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
