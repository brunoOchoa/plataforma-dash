import api from './api';
import type { SharepointSource, SharepointSourceRequest, SharepointTestConnectionResponse } from '../types/sharepointSource';

export const sharepointSourceService = {
  getByKnowledgeBase: (knowledgeBaseId: string) =>
    api.get<SharepointSource>(`/sharepoint-sources/knowledge-base/${knowledgeBaseId}`).then(r => r.data),

  create: (body: SharepointSourceRequest) =>
    api.post<SharepointSource>('/sharepoint-sources', body).then(r => r.data),

  update: (id: string, body: SharepointSourceRequest) =>
    api.put<SharepointSource>(`/sharepoint-sources/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/sharepoint-sources/${id}`).then(r => r.data),

  testConnection: (id: string) =>
    api.post<SharepointTestConnectionResponse>(`/sharepoint-sources/${id}/test-connection`).then(r => r.data),

  listRootItems: (id: string) =>
    api.get<SharepointTestConnectionResponse>(`/sharepoint-sources/${id}/root-items`).then(r => r.data),

  sync: (id: string) =>
    api.post<SharepointSource>(`/sharepoint-sources/${id}/sync`).then(r => r.data),
};
