import axios from 'axios';
import { getToken } from './auth';

// Configuración de la URL base usando variables de entorno de Vite
// Si VITE_API_URL no está definida, usa localhost como fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

console.log('🔌 Conectando a API:', API_BASE_URL);

// Crear instancia de Axios centralizada
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para añadir token
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
