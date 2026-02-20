export interface SystemUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  forcePasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
  roles: Role[];
  groups: Group[];
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  forcePasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
  company: Company;
  roles: Role[];
  groups: Group[];
  departments: Department[];
}

export interface Role {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Group {
  id: string;
  name: string;
  active?: boolean;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  active?: boolean;
}

export interface Department {
  id: string;
  name: string;
  active?: boolean;
  company?: Company;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CreateSystemUserRequest {
  name: string;
  email: string;
  password?: string;
  active?: boolean;
  force_password_change?: boolean;
  role_ids?: string[];
  group_ids?: string[];
}

export interface CreateCustomerUserRequest {
  name: string;
  email: string;
  password: string;
  company_id: string;
  active?: boolean;
  force_password_change?: boolean;
  role_ids?: string[];
  group_ids?: string[];
  department_ids?: string[];
}

export interface ChangePasswordRequest {
  new_password: string;
  old_password: string;
}
