import axios from 'axios';

// Configuración de la URL base usando variables de entorno de Vite
// Si VITE_API_URL no está definida, usa localhost como fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

console.log('🔌 Conectando a API:', API_BASE_URL);

// Crear instancia de Axios centralizada
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para añadir token si fuera necesario en el futuro (opcional)
/*
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
*/

export default api;
