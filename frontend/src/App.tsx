import { useEffect, useMemo, useState } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'
import MapView from './mapview'
import {
  acceptRide,
  createRide,
  estimateFare,
  health,
  login,
  myRides,
  openRides,
  register,
  verifyOTP,
  type Ride,
  type Role,
} from './api'

/* ─── Icons ─────────────────────────────────────────────────────── */
const BikeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6h-5l-3 8h10l-2-8z"/><path d="M12 6V3"/><path d="M5.5 14l4-8"/>
  </svg>
)
const AutoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 6v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
)
const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)
const LocationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
)

/* ─── Kallakurichi popular locations with coordinates ───────────── */
const KK_LOCATIONS: Record<string, [number, number]> = {
  'Kallakurichi Bus Stand':   [11.7393, 79.0066],
  'Kallakurichi Market':      [11.7380, 79.0050],
  'Government Hospital':      [11.7410, 79.0080],
  'Kallakurichi Railway':     [11.7350, 79.0020],
  'Sankarapuram':             [11.7550, 78.9800],
  'Ulundurpet':               [11.6700, 79.3200],
  'Chinnasalem':              [11.5700, 78.8600],
  'Tirukoilur':               [11.9600, 79.1900],
  'Vridhachalam':             [11.5200, 79.3100],
  'Rishivandiyam':            [11.7900, 78.9400],
  'Kallakurichi Collectorate':[11.7420, 79.0090],
  'TNEB Office':              [11.7360, 79.0040],
  'Kallakurichi Court':       [11.7400, 79.0070],
  'Anna Nagar Kallakurichi':  [11.7430, 79.0100],
  'Thiyagadurgam':            [11.8200, 79.0700],
}

type Screen = 'home' | 'book' | 'driver' | 'rides' | 'help' | 'auth'

function getCoords(location: string): [number, number] | undefined {
  if (KK_LOCATIONS[location]) return KK_LOCATIONS[location]
  for (const [key, coords] of Object.entries(KK_LOCATIONS)) {
    if (key.toLowerCase().includes(location.toLowerCase()) ||
        location.toLowerCase().includes(key.toLowerCase())) {
      return coords
    }
  }
  return undefined
}

export default function App() {
  const supportPhone = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined) ?? '9876543210'
  const supportWhatsapp = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? '9876543210'

  const [screen, setScreen] = useState<Screen>('home')
  const [role, setRole] = useState<Role | null>(null)
  const [authedPhone, setAuthedPhone] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [backend, setBackend] = useState<{ ok: boolean; db: string } | null>(null)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [regRole, setRegRole] = useState<'passenger' | 'driver'>('passenger')
  const [pickup, setPickup] = useState('')
  const [drop, setDrop] = useState('')
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto'>('bike')
  const [km, setKm] = useState<number>(3)
  const [fareTotal, setFareTotal] = useState<number | null>(null)
  const [rides, setRides] = useState<Ride[]>([])
  const [open, setOpen] = useState<Ride[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState<'pickup' | 'drop' | null>(null)
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
  const [otpLoading, setOtpLoading] = useState<Record<string, boolean>>({})

  const token = useMemo(() => localStorage.getItem('tn15_token'), [])

  const pickupCoords = getCoords(pickup)
  const dropCoords = getCoords(drop)

  useEffect(() => {
    health().then(setBackend).catch(() => setBackend({ ok: false, db: 'down' }))
    const stored = localStorage.getItem('tn15_role') as Role | null
    if (stored) {
      setRole(stored)
      setAuthedPhone(localStorage.getItem('tn15_phone'))
    }
  }, [])

  useEffect(() => {
    if (!token) return
    myRides().then((r) => setRides(r.rides)).catch(() => {})
  }, [token])

  async function refresh() {
    const storedRole = (localStorage.getItem('tn15_role') as Role | null) ?? null
    setRole(storedRole)
    setAuthedPhone(localStorage.getItem('tn15_phone'))
    if (!localStorage.getItem('tn15_token')) return
    try { const r = await myRides(); setRides(r.rides) } catch {}
    if (storedRole === 'driver') {
      try { const o = await openRides(); setOpen(o.rides) } catch {}
    }
  }

  async function doAuth() {
    setLoading(true); setStatus('')
    try {
      if (authMode === 'register') {
        if (regRole === 'driver') {
          await register({ phone, password, role: 'driver', name: 'Driver', vehicleType, vehicleNumber: '' })
        } else {
          await register({ phone, password, role: 'passenger' })
        }
        setStatus('Registered! Please login.')
        setAuthMode('login')
      } else {
        const r = await login({ phone, password })
        localStorage.setItem('tn15_token', r.token)
        localStorage.setItem('tn15_role', r.role)
        localStorage.setItem('tn15_phone', phone)
        setRole(r.role)
        setAuthedPhone(phone)
        setScreen('home')
        await refresh()
      }
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Error occurred')
    }
    setLoading(false)
  }

  async function logout() {
    localStorage.clear()
    setRole(null); setAuthedPhone(null)
    setRides([]); setOpen([])
    setScreen('home')
  }

  async function calcFare() {
    setFareTotal(null)
    const r = await estimateFare({ vehicleType, km })
    setFareTotal(r.estimate.total)
  }

  async function bookRide() {
    if (!pickup || !drop) { setStatus('Enter pickup and drop'); return }
    setLoading(true); setStatus('')
    try {
      const r = await createRide({ pickup, drop, vehicleType, km })
      setStatus(`Ride booked! ID: ${r.ride.id.slice(0,8)}…`)
      setPickup(''); setDrop('')
      await refresh()
      setScreen('rides')
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Booking failed')
    }
    setLoading(false)
  }

  async function accept(rideId: string) {
    setLoading(true)
    try {
      await acceptRide(rideId)
      setStatus('Ride accepted!')
      await refresh()
    } catch {}
    setLoading(false)
  }

  async function handleVerifyOTP(rideId: string) {
    const otp = otpInputs[rideId]
    if (!otp || otp.length !== 4) { setStatus('Enter 4 digit OTP'); return }
    setOtpLoading(prev => ({ ...prev, [rideId]: true }))
    try {
      const r = await verifyOTP(rideId, otp)
      if (r.ok) {
        setStatus('OTP verified! Ride started! 🎉')
        await refresh()
      }
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Invalid OTP')
    }
    setOtpLoading(prev => ({ ...prev, [rideId]: false }))
  }

  const statusColor = (s: string) => {
    if (s === 'pending' || s === 'requested') return '#FFB800'
    if (s === 'accepted') return '#00D97E'
    if (s === 'completed') return '#6C8EFF'
    return '#888'
  }

  const filteredLocations = (query: string) =>
    Object.keys(KK_LOCATIONS).filter(l =>
      l.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 6)

  return (
    <div className="app">
      {status && <div className="toast" onClick={() => setStatus('')}>{status}</div>}

      {/* Header */}
      <header className="hdr">
        <div className="hdr-brand">
          <span className="hdr-logo">TN<span className="hdr-num">15</span></span>
          <span className="hdr-tag">Kallakurichi</span>
        </div>
        <div className="hdr-right">
          <span className={`dot ${backend?.ok ? 'dot-on' : 'dot-off'}`} />
          {role ? (
            <button className="btn-ghost sm" onClick={logout}>Logout</button>
          ) : (
            <button className="btn-accent sm" onClick={() => setScreen('auth')}>Login</button>
          )}
        </div>
      </header>

      {/* Auth Screen */}
      {screen === 'auth' && (
        <div className="screen fade-in">
          <div className="auth-card">
            <div className="auth-title">{authMode === 'login' ? 'Welcome back' : 'Create account'}</div>
            <div className="seg-row">
              <button className={`seg ${authMode === 'login' ? 'seg-on' : ''}`} onClick={() => setAuthMode('login')}>Login</button>
              <button className={`seg ${authMode === 'register' ? 'seg-on' : ''}`} onClick={() => setAuthMode('register')}>Register</button>
            </div>
            {authMode === 'register' && (
              <div className="seg-row">
                <button className={`seg ${regRole === 'passenger' ? 'seg-on' : ''}`} onClick={() => setRegRole('passenger')}>Passenger</button>
                <button className={`seg ${regRole === 'driver' ? 'seg-on' : ''}`} onClick={() => setRegRole('driver')}>Driver</button>
              </div>
            )}
            <input className="inp" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
            <input className="inp" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button className="btn-primary full" onClick={doAuth} disabled={loading}>
              {loading ? 'Please wait…' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
            <button className="btn-ghost full" onClick={() => setScreen('home')}>← Back</button>
          </div>
        </div>
      )}

      {/* Home Screen */}
      {screen === 'home' && (
        <div className="screen fade-in">
          <div className="hero">
            <div className="hero-city">Kallakurichi District</div>
            <div className="hero-title">Where to?</div>
            {role && <div className="hero-sub">Hello, <b>{authedPhone}</b> · {role}</div>}
          </div>

          <div style={{ padding: '0 20px 16px' }}>
            <MapView pickup="Kallakurichi Bus Stand" drop="" pickupCoords={[11.7393, 79.0066]} />
          </div>

          <div className="quick-bar">
            <span className="qb-dot green" />
            <input className="qb-inp" placeholder="Enter destination in Kallakurichi…"
              value={drop} onChange={e => setDrop(e.target.value)}
              onFocus={() => role ? setScreen('book') : setScreen('auth')}
            />
            <button className="btn-accent" onClick={() => role ? setScreen('book') : setScreen('auth')}>Go</button>
          </div>

          <div className="vh-row">
            <button className={`vh-card ${vehicleType === 'bike' ? 'vh-on' : ''}`} onClick={() => setVehicleType('bike')}>
              <BikeIcon /><div className="vh-name">Bike</div><div className="vh-eta">2 min</div>
            </button>
            <button className={`vh-card ${vehicleType === 'auto' ? 'vh-on' : ''}`} onClick={() => setVehicleType('auto')}>
              <AutoIcon /><div className="vh-name">Auto</div><div className="vh-eta">4 min</div>
            </button>
          </div>

          {rides.length > 0 && (
            <div className="section">
              <div className="sec-title">Recent rides</div>
              {rides.slice(0,2).map(r => (
                <div key={r.id} className="ride-row" onClick={() => setScreen('rides')}>
                  <div className="ride-icon">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</div>
                  <div className="ride-info">
                    <div className="ride-route">{r.pickup} → {r.drop}</div>
                    <div className="ride-meta">{new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="ride-badge" style={{ background: statusColor(r.status) + '22', color: statusColor(r.status) }}>{r.status}</div>
                </div>
              ))}
            </div>
          )}

          <button className="help-strip" onClick={() => setScreen('help')}>
            <PhoneIcon /> Book via Call or WhatsApp
          </button>
        </div>
      )}

      {/* Book Screen */}
      {screen === 'book' && (
        <div className="screen fade-in">
          <button className="back-btn" onClick={() => setScreen('home')}>← Back</button>
          <div className="book-card">
            <div className="route-inputs">
              <div className="ri-row" style={{ position: 'relative' }}>
                <span className="ri-dot green" />
                <input className="ri-inp" placeholder="Pickup location in Kallakurichi"
                  value={pickup}
                  onChange={e => { setPickup(e.target.value); setShowSuggestions('pickup') }}
                  onFocus={() => setShowSuggestions('pickup')}
                  onBlur={() => setTimeout(() => setShowSuggestions(null), 200)}
                />
              </div>
              {showSuggestions === 'pickup' && pickup && (
                <div className="suggestions">
                  {filteredLocations(pickup).map(l => (
                    <div key={l} className="suggestion-item" onMouseDown={() => { setPickup(l); setShowSuggestions(null) }}>
                      <LocationIcon /> {l}
                    </div>
                  ))}
                </div>
              )}
              <div className="ri-line" />
              <div className="ri-row" style={{ position: 'relative' }}>
                <span className="ri-dot red" />
                <input className="ri-inp" placeholder="Drop location in Kallakurichi"
                  value={drop}
                  onChange={e => { setDrop(e.target.value); setShowSuggestions('drop') }}
                  onFocus={() => setShowSuggestions('drop')}
                  onBlur={() => setTimeout(() => setShowSuggestions(null), 200)}
                />
              </div>
              {showSuggestions === 'drop' && drop && (
                <div className="suggestions">
                  {filteredLocations(drop).map(l => (
                    <div key={l} className="suggestion-item" onMouseDown={() => { setDrop(l); setShowSuggestions(null) }}>
                      <LocationIcon /> {l}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(pickup || drop) && (
              <MapView pickup={pickup} drop={drop} pickupCoords={pickupCoords} dropCoords={dropCoords} />
            )}

            <div className="vh-row">
              <button className={`vh-card ${vehicleType === 'bike' ? 'vh-on' : ''}`} onClick={() => setVehicleType('bike')}>
                <BikeIcon /><div className="vh-name">Bike</div>
              </button>
              <button className={`vh-card ${vehicleType === 'auto' ? 'vh-on' : ''}`} onClick={() => setVehicleType('auto')}>
                <AutoIcon /><div className="vh-name">Auto</div>
              </button>
            </div>

            <div className="km-row">
              <span className="km-label">Distance (km)</span>
              <div className="km-ctrl">
                <button className="km-btn" onClick={() => setKm(Math.max(1, km - 1))}>−</button>
                <span className="km-val">{km}</span>
                <button className="km-btn" onClick={() => setKm(km + 1)}>+</button>
              </div>
            </div>

            <div className="fare-row">
              <button className="btn-ghost" onClick={calcFare}>Estimate fare</button>
              {fareTotal !== null && <div className="fare-pill">₹{fareTotal}</div>}
            </div>

            <button className="btn-primary full big" onClick={bookRide} disabled={loading || !role}>
              {!role ? 'Login to book' : loading ? 'Booking…' : `Book ${vehicleType === 'bike' ? '🏍' : '🛺'} Now`}
            </button>
          </div>
        </div>
      )}

      {/* Driver Screen */}
      {screen === 'driver' && (
        <div className="screen fade-in">
          <div className="sec-title" style={{ padding: '0 20px 12px' }}>Open requests</div>
          <button className="btn-ghost sm" style={{ margin: '0 20px 16px' }} onClick={refresh}>↻ Refresh</button>
          {open.length === 0 ? (
            <div className="empty">No open rides right now.<br />Pull to refresh.</div>
          ) : (
            open.map(r => (
              <div key={r.id} className="driver-card">
                <div className="dc-head">
                  <span className="dc-type">{r.vehicleType.toUpperCase()}</span>
                  {r.fare?.total && <span className="dc-fare">₹{r.fare.total}</span>}
                </div>
                <div className="dc-route"><span className="ri-dot green sm" /> {r.pickup}</div>
                <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot red sm" /> {r.drop}</div>
                <div style={{ margin: '12px 0' }}>
                  <MapView pickup={r.pickup} drop={r.drop} pickupCoords={getCoords(r.pickup)} dropCoords={getCoords(r.drop)} />
                </div>
                <div className="dc-row">
                  <span className="muted-text">{new Date(r.createdAt).toLocaleTimeString()}</span>
                  <button className="btn-accent" onClick={() => accept(r.id)} disabled={loading}>Accept</button>
                </div>
              </div>
            ))
          )}

          {/* Accepted rides — OTP verification */}
          {rides.filter(r => r.status === 'accepted').length > 0 && (
            <>
              <div className="sec-title" style={{ padding: '16px 20px 12px' }}>Active rides — Enter OTP</div>
              {rides.filter(r => r.status === 'accepted').map(r => (
                <div key={r.id} className="driver-card">
                  <div className="dc-head">
                    <span className="dc-type">{r.vehicleType.toUpperCase()}</span>
                    <span className="ride-badge" style={{ background: '#00D97E22', color: '#00D97E' }}>Accepted</span>
                  </div>
                  <div className="dc-route"><span className="ri-dot green sm" /> {r.pickup}</div>
                  <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot red sm" /> {r.drop}</div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Ask passenger for OTP to start ride:</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="inp"
                        placeholder="Enter 4 digit OTP"
                        maxLength={4}
                        value={otpInputs[r.id] ?? ''}
                        onChange={e => setOtpInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                        style={{ fontSize: 20, letterSpacing: 8, textAlign: 'center' }}
                      />
                      <button className="btn-accent" onClick={() => handleVerifyOTP(r.id)} disabled={otpLoading[r.id]}>
                        {otpLoading[r.id] ? '…' : 'Verify'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* My Rides Screen */}
      {screen === 'rides' && (
        <div className="screen fade-in">
          <div className="sec-title" style={{ padding: '0 20px 12px' }}>My rides</div>
          {rides.length === 0 ? (
            <div className="empty">No rides yet.</div>
          ) : (
            rides.slice().reverse().map(r => (
              <div key={r.id} className="driver-card">
                <div className="dc-head">
                  <div className="dc-type">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</div>
                  <div className="ride-badge" style={{ background: statusColor(r.status) + '22', color: statusColor(r.status) }}>{r.status}</div>
                </div>
                <div className="dc-route"><span className="ri-dot green sm" />{r.pickup}</div>
                <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot red sm" />{r.drop}</div>
                <div style={{ margin: '12px 0' }}>
                  <MapView pickup={r.pickup} drop={r.drop} pickupCoords={getCoords(r.pickup)} dropCoords={getCoords(r.drop)} />
                </div>

                {/* OTP Display for passenger */}
                {r.status === 'accepted' && r.otp && (
                  <div style={{
                    background: 'rgba(255,214,0,0.1)',
                    border: '2px dashed #FFD600',
                    borderRadius: 12,
                    padding: '12px 16px',
                    margin: '10px 0',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                      🔐 Your OTP — Share with driver
                    </div>
                    <div style={{ fontSize: 40, fontWeight: 800, color: '#FFD600', letterSpacing: 12 }}>
                      {r.otp}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                      Driver is on the way!
                    </div>
                  </div>
                )}

                {r.status === 'completed' && r.otp && (
                  <div style={{
                    background: 'rgba(108,142,255,0.1)',
                    border: '1px solid rgba(108,142,255,0.3)',
                    borderRadius: 12,
                    padding: '10px 16px',
                    margin: '10px 0',
                    textAlign: 'center',
                    fontSize: 13,
                    color: '#6C8EFF'
                  }}>
                    ✅ Ride completed!
                  </div>
                )}

                <div className="dc-row">
                  <span className="muted-text">{new Date(r.createdAt).toLocaleString()}</span>
                  {r.fare?.total && <span className="dc-fare">₹{r.fare.total}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Help Screen */}
      {screen === 'help' && (
        <div className="screen fade-in">
          <div className="help-card">
            <div className="help-title">Quick booking</div>
            <div className="help-sub">Book directly via phone — Kallakurichi</div>
            <a className="contact-btn call" href={`tel:${supportPhone}`}>
              <PhoneIcon /> Call {supportPhone}
            </a>
            <a className="contact-btn wa" href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp {supportWhatsapp}
            </a>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="bnav">
        <button className={`bn ${screen === 'home' ? 'bn-on' : ''}`} onClick={() => setScreen('home')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Home</span>
        </button>
        <button className={`bn ${screen === 'book' ? 'bn-on' : ''}`} onClick={() => role ? setScreen('book') : setScreen('auth')}>
          <LocationIcon />
          <span>Book</span>
        </button>
        {role === 'driver' && (
          <button className={`bn ${screen === 'driver' ? 'bn-on' : ''}`} onClick={() => { refresh(); setScreen('driver') }}>
            <BikeIcon />
            <span>Requests</span>
          </button>
        )}
        <button className={`bn ${screen === 'rides' ? 'bn-on' : ''}`} onClick={() => { refresh(); setScreen('rides') }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Rides</span>
        </button>
        <button className={`bn ${screen === 'help' ? 'bn-on' : ''}`} onClick={() => setScreen('help')}>
          <PhoneIcon />
          <span>Help</span>
        </button>
      </nav>
    </div>
  )
}
