import { useEffect, useState } from 'react'
import {
  downloadGrievanceAttachment,
  getGrievanceAttachments,
  uploadGrievanceAttachment,
} from '../services/api'

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.webp,.pdf'
const MAX_FILE_SIZE = 5 * 1024 * 1024

export default function GrievanceAttachments({ grievanceId, canUpload = false, onAuthError }) {
  const [attachments, setAttachments] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadAttachments() {
    try {
      const result = await getGrievanceAttachments(grievanceId)
      setAttachments(result.attachments || [])
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttachments()
  }, [grievanceId])

  function chooseFile(event) {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setMessage('')
    setError('')
    if (file && file.size > MAX_FILE_SIZE) {
      setError('Attachment must not exceed 5 MB.')
      setSelectedFile(null)
    }
  }

  async function upload() {
    if (!selectedFile || uploading) return
    setUploading(true)
    setMessage('')
    setError('')
    try {
      const result = await uploadGrievanceAttachment(grievanceId, selectedFile)
      setAttachments(previous => [...previous, result.attachment])
      setSelectedFile(null)
      setMessage('Evidence uploaded successfully.')
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  async function download(attachment) {
    if (downloading) return
    setDownloading(attachment.id)
    setError('')
    try {
      const blob = await downloadGrievanceAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.original_filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message)
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[#0b2945]">Evidence and attachments</h4>
        <span className="text-xs text-[#56677b]">{attachments.length}/5</span>
      </div>
      <p className="mt-1 text-xs text-[#56677b]">JPEG, PNG, WEBP or PDF, maximum 5 MB per file.</p>
      {message && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">{message}</div>}
      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      {loading ? <div className="mt-3 text-xs text-[#56677b]">Loading evidence…</div> : (
        <>
          {attachments.length === 0 ? (
            <div className="mt-3 text-xs text-[#56677b]">No evidence uploaded.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {attachments.map(attachment => (
                <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-[#0b2945]">{attachment.original_filename}</div>
                    <div className="text-[11px] text-[#56677b]">{Math.ceil(attachment.file_size / 1024)} KB · {attachment.mime_type}</div>
                  </div>
                  <button type="button" onClick={() => download(attachment)} disabled={downloading === attachment.id} className="shrink-0 rounded-lg border border-[#087451] px-2 py-1 text-xs font-semibold text-[#087451] disabled:opacity-60">
                    {downloading === attachment.id ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {canUpload && attachments.length < 5 && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="file" accept={ACCEPTED_TYPES} onChange={chooseFile} disabled={uploading} className="min-w-0 text-xs" />
              <button type="button" onClick={upload} disabled={!selectedFile || uploading} className="rounded-lg bg-[#087451] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#065d41] disabled:opacity-60">
                {uploading ? 'Uploading…' : 'Upload evidence'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
