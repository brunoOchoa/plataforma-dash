import api from './api';
import type {
  SystemUser, CustomerUser, Page,
  CreateSystemUserRequest, CreateCustomerUserRequest, ChangePasswordRequest,
} from '../types/user';

/* ─── System Users ─── */
export const systemUserService = {
  list: (params?: { name?: string; page?: number; size?: number }) =>
    api.get<Page<SystemUser>>('/system/user', { params: { ...params, size: params?.size ?? 10 } })
       .then(r => r.data),

  getById: (id: string) =>
    api.get<SystemUser>(`/system/user/${id}`).then(r => r.data),

  create: (body: CreateSystemUserRequest) =>
    api.post<SystemUser>('/system/user', body).then(r => r.data),

  update: (id: string, body: CreateSystemUserRequest) =>
    api.put<SystemUser>(`/system/user/${id}`, body).then(r => r.data),

  changePassword: (id: string, body: ChangePasswordRequest) =>
    api.put<SystemUser>(`/system/user/change-password/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/system/user/${id}`).then(r => r.data),
};

/* ─── Customer Users ─── */
export const customerUserService = {
  list: (params?: { companyId?: string; name?: string; page?: number; size?: number }) =>
    api.get<Page<CustomerUser>>('/customer/user', { params: { ...params, size: params?.size ?? 10 } })
       .then(r => r.data),

  getById: (id: string) =>
    api.get<CustomerUser>(`/customer/user/${id}`).then(r => r.data),

  create: (body: CreateCustomerUserRequest) =>
    api.post<CustomerUser>('/customer/user', body).then(r => r.data),

  update: (id: string, body: CreateCustomerUserRequest) =>
    api.put<CustomerUser>(`/customer/user/${id}`, body).then(r => r.data),

  changePassword: (id: string, body: ChangePasswordRequest) =>
    api.put<CustomerUser>(`/customer/user/change-password/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/customer/user/${id}`).then(r => r.data),
};
