import axios from 'axios';

const TOKEN_KEY = 'auth_token';
const MAX_RETRIES = 2;

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as (typeof error.config) & { _retryCount?: number };

    if (!error.response && config) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      if (config._retryCount <= MAX_RETRIES) return client(config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
    }

    console.error('[API]', error.message, error.response?.data);
    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
export default client;
