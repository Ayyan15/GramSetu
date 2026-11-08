import { useEffect, useState } from 'react'
import { assignGrievance, getGrievanceWorkers } from '../services/api'

export default function GrievanceAssignment({ grievance, onAssigned, onAuthError }) {
  const [workers, setWorkers] = useState([])
  const [selected, setSelected] = useState(grievance.assigned_to || '')
  const [loading, setLoading] = useState(false)
  const [loadingWorkers, setLoadingWorkers] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getGrievanceWorkers()
      .then(result => setWorkers(result.workers || []))
      .catch(requestError => {
        if (requestError.status === 401) onAuthError?.()
        setError(requestError.message)
      })
      .finally(() => setLoadingWorkers(false))
  }, [onAuthError])

  async function submit(event) {
    event.preventDefault()
    if (!selected || loading) return
    setLoading(true)
    setError('')
    try {
      const result = await assignGrievance(grievance.id, selected)
      onAssigned(result.grievance)
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor={`worker-${grievance.id}`} className="block text-xs font-semibold text-[#56677b] mb-1">{grievance.assigned_to ? 'Reassign field worker' : 'Assign field worker'}</label>
        <select id={`worker-${grievance.id}`} value={selected} onChange={event => setSelected(event.target.value)} disabled={loadingWorkers || loading} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">{loadingWorkers ? 'Loading workers…' : 'Select a worker'}</option>
          {workers.map(worker => <option key={worker.id} value={worker.id}>{worker.display_name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={!selected || loading || loadingWorkers} className="rounded-lg bg-[#087451] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{loading ? 'Saving…' : 'Save assignment'}</button>
      {error && <div className="text-xs text-red-600 sm:absolute">{error}</div>}
    </form>
  )
}
