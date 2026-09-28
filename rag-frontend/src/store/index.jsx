import { create } from 'zustand'
import { authAPI } from '../services/api'

// -----------------------------
// JWT decode helper
// -----------------------------
const decodeJWT = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

const getUserFromToken = (token) => {
  if (!token) return null
  const payload = decodeJWT(token)
  if (!payload || !payload.sub) return null
  return {
    id: payload.user_id || null,
    username: payload.sub,
    role: payload.role || 'user',
  }
}

// ─── Auth Store ───────────────────────────────────────────────
const initialToken = localStorage.getItem('token')
const initialUser = getUserFromToken(initialToken)

export const useAuthStore = create((set, get) => ({
  user: initialUser,
  token: initialUser ? initialToken : null,
  isAuthenticated: !!initialUser,

  login: (userOrToken, token, refreshToken) => {
    let jwtToken = null
    let user = null

    if (typeof userOrToken === 'string' && !token) {
      jwtToken = userOrToken
      user = getUserFromToken(jwtToken)
      if (!user) { localStorage.removeItem('token'); return false }
    } else if (userOrToken && token) {
      jwtToken = token
      user = userOrToken
    } else {
      return false
    }

    localStorage.setItem('token', jwtToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    set({ user, token: jwtToken, isAuthenticated: true })
    return true
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  init: async () => {
    const token = localStorage.getItem('token')
    if (!token) { set({ user: null, token: null, isAuthenticated: false }); return }

    const isOk = get().login(token)
    if (!isOk) { set({ user: null, token: null, isAuthenticated: false }); return }

    try {
      const resp = await authAPI.getMe()
      set({ user: resp.data, token: localStorage.getItem('token'), isAuthenticated: true })
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      set({ user: null, token: null, isAuthenticated: false })
    }
  },
}))

// ─── Chat Store ───────────────────────────────────────────────
// ✅ FIX: messages, activeDocument, chatSessionId ab localStorage mein persist hote hain

const CHAT_KEY = 'chatState'

const loadChatState = () => {
  try {
    const saved = localStorage.getItem(CHAT_KEY)
    if (!saved) return {}
    return JSON.parse(saved)
  } catch {
    return {}
  }
}

const saveChatState = (patch) => {
  try {
    const current = loadChatState()
    localStorage.setItem(CHAT_KEY, JSON.stringify({ ...current, ...patch }))
  } catch { /* quota exceeded etc — silently ignore */ }
}

const savedChat = loadChatState()

export const useChatStore = create((set) => ({
  // ── persisted ──────────────────────────────────────────────
  activeDocument: savedChat.activeDocument ?? null,
  chatSessionId: savedChat.chatSessionId ?? null,
  messages: savedChat.messages ?? [],

  // ── in-memory only ─────────────────────────────────────────
  isTyping: false,
  rightPanelOpen: true,
  activeTab: 'questions',

  setActiveDocument: (doc) => {
    saveChatState({ activeDocument: doc, messages: [], chatSessionId: null })
    set({ activeDocument: doc, messages: [], chatSessionId: null })
  },

  setChatSessionId: (id) => {
    saveChatState({ chatSessionId: id })
    set({ chatSessionId: id })
  },

  addMessage: (msg) => set((s) => {
    const newMsg = {
      ...msg,
      id: msg.id || Date.now().toString(),
      createdAt: msg.createdAt || new Date().toISOString(),
    }
    const messages = [...s.messages, newMsg]
    saveChatState({ messages })
    return { messages }
  }),

  updateMessage: (id, patch) => set((s) => {
    const messages = s.messages.map(m => m.id === id ? { ...m, ...patch } : m)
    saveChatState({ messages })
    return { messages }
  }),

  removeMessage: (id) => set((s) => {
    const messages = s.messages.filter(m => m.id !== id)
    saveChatState({ messages })
    return { messages }
  }),

  setTyping: (v) => set({ isTyping: v }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),

  clearMessages: () => {
    saveChatState({ messages: [], chatSessionId: null })
    set({ messages: [], chatSessionId: null })
  },

  resetSession: () => {
    saveChatState({ activeDocument: null, chatSessionId: null, messages: [] })
    set({ activeDocument: null, chatSessionId: null, messages: [], isTyping: false })
  },

  loadSession: (sessionId, documentName, messages) => {
    const activeDocument = { id: documentName, name: documentName }
    saveChatState({ chatSessionId: sessionId, activeDocument, messages })
    set({ chatSessionId: sessionId, activeDocument, messages })
  },
}))

// ─── UI Store ─────────────────────────────────────────────────
const PANEL_KEY = 'activePanel'
const validPanels = ['dashboard', 'documents', 'chat', 'history', 'analytics', 'admin', 'logs', 'settings']
const savedPanel = localStorage.getItem(PANEL_KEY)
const initialPanel = savedPanel && validPanels.includes(savedPanel) ? savedPanel : 'dashboard'

export const useUIStore = create((set) => ({
  activePanel: initialPanel,
  refModalOpen: false,
  refModalData: null,
  uploadModalOpen: false,

  setPanel: (panel) => {
    localStorage.setItem(PANEL_KEY, panel)
    set({ activePanel: panel })
  },

  openRefModal: (data) => set({ refModalOpen: true, refModalData: data }),
  closeRefModal: () => set({ refModalOpen: false, refModalData: null }),
  openUploadModal: () => set({ uploadModalOpen: true }),
  closeUploadModal: () => set({ uploadModalOpen: false }),

  resetWorkspace: () => {
    localStorage.removeItem(PANEL_KEY)
    set({ activePanel: 'dashboard', refModalOpen: false, refModalData: null, uploadModalOpen: false })
  },
}))
