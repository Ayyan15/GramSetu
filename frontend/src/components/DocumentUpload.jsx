import { useEffect, useState } from 'react'
import { getApplicationDocuments, uploadApplicationDocument } from '../services/api'

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png'

export default function DocumentUpload({ application, requiredDocs = [] }) {
  const [documents, setDocuments] = useState([])
  const [files, setFiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadDocuments() {
    try {
      const result = await getApplicationDocuments(application.id)
      setDocuments(result.documents || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [application.id])

  async function upload(documentType) {
    const file = files[documentType]
    if (!file) {
      setError(`Choose a file for ${documentType}.`)
      return
    }
    setUploading(documentType)
    setMessage('')
    setError('')
    try {
      const result = await uploadApplicationDocument(application.id, documentType, file)
      setDocuments(previous => [...previous, result.document])
      setFiles(previous => ({ ...previous, [documentType]: null }))
      setMessage(`${documentType} uploaded successfully.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading('')
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-bold text-[#0b2945] mb-2">Application Documents</h3>
      <p className="text-xs text-[#56677b] mb-3">PDF, JPG, JPEG or PNG only, maximum 5 MB per file.</p>
      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        Upload only the documents required for this service. Use masked identity documents where accepted; do not upload full Aadhaar numbers unless the Panchayat specifically requires them. Retention and deletion are subject to Panchayat policy.
      </p>
      {message && <div className="mb-3 rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700">{message}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</div>}
      {loading ? (
        <div className="text-xs text-[#56677b]">Loading documents…</div>
      ) : (
        <>
          {requiredDocs.length > 0 && (
            <div className="space-y-3">
              {requiredDocs.map(documentType => {
                const uploaded = documents.find(document => (
                  document.document_type.trim().toLowerCase() === documentType.trim().toLowerCase()
                    && document.verification_status !== 'REJECTED'
                ))
                const rejected = documents.find(document => (
                  document.document_type.trim().toLowerCase() === documentType.trim().toLowerCase()
                    && document.verification_status === 'REJECTED'
                ))
                return (
                  <div key={documentType} className="rounded-lg border border-gray-100 p-3">
                    <div className="text-xs font-semibold text-[#0b2945] mb-2">{documentType}</div>
                    {uploaded ? (
                      <div className="text-xs text-[#56677b]">
                        {uploaded.original_filename}
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">{uploaded.verification_status}</span>
                        {uploaded.rejection_reason && <div className="mt-1 text-red-600">Reason: {uploaded.rejection_reason}</div>}
                      </div>
                    ) : (
                      <div>
                        {rejected && (
                          <div className="mb-2 text-xs text-red-600">
                            Previous upload rejected{rejected.rejection_reason ? `: ${rejected.rejection_reason}` : '.'} You may upload a replacement.
                          </div>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input type="file" accept={ACCEPTED_TYPES} onChange={event => setFiles(previous => ({ ...previous, [documentType]: event.target.files?.[0] || null }))} className="min-w-0 text-xs" />
                          <button type="button" onClick={() => upload(documentType)} disabled={uploading === documentType} className="rounded-lg bg-[#087451] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#065d41] disabled:opacity-60">
                            {uploading === documentType ? 'Uploading…' : 'Upload'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {requiredDocs.length === 0 && <div className="text-xs text-[#56677b]">No required documents are configured.</div>}
        </>
      )}
    </div>
  )
}
