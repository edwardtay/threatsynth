import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

// Dashboard
export const getDashboardStats = () => api.get('/api/dashboard/stats');
export const getDashboardRecent = () => api.get('/api/dashboard/recent');

// Assets
export const getAssets = () => api.get('/api/assets');
export const createAsset = (data) => api.post('/api/assets', data);
export const scanAssets = (target) => api.post('/api/assets/scan', { target });
export const importYamlAssets = (yamlContent) => api.post('/api/assets/import-yaml', { yaml_content: yamlContent });
export const deleteAsset = (id) => api.delete(`/api/assets/${id}`);

// Threats
export const getThreats = (params = {}) => {
  const queryParams = {};
  if (params.source && params.source !== 'all') queryParams.source = params.source;
  if (params.severity && params.severity !== 'all') queryParams.severity = params.severity;
  return api.get('/api/threats', { params: queryParams });
};
export const ingestAllThreats = () => api.post('/api/threats/ingest');
export const ingestThreatSource = (source) => api.post(`/api/threats/ingest/${source}`);

// Briefings
export const getBriefings = () => api.get('/api/briefings');
export const generateBriefings = () => api.post('/api/briefings/generate');
export const updateBriefingStatus = (id, status) => api.patch(`/api/briefings/${id}/status`, { status });

export default api;
