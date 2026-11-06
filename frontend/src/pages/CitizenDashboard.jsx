import { useState, useEffect } from 'react'
import { getMyProfile, getServices } from '../services/api'

const CATEGORY_ICONS = {
  certificate: '📄',
  utility:     '⚡',
  welfare:     '🤝',
  other:       '📋',
}

export default function CitizenDashboard({ user, token, onLogout }) {
  const [profile,  setProfile]  = useState(user)
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [view,     setView]     = useState('home') // 'home' | 'services'

  useEffect(() => {
    async function load() {
      try {
        const [profRes, svcRes] = await Promise.all([getMyProfile(), getServices()])
        setProfile(profRes.user)
        setServices(svcRes.services || [])
      } catch (e) {
        if (e.status === 401) { onLogout(); return }
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'सुप्रभात'   // Good morning
    if (h < 17) return 'नमस्कार'    // Hello
    return 'शुभ संध्या'              // Good evening
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#edf5f1]">
      <div className="text-[#087451] font-semibold text-lg animate-pulse">Loading your dashboard…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#edf5f1]">
      {/* Top navigation bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#087451] flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.[0] || 'C'}
            </div>
            <div>
              <div className="text-sm font-bold text-[#0b2945]">
                {greeting()}, {profile?.full_name || 'Citizen'}
              </div>
              <div className="text-xs text-[#56677b]">किनी ग्रामपंचायत · Citizen</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-[#56677b] bg-green-50 px-2 py-1 rounded-full border border-green-200">
              🏡 Kini Gram Panchayat
            </span>
            <button
              onClick={onLogout}
              className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {[['home', '🏠 Home'], ['services', '📋 Services']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                view === id
                  ? 'border-[#087451] text-[#087451]'
                  : 'border-transparent text-[#56677b] hover:text-[#087451]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* HOME VIEW */}
        {view === 'home' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Applications',  value: '—', icon: '📝', color: 'blue'  },
                { label: 'Approved',      value: '—', icon: '✅', color: 'green' },
                { label: 'Grievances',    value: '—', icon: '📢', color: 'amber' },
                { label: 'Pending Docs',  value: '—', icon: '📌', color: 'red'   },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <div className="text-2xl font-bold text-[#0b2945]">{c.value}</div>
                  <div className="text-xs text-[#56677b] mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="text-base font-bold text-[#0b2945] mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: '📄', label: 'Apply for Certificate', action: () => setView('services') },
                  { icon: '📢', label: 'Submit Grievance',      action: () => alert('Grievance module — coming soon') },
                  { icon: '🔍', label: 'Track Application',     action: () => alert('Application tracking — coming soon') },
                  { icon: '👤', label: 'My Profile',            action: () => alert('Profile management — coming soon') },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#087451] hover:bg-green-50 transition-all group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{a.icon}</span>
                    <span className="text-xs font-semibold text-[#56677b] group-hover:text-[#087451] text-center leading-tight">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Profile card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-bold text-[#0b2945] mb-3">Account Information</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                {[
                  ['Full Name',    profile?.full_name  || '—'],
                  ['Email',        profile?.email      || '—'],
                  ['Mobile',       profile?.mobile     || '—'],
                  ['Role',         profile?.role       || '—'],
                  ['Panchayat',    profile?.panchayat  || 'Kini Gram Panchayat'],
                  ['Member Since', profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN') : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-[#56677b] mb-0.5">{k}</div>
                    <div className="font-medium text-[#0b2945] break-all">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* SERVICES VIEW */}
        {view === 'services' && (
          <div>
            <h2 className="text-lg font-bold text-[#0b2945] mb-4">
              Available Services — किनी ग्रामपंचायत
            </h2>
            {services.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-[#56677b]">No services found.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {services.map(svc => (
                  <div key={svc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{CATEGORY_ICONS[svc.category] || '📋'}</span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#0b2945] leading-tight">{svc.name}</h3>
                        {svc.name_marathi && (
                          <div className="text-sm text-[#087451] mt-0.5">{svc.name_marathi}</div>
                        )}
                      </div>
                    </div>
                    {svc.description && (
                      <p className="text-sm text-[#56677b] mb-3 leading-relaxed">{svc.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-[#56677b] mb-3">
                      <span>⏱ {svc.processing_days} days</span>
                      <span>💰 {svc.fee_amount > 0 ? `₹${svc.fee_amount}` : 'Free'}</span>
                    </div>
                    {svc.required_docs?.length > 0 && (
                      <div className="text-xs text-[#56677b] mb-3">
                        <div className="font-semibold mb-1">Required Documents:</div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {svc.required_docs.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => alert(`Application form for "${svc.name}" — coming soon in next milestone`)}
                      className="w-full mt-2 py-2 px-4 bg-[#087451] hover:bg-[#065d41] text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Apply Now
                    </button>
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
