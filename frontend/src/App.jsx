import { useState } from 'react'
import { registerCitizen, loginUser } from './services/api'
import { saveAuth, loadAuth, clearAuth } from './services/auth'
import CitizenDashboard     from './pages/CitizenDashboard'
import OfficialDashboard    from './pages/OfficialDashboard'
import FieldWorkerDashboard from './pages/FieldWorkerDashboard'
import AdminDashboard       from './pages/AdminDashboard'

const roles = [
  'Citizen',
  'Panchayat Official',
  'Field Worker',
  'Admin',
]

export default function App() {
  // ── Persisted auth state (restored from localStorage on mount) ───────────
  const saved = loadAuth()
  const [currentUser, setCurrentUser] = useState(saved.user)
  const [authToken,   setAuthToken]   = useState(saved.token)

  // ── Login / register form state ─────────────────────────────────────────
  const [isRegistering, setIsRegistering] = useState(false)
  const [role, setRole] = useState('Citizen')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'success' | 'error'
  const [isLoading, setIsLoading] = useState(false)

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    clearAuth()
    setCurrentUser(null)
    setAuthToken(null)
    setEmail('')
    setPassword('')
    setMessage('')
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin(event) {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')
    setMessageType('')

    try {
      const result = await loginUser(email, password)
      saveAuth(result.token, result.user)
      setCurrentUser(result.user)
      setAuthToken(result.token)
      // Clear sensitive form fields
      setPassword('')
    } catch (err) {
      setMessage(err.message || 'Login failed. Please check your credentials.')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRegister(event) {
    event.preventDefault()

    // Client-side pre-checks before hitting the network
    if (password !== confirmPassword) {
      setMessage('Passwords do not match. Please try again.')
      setMessageType('error')
      return
    }

    if (!acceptedTerms) {
      setMessage('Please accept the Terms and Conditions to register.')
      setMessageType('error')
      return
    }

    setIsLoading(true)
    setMessage('')
    setMessageType('')

    try {
      const result = await registerCitizen({
        full_name:        fullName,
        email:            email || undefined,
        mobile:           mobile || undefined,
        password,
        confirm_password: confirmPassword,
      })

      setMessage(result.message || 'Registration successful! You can now log in.')
      setMessageType('success')

      // Clear sensitive fields on success
      setPassword('')
      setConfirmPassword('')
      setAcceptedTerms(false)

    } catch (err) {
      setMessage(err.message || 'Registration failed. Please try again.')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  function switchMode(registering) {
    setIsRegistering(registering)
    setMessage('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  // ── Post-login: render role-appropriate dashboard ───────────────────────
  if (currentUser && authToken) {
    const props = { user: currentUser, token: authToken, onLogout: handleLogout }
    if (currentUser.role === 'PANCHAYAT_OFFICIAL') return <OfficialDashboard {...props} />
    if (currentUser.role === 'FIELD_WORKER')       return <FieldWorkerDashboard {...props} />
    if (currentUser.role === 'SYSTEM_ADMIN')       return <AdminDashboard {...props} />
    return <CitizenDashboard {...props} />
  }

  return (
    <main className="login-page">
      <section
        className="village-panel"
        aria-label="GramSetu digital governance"
      >
        <img
          src="/gramsetu-village.png"
          alt="GramSetu village illustration"
          className="village-image"
        />
      </section>

      <section className="login-panel">
        <div className={`login-card ${isRegistering ? 'register-card' : ''}`}>
          <header className="login-heading">
            <h1>
              {isRegistering ? 'Create your Gram' : 'Welcome to Gram'}
              <span>Setu</span>
            </h1>

            <p>
              {isRegistering
                ? 'Register to access your Gram Panchayat services.'
                : 'Login to access Panchayat services and manage your applications.'}
            </p>
          </header>

          <div className="role-tabs" aria-label="Account role">
            {roles.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={role === item}
                className={`role-tab ${role === item ? 'active' : ''}`}
                onClick={() => {
                  setRole(item)
                  setMessage('')
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {isRegistering ? (
            <form onSubmit={handleRegister}>
              <div className="input-group">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  type="text"
                  name="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Full Name"
                  aria-label="Full Name"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="input-group">
                <span className="input-icon" aria-hidden="true">✉</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email Address"
                  aria-label="Email Address"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="input-group">
                <span className="input-icon" aria-hidden="true">☎</span>
                <input
                  type="tel"
                  name="mobile"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="Mobile Number"
                  aria-label="Mobile Number"
                  autoComplete="tel"
                  pattern="[0-9]{10}"
                  title="Enter a 10-digit mobile number"
                  maxLength={10}
                  required
                />
              </div>

              <div className="input-group">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create Password (minimum 8 characters)"
                  aria-label="Create Password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="input-group">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm Password"
                  aria-label="Confirm Password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <label className="remember-option terms-option">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  I agree to the Terms and Conditions.
                </span>
              </label>

              {message && (
                <p
                  className={`status-message ${messageType === 'success' ? 'status-success' : messageType === 'error' ? 'status-error' : ''}`}
                  role="status"
                >
                  {message}
                </p>
              )}

              <button type="submit" className="login-button" disabled={isLoading}>
                {isLoading ? 'Creating Account…' : <>Create Account <span aria-hidden="true">→</span></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <span className="input-icon" aria-hidden="true">✉</span>
                <input
                  type="text"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email ID or Mobile Number"
                  aria-label="Email ID or Mobile Number"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="input-group">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="login-options">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setMessage(
                      'Password recovery will be implemented with backend authentication.',
                    )
                  }
                >
                  Forgot Password?
                </button>
              </div>

              {message && (
                <p
                  className={`status-message ${messageType === 'success' ? 'status-success' : messageType === 'error' ? 'status-error' : ''}`}
                  role="status"
                >
                  {message}
                </p>
              )}

              <button type="submit" className="login-button" disabled={isLoading}>
                {isLoading ? 'Logging in…' : <>Login <span aria-hidden="true">→</span></>}
              </button>

              <div className="divider">
                <span />
                <p>OR</p>
                <span />
              </div>

              <button
                type="button"
                className="google-button"
                onClick={() =>
                  setMessage('Google authentication will be configured later.')
                }
              >
                <span className="google-icon" aria-hidden="true">G</span>
                Login with Google
              </button>
            </form>
          )}

          <p className="register-prompt">
            {isRegistering
              ? 'Already have an account?'
              : "Don't have an account?"}

            <button
              type="button"
              className="text-button register-button"
              onClick={() => switchMode(!isRegistering)}
            >
              {isRegistering ? 'Login here' : 'Register here'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}