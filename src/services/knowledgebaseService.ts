import api from './api';
import type { KnowledgeBase, CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest, KnowledgeBasePage } from '../types/knowledgebase';

export const knowledgebaseService = {
  list: (params?: {
    name?: string;
    companyId?: string;
    departmentId?: string;
    modelType?: string;
    page?: number;
    size?: number;
  }) => {
    // API espera todos os params em camelCase
    const { departmentId, companyId, modelType, ...rest } = params ?? {};
    const p: Record<string, any> = { size: 20, ...rest };
    if (companyId)    p['companyId']    = companyId;
    if (departmentId) p['departmentId'] = departmentId;
    if (modelType)    p['modelType']    = modelType;
    return api.get<KnowledgeBasePage>('/knowledge-base', { params: p }).then(r => r.data);
  },

  getById: (id: string) =>
    api.get<KnowledgeBase>(`/knowledge-base/${id}`).then(r => r.data),

  create: (body: CreateKnowledgeBaseRequest) =>
    api.post<KnowledgeBase>('/knowledge-base', body).then(r => r.data),

  update: (id: string, body: UpdateKnowledgeBaseRequest) =>
    api.put<KnowledgeBase>(`/knowledge-base/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/knowledge-base/${id}`).then(r => r.data),
};
