import { useState, useEffect } from 'react'
import { getMyProfile } from '../services/api'
import { getToken } from '../services/auth'

const API = 'http://localhost:5000'

export default function AdminDashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(user)
  const [stats,   setStats]   = useState(null)
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState('home')
  const token = getToken()

  useEffect(() => {
    async function load() {
      try {
        const profRes = await getMyProfile()
        setProfile(profRes.user)

        // Load stats
        const sr = await fetch(`${API}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (sr.ok) setStats((await sr.json()).stats)

        // Load users
        const ur = await fetch(`${API}/api/admin/users?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (ur.ok) setUsers((await ur.json()).users || [])

      } catch (e) {
        if (e.status === 401) onLogout()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleUserStatus(userId, currentStatus) {
    const newStatus = !currentStatus
    try {
      const r = await fetch(`${API}/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: newStatus }),
      })
      if (r.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u))
      } else {
        const d = await r.json()
        alert(d.message || 'Update failed')
      }
    } catch (e) { alert('Network error') }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#edf5f1]">
      <div className="text-[#087451] font-semibold text-lg animate-pulse">Loading admin panel…</div>
    </div>
  )

  const ROLE_BADGE = {
    CITIZEN:            'bg-green-100 text-green-800',
    PANCHAYAT_OFFICIAL: 'bg-blue-100 text-blue-800',
    FIELD_WORKER:       'bg-orange-100 text-orange-800',
    SYSTEM_ADMIN:       'bg-purple-100 text-purple-800',
  }

  return (
    <div className="min-h-screen bg-[#edf5f1]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#6a0572] flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.[0] || 'A'}
            </div>
            <div>
              <div className="text-sm font-bold text-[#0b2945]">{profile?.full_name || 'Administrator'}</div>
              <div className="text-xs text-[#56677b]">किनी ग्रामपंचायत · System Admin</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {[['home','📊 Overview'],['users','👥 Users']].map(([id,label]) => (
            <button key={id} onClick={() => setView(id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                view===id ? 'border-[#6a0572] text-[#6a0572]' : 'border-transparent text-[#56677b] hover:text-[#6a0572]'
              }`}>{label}</button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* OVERVIEW */}
        {view === 'home' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Users',        value: stats?.total_users        ?? '—', icon: '👥' },
                { label: 'Active Services',    value: stats?.total_services     ?? '—', icon: '📋' },
                { label: 'Total Applications', value: stats?.total_applications ?? '—', icon: '📝' },
                { label: 'Open Grievances',    value: stats?.open_grievances    ?? '—', icon: '📢' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <div className="text-3xl font-bold text-[#0b2945]">{c.value}</div>
                  <div className="text-xs text-[#56677b] mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Role breakdown */}
            {stats?.users_by_role && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
                <h2 className="text-base font-bold text-[#0b2945] mb-3">Users by Role</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stats.users_by_role.map(r => (
                    <div key={r.role} className="text-center p-3 rounded-lg border border-gray-100">
                      <div className="text-2xl font-bold text-[#0b2945]">{r.count}</div>
                      <div className={`text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block ${ROLE_BADGE[r.role]||'bg-gray-100 text-gray-700'}`}>{r.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-bold text-[#0b2945] mb-3">System Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Panchayat',  'Kini Gram Panchayat'],
                  ['District',   'Kolhapur, Maharashtra'],
                  ['Database',   'gramsetu_db (PostgreSQL)'],
                  ['Version',    'GramSetu v1.0 (MVP)'],
                ].map(([k,v]) => (
                  <div key={k}>
                    <div className="text-xs text-[#56677b] mb-0.5">{k}</div>
                    <div className="font-medium text-[#0b2945]">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* USERS TAB */}
        {view === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-[#0b2945] mb-4">Registered Users ({users.length})</h2>
            {users.length === 0 ? (
              <p className="text-sm text-[#56677b]">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    {['Name','Email/Mobile','Role','Status','Joined','Action'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-[#56677b] pb-2 pr-4">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-[#0b2945]">{u.full_name || '—'}</td>
                        <td className="py-2 pr-4 text-[#56677b] text-xs">{u.email || u.mobile || '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_BADGE[u.role]||'bg-gray-100 text-gray-700'}`}>{u.role}</span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-[#56677b]">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="py-2">
                          {u.id !== profile?.id && (
                            <button
                              onClick={() => toggleUserStatus(u.id, u.is_active)}
                              className={`text-xs px-2 py-1 rounded ${u.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
