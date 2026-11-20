// API Base URL - uses relative path in production, dynamic hostname in development
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : `http://${window.location.hostname}:5002/api`);

export default API_BASE;
