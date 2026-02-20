import api from './api';
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest, DepartmentPage } from '../types/department';

export const departmentService = {
  list: (params?: {
    name?: string;
    companyId?: string;
    active?: boolean;
    page?: number;
    size?: number;
  }) => {
    // API espera companyId (camelCase) como query param — @RequestParam(value="companyId")
    const p: Record<string, any> = { size: 20, ...params };
    return api.get<DepartmentPage>('/department', { params: p }).then(r => r.data);
  },

  getById: (id: string) =>
    api.get<Department>(`/department/${id}`).then(r => r.data),

  create: (body: CreateDepartmentRequest) =>
    api.post<Department>('/department', body).then(r => r.data),

  update: (id: string, body: UpdateDepartmentRequest) =>
    api.put<Department>(`/department/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/department/${id}`).then(r => r.data),
};
