import { useState } from 'react'

function initialValues(schema) {
  return schema.reduce((values, field) => ({ ...values, [field.key]: '' }), {})
}

function validateField(field, value) {
  const isEmpty = value === undefined || value === null || value === ''
  if (isEmpty) return field.required ? 'This field is required.' : ''

  const rules = field.validation || {}
  if (field.type === 'text' || field.type === 'textarea') {
    if (rules.minLength && value.trim().length < rules.minLength) return `Enter at least ${rules.minLength} characters.`
    if (rules.maxLength && value.trim().length > rules.maxLength) return `Use no more than ${rules.maxLength} characters.`
  }
  if (field.type === 'number') {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) return 'Enter a valid number.'
    if (rules.integer && !Number.isInteger(numberValue)) return 'Enter a whole number.'
    if (rules.min !== undefined && numberValue < rules.min) return `Value must be at least ${rules.min}.`
    if (rules.max !== undefined && numberValue > rules.max) return `Value must not exceed ${rules.max}.`
  }
  if (field.type === 'date' && rules.notFuture) {
    const today = new Date().toISOString().slice(0, 10)
    if (value > today) return 'Future dates are not allowed.'
  }
  if (field.type === 'select' && !field.options?.some(option => option.value === value)) {
    return 'Select one of the available options.'
  }
  return ''
}

export default function ApplicationForm({ service, onSubmit, onCancel, submitting, serverErrors = [] }) {
  const schema = Array.isArray(service?.form_schema) ? service.form_schema : []
  const [values, setValues] = useState(() => initialValues(schema))
  const [errors, setErrors] = useState({})
  const [remarks, setRemarks] = useState('')

  function updateValue(key, value) {
    setValues(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: '' }))
  }

  function validate() {
    const nextErrors = {}
    schema.forEach(field => {
      const error = validateField(field, values[field.key])
      if (error) nextErrors[field.key] = error
    })
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return

    const applicationData = {}
    schema.forEach(field => {
      const value = values[field.key]
      if (value !== '') {
        applicationData[field.key] = field.type === 'number' ? Number(value) : value.trim?.() || value
      }
    })
    onSubmit({ service_id: service.id, application_data: applicationData, remarks })
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#0b2945] focus:border-[#087451] focus:outline-none focus:ring-1 focus:ring-[#087451]'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#0b2945]">{service.name}</h2>
          {service.name_marathi && <div className="text-sm text-[#087451]">{service.name_marathi}</div>}
          <p className="text-xs text-[#56677b] mt-2">Please provide the requested information. These are draft application fields.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-sm text-[#56677b] hover:text-[#087451]">Cancel</button>
      </div>

      {serverErrors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-disc list-inside space-y-1">{serverErrors.map(error => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      <div className="space-y-4">
        {schema.length === 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            This service does not currently have an application form configured.
          </div>
        )}
        {schema.map(field => (
          <div key={field.key}>
            <label htmlFor={field.key} className="block text-sm font-semibold text-[#0b2945] mb-1">
              {field.label?.en || field.key}
              {field.label?.mr && <span className="ml-2 font-normal text-[#087451]">{field.label.mr}</span>}
              {field.required && <span className="ml-1 text-red-600">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea id={field.key} value={values[field.key]} onChange={event => updateValue(field.key, event.target.value)} className={inputClass} rows="3" />
            ) : field.type === 'select' ? (
              <select id={field.key} value={values[field.key]} onChange={event => updateValue(field.key, event.target.value)} className={inputClass}>
                <option value="">Select an option</option>
                {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label?.en || option.value} {option.label?.mr ? `— ${option.label.mr}` : ''}</option>)}
              </select>
            ) : (
              <input
                id={field.key}
                type={field.type}
                value={values[field.key]}
                onChange={event => updateValue(field.key, event.target.value)}
                min={field.type === 'number' ? field.validation?.min : undefined}
                max={field.type === 'number' ? field.validation?.max : field.validation?.notFuture ? new Date().toISOString().slice(0, 10) : undefined}
                step={field.type === 'number' && field.validation?.integer ? 1 : undefined}
                className={inputClass}
              />
            )}
            {errors[field.key] && <div className="mt-1 text-xs text-red-600">{errors[field.key]}</div>}
          </div>
        ))}
        <div>
          <label htmlFor="application-remarks" className="block text-sm font-semibold text-[#0b2945] mb-1">Additional remarks <span className="font-normal text-[#56677b]">(optional)</span></label>
          <textarea id="application-remarks" value={remarks} onChange={event => setRemarks(event.target.value)} className={inputClass} rows="3" maxLength="1000" />
        </div>
      </div>

      <button type="submit" disabled={submitting || schema.length === 0} className="w-full mt-5 py-2.5 px-4 bg-[#087451] hover:bg-[#065d41] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
        {submitting ? 'Submitting…' : 'Submit Application'}
      </button>
    </form>
  )
}
