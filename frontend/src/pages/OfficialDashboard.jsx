import { useState, useEffect } from 'react'
import { getGrievances, getMyProfile, updateGrievanceStatus } from '../services/api'
import { getToken } from '../services/auth'
import DocumentReview from '../components/DocumentReview'
import GrievanceDetails from '../components/GrievanceDetails'
import GrievanceAssignment from '../components/GrievanceAssignment'
import NotificationCenter from '../components/NotificationCenter'

const API = 'http://localhost:5000'

async function fetchApplications(token) {
  const r = await fetch(`${API}/api/applications?limit=20`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return r.ok ? (await r.json()).applications || [] : []
}

async function fetchGrievances(token) {
  const r = await fetch(`${API}/api/grievances?limit=20`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return r.ok ? (await r.json()).grievances || [] : []
}

const STATUS_BADGE = {
  PENDING:            'bg-yellow-100 text-yellow-800',
  UNDER_REVIEW:       'bg-blue-100 text-blue-800',
  APPROVED:           'bg-green-100 text-green-800',
  REJECTED:           'bg-red-100 text-red-800',
  CORRECTIONS_NEEDED: 'bg-orange-100 text-orange-800',
  OPEN:               'bg-yellow-100 text-yellow-800',
  ASSIGNED:           'bg-blue-100 text-blue-800',
  IN_PROGRESS:        'bg-indigo-100 text-indigo-800',
  RESOLVED:           'bg-green-100 text-green-800',
  CLOSED:             'bg-gray-100 text-gray-700',
}

export default function OfficialDashboard({ user, onLogout }) {
  const [profile,      setProfile]      = useState(user)
  const [applications, setApplications] = useState([])
  const [grievances,   setGrievances]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState('home')
  const [documentApplicationId, setDocumentApplicationId] = useState('')
  const [grievanceFilters, setGrievanceFilters] = useState({ status: '', category: '', priority: '', search: '', limit: 20, offset: 0 })
  const [selectedGrievanceId, setSelectedGrievanceId] = useState('')
  const [grievanceLoading, setGrievanceLoading] = useState(false)
  const [grievanceError, setGrievanceError] = useState('')
  const [grievanceSuccess, setGrievanceSuccess] = useState('')
  const token = getToken()

  useEffect(() => {
    async function load() {
      try {
        const [profRes, apps, grvs] = await Promise.all([
          getMyProfile(),
          fetchApplications(token),
          getGrievances(grievanceFilters),
        ])
        setProfile(profRes.user)
        setApplications(apps)
        setGrievances(grvs.grievances || [])
      } catch (e) {
        if (e.status === 401) onLogout()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function refreshGrievances(filters = grievanceFilters) {
    setGrievanceLoading(true)
    setGrievanceError('')
    try {
      const result = await getGrievances(filters)
      setGrievances(result.grievances || [])
    } catch (requestError) {
      if (requestError.status === 401) onLogout()
      setGrievanceError(requestError.message)
    } finally {
      setGrievanceLoading(false)
    }
  }

  function updateGrievanceFilter(name, value) {
    const next = { ...grievanceFilters, [name]: value, offset: 0 }
    setGrievanceFilters(next)
    refreshGrievances(next)
  }

  async function changeGrievanceStatus(grievance, status) {
    let resolution_note = ''
    if (status === 'REJECTED' || status === 'IN_PROGRESS') {
      resolution_note = window.prompt(status === 'REJECTED' ? 'Reason for rejection:' : 'Reason for reopening:')?.trim() || ''
      if (!resolution_note) {
        setGrievanceError('An explanation is required.')
        return
      }
    }
    if (status === 'CLOSED' && !window.confirm('Confirm closure of this grievance?')) return
    setGrievanceError('')
    setGrievanceSuccess('')
    try {
      await updateGrievanceStatus(grievance.id, { status, resolution_note: resolution_note || undefined })
      setGrievanceSuccess(`Grievance ${status.toLowerCase()} successfully.`)
      await refreshGrievances()
    } catch (requestError) {
      if (requestError.status === 401) onLogout()
      setGrievanceError(requestError.message)
    }
  }

  async function updateApplicationStatus(id, status, remarks) {
    try {
      const r = await fetch(`${API}/api/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, remarks }),
      })
      if (r.ok) {
        const apps = await fetchApplications(token)
        setApplications(apps)
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

  const pending  = applications.filter(a => a.status === 'PENDING').length
  const openGrvs = grievances.filter(g => g.status === 'OPEN').length

  return (
    <div className="min-h-screen bg-[#edf5f1]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1a5276] flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.[0] || 'O'}
            </div>
            <div>
              <div className="text-sm font-bold text-[#0b2945]">{profile?.full_name || 'Official'}</div>
              <div className="text-xs text-[#56677b]">किनी ग्रामपंचायत · Panchayat Official</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter onAuthError={onLogout} onNavigate={(notification) => setView(notification.reference_type === 'grievance' ? 'grievances' : 'applications')} />
            <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {[['home','🏠 Dashboard'],['applications','📝 Applications'],['grievances','📢 Grievances']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                view===id ? 'border-[#087451] text-[#087451]' : 'border-transparent text-[#56677b] hover:text-[#087451]'
              }`}>{label}{id==='applications'&&pending>0?<span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pending}</span>:null}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* HOME */}
        {view === 'home' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Pending Applications', value: applications.filter(a=>a.status==='PENDING').length,       icon: '⏳', accent: 'yellow' },
                { label: 'Under Review',          value: applications.filter(a=>a.status==='UNDER_REVIEW').length, icon: '🔍', accent: 'blue'   },
                { label: 'Approved Today',         value: applications.filter(a=>a.status==='APPROVED').length,    icon: '✅', accent: 'green'  },
                { label: 'Open Grievances',        value: openGrvs,                                                icon: '📢', accent: 'red'    },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <div className="text-3xl font-bold text-[#0b2945]">{c.value}</div>
                  <div className="text-xs text-[#56677b] mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Recent applications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-bold text-[#0b2945] mb-3">Recent Applications</h2>
              {applications.length === 0 ? (
                <p className="text-sm text-[#56677b]">No applications yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      {['Citizen','Service','Submitted','Status','Action'].map(h=>(
                        <th key={h} className="text-left text-xs font-semibold text-[#56677b] pb-2 pr-4">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {applications.slice(0,8).map(a => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-4 font-medium text-[#0b2945]">{a.citizen_name || '—'}</td>
                          <td className="py-2 pr-4 text-[#56677b]">{a.service_name  || '—'}</td>
                          <td className="py-2 pr-4 text-[#56677b]">{new Date(a.submitted_at).toLocaleDateString('en-IN')}</td>
                          <td className="py-2 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[a.status]||'bg-gray-100 text-gray-700'}`}>{a.status}</span>
                          </td>
                          <td className="py-2">
                            {a.status === 'PENDING' && (
                              <div className="flex gap-1">
                                <button onClick={() => updateApplicationStatus(a.id,'UNDER_REVIEW','')} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200">Review</button>
                                <button onClick={() => updateApplicationStatus(a.id,'APPROVED','Approved by official')} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200">Approve</button>
                                <button onClick={() => updateApplicationStatus(a.id,'REJECTED','Rejected by official')} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* APPLICATIONS TAB */}
        {view === 'applications' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-[#0b2945] mb-4">All Applications</h2>
            {applications.length === 0 ? (
              <p className="text-sm text-[#56677b]">No applications in the system.</p>
            ) : (
              <div className="space-y-3">
                {applications.map(a => (
                  <div key={a.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold text-[#0b2945]">{a.service_name || '—'}</div>
                        <div className="text-sm text-[#56677b]">by {a.citizen_name || '—'} · {new Date(a.submitted_at).toLocaleDateString('en-IN')}</div>
                        {a.remarks && <div className="text-xs text-[#56677b] mt-1 italic">"{a.remarks}"</div>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_BADGE[a.status]||'bg-gray-100 text-gray-700'}`}>{a.status}</span>
                    </div>
                    {a.status === 'PENDING' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => updateApplicationStatus(a.id,'APPROVED','Approved')}      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">✓ Approve</button>
                        <button onClick={() => updateApplicationStatus(a.id,'REJECTED','Rejected')}      className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">✗ Reject</button>
                        <button onClick={() => updateApplicationStatus(a.id,'CORRECTIONS_NEEDED','Please resubmit with correct documents')} className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">⚠ Request Corrections</button>
                      </div>
                    )}
                    <button type="button" onClick={() => setDocumentApplicationId(documentApplicationId === a.id ? '' : a.id)} className="mt-2 text-xs text-[#087451] underline">
                      {documentApplicationId === a.id ? 'Hide documents' : 'View documents'}
                    </button>
                    {documentApplicationId === a.id && <DocumentReview applicationId={a.id} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GRIEVANCES TAB */}
        {view === 'grievances' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[#0b2945]">Citizen Grievances</h2>
                {grievanceLoading && <span className="text-xs text-[#56677b]">Loading…</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select value={grievanceFilters.status} onChange={event => updateGrievanceFilter('status', event.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs"><option value="">All statuses</option>{['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'].map(status => <option key={status}>{status}</option>)}</select>
                <select value={grievanceFilters.category} onChange={event => updateGrievanceFilter('category', event.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs"><option value="">All categories</option>{['road', 'water', 'electricity', 'sanitation', 'other'].map(category => <option key={category}>{category}</option>)}</select>
                <select value={grievanceFilters.priority} onChange={event => updateGrievanceFilter('priority', event.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs"><option value="">All priorities</option>{['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(priority => <option key={priority}>{priority}</option>)}</select>
                <input value={grievanceFilters.search} onChange={event => updateGrievanceFilter('search', event.target.value)} placeholder="Search grievances" className="rounded-lg border border-gray-300 px-2 py-2 text-xs" />
              </div>
              {grievanceError && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{grievanceError}</div>}
              {grievanceSuccess && <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">{grievanceSuccess}</div>}
            </div>
            {grievances.length === 0 ? (
              <p className="text-sm text-[#56677b]">No grievances submitted.</p>
            ) : (
              <div className="space-y-3">
                {grievances.map(g => (
                  <div key={g.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold text-[#0b2945]">{g.title}</div>
                        <div className="text-sm text-[#56677b]">{g.category} · {g.priority || 'NORMAL'} · {new Date(g.submitted_at).toLocaleDateString('en-IN')}</div>
                        <div className="text-sm text-[#56677b] mt-1 leading-relaxed">{g.description}</div>
                        {g.location_text && <div className="text-xs text-[#56677b] mt-1">📍 {g.location_text}</div>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_BADGE[g.status]||'bg-gray-100 text-gray-700'}`}>{g.status}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedGrievanceId(selectedGrievanceId === g.id ? '' : g.id)} className="mt-3 text-xs font-semibold text-[#087451] underline">{selectedGrievanceId === g.id ? 'Hide details' : 'View details'}</button>
                    {selectedGrievanceId === g.id && (
                      <>
                        <GrievanceDetails grievance={g} onClose={() => setSelectedGrievanceId('')} onAuthError={onLogout} />
                        {(g.status === 'OPEN' || g.status === 'ASSIGNED') && <GrievanceAssignment grievance={g} onAssigned={updated => { setGrievances(previous => previous.map(item => item.id === g.id ? { ...item, ...updated } : item)); setGrievanceSuccess('Assignment saved successfully.') }} onAuthError={onLogout} />}
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                          {g.status === 'OPEN' && <button type="button" onClick={() => changeGrievanceStatus(g, 'REJECTED')} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Reject</button>}
                          {g.status === 'RESOLVED' && <><button type="button" onClick={() => changeGrievanceStatus(g, 'CLOSED')} className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white">Close</button><button type="button" onClick={() => changeGrievanceStatus(g, 'IN_PROGRESS')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Reopen</button></>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
