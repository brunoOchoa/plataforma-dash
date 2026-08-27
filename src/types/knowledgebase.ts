export type EmbedModelType =
  | 'ALL_MINILM_L6_V2_384'
  | 'NOMIC_EMBED_TEXT_768'
  | 'TEXT_EMBEDDING_3_SMALL_1536'
  | 'TEXT_EMBEDDING_3_LARGE_3072';

export const EMBED_MODEL_OPTIONS: { value: EmbedModelType; label: string; description: string; dims: number }[] = [
  {
    value: 'ALL_MINILM_L6_V2_384',
    label: 'MiniLM L6',
    description: 'Modelo compacto e rápido · 384 dimensões',
    dims: 384,
  },
  {
    value: 'NOMIC_EMBED_TEXT_768',
    label: 'Nomic Embed',
    description: 'Boa relação qualidade/velocidade · 768 dimensões',
    dims: 768,
  },
  {
    value: 'TEXT_EMBEDDING_3_SMALL_1536',
    label: 'OpenAI Small',
    description: 'Embedding OpenAI compacto · 1 536 dimensões',
    dims: 1536,
  },
  {
    value: 'TEXT_EMBEDDING_3_LARGE_3072',
    label: 'OpenAI Large',
    description: 'Embedding OpenAI mais potente · 3 072 dimensões',
    dims: 3072,
  },
];

/* Resposta da API — campos em snake_case conforme @JsonProperty */
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  size_kb: number;
  model_type: EmbedModelType;
  department_id: string;
  department_name?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  /* MANUAL | SHAREPOINT — trava sozinho quando uma SharepointSource é criada pra essa base */
  source_type?: 'MANUAL' | 'SHAREPOINT';
}

/* Requisição de criação — API espera snake_case */
export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string | null;
  model_type: EmbedModelType;
  department_id: string;
  active?: boolean;
}

/* Requisição de edição — a API usa o mesmo DTO do create e EXIGE department_id e
   model_type no body mesmo no PUT (ela só revalida que continuam os mesmos —
   model_type é imutável e departmentId não pode ser alterado pela UI, mas
   precisam ser reenviados ou a API rejeita com 400 "obrigatório"). */
export interface UpdateKnowledgeBaseRequest {
  name: string;
  description: string | null;
  active: boolean;
  model_type: EmbedModelType;
  department_id: string;
}

export interface KnowledgeBasePage {
  content: KnowledgeBase[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
