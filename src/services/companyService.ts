import api from './api';
import type { Company, CreateCompanyRequest, UpdateCompanyRequest, Page } from '../types/company';

export const companyService = {
  list: (params?: { name?: string; active?: boolean; page?: number; size?: number }) =>
    api.get<Page<Company>>('/system/company', { params: { size: 10, ...params } })
       .then(r => r.data),

  getById: (id: string) =>
    api.get<Company>(`/system/company/${id}`).then(r => r.data),

  create: (body: CreateCompanyRequest) =>
    api.post<Company>('/system/company', body).then(r => r.data),

  update: (id: string, body: UpdateCompanyRequest) =>
    api.put<Company>(`/system/company/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/system/company/${id}`).then(r => r.data),
};
