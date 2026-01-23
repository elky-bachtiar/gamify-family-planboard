import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MailOpen, Send, ArrowLeft, RefreshCw, Reply } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFamily } from '../../../contexts/FamilyContext';
import { getSupabaseClient } from '../../../lib/supabase';

interface Message {
  id: string;
  family_id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string | null;
}

interface MessageWithSender extends Message {
  sender_name: string;
  sender_color: string;
}

type View = 'list' | 'detail' | 'compose';

export function ChildMessagesView() {
  const { t } = useTranslation(['messages', 'common']);
  const { familyMember, family } = useAuth();
  const { familyMembers } = useFamily();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithSender | null>(null);
  const [view, setView] = useState<View>('list');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [recipientId, setRecipientId] = useState<string | 'all'>('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    if (!familyMember || !family) return;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('family_id', family.id)
      .or(`recipient_id.eq.${familyMember.id},recipient_id.is.null`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    const enrichedMessages: MessageWithSender[] = (data || []).map((msg) => {
      const sender = familyMembers.find((m) => m.id === msg.sender_id);
      return {
        ...msg,
        sender_name: sender?.name || t('messages:unknownSender'),
        sender_color: sender?.color || '#888888',
      };
    });

    setMessages(enrichedMessages);
    setLoading(false);
  }, [familyMember, family, familyMembers, t]);

  useEffect(() => {
    loadMessages();

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('child-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `family_id=eq.${family?.id}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyMember?.id, family?.id, familyMembers, loadMessages]);

  const markAsRead = async (messageId: string) => {
    const supabase = getSupabaseClient();
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read_at: new Date().toISOString() } : m))
    );
  };

  const handleMessageClick = (message: MessageWithSender) => {
    setSelectedMessage(message);
    setView('detail');
    if (!message.read_at) {
      markAsRead(message.id);
    }
  };

  const handleReply = (message: MessageWithSender) => {
    setReplyToId(message.sender_id);
    setRecipientId(message.sender_id);
    setView('compose');
  };

  const handleSend = async () => {
    if (!familyMember || !family || !content.trim() || !recipientId) return;

    setIsSending(true);

    try {
      const supabase = getSupabaseClient();
      await supabase.from('messages').insert({
        family_id: family.id,
        sender_id: familyMember.id,
        recipient_id: recipientId === 'all' ? null : recipientId,
        content: content.trim(),
      });

      setContent('');
      setRecipientId('');
      setReplyToId(null);
      setView('list');
      loadMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const unreadCount = messages.filter((m) => !m.read_at).length;
  const availableRecipients = familyMembers.filter((m) => m.id !== familyMember?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Compose View
  if (view === 'compose') {
    const replyToMember = familyMembers.find((m) => m.id === replyToId);

    return (
      <div className="p-4">
        <button
          onClick={() => {
            setView('list');
            setReplyToId(null);
            setContent('');
          }}
          className="flex items-center gap-2 text-gray-600 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('messages:backToInbox')}
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {replyToMember
            ? t('messages:replyTo', { name: replyToMember.name })
            : t('messages:newMessage')}
        </h2>

        <div className="space-y-4">
          {!replyToId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('messages:to')}
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500"
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
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('messages:message')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder={t('messages:messagePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={isSending || !content.trim() || (!replyToId && !recipientId)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            {isSending ? t('messages:sending') : t('messages:send')}
          </button>
        </div>
      </div>
    );
  }

  // Detail View
  if (view === 'detail' && selectedMessage) {
    return (
      <div className="p-4">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-gray-600 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('messages:backToInbox')}
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: selectedMessage.sender_color }}
          >
            {selectedMessage.sender_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">{selectedMessage.sender_name}</p>
            <p className="text-sm text-gray-500">{formatDate(selectedMessage.created_at)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-lg whitespace-pre-wrap">{selectedMessage.content}</p>
        </div>

        <button
          onClick={() => handleReply(selectedMessage)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold"
        >
          <Reply className="w-5 h-5" />
          {t('messages:reply')}
        </button>
      </div>
    );
  }

  // List View
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">{t('messages:inbox')}</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setView('compose')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          <Send className="w-4 h-4" />
          {t('messages:compose')}
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-12">
          <MailOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">{t('messages:noMessages')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((message) => (
            <button
              key={message.id}
              onClick={() => handleMessageClick(message)}
              className={`w-full p-4 rounded-xl text-left transition-colors ${
                !message.read_at
                  ? 'bg-blue-50 border-2 border-blue-200'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: message.sender_color }}
                >
                  {message.sender_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-semibold ${!message.read_at ? 'text-gray-900' : 'text-gray-600'}`}
                    >
                      {message.sender_name}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(message.created_at)}</span>
                  </div>
                  <p
                    className={`text-sm line-clamp-2 ${!message.read_at ? 'text-gray-800' : 'text-gray-500'}`}
                  >
                    {message.content}
                  </p>
                </div>
                {!message.read_at && (
                  <div className="w-3 h-3 bg-blue-600 rounded-full flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
