import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/api'

const ICONS = {
  APPLICATION_SUBMITTED: '📝',
  APPLICATION_STATUS_UPDATED: '✅',
  DOCUMENT_UPLOADED: '📎',
  DOCUMENT_VERIFIED: '📄',
  GRIEVANCE_SUBMITTED: '📢',
  GRIEVANCE_ASSIGNED: '👷',
  GRIEVANCE_REASSIGNED: '🔁',
  GRIEVANCE_STATUS_UPDATED: '🔔',
  GRIEVANCE_ATTACHMENT_UPLOADED: '📎',
}

function formatTime(value) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function NotificationCenter({ onAuthError, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef(null)

  const loadCount = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount()
      setCount(result.count || 0)
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
    }
  }, [onAuthError])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getNotifications({ limit: 20 })
      setNotifications(result.notifications || [])
      await loadCount()
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message || 'Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [loadCount, onAuthError])

  useEffect(() => {
    loadCount()
    const interval = window.setInterval(loadCount, 45000)
    return () => window.clearInterval(interval)
  }, [loadCount])

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  function toggle() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) loadNotifications()
  }

  async function markRead(notification) {
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id)
        setNotifications(previous => previous.map(item => (
          item.id === notification.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
        )))
        setCount(previous => Math.max(0, previous - 1))
      } catch (requestError) {
        if (requestError.status === 401) onAuthError?.()
        setError(requestError.message || 'Unable to update notification.')
        return
      }
    }
    if (notification.reference_type && notification.reference_id) onNavigate?.(notification)
  }

  async function markAllRead() {
    try {
      await markAllNotificationsAsRead()
      setNotifications(previous => previous.map(item => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() })))
      setCount(0)
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message || 'Unable to update notifications.')
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-[#087451] hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-[#087451]"
      >
        <span aria-hidden="true" className="text-xl">🔔</span>
        {count > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <section className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="font-bold text-[#0b2945]">Notifications</h2>
            <button type="button" onClick={markAllRead} disabled={!count} className="text-xs font-semibold text-[#087451] disabled:text-gray-400">Mark all read</button>
          </div>
          {error && <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}
          {loading ? <div className="p-6 text-center text-sm text-[#56677b]">Loading notifications…</div> : notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#56677b]">You have no notifications.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notification => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => markRead(notification)}
                  className={`flex w-full gap-3 border-b border-gray-100 p-3 text-left hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#087451] ${notification.is_read ? 'bg-white' : 'bg-green-50/60'}`}
                >
                  <span className="text-lg" aria-hidden="true">{ICONS[notification.notification_type] || '🔔'}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#0b2945]">{notification.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-[#56677b]">{notification.message}</span>
                    <span className="mt-1 block text-[10px] text-gray-400">{formatTime(notification.created_at)}</span>
                  </span>
                  {!notification.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#087451]" aria-label="Unread" />}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
