
/**
 * API Configuration
 * For production, set VITE_API_BASE_URL and VITE_STORAGE_URL.
 */
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const envStorageUrl = (import.meta.env.VITE_STORAGE_URL || '').trim();

export const API_CONFIG = {
  // Dev defaults to Vite proxy. Production defaults to same-origin API if env var is not set.
  BASE_URL: envApiBaseUrl || (isLocalhost ? '/api' : `${window.location.origin}/api`),
  // Storage URL can be explicitly configured; otherwise follow same-origin in production.
  STORAGE_URL: envStorageUrl || (isLocalhost ? 'http://localhost:8000/storage' : `${window.location.origin}/storage`),
  TIMEOUT: 10000,
};
