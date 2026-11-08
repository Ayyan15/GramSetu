import { useCallback, useEffect, useState } from 'react'
import { getGrievances, getMyProfile, updateGrievanceStatus } from '../services/api'
import GrievanceAttachments from '../components/GrievanceAttachments'

const STATUS_BADGE = {
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  RESOLVED: 'bg-green-100 text-green-800',
}

export default function FieldWorkerDashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(user)
  const [grievances, setGrievances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [updating, setUpdating] = useState('')

  const loadGrievances = useCallback(async () => {
    try {
      const result = await getGrievances()
      setGrievances(result.grievances || [])
    } catch (requestError) {
      if (requestError.status === 401) onLogout()
      setError(requestError.message)
    }
  }, [onLogout])

  useEffect(() => {
    async function load() {
      try {
        const profileResult = await getMyProfile()
        setProfile(profileResult.user)
        await loadGrievances()
      } catch (requestError) {
        if (requestError.status === 401) onLogout()
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [loadGrievances, onLogout])

  async function updateStatus(id, status, resolutionNote) {
    if (updating) return
    setUpdating(id)
    setError('')
    setSuccess('')
    try {
      const payload = { status }
      if (resolutionNote) payload.resolution_note = resolutionNote
      await updateGrievanceStatus(id, payload)
      await loadGrievances()
      setSuccess(`Grievance ${status === 'IN_PROGRESS' ? 'started' : 'resolved'} successfully.`)
    } catch (requestError) {
      if (requestError.status === 401) onLogout()
      setError(requestError.message)
    } finally {
      setUpdating('')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#edf5f1]">
      <div className="text-[#087451] font-semibold text-lg animate-pulse">Loading dashboard…</div>
    </div>
  )

  const inProgress = grievances.filter(grievance => grievance.status === 'IN_PROGRESS').length
  const assigned = grievances.filter(grievance => grievance.status === 'ASSIGNED').length
  const resolved = grievances.filter(grievance => grievance.status === 'RESOLVED').length

  return (
    <div className="min-h-screen bg-[#edf5f1]">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#6d4c41] flex items-center justify-center text-white font-bold text-sm">{profile?.full_name?.[0] || 'F'}</div>
            <div><div className="text-sm font-bold text-[#0b2945]">{profile?.full_name || 'Field Worker'}</div><div className="text-xs text-[#56677b]">किनी ग्रामपंचायत · Field Worker</div></div>
          </div>
          <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[['Assigned', assigned, '📋'], ['In Progress', inProgress, '🔧'], ['Resolved', resolved, '✅']].map(([label, value, icon]) => (
            <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div className="text-2xl mb-1">{icon}</div><div className="text-3xl font-bold text-[#0b2945]">{value}</div><div className="text-xs text-[#56677b] mt-0.5">{label}</div></div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold text-[#0b2945] mb-4">My Assigned Grievances</h2>
          {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          {success && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">{success}</div>}
          {grievances.length === 0 ? <div className="text-center py-10 text-[#56677b]"><div className="text-4xl mb-3">📋</div><div className="font-medium">No grievances assigned to you yet.</div></div> : (
            <div className="space-y-4">
              {grievances.map(grievance => (
                <div key={grievance.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="font-semibold text-[#0b2945]">{grievance.title}</div>
                      <div className="text-sm text-[#56677b]">{grievance.category} · {grievance.priority || 'NORMAL'} · {new Date(grievance.submitted_at).toLocaleDateString('en-IN')}</div>
                      <div className="text-sm text-[#56677b] mt-1 leading-relaxed">{grievance.description}</div>
                      {grievance.location_text && <div className="text-xs text-blue-600 mt-1 font-medium">📍 {grievance.location_text}</div>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${STATUS_BADGE[grievance.status] || 'bg-gray-100 text-gray-700'}`}>{grievance.status}</span>
                  </div>
                  {grievance.status === 'ASSIGNED' && <button disabled={updating === grievance.id} onClick={() => updateStatus(grievance.id, 'IN_PROGRESS')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60">🔧 Start Work</button>}
                  {grievance.status === 'IN_PROGRESS' && <button disabled={updating === grievance.id} onClick={() => { const note = window.prompt('Resolution note (what was done):')?.trim() || ''; if (!note) { setError('A resolution note is required.'); return } updateStatus(grievance.id, 'RESOLVED', note) }} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-60">✅ Mark Resolved</button>}
                  <GrievanceAttachments grievanceId={grievance.id} onAuthError={onLogout} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
