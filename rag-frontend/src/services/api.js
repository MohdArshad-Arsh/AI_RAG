import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refresh_token'
let refreshPromise = null

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) return null

    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        localStorage.setItem(TOKEN_KEY, res.data.access_token)
        localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token)
        return res.data.access_token
      })
      .catch((err) => {
        clearSession()
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// ── Attach JWT token ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Handle 401 → logout ──
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config
    const isAuthRefresh = originalRequest?.url?.includes('/auth/refresh')

    if (err.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRefresh) {
      originalRequest._retry = true

      try {
        const newToken = await refreshAccessToken()
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch {
        redirectToLogin()
      }
    }

    if (err.response?.status === 401 && !isAuthRefresh) {
      clearSession()
      redirectToLogin()
    }

    return Promise.reject(err)
  }
)

// ── AUTH ──────────────────────────────────────────────────────
export const authAPI = {
  login:          (email, password) => api.post('/auth/login', { email, password }),
  logout:         ()                => api.post('/auth/logout'),
  getMe:          ()                => api.get('/auth/me'),
  forgotPassword: (email)           => api.post('/auth/forgot-password', { email }),
  verifyOtp:      (email, otp)      => api.post('/auth/verify-otp', { email, otp }),
  resetPassword:  (email, otp, newPassword) => api.post('/auth/reset-password', { email, otp, newPassword }),
  listUsers:      ()                => api.get('/auth/users'),
  deleteUser:     (id)              => api.delete(`/auth/users/${id}`),
}

// ── DOCUMENTS ─────────────────────────────────────────────────
export const documentsAPI = {
  // GET /api/documents/list
  getAll: () => api.get('/documents/list'),

  // POST /api/documents/upload  (multipart)
  // POST /api/documents/ingest/{filename}
  upload: async (formData, onProgress) => {
    const res = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        const pct = Math.round((e.loaded * 100) / e.total)
        if (onProgress) onProgress(pct)
      },
    })
    await api.post(`/documents/ingest/${res.data.filename}`)
    return res
  },

  /** DELETE /api/documents/{document_id}
   * @param {number} documentId
   */
  delete: (documentId) =>
    api.delete(`/documents/${documentId}`),

  /**
   * GET /api/documents/view/{filename}
   * Returns: { filename, status, uploaded_at, file_size, session_id }
   */
  view: (filename) =>
    api.get(`/documents/view/${encodeURIComponent(filename)}`),

  /**
   * GET /api/documents/download/{filename}
   * Returns the raw file binary — responseType: 'blob' is required
   */
  download: (filename) =>
    api.get(`/documents/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    }),
}

// ── CHAT ──────────────────────────────────────────────────────
export const chatAPI = {
  ask:           (payload)           => api.post('/chat/ask', payload),
  getSessions:   ()                  => api.get('/chat/sessions'),
  getMessages:   (sessionId)         => api.get(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (id)                => api.delete(`/chat/sessions/${id}`),
  exportChat:    (sessionId, format) =>
    api.get(`/chat/export/${sessionId}`, { params: { format }, responseType: 'blob' }),
  toggleFavourite: (messageId, isFavourite) =>
    api.patch('/chat/favourite', { message_id: messageId, is_favourite: isFavourite }),
  getFavourites:   () =>
    api.get('/chat/favourites'),
}

// ── PROMPTS ───────────────────────────────────────────────────
export const promptsAPI = {
  getAll: ()         => api.get('/prompts'),
  create: (data)     => api.post('/prompts', data),
  update: (id, data) => api.put(`/prompts/${id}`, data),
  delete: (id)       => api.delete(`/prompts/${id}`),
}

// ── ANALYTICS ─────────────────────────────────────────────────
export const analyticsAPI = {
  getOverview: () => api.get('/analytics/summary'),
  getQueryTrend: (days = 7) => api.get('/analytics/query-trend', { params: { days } }),
  getDocumentUsage: () => api.get('/analytics/document-usage'),
  getTopQuestions: () => api.get('/analytics/top-questions'),
}

// ── QUESTIONS ─────────────────────────────────────────────────
export const questionsAPI = {
  getAll: () => api.get('/questions'),
}

export default api
