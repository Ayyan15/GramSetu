import { useState } from 'react'

const roles = [
  'Citizen',
  'Panchayat Official',
  'Field Worker',
  'Admin',
]

export default function App() {
  const [role, setRole] = useState('Citizen')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  function handleLogin(event) {
    event.preventDefault()
    setMessage(
      `Login interface is ready for ${role}. Backend authentication will be connected next.`,
    )
  }

  return (
    <main className="login-page">
      {/* Left side: original illustration without duplicate branding */}
      <section
        className="village-panel"
        aria-label="GramSetu digital governance"
      >
        <img
          src="/gramsetu-village.png"
          alt="GramSetu village and Gram Panchayat"
          className="village-image"
        />
      </section>

      {/* Right side: login card */}
      <section className="login-panel">
        <div className="login-card">
          <header className="login-heading">
            <h1>
              Welcome to Gram<span>Setu</span>
            </h1>

            <p>
              Login to access Panchayat services and manage
              <br className="desktop-break" />
              your applications.
            </p>
          </header>

          <div className="role-tabs" role="tablist" aria-label="Account role">
            {roles.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={role === item}
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

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <span className="input-icon" aria-hidden="true">
                ✉
              </span>

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
              <span className="input-icon" aria-hidden="true">
                ♙
              </span>

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
                {showPassword ? '◉' : '◉̸'}
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
                    'Password recovery will be connected to the backend later.',
                  )
                }
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="login-button">
              Login <span aria-hidden="true">→</span>
            </button>
          </form>

          {message && (
            <p className="status-message" role="status">
              {message}
            </p>
          )}

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
            <span className="google-icon" aria-hidden="true">
              G
            </span>
            Login with Google
          </button>

          <p className="register-prompt">
            Don't have an account?
            <button
              type="button"
              className="text-button register-button"
              onClick={() =>
                setMessage('The registration page will be implemented next.')
              }
            >
              Register here
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}