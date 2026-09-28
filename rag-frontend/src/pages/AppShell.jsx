import Topbar from '../components/Layout/Topbar'
import Sidebar from '../components/Layout/Sidebar'
import Dashboard from '../components/Dashboard'
import DocumentsPanel from '../components/Documents/DocumentsPanel'
import ChatPanel from '../components/Chat/ChatPanel'
import HistoryPanel from '../components/History/HistoryPanel'
import AnalyticsPanel from '../components/Analytics/AnalyticsPanel'
import SettingsPanel from '../components/Settings/SettingsPanel'
import LogsPanel from '../components/Logs/LogsPanel'
import RefModal from '../components/Common/RefModal'
import UploadModal from '../components/Documents/UploadModal'
import { useUIStore, useAuthStore } from '../store'
import AdminUsersPanel from '../components/Admin/AdminUsersPanel'
 
// Guard: renders children only if user has admin role
function AdminGuard({ children }) {
  const { user } = useAuthStore()
  if (user?.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Admin Access Required
          </div>
          <div style={{ fontSize: 13, color: 'var(--text4)' }}>
            You don't have permission to view this page.
          </div>
        </div>
      </div>
    )
  }
  return children
}
 
const PANELS = {
  dashboard: Dashboard,
  documents: DocumentsPanel,
  chat: ChatPanel,
  history: HistoryPanel,
  analytics: AnalyticsPanel,
  settings: SettingsPanel,
  admin: () => <AdminGuard><AdminUsersPanel /></AdminGuard>,  // ← fix
  logs: () => <AdminGuard><LogsPanel /></AdminGuard>,
}
 
export default function AppShell() {
  // const { activePanel, refModalOpen, uploadModalOpen } = useUIStore()
  const { activePanel, uploadModalOpen } = useUIStore()
  const ActivePanel = PANELS[activePanel] || Dashboard
 
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <ActivePanel />
        </main>
      </div>
      {/* {refModalOpen && <RefModal />} */}
      {uploadModalOpen && <UploadModal />}
    </div>
  )
}
 