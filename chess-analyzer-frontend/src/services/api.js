import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for analysis
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error || 'Server error occurred';
      throw new Error(message);
    } else if (error.request) {
      // Network error
      throw new Error('Unable to connect to analysis server. Please check your connection.');
    } else {
      // Other error
      throw new Error('An unexpected error occurred');
    }
  }
);

export const analyzeGame = async (pgn, depth = 15, includeAIContext = false) => {
  return api.post('/api/chess/analyze', { pgn, depth, includeAIContext });
};

export const getEngineInfo = async () => {
  return api.get('/api/chess/engine-info');
};

export const checkHealth = async () => {
  return api.get('/health');
};

export default api;
