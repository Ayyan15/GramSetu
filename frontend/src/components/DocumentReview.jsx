import { useEffect, useState } from 'react'
import { downloadDocument, getApplicationDocuments, updateDocumentVerification } from '../services/api'

export default function DocumentReview({ applicationId }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState('')

  async function loadDocuments() {
    try {
      const result = await getApplicationDocuments(applicationId)
      setDocuments(result.documents || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [applicationId])

  async function openDocument(document) {
    try {
      const blob = await downloadDocument(document.id)
      const url = URL.createObjectURL(blob)
      const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!openedWindow) {
        URL.revokeObjectURL(url)
        throw new Error('The document could not be opened. Please allow pop-ups and try again.')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function verify(document, status) {
    let reason = ''
    if (status === 'REJECTED') {
      reason = window.prompt('Reason for rejection:')?.trim() || ''
      if (!reason) {
        setError('A rejection reason is required.')
        return
      }
    }
    setUpdating(document.id)
    setError('')
    try {
      const result = await updateDocumentVerification(document.id, status, reason)
      setDocuments(previous => previous.map(item => item.id === document.id ? result.document : item))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdating('')
    }
  }

  if (loading) return <div className="mt-3 text-xs text-[#56677b]">Loading documents…</div>
  if (error && documents.length === 0) return <div className="mt-3 text-xs text-red-600">{error}</div>
  if (documents.length === 0) return <div className="mt-3 text-xs text-[#56677b]">No documents uploaded.</div>

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      <div className="space-y-2">
        {documents.map(document => (
          <div key={document.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-[#0b2945]">{document.document_type}</div>
              <div className="text-[#56677b]">{document.original_filename}</div>
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">{document.verification_status}</span>
              {document.rejection_reason && <div className="mt-1 text-red-600">Reason: {document.rejection_reason}</div>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openDocument(document)} className="rounded bg-gray-100 px-2 py-1 font-semibold text-[#0b2945]">View</button>
              {document.verification_status === 'PENDING' && (
                <>
                  <button type="button" onClick={() => verify(document, 'APPROVED')} disabled={updating === document.id} className="rounded bg-green-600 px-2 py-1 font-semibold text-white disabled:opacity-60">Approve</button>
                  <button type="button" onClick={() => verify(document, 'REJECTED')} disabled={updating === document.id} className="rounded bg-red-600 px-2 py-1 font-semibold text-white disabled:opacity-60">Reject</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
