export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  token: string;
  refresh_token: string;
  expires_in: number;
  is_user_hitss: boolean;
  force_change_password: boolean;
}

export interface UserInfo {
  id: string;
  token: string;
  refresh_token: string;
  expires_in: number;
  is_user_hitss: boolean;
  force_change_password: boolean;
  email?: string;
  name?: string;
  type: 'system' | 'customer';
  /** Preenchido apenas para usuários customer — extraído do JWT claim */
  company_id?:   string;
  company_name?: string;
}
