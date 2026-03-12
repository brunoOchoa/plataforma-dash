export type PromptType = 'CHAT_GERAL' | 'RAG_GERAL';

export interface Prompt {
  id: string;
  bot_id: string;
  description: string | null;
  prompt_text: string;
  type_prompt: PromptType;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptPage {
  content: Prompt[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CreatePromptRequest {
  bot_id: string;
  type_prompt: PromptType;
  description?: string | null;
  prompt_text: string;
}
