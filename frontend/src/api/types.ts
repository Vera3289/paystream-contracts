export interface Stream {
  id: string;
  employer: string;
  employee: string;
  token: string;
  deposit: string;
  ratePerSecond: string;
  withdrawn: string;
  startTime: number;
  stopTime?: number;
  status: 'Active' | 'Paused' | 'Cancelled' | 'Exhausted';
}

export interface Payment {
  id: string;
  streamId: string;
  recipient: string;
  amount: string;
  timestamp: number;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: number;
}
