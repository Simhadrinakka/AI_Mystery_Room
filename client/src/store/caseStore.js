import { create } from 'zustand';
export const useCase = create(set => ({ current: null, setCurrent: current => set({ current }), clear: () => set({ current: null }) }));
