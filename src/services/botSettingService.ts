import api from './api';
import type { BotSettingRequest, BotSettingResponse } from '../types/botSetting';

export const botSettingService = {
  /** GET /api/v1/agent-settings/{agentId} — busca pelo ID do agent (não do setting) */
  getByBotId: (agentId: string) =>
    api.get<BotSettingResponse>(`/agent-settings/${agentId}`).then(r => r.data),

  /** POST /api/v1/agent-settings */
  create: (body: BotSettingRequest) =>
    api.post<BotSettingResponse>('/agent-settings', body).then(r => r.data),

  /** PUT /api/v1/agent-settings/{id} — id do próprio setting */
  update: (settingId: string, body: BotSettingRequest) =>
    api.put<BotSettingResponse>(`/agent-settings/${settingId}`, body).then(r => r.data),
};
