import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface ChildPinLoginProps {
  inviteCode: string;
  onLogin: (data: { token: string; member: unknown; family: unknown }) => void | Promise<void>;
  onBack?: () => void;
}

export function ChildPinLogin({ inviteCode, onLogin, onBack }: ChildPinLoginProps) {
  const { t } = useTranslation(['auth', 'common']);
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    setError(null);
  };

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      handlePinChange(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError(null);
  };

  const handleSubmit = async (pinToSubmit?: string) => {
    const pinValue = pinToSubmit ?? pin;
    if (pinValue.length < 4) {
      setError(t('auth:childLogin.wrongPin'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('pin-login', {
        body: {
          child_invite_code: inviteCode,
          pin: pinValue,
        },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        throw new Error(data.error);
      }

      await onLogin({
        token: data.token,
        member: data.member,
        family: data.family,
      });
    } catch (err) {
      console.error('PIN login error:', err);
      setError(t('auth:childLogin.wrongPin'));
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  const handlePinComplete = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    handlePinChange(digits);
    if (digits.length >= 6) {
      // Pass pin directly to avoid stale state closure issue
      setTimeout(() => handleSubmit(digits), 100);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{t('common:buttons.back')}</span>
          </button>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('auth:childLogin.title')}</h1>
          <p className="text-gray-600 mt-2">{t('auth:childLogin.subtitle')}</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-center gap-3 mb-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  i < pin.length
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {i < pin.length ? '●' : ''}
              </div>
            ))}
          </div>

          {error && (
            <div className="text-center text-red-500 text-sm font-medium mb-4">{error}</div>
          )}

          {/* Hidden input for keyboard entry */}
          <input
            type="tel"
            inputMode="numeric"
            value={pin}
            onChange={(e) => handlePinComplete(e.target.value)}
            className="sr-only"
            autoFocus
          />
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitClick(digit)}
              disabled={isLoading}
              className="h-14 rounded-xl bg-gray-100 hover:bg-gray-200 text-2xl font-semibold text-gray-800 transition-colors disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isLoading || pin.length === 0}
            className="h-14 rounded-xl bg-gray-100 hover:bg-gray-200 text-lg font-medium text-gray-600 transition-colors disabled:opacity-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            disabled={isLoading}
            className="h-14 rounded-xl bg-gray-100 hover:bg-gray-200 text-2xl font-semibold text-gray-800 transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isLoading || pin.length < 4}
            className="h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('auth:childLogin.submitButton')
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-500">{t('auth:childLogin.pinLabel')}</p>
      </div>
    </div>
  );
}
