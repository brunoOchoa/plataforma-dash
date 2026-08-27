/* Resposta da API — record sem @JsonProperty, portanto Jackson serializa em camelCase.
   clientSecret NUNCA é retornado em nenhuma resposta. */
export interface SharepointConnection {
  id: string;
  departmentId: string;
  departmentName: string;
  tenantId: string;
  clientId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/* Requisição (create e update) — camelCase.
   clientSecret é opcional no update: se omitido/vazio, o segredo atual é mantido. */
export interface SharepointConnectionRequest {
  departmentId: string;
  tenantId: string;
  clientId: string;
  clientSecret?: string | null;
  enabled?: boolean;
}
