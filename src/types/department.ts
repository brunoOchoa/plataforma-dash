/* Nested company dentro do Department (entidade retornada pelo list endpoint) */
export interface DepartmentCompany {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  storageQuotas: number | null;
  active: boolean;
  createdAt: string;
}

/* Resposta da API — o list endpoint retorna a entidade Department diretamente,
   portanto Jackson serializa em camelCase (sem @JsonProperty):
     storageQuotas, createdAt, updatedAt, availableStorageQuotas            */
export interface Department {
  id: string;
  name: string;
  storageQuotas: number | null;           // KB
  availableStorageQuotas?: number | null; // KB (@Transient, calculado)
  active: boolean;
  company?: DepartmentCompany;
  createdAt: string;
  updatedAt: string;
}

/* Requisições (front → API) — DepartmentRequest usa @JsonProperty snake_case */
export interface CreateDepartmentRequest {
  name: string;
  storage_quotas?: number | null;  // KB
  active?: boolean;
  company_id: string;
}

export interface UpdateDepartmentRequest {
  name: string;
  storage_quotas: number | null;   // KB
  active: boolean;
  company_id: string;
}

export interface DepartmentPage {
  content: Department[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
