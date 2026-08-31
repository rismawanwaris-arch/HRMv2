// API Base URL - uses relative path in production, localhost in development
const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

export default API_BASE;
