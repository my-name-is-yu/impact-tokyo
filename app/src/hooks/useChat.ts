import { useState, useCallback } from 'react';
import type { ChatMessage, ChatIntent } from '../types';
import {
  structureRecord,
  saveRecord,
  sendGuideMessage,
  generateReport,
  generateDoctorMemo,
  generateHandover,
  generateChecklist,
  getAlerts,
} from '../lib/api';
import { classifyIntent } from '../lib/chat-api';

function getPreviousMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: fmt(firstOfPrevMonth), end: fmt(lastOfPrevMonth) };
}

function makeMessage(role: 'user' | 'assistant', content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
    ...extra,
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [guideSessionId, setGuideSessionId] = useState<string | null>(null);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const updateLastAssistantMessage = useCallback((updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages(prev => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
        updated[lastIdx] = updater(updated[lastIdx]);
      }
      return updated;
    });
  }, []);

  const handleGuideStream = useCallback(async (text: string) => {
    const placeholderId = crypto.randomUUID();
    const placeholder = makeMessage('assistant', '', { id: placeholderId, isStreaming: true });
    setMessages(prev => [...prev, placeholder]);
    setIsStreaming(true);

    try {
      const res = await sendGuideMessage(guideSessionId, text);

      const newSessionId = res.headers.get('X-Session-Id');
      if (newSessionId) setGuideSessionId(newSessionId);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: updated[lastIdx].content + parsed.text,
                  };
                }
                return updated;
              });
            }
            if (parsed.session_id) setGuideSessionId(parsed.session_id);
          } catch {
            // ignore parse errors on incomplete chunks
          }
        }
      }
    } finally {
      updateLastAssistantMessage(msg => ({ ...msg, isStreaming: false }));
      setIsStreaming(false);
    }
  }, [guideSessionId, updateLastAssistantMessage]);

  const dispatch = useCallback(async (
    intent: ChatIntent,
    text: string,
    params: Record<string, unknown> = {}
  ) => {
    switch (intent) {
      case 'record_entry': {
        const result = await structureRecord(text);
        await saveRecord(result.id);
        appendMessage(makeMessage('assistant',
          '記録を保存しました。内容を確認してください。',
          { intent, resultData: result }
        ));
        break;
      }

      case 'guide_question': {
        await handleGuideStream(text);
        break;
      }

      case 'report_generation': {
        const { start, end } = getPreviousMonthRange();
        const result = await generateReport(start, end, '', 'standard');
        appendMessage(makeMessage('assistant',
          `ケアマネージャー報告書を生成しました（${start} 〜 ${end}）。`,
          { intent, resultData: result }
        ));
        break;
      }

      case 'doctor_memo': {
        const visitReason = typeof params.visit_reason === 'string' ? params.visit_reason : undefined;
        const result = await generateDoctorMemo(visitReason);
        appendMessage(makeMessage('assistant',
          `受診メモを作成しました。\n\n${result.memo}`,
          { intent, resultData: result }
        ));
        break;
      }

      case 'handover': {
        const providerName = typeof params.provider_name === 'string' ? params.provider_name : undefined;
        const result = await generateHandover(providerName);
        appendMessage(makeMessage('assistant',
          `申し送り書を作成しました。\n\n${result.summary}`,
          { intent, resultData: result }
        ));
        break;
      }

      case 'checklist': {
        const type = params.type === 'discharge' ? 'discharge' : 'admission';
        const result = await generateChecklist(type);
        const label = type === 'admission' ? '入院' : '退院';
        const lines = result.checklist.flatMap(cat => [
          `【${cat.category}】`,
          ...cat.items.map(item => `• ${item.text}`),
          '',
        ]);
        appendMessage(makeMessage('assistant',
          `${label}チェックリストを作成しました。\n\n${lines.join('\n').trim()}`,
          { intent, resultData: result }
        ));
        break;
      }

      case 'alert_inquiry': {
        const alerts = await getAlerts();
        if (alerts.length === 0) {
          appendMessage(makeMessage('assistant', '現在、未読のアラートはありません。', { intent }));
        } else {
          const unread = alerts.filter(a => !a.read);
          const lines = (unread.length > 0 ? unread : alerts).map(
            a => `【${a.severity === 'high' ? '重要' : a.severity === 'medium' ? '注意' : '情報'}】${a.title}: ${a.description}`
          );
          appendMessage(makeMessage('assistant',
            `アラート情報（${unread.length > 0 ? `未読 ${unread.length}件` : `全 ${alerts.length}件`}）:\n\n${lines.join('\n')}`,
            { intent, resultData: alerts }
          ));
        }
        break;
      }

      case 'general_chat':
      default: {
        appendMessage(makeMessage('assistant',
          'こんにちは。以下のことをお手伝いできます：\n\n• 介護記録の入力・構造化\n• 介護手続きに関するご質問\n• ケアマネージャー報告書の生成\n• 受診メモの作成\n• 申し送り書の作成\n• 入退院チェックリストの作成\n• アラート・通知の確認\n\nどのようなことをご要望ですか？',
          { intent }
        ));
        break;
      }
    }
  }, [appendMessage, handleGuideStream]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isStreaming) return;

    appendMessage(makeMessage('user', text));
    setIsLoading(true);

    try {
      const classification = await classifyIntent(text);
      await dispatch(classification.intent, text, classification.extracted_params);
    } catch (err) {
      const message = err instanceof Error ? err.message : '予期しないエラーが発生しました。';
      appendMessage(makeMessage('assistant', `エラーが発生しました: ${message}`));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isStreaming, appendMessage, dispatch]);

  const sendQuickAction = useCallback(async (
    intent: ChatIntent,
    params: Record<string, unknown> = {}
  ) => {
    if (isLoading || isStreaming) return;

    const labelMap: Record<ChatIntent, string> = {
      record_entry: '記録を入力',
      guide_question: '手続きについて質問',
      report_generation: '報告書を生成',
      doctor_memo: '受診メモを作成',
      handover: '申し送り書を作成',
      checklist: 'チェックリストを作成',
      alert_inquiry: 'アラートを確認',
      general_chat: 'ヘルプ',
    };

    appendMessage(makeMessage('user', labelMap[intent]));
    setIsLoading(true);

    try {
      await dispatch(intent, labelMap[intent], params);
    } catch (err) {
      const message = err instanceof Error ? err.message : '予期しないエラーが発生しました。';
      appendMessage(makeMessage('assistant', `エラーが発生しました: ${message}`));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isStreaming, appendMessage, dispatch]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setGuideSessionId(null);
  }, []);

  return { messages, isLoading, isStreaming, sendMessage, sendQuickAction, clearMessages };
}
