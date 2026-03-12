/* BotSettingRequest — POST /api/v1/agent-settings
   PUT  /api/v1/agent-settings/{id}
   Usa @JsonProperty snake_case                    */
export interface BotSettingRequest {
  agent_id:               string;
  phone_number_id?:       string | null;
  meta_settings?:         Record<string, unknown> | null;  // JSON livre — criptografado no banco
  orchestrator_settings?: Record<string, unknown> | null;  // JSON livre
  verify_token?:          string | null;
}

/* BotSettingResponse — GET /api/v1/agent-settings/{agentId}
   Campos retornados sem @JsonProperty → camelCase       */
export interface BotSettingResponse {
  id:                    string;
  phoneNumberId:         string | null;
  orchestratorSettings:  Record<string, unknown> | null;
  verifyToken:           string | null;
  agent: {
    id:         string;
    name:       string;
    active:     boolean;
    department: {
      id:      string;
      name:    string;
      company: { id: string; name: string } | null;
    } | null;
  };
}
