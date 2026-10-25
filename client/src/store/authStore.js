import { create } from 'zustand';
import { api } from '../api/client.js';
export const useAuth = create((set) => ({ user: null, loading: true, async load() { try { const { data } = await api.get('/auth/me'); set({ user: data.user }); } catch { set({ user: null }); } finally { set({ loading: false }); } }, setUser: user => set({ user }), async logout() { await api.post('/auth/logout'); set({ user: null }); } }));
