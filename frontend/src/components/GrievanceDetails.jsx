const STATUS_BADGE = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  REJECTED: 'bg-red-100 text-red-800',
}

const TIMELINE = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

import GrievanceAttachments from './GrievanceAttachments'

export default function GrievanceDetails({ grievance, onClose, workerName, canUpload = false, onAuthError }) {
  const isRejected = grievance.status === 'REJECTED'
  const currentIndex = TIMELINE.indexOf(grievance.status)
  return (
    <div className="rounded-xl border border-gray-100 bg-[#f8fbf9] p-4 mt-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-[#0b2945]">Grievance details</h3>
        <button type="button" onClick={onClose} className="text-xs text-[#56677b] hover:text-[#087451]">Close</button>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><span className="text-xs text-[#56677b]">Description</span><p className="text-[#0b2945] whitespace-pre-wrap">{grievance.description}</p></div>
        <div><span className="text-xs text-[#56677b]">Current status</span><p><span className={`inline-block mt-1 rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE[grievance.status] || 'bg-gray-100 text-gray-700'}`}>{grievance.status}</span></p></div>
        <div><span className="text-xs text-[#56677b]">Priority</span><p className="text-[#0b2945]">{grievance.priority || 'NORMAL'}</p></div>
        <div><span className="text-xs text-[#56677b]">Citizen</span><p className="text-[#0b2945]">{grievance.citizen_name || '—'}</p></div>
        <div><span className="text-xs text-[#56677b]">Location</span><p className="text-[#0b2945]">{grievance.location_text || '—'}</p></div>
        <div><span className="text-xs text-[#56677b]">Assigned worker</span><p className="text-[#0b2945]">{workerName || grievance.assigned_to || 'Unassigned'}</p></div>
      </div>
      {grievance.latitude !== null && grievance.latitude !== undefined && grievance.longitude !== null && grievance.longitude !== undefined && (
        <a href={`https://www.google.com/maps?q=${grievance.latitude},${grievance.longitude}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-blue-600 underline">
          View coordinates on map ({grievance.latitude}, {grievance.longitude})
        </a>
      )}
      {!isRejected ? (
        <div className="mt-4">
          <div className="text-xs font-semibold text-[#56677b] mb-2">Status timeline</div>
          <div className="grid grid-cols-5 gap-1">
            {TIMELINE.map((status, index) => (
              <div key={status} className={`text-center text-[10px] ${index <= currentIndex ? 'text-[#087451]' : 'text-gray-400'}`}>
                <div className={`mx-auto mb-1 h-3 w-3 rounded-full ${index <= currentIndex ? 'bg-[#087451]' : 'bg-gray-300'}`} />
                {status.replace('_', ' ')}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Rejected:</strong> {grievance.resolution_note || 'No explanation provided.'}
        </div>
      )}
      {grievance.resolution_note && grievance.status !== 'REJECTED' && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <strong>Resolution details:</strong> {grievance.resolution_note}
        </div>
      )}
      <GrievanceAttachments grievanceId={grievance.id} canUpload={canUpload} onAuthError={onAuthError} />
    </div>
  )
}
