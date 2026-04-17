export type SessionStatus   = 'ACTIVE' | 'CLOSED' | 'ABANDONED' | 'EXPIRED';
export type MessageType     = 'USER' | 'HUMAN_AGENT' | 'LLM_ASSISTANT';
export type ResponderType   = 'LLM_ASSISTANT' | 'HUMAN_AGENT';
export type Channel         = 'WHATSAPP' | 'TEAMS' | 'WEB';

export interface ChatSession {
  id:                   string;
  agent_id:             string;
  agent_name:           string;
  account_id:           string;
  channel?:             Channel;
  prompt_tokens:        number;
  completion_tokens:    number;
  total_tokens:         number;
  responder_type:       ResponderType;
  interaction_status:   SessionStatus;
  created_at:           string;
  updated_at:           string;
}

export interface ChatAccount {
  id:                  string;
  user_name:           string | null;
  user_phone:          string | null;
  user_email:          string | null;
  user_cpf_cnpj:       string | null;
  last_interaction_at: string;
}

export interface ChatMessage {
  id:                string;
  content:           string;
  type_message:      MessageType;
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
  created_at:        string;
}
