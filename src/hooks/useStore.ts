import { create } from 'zustand'

function getInitialCastingViewMode(): 'list' | 'grid' | 'kanban' {
  if (typeof window === 'undefined') return 'grid'
  const stored = window.localStorage.getItem('casting_view_mode')
  return stored === 'list' || stored === 'kanban' ? stored : 'grid'
}

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  
  currentUser: {
    name: string
    role: string
    email?: string
    phone?: string
    avatar?: string | null
    date_of_birth?: string | null
    team_member_id?: number | null
  } | null
  setCurrentUser: (user: {
    name: string
    role: string
    email?: string
    phone?: string
    avatar?: string | null
    date_of_birth?: string | null
    team_member_id?: number | null
  } | null) => void
  
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
  
  castingViewMode: getInitialCastingViewMode(),
  setCastingViewMode: (mode) => {
    localStorage.setItem('casting_view_mode', mode)
    set({ castingViewMode: mode })
  },
}))
