import { useState, useEffect } from 'react'
import { getApplications, getGrievances, getMyProfile, getServices, submitApplication } from '../services/api'
import ApplicationForm from '../components/ApplicationForm'
import DocumentUpload from '../components/DocumentUpload'
import GrievanceForm from '../components/GrievanceForm'
import GrievanceDetails from '../components/GrievanceDetails'
import NotificationCenter from '../components/NotificationCenter'

const CATEGORY_ICONS = {
  certificate: '📄',
  utility:     '⚡',
  welfare:     '🤝',
  other:       '📋',
}

export default function CitizenDashboard({ user, onLogout }) {
  const [profile,  setProfile]  = useState(user)
  const [services, setServices] = useState([])
  const [applications, setApplications] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [view,     setView]     = useState('home')
  const [selectedService, setSelectedService] = useState(null)
  const [applicationLoading, setApplicationLoading] = useState(false)
  const [applicationError, setApplicationError] = useState('')
  const [applicationSuccess, setApplicationSuccess] = useState('')
  const [grievances, setGrievances] = useState([])
  const [grievanceForm, setGrievanceForm] = useState(false)
  const [grievanceSuccess, setGrievanceSuccess] = useState('')
  const [grievanceError, setGrievanceError] = useState('')
  const [selectedGrievance, setSelectedGrievance] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [profRes, svcRes, appRes, grievanceRes] = await Promise.all([getMyProfile(), getServices(), getApplications(), getGrievances()])
        setProfile(profRes.user)
        setServices(svcRes.services || [])
        setApplications(appRes.applications || [])
        setGrievances(grievanceRes.grievances || [])
      } catch (e) {
        if (e.status === 401) { onLogout(); return }
        setError(e.message)
      } finally {
        setLoading(false)
      }

    }
    load()
  }, [onLogout])

  function handleGrievanceSuccess(grievance) {
    setGrievances(previous => [grievance, ...previous])
    setGrievanceForm(false)
    setGrievanceSuccess('Your grievance was submitted successfully.')
    setView('grievances')
  }

  async function handleApplicationSubmit(payload) {
    setApplicationLoading(true)
    setApplicationError('')
    setApplicationSuccess('')
    try {
      const result = await submitApplication(payload)
      const submittedApplication = {
        ...result.application,
        service_name: result.application.service?.name || selectedService.name,
        service_name_marathi: result.application.service?.name_marathi || selectedService.name_marathi,
      }
      setApplications(previous => [submittedApplication, ...previous])
      setSelectedService(null)
      setApplicationSuccess('Your application was submitted successfully.')
      setView('applications')
    } catch (e) {
      if (e.status === 401) { onLogout(); return }
      setApplicationError(e.data?.errors || [e.message])
    } finally {
      setApplicationLoading(false)
    }
  }

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
            <NotificationCenter onAuthError={onLogout} onNavigate={() => setView('applications')} />
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
          {[['home', '🏠 Home'], ['services', '📋 Services'], ['applications', '🔍 My Applications'], ['grievances', '📢 My Grievances']].map(([id, label]) => (
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
              { label: 'Applications',  value: applications.length, icon: '📝', color: 'blue'  },
              { label: 'Approved',      value: applications.filter(a => a.status === 'APPROVED').length, icon: '✅', color: 'green' },
                { label: 'Grievances',    value: grievances.length, icon: '📢', color: 'amber' },
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
                  { icon: '📢', label: 'Submit Grievance',      action: () => { setGrievanceForm(true); setGrievanceError(''); setGrievanceSuccess(''); setView('grievances') } },
                  { icon: '🔍', label: 'Track Application',     action: () => setView('applications') },
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

        {view === 'applications' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-[#0b2945] mb-4">My Applications</h2>
            {applicationSuccess && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{applicationSuccess}</div>}
            {applications.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#56677b]">You have not submitted any applications yet.</div>
            ) : (
              <div className="space-y-3">
                {applications.map(application => (
                  <div key={application.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#0b2945]">{application.service_name || 'Service application'}</div>
                        <div className="text-xs text-[#56677b] mt-1">Application ID: {application.id}</div>
                        <div className="text-xs text-[#56677b] mt-1">Submitted: {new Date(application.submitted_at).toLocaleDateString('en-IN')}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-blue-100 text-blue-800">{application.status}</span>
                    </div>
                    {application.remarks && <div className="text-sm text-[#56677b] mt-2">{application.remarks}</div>}
                    <DocumentUpload
                      application={application}
                      requiredDocs={application.required_docs || services.find(service => service.name === application.service_name)?.required_docs || []}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'grievances' && (
          <div>
            {grievanceForm ? (
              <GrievanceForm
                onSuccess={handleGrievanceSuccess}
                onCancel={() => setGrievanceForm(false)}
                onAuthError={onLogout}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0b2945]">My Grievances</h2>
                    <p className="text-xs text-[#56677b] mt-1">Track issues submitted to Kini Gram Panchayat.</p>
                  </div>
                  <button type="button" onClick={() => { setGrievanceForm(true); setGrievanceError(''); setGrievanceSuccess('') }} className="rounded-lg bg-[#087451] px-3 py-2 text-xs font-semibold text-white hover:bg-[#065d41]">Submit grievance</button>
                </div>
                {grievanceSuccess && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{grievanceSuccess}</div>}
                {grievanceError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{grievanceError}</div>}
                {grievances.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[#56677b]">You have not submitted any grievances yet.</div>
                ) : (
                  <div className="space-y-3">
                    {grievances.map(grievance => (
                      <div key={grievance.id} className="rounded-xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[#0b2945]">{grievance.title}</div>
                            <div className="mt-1 text-xs text-[#56677b]">{grievance.category} · {new Date(grievance.submitted_at).toLocaleDateString('en-IN')} · Priority: {grievance.priority || 'NORMAL'}</div>
                            {grievance.location_text && <div className="mt-1 text-xs text-[#56677b]">📍 {grievance.location_text}</div>}
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${grievance.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{grievance.status}</span>
                        </div>
                        <button type="button" onClick={() => setSelectedGrievance(selectedGrievance?.id === grievance.id ? null : grievance)} className="mt-3 text-xs font-semibold text-[#087451] underline">
                          {selectedGrievance?.id === grievance.id ? 'Hide details' : 'View details'}
                        </button>
                        {selectedGrievance?.id === grievance.id && <GrievanceDetails grievance={grievance} onClose={() => setSelectedGrievance(null)} canUpload={grievance.status !== 'CLOSED' && grievance.status !== 'REJECTED'} onAuthError={onLogout} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SERVICES VIEW */}
        {view === 'services' && (
          <div>
            {selectedService ? (
              <ApplicationForm
                service={selectedService}
                onSubmit={handleApplicationSubmit}
                onCancel={() => { setSelectedService(null); setApplicationError('') }}
                submitting={applicationLoading}
                serverErrors={applicationError}
              />
            ) : (
            <>
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
                      onClick={() => { setSelectedService(svc); setApplicationError(''); setApplicationSuccess('') }}
                      className="w-full mt-2 py-2 px-4 bg-[#087451] hover:bg-[#065d41] text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Apply Now
                    </button>
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
