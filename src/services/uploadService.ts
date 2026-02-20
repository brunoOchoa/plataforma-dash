import api from './api';

export type DocumentStatus = 'PENDING' | 'AVAILABLE' | 'PROCESSED' | 'ERROR' | 'TRASH';

export interface DocumentUpload {
  id: string;
  filename: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
}

export interface DocumentPage {
  content: DocumentUpload[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export const uploadService = {
  list: (params?: { knowledgeBaseId?: string; page?: number; size?: number }) =>
    api.get<DocumentPage>('/customer/upload', { params: { size: 20, ...params } })
       .then(r => r.data),

  upload: (file: File, knowledgeBaseId: string) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<DocumentUpload>(`/customer/upload?knowledgeBaseId=${knowledgeBaseId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  remove: (id: string) =>
    api.delete(`/customer/upload/${id}`).then(r => r.data),
};
