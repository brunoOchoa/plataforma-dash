import api from './api';
import type { Role } from '../types/user';

/* ─── System Roles ─── */
export const systemRoleService = {
  list: () =>
    api.get<Role[]>('/system/role').then(r => r.data),
};

/* ─── Customer Roles ───
   Usuário sistema não pode acessar /customer/role (security chain separada → 403).
   Usamos /system/customer-role, acessível com token de sistema (SYSTEM_ADMIN_FULL).
   ─────────────────────────────────────────────────────────────────────────────── */
export const customerRoleService = {
  list: () =>
    api.get<Role[]>('/system/customer-role').then(r => r.data),
};
