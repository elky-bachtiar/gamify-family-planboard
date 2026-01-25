import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { getSupabaseClient } from '../../lib/supabase';

interface ComposeMessageProps {
  onClose: () => void;
  onSent: () => void;
  replyTo?: {
    sender_id: string;
    sender_name: string;
    content: string;
  } | null;
}

export function ComposeMessage({ onClose, onSent, replyTo }: ComposeMessageProps) {
  const { t } = useTranslation(['messages', 'common']);
  const { familyMember, family, isPinUser } = useAuth();
  const { familyMembers } = useFamily();
  const [recipientId, setRecipientId] = useState<string | 'all'>(replyTo?.sender_id || '');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out current user from recipients
  const availableRecipients = familyMembers.filter((m) => m.id !== familyMember?.id);

  const handleSend = async () => {
    if (!familyMember || !family || !content.trim() || (!recipientId && recipientId !== 'all')) {
      setError(t('messages:errorFillFields'));
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Get current session for authorization
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      console.log('[SendMessage] Debug:', {
        isPinUser,
        hasSession: !!sessionData?.session,
        hasAccessToken: !!accessToken,
        userId: sessionData?.session?.user?.id,
        memberName: familyMember?.name,
      });

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Use fetch directly to ensure proper Authorization header
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            family_id: family.id,
            recipient_id: recipientId === 'all' ? null : recipientId,
            content: content.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[SendMessage] Error response:', data);
        throw new Error(data.error || 'Failed to send message');
      }

      if (data?.error) throw new Error(data.error);

      onSent();
    } catch (err) {
      console.error('Error sending message:', err);
      setError(t('messages:errorSending'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          {replyTo
            ? t('messages:replyTo', { name: replyTo.sender_name })
            : t('messages:newMessage')}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      {replyTo && (
        <div className="mb-4 p-3 bg-gray-100 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">{t('messages:originalMessage')}:</p>
          <p className="text-sm text-gray-700 line-clamp-3">{replyTo.content}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('messages:to')}</label>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('messages:selectRecipient')}</option>
            <option value="all">{t('messages:everyone')}</option>
            {availableRecipients.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('messages:message')}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder={t('messages:messagePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !content.trim() || !recipientId}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {isSending ? t('messages:sending') : t('messages:send')}
          </button>
        </div>
      </div>
    </div>
  );
}
