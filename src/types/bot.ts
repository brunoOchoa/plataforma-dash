/* Departamento aninhado no Bot (entidade direta, camelCase) */
export interface BotDepartment {
  id: string;
  name: string;
  company?: {
    id: string;
    name: string;
  };
}

/* KnowledgeBase resumida (ManyToMany LAZY — pode não vir no list) */
export interface BotKnowledgeBase {
  id: string;
  name: string;
}

/* Resposta da API — BotController retorna a entidade Bot diretamente,
   portanto Jackson serializa em camelCase (sem @JsonProperty):
     createdAt, updatedAt, department (nested entity)               */
export interface Bot {
  id: string;
  name: string;
  active: boolean;
  department: BotDepartment;
  knowledgeBases?: BotKnowledgeBase[];
  createdAt: string;
  updatedAt: string;
}

/* Requisições (front → API) — BotRequest usa @JsonProperty snake_case */
export interface CreateBotRequest {
  name: string;
  department_id: string;
  knowledge_base_ids?: string[];
  active: boolean;  // obrigatório — construtor do Bot usa boolean primitivo (NPE se null)
}

export interface UpdateBotRequest {
  name: string;
  active: boolean;
  department_id: string;
  knowledge_base_ids?: string[];
}

export interface BotPage {
  content: Bot[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
