import { useEffect, useState } from 'react'
import { authAPI } from '../../services/api'
import { useUIStore } from '../../store'

export default function AdminUsersPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  // Get current user ID to know who's logged in
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await authAPI.getMe()
        setCurrentUserId(res.data.id)
      } catch (err) {
        console.error("Failed to get current user:", err)
      }
    }
    loadCurrentUser()
  }, [])

  // Load users list
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await authAPI.listUsers()
        setUsers(res.data.users)
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load users")
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [])

  // Handle user deletion
  const handleDelete = async (userId) => {
    try {
      await authAPI.deleteUser(userId)
      setUsers(users.filter(u => u.id !== userId))
      setDeleteConfirm(null)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete user")
      setDeleteConfirm(null)
    }
  }

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/70">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-surface1 p-6 gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">User Management</h1>
        <p className="text-white/50">View and manage all application users</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-md text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="flex-1 overflow-auto">
        {users.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40">
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-surface2">
                  <th className="px-4 py-3 text-left font-semibold text-white/80">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">Username</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">Created At</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId
                  const isDeleteConfirming = deleteConfirm === user.id
                  
                  return (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-surface2/30 transition">
                      <td className="px-4 py-3 text-white/80">{user.id}</td>
                      <td className="px-4 py-3 text-white">
                        {user.username}
                        {isCurrentUser && <span className="ml-2 text-xs bg-blue-900/50 text-blue-200 px-2 py-1 rounded">Current</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-amber-900/50 text-amber-200' 
                            : 'bg-gray-900/50 text-gray-200'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3">
                        {isCurrentUser ? (
                          <span className="text-white/40 text-xs">Cannot delete self</span>
                        ) : isDeleteConfirming ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            className="px-3 py-1 bg-red-900/50 hover:bg-red-800/70 text-red-200 text-xs rounded transition border border-red-700/30"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="pt-4 border-t border-white/10 flex gap-6">
        <div>
          <div className="text-white/50 text-xs">Total Users</div>
          <div className="text-white text-lg font-semibold">{users.length}</div>
        </div>
        <div>
          <div className="text-white/50 text-xs">Admins</div>
          <div className="text-white text-lg font-semibold">{users.filter(u => u.role === 'admin').length}</div>
        </div>
        <div>
          <div className="text-white/50 text-xs">Regular Users</div>
          <div className="text-white text-lg font-semibold">{users.filter(u => u.role === 'user').length}</div>
        </div>
      </div>
    </div>
  )
}
