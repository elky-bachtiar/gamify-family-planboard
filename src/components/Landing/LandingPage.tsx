import { useEffect } from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { FeaturesSection } from './FeaturesSection';
import { HowItWorksSection } from './HowItWorksSection';
import { TestimonialsSection } from './TestimonialsSection';
import { PricingSection } from './PricingSection';
import { CTASection } from './CTASection';
import { LandingFooter } from './LandingFooter';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  // Set up scroll reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    // Observe all sections with scroll-reveal class
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader onGetStarted={onGetStarted} onLogin={onLogin} />
      <HeroSection onGetStarted={onGetStarted} />
      <div className="scroll-reveal">
        <FeaturesSection />
      </div>
      <div className="scroll-reveal">
        <HowItWorksSection />
      </div>
      <div className="scroll-reveal">
        <TestimonialsSection />
      </div>
      <div className="scroll-reveal">
        <PricingSection onGetStarted={onGetStarted} />
      </div>
      <div className="scroll-reveal">
        <CTASection onGetStarted={onGetStarted} />
      </div>
      <LandingFooter />
    </div>
  );
}
