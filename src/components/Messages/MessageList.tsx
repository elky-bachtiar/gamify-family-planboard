import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MailOpen, RefreshCw, Trash2, Reply, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { getSupabaseClient } from '../../lib/supabase';
import { ComposeMessage } from './ComposeMessage';

interface Message {
  id: string;
  family_id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface MessageWithSender extends Message {
  sender_name: string;
  sender_color: string;
}

export function MessageList() {
  const { t } = useTranslation(['messages', 'common']);
  const { familyMember, family } = useAuth();
  const { familyMembers } = useFamily();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithSender | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    if (!familyMember || !family) return;

    const supabase = getSupabaseClient();

    // Get messages where I am the recipient or it's a broadcast (recipient_id is null)
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

    // Enrich with sender info
    const enrichedMessages: MessageWithSender[] = (data || []).map(msg => {
      const sender = familyMembers.find(m => m.id === msg.sender_id);
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

    // Subscribe to new messages
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('messages-inbox')
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

    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, read_at: new Date().toISOString() } : m)
    );
  };

  const deleteMessage = async (messageId: string) => {
    const supabase = getSupabaseClient();
    await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    setMessages(prev => prev.filter(m => m.id !== messageId));
    setSelectedMessage(null);
  };

  const handleMessageClick = (message: MessageWithSender) => {
    setSelectedMessage(message);
    if (!message.read_at) {
      markAsRead(message.id);
    }
  };

  const handleReply = (message: MessageWithSender) => {
    setReplyTo(message);
    setIsComposing(true);
    setSelectedMessage(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (isComposing) {
    return (
      <ComposeMessage
        onClose={() => {
          setIsComposing(false);
          setReplyTo(null);
        }}
        onSent={() => {
          setIsComposing(false);
          setReplyTo(null);
          loadMessages();
        }}
        replyTo={replyTo}
      />
    );
  }

  if (selectedMessage) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedMessage(null)}
            className="text-gray-600 hover:text-gray-800"
          >
            &larr; {t('messages:backToInbox')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReply(selectedMessage)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              <Reply className="w-4 h-4" />
              {t('messages:reply')}
            </button>
            <button
              onClick={() => deleteMessage(selectedMessage.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              <Trash2 className="w-4 h-4" />
              {t('messages:delete')}
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: selectedMessage.sender_color }}
            >
              {selectedMessage.sender_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{selectedMessage.sender_name}</p>
              <p className="text-xs text-gray-500">{formatDate(selectedMessage.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">{t('messages:inbox')}</h2>
        </div>
        <button
          onClick={() => setIsComposing(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Send className="w-4 h-4" />
          {t('messages:compose')}
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <MailOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>{t('messages:noMessages')}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {messages.map((message) => (
            <button
              key={message.id}
              onClick={() => handleMessageClick(message)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                !message.read_at ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: message.sender_color }}
                >
                  {message.sender_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium ${!message.read_at ? 'text-gray-900' : 'text-gray-600'}`}>
                      {message.sender_name}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(message.created_at)}</span>
                  </div>
                  <p className={`text-sm truncate ${!message.read_at ? 'text-gray-800' : 'text-gray-500'}`}>
                    {message.content}
                  </p>
                </div>
                {!message.read_at && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
