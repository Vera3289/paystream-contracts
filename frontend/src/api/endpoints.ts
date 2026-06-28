import client, { TOKEN_KEY } from './client';
import type { Stream, Payment, AuthCredentials, AuthResponse } from './types';

export const getStreams = () =>
  client.get<Stream[]>('/streams').then((r) => r.data);

export const getStream = (id: string) =>
  client.get<Stream>(`/streams/${id}`).then((r) => r.data);

export const createStream = (data: Omit<Stream, 'id' | 'withdrawn' | 'status' | 'startTime'>) =>
  client.post<Stream>('/streams', data).then((r) => r.data);

export const getPayments = () =>
  client.get<Payment[]>('/payments').then((r) => r.data);

export const auth = {
  login: (credentials: AuthCredentials) =>
    client.post<AuthResponse>('/auth/login', credentials).then((r) => {
      localStorage.setItem(TOKEN_KEY, r.data.token);
      return r.data;
    }),

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    return client.post('/auth/logout').then((r) => r.data);
  },
};
