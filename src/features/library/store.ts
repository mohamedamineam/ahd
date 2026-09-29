import { create } from 'zustand';

interface LibraryState {
  refreshing: boolean;
  refreshCatalog: (force?: boolean) => Promise<void>;
}

// Filled in by the Library module (catalog download + verification).
export const useLibrary = create<LibraryState>((set) => ({
  refreshing: false,
  async refreshCatalog() {
    set({ refreshing: true });
    set({ refreshing: false });
  },
}));
