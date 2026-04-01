import { create } from 'zustand'

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  
  currentUser: {
    name: string
    role: string
    avatar?: string
  } | null
  setCurrentUser: (user: { name: string; role: string; avatar?: string } | null) => void
  
  castingViewMode: 'list' | 'grid' | 'kanban'
  setCastingViewMode: (mode: 'list' | 'grid' | 'kanban') => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  castingViewMode: 'grid',
  setCastingViewMode: (mode) => {
    localStorage.setItem('casting_view_mode', mode)
    set({ castingViewMode: mode })
  },
}))
