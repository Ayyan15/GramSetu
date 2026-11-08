import { useState } from 'react'
import { createGrievance } from '../services/api'

const categories = [
  ['road', 'Road'],
  ['water', 'Water'],
  ['electricity', 'Electricity'],
  ['sanitation', 'Sanitation'],
  ['other', 'Other'],
]

const initialValues = {
  title: '',
  category: 'road',
  description: '',
  location_text: '',
  latitude: '',
  longitude: '',
}

export default function GrievanceForm({ onSuccess, onCancel, onAuthError }) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(name, value) {
    setValues(previous => ({ ...previous, [name]: value }))
    setErrors(previous => ({ ...previous, [name]: '' }))
    setError('')
  }

  function validate() {
    const next = {}
    if (!values.title.trim()) next.title = 'Title is required.'
    else if (values.title.trim().length > 300) next.title = 'Title must be 300 characters or fewer.'
    if (!values.description.trim()) next.description = 'Description is required.'
    else if (values.description.trim().length > 10000) next.description = 'Description must be 10,000 characters or fewer.'
    if (values.location_text.length > 1000) next.location_text = 'Location must be 1,000 characters or fewer.'
    if (values.latitude !== '') {
      const latitude = Number(values.latitude)
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) next.latitude = 'Latitude must be between -90 and 90.'
    }
    if (values.longitude !== '') {
      const longitude = Number(values.longitude)
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) next.longitude = 'Longitude must be between -180 and 180.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event) {
    event.preventDefault()
    if (!validate() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: values.title.trim(),
        category: values.category,
        description: values.description.trim(),
        location_text: values.location_text.trim() || undefined,
        latitude: values.latitude === '' ? undefined : Number(values.latitude),
        longitude: values.longitude === '' ? undefined : Number(values.longitude),
      }
      const result = await createGrievance(payload)
      onSuccess(result.grievance)
    } catch (requestError) {
      if (requestError.status === 401) onAuthError?.()
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#0b2945] focus:border-[#087451] focus:outline-none focus:ring-1 focus:ring-[#087451]'
  const fieldError = name => errors[name] && <div className="mt-1 text-xs text-red-600">{errors[name]}</div>

  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#0b2945]">Submit a Grievance</h2>
          <p className="text-xs text-[#56677b] mt-1">Tell the Panchayat about an issue in your area.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-sm text-[#56677b] hover:text-[#087451]">Cancel</button>
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        <div>
          <label htmlFor="grievance-title" className="block text-sm font-semibold text-[#0b2945] mb-1">Title <span className="text-red-600">*</span></label>
          <input id="grievance-title" maxLength="300" value={values.title} onChange={event => update('title', event.target.value)} className={inputClass} />
          {fieldError('title')}
          <div className="mt-1 text-right text-xs text-[#56677b]">{values.title.length}/300</div>
        </div>
        <div>
          <label htmlFor="grievance-category" className="block text-sm font-semibold text-[#0b2945] mb-1">Category <span className="text-red-600">*</span></label>
          <select id="grievance-category" value={values.category} onChange={event => update('category', event.target.value)} className={inputClass}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="grievance-description" className="block text-sm font-semibold text-[#0b2945] mb-1">Description <span className="text-red-600">*</span></label>
          <textarea id="grievance-description" maxLength="10000" rows="5" value={values.description} onChange={event => update('description', event.target.value)} className={inputClass} />
          {fieldError('description')}
          <div className="mt-1 text-right text-xs text-[#56677b]">{values.description.length}/10000</div>
        </div>
        <div>
          <label htmlFor="grievance-location" className="block text-sm font-semibold text-[#0b2945] mb-1">Location or address <span className="font-normal text-[#56677b]">(optional)</span></label>
          <input id="grievance-location" maxLength="1000" value={values.location_text} onChange={event => update('location_text', event.target.value)} className={inputClass} />
          {fieldError('location_text')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {['latitude', 'longitude'].map(name => (
            <div key={name}>
              <label htmlFor={`grievance-${name}`} className="block text-sm font-semibold text-[#0b2945] mb-1">{name[0].toUpperCase() + name.slice(1)} <span className="font-normal text-[#56677b]">(optional)</span></label>
              <input id={`grievance-${name}`} type="number" step="any" value={values[name]} onChange={event => update(name, event.target.value)} className={inputClass} />
              {fieldError(name)}
            </div>
          ))}
        </div>
      </div>
      <button type="submit" disabled={submitting} className="w-full mt-5 py-2.5 px-4 bg-[#087451] hover:bg-[#065d41] disabled:opacity-60 text-white text-sm font-semibold rounded-lg">
        {submitting ? 'Submitting…' : 'Submit Grievance'}
      </button>
    </form>
  )
}
