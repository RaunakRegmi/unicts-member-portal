import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try one silent refresh (shared across concurrent failures so the
// rotated refresh token is only spent once), then replay the request.
let refreshPromise = null;

export async function refreshSession() {
  refreshPromise =
    refreshPromise ||
    axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        useAuthStore.getState().setSession(data.data);
        return data.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response && error.response.status;
    const isAuthCall = (original.url || '').startsWith('/auth/');
    if (status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const session = await refreshSession();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        useAuthStore.getState().clearSession();
        throw error;
      }
    }
    throw error;
  }
);

export function apiErrorMessage(error) {
  const data = error && error.response && error.response.data;
  if (data && data.error && data.error.message) return data.error.message;
  if (data && data.errors) return 'Please fix the highlighted fields';
  return (error && error.message) || 'Something went wrong';
}

// Zod flatten() shape from the backend → { fieldName: "first message" }
export function apiFieldErrors(error) {
  const fieldErrors =
    (error &&
      error.response &&
      error.response.data &&
      error.response.data.errors &&
      error.response.data.errors.fieldErrors) ||
    {};
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [key, messages[0]])
  );
}
