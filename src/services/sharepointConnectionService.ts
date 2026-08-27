import api from './api';
import type { SharepointConnection, SharepointConnectionRequest } from '../types/sharepointConnection';

export const sharepointConnectionService = {
  getByDepartment: (departmentId: string) =>
    api.get<SharepointConnection>(`/sharepoint-connections/department/${departmentId}`).then(r => r.data),

  create: (body: SharepointConnectionRequest) =>
    api.post<SharepointConnection>('/sharepoint-connections', body).then(r => r.data),

  update: (id: string, body: SharepointConnectionRequest) =>
    api.put<SharepointConnection>(`/sharepoint-connections/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/sharepoint-connections/${id}`).then(r => r.data),
};
