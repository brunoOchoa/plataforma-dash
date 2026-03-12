import api from './api';
import type { BotSettingRequest, BotSettingResponse } from '../types/botSetting';

export const botSettingService = {
  /** GET /api/v1/agent-settings/{botId} — busca pelo ID do bot (não do setting) */
  getByBotId: (botId: string) =>
    api.get<BotSettingResponse>(`/agent-settings/${botId}`).then(r => r.data),

  /** POST /api/v1/agent-settings */
  create: (body: BotSettingRequest) =>
    api.post<BotSettingResponse>('/agent-settings', body).then(r => r.data),

  /** PUT /api/v1/agent-settings/{id} — id do próprio setting */
  update: (settingId: string, body: BotSettingRequest) =>
    api.put<BotSettingResponse>(`/agent-settings/${settingId}`, body).then(r => r.data),
};
