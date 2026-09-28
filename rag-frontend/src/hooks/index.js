import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { documentsAPI, chatAPI, promptsAPI, analyticsAPI } from '../services/api'
import { MOCK_ANALYTICS, MOCK_PROMPTS } from '../services/mockData'
import { useAuthStore, useChatStore } from '../store'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ─── Documents ────────────────────────────────────────────────
export function useDocuments() {
  const { user, isAuthenticated } = useAuthStore()
  const userKey = user?.id || user?.username || 'anonymous'

  return useQuery({
    queryKey: ['documents', userKey],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await documentsAPI.getAll()
      return res.data.documents
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formData, onProgress }) => documentsAPI.upload(formData, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document uploaded & indexed successfully')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => documentsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document deleted')
    },
    onError: () => toast.error('Delete failed'),
  })
}

// ─── Chat ─────────────────────────────────────────────────────
export function useChat() {
  const qc = useQueryClient()
  const { addMessage, setTyping, activeDocument, chatSessionId, setChatSessionId, setActiveDocument } = useChatStore()

  const sendMessage = async (text) => {
    addMessage({ role: 'user', content: text })
    setTyping(true)

    try {
      const res = await chatAPI.ask({
        question: text,
        document: activeDocument.name,
        session_id: chatSessionId || undefined,
      })

      const data = res.data

      // Save the session_id returned by backend
      if (data.session_id && data.session_id !== chatSessionId) {
        setChatSessionId(data.session_id)
      }

      addMessage({
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        score: data.score,
        tokensUsed: data.tokensUsed,
        isFavourite: false,
        dbId: data.message_id,   // real DB id — needed for favourite toggle
      })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Chat failed'
      if (err.response?.status === 404) {
        setActiveDocument(null)
        qc.invalidateQueries({ queryKey: ['documents'] })
      }
      toast.error(msg)
    } finally {
      setTyping(false)
    }
  }

  return { sendMessage }
}

// ─── Chat Sessions (for History panel) ───────────────────────
export function useChatSessions() {
  return useQuery({
    queryKey: ['chatSessions'],
    queryFn: async () => {
      const res = await chatAPI.getSessions()
      return res.data
    },
    refetchInterval: 30000, // refresh every 30s
  })
}

// ─── Load a past session into chat panel ─────────────────────
export function useLoadSession() {
  const { loadSession } = useChatStore()

  return async (session) => {
    try {
      const res = await chatAPI.getMessages(session.session_id || session.id)
      const messages = res.data.messages.map(m => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        isFavourite: m.isFavourite,
        createdAt: m.createdAt,
        // dbId needed for favourite toggle
        dbId: m.id,
      }))
      loadSession(session.session_id || session.id, session.documentName, messages)
    } catch {
      toast.error('Could not load session')
    }
  }
}

// ─── Toggle Favourite ─────────────────────────────────────────
export function useToggleFavourite() {
  const { updateMessage } = useChatStore()
  const qc = useQueryClient()

  return async (msg, newValue) => {
    // Optimistic update in store
    updateMessage(msg.id, { isFavourite: newValue })

    // Only call API if the message has a real DB id (dbId)
    if (msg.dbId) {
      try {
        await chatAPI.toggleFavourite(msg.dbId, newValue)
        qc.invalidateQueries(['favourites'])
      } catch {
        // Roll back optimistic update
        updateMessage(msg.id, { isFavourite: !newValue })
        toast.error('Could not save favourite')
      }
    }
  }
}

// ─── Favourites list ──────────────────────────────────────────
export function useFavourites() {
  return useQuery({
    queryKey: ['favourites'],
    queryFn: async () => {
      const res = await chatAPI.getFavourites()
      return res.data.favourites
    },
  })
}

// ─── Delete session ───────────────────────────────────────────
export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => chatAPI.deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries(['chatSessions'])
      toast.success('Session deleted')
    },
    onError: () => toast.error('Delete failed'),
  })
}

// ─── Prompts ──────────────────────────────────────────────────
export function usePrompts() {
  return useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_PROMPTS
      const res = await promptsAPI.getAll()
      return res.data
    },
  })
}

export function useCreatePrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => promptsAPI.create(data),
    onSuccess: () => { qc.invalidateQueries(['prompts']); toast.success('Prompt saved') },
  })
}

// ─── Analytics ────────────────────────────────────────────────
export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_ANALYTICS
      const [overview, queryTrend, docUsage, topQs] = await Promise.all([
        analyticsAPI.getOverview(),
        analyticsAPI.getQueryTrend(7),
        analyticsAPI.getDocumentUsage(),
        analyticsAPI.getTopQuestions(),
      ])
      return {
        overview: overview.data,
        queryTrend: queryTrend.data,
        documentUsage: docUsage.data,
        topQuestions: topQs.data,
      }
    },
  })
}
