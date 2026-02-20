import api from './api';
import type { Bot, CreateBotRequest, UpdateBotRequest, BotPage } from '../types/bot';

export const botService = {
  list: (params?: { name?: string; companyId?: string; departmentId?: string; page?: number; size?: number }) =>
    api.get<BotPage>('/bot', { params: { size: 15, ...params } }).then(r => r.data),

  getById: (id: string) =>
    api.get<Bot>(`/bot/${id}`).then(r => r.data),

  create: (body: CreateBotRequest) =>
    api.post<Bot>('/bot', body).then(r => r.data),

  update: (id: string, body: UpdateBotRequest) =>
    api.put<Bot>(`/bot/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/bot/${id}`).then(r => r.data),
};
