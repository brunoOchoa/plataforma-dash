export type SharepointSyncStatus = 'NEVER_SYNCED' | 'SYNCING' | 'SYNCED' | 'ERROR';

/* Resposta da API — camelCase (record sem @JsonProperty) */
export interface SharepointSource {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  siteHostname: string;
  sitePath: string;
  driveId: string | null;
  libraryName: string | null;
  folderPaths: string[];
  enabled: boolean;
  syncStatus: SharepointSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharepointSourceRequest {
  knowledgeBaseId: string;
  siteHostname: string;
  sitePath: string;
  libraryName?: string | null;
  folderPaths?: string[] | null;
  enabled?: boolean;
}

export interface SharepointTestConnectionItem {
  name: string;
  folder: boolean;
}

/* Diferente dos outros endpoints, falha de Graph/Azure não vem como erro HTTP —
   a chamada retorna 200 com success:false + error. */
export interface SharepointTestConnectionResponse {
  success: boolean;
  siteId: string | null;
  siteDisplayName: string | null;
  driveId: string | null;
  driveName: string | null;
  items: SharepointTestConnectionItem[];
  error: string | null;
}
