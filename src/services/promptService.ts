import api from './api';
import type { Prompt, PromptPage, PromptType, CreatePromptRequest } from '../types/prompt';

export const promptService = {
  list: (params?: { botId?: string; typePrompt?: PromptType; page?: number; size?: number }) =>
    api.get<PromptPage>('/prompt', { params: { size: 15, ...params } }).then(r => r.data),

  getById: (id: string) =>
    api.get<Prompt>(`/prompt/${id}`).then(r => r.data),

  create: (body: CreatePromptRequest) =>
    api.post<Prompt>('/prompt', body).then(r => r.data),

  restore: (id: string) =>
    api.put<Prompt>(`/prompt/restore/${id}`).then(r => r.data),
};
