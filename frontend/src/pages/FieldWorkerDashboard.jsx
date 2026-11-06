import { useState, useEffect } from 'react'
import { getMyProfile } from '../services/api'
import { getToken } from '../services/auth'

const API = 'http://localhost:5000'

const STATUS_BADGE = {
  OPEN:        'bg-yellow-100 text-yellow-800',
  ASSIGNED:    'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  RESOLVED:    'bg-green-100 text-green-800',
  CLOSED:      'bg-gray-100 text-gray-700',
}

export default function FieldWorkerDashboard({ user, onLogout }) {
  const [profile,    setProfile]    = useState(user)
  const [grievances, setGrievances] = useState([])
  const [loading,    setLoading]    = useState(true)
  const token = getToken()

  async function loadGrievances() {
    try {
      const r = await fetch(`${API}/api/grievances?assigned=me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) {
        const d = await r.json()
        setGrievances(d.grievances || [])
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    async function load() {
      try {
        const profRes = await getMyProfile()
        setProfile(profRes.user)
        await loadGrievances()
      } catch (e) {
        if (e.status === 401) onLogout()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function updateStatus(id, newStatus, note) {
    try {
      const r = await fetch(`${API}/api/grievances/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, resolution_note: note }),
      })
      if (r.ok) {
        await loadGrievances()
      } else {
        const d = await r.json()
        alert(d.message || 'Update failed')
      }
    } catch (e) { alert('Network error') }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#edf5f1]">
      <div className="text-[#087451] font-semibold text-lg animate-pulse">Loading dashboard…</div>
    </div>
  )

  const inProgress = grievances.filter(g => g.status === 'IN_PROGRESS').length
  const assigned   = grievances.filter(g => g.status === 'ASSIGNED').length
  const resolved   = grievances.filter(g => g.status === 'RESOLVED').length

  return (
    <div className="min-h-screen bg-[#edf5f1]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#6d4c41] flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.[0] || 'F'}
            </div>
            <div>
              <div className="text-sm font-bold text-[#0b2945]">{profile?.full_name || 'Field Worker'}</div>
              <div className="text-xs text-[#56677b]">किनी ग्रामपंचायत · Field Worker</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Assigned',    value: assigned,   icon: '📋', color: 'blue'   },
            { label: 'In Progress', value: inProgress, icon: '🔧', color: 'indigo' },
            { label: 'Resolved',    value: resolved,   icon: '✅', color: 'green'  },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-3xl font-bold text-[#0b2945]">{c.value}</div>
              <div className="text-xs text-[#56677b] mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Grievances list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold text-[#0b2945] mb-4">My Assigned Grievances</h2>
          {grievances.length === 0 ? (
            <div className="text-center py-10 text-[#56677b]">
              <div className="text-4xl mb-3">📋</div>
              <div className="font-medium">No grievances assigned to you yet.</div>
              <div className="text-sm mt-1">The Panchayat Official will assign tasks here.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {grievances.map(g => (
                <div key={g.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="font-semibold text-[#0b2945]">{g.title}</div>
                      <div className="text-sm text-[#56677b]">{g.category} · {new Date(g.submitted_at).toLocaleDateString('en-IN')}</div>
                      <div className="text-sm text-[#56677b] mt-1 leading-relaxed">{g.description}</div>
                      {g.location_text && (
                        <div className="text-xs text-blue-600 mt-1 font-medium">📍 {g.location_text}</div>
                      )}
                      {g.latitude && g.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${g.latitude},${g.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 underline"
                        >
                          View on Maps ({g.latitude}, {g.longitude})
                        </a>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${STATUS_BADGE[g.status]||'bg-gray-100 text-gray-700'}`}>{g.status}</span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100 flex-wrap">
                    {g.status === 'ASSIGNED' && (
                      <button onClick={() => updateStatus(g.id, 'IN_PROGRESS', 'Work started')}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                        🔧 Start Work
                      </button>
                    )}
                    {g.status === 'IN_PROGRESS' && (
                      <button onClick={() => {
                        const note = prompt('Resolution note (what was done):') || 'Issue resolved'
                        updateStatus(g.id, 'RESOLVED', note)
                      }}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                        ✅ Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
