import api from './api';
import type { ChatSession, ChatMessage, SessionStatus } from '../types/chat';
import type { Page } from '../types/user';

export interface ChatSessionsParams {
  agentId:  string;
  from?:    string;
  to?:      string;
  status?:  SessionStatus | '';
  page?:    number;
  size?:    number;
}

export const chatService = {
  getSessions: (params: ChatSessionsParams) =>
    api.get<Page<ChatSession>>('/chat/sessions', { params: { size: 20, ...params } }).then(r => r.data),

  getMessages: (sessionId: string) =>
    api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`).then(r => r.data),
};
