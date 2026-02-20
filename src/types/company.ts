/* ─── RESPONSE (API → front) ─────────────────────────────────────────────
   O CompanyController retorna a entidade Company diretamente (sem DTO),
   portanto Jackson serializa os campos em camelCase (sem @JsonProperty):
     cpfCnpj, storageQuotas, createdAt
   ──────────────────────────────────────────────────────────────────────── */
export interface Company {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  storageQuotas: number | null;  // em bytes
  active: boolean;
  createdAt: string;
  // só retornado na criação
  password?: string;
}

/* ─── REQUESTS (front → API) ─────────────────────────────────────────────
   Company entity não tem @JsonProperty → Jackson espera camelCase
   ──────────────────────────────────────────────────────────────────────── */
export interface CreateCompanyRequest {
  name: string;
  cpfCnpj: string;
  email: string;
  storageQuotas?: number | null;
  active?: boolean;
}

export interface UpdateCompanyRequest {
  name: string;
  cpfCnpj: string;
  email: string;
  storageQuotas: number | null;
  active: boolean;
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
