import api from './api';
import type { ChatSession, ChatMessage, ChatAccount, SessionStatus, Channel } from '../types/chat';
import type { Page } from '../types/user';

export interface ChatSessionsParams {
  agentId:    string;
  from?:      string;
  to?:        string;
  status?:    SessionStatus | '';
  channel?:   Channel | '';
  accountId?: string;
  page?:      number;
  size?:      number;
}

export const chatService = {
  getSessions: (params: ChatSessionsParams) => {
    // remove campos vazios para não poluir a query string
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    );
    return api.get<Page<ChatSession>>('/chat/sessions', { params: { size: 20, ...clean } }).then(r => r.data);
  },

  getAccounts: (agentId: string) =>
    api.get<Page<ChatAccount>>('/chat/accounts', { params: { agentId } }).then(r => r.data),

  getMessages: (sessionId: string) =>
    api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`).then(r => r.data),
};
