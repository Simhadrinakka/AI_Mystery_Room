import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1', withCredentials: true });
export const getMessage = error => error?.response?.data?.error?.message || 'Something went wrong. Please try again.';
