import { useEffect, useState, useRef } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'

/* ── API Base ─────────────────────────────────────────────────── */
const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('tn15d_token')
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers ?? {}) } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
  return json as T
}

/* ── Types ─────────────────────────────────────────────────────── */
interface Ride {
  id: string
  pickup: string
  drop: string
  dropoff?: string
  vehicleType: 'bike' | 'auto'
  status: string
  fare?: { total: number } | null
  fareTotal?: number
  km?: number
  createdAt: string
}

/* ── Kallakurichi locations ─────────────────────────────────────── */
const KK_LOCATIONS: Record<string, [number, number]> = {
  'Kallakurichi Bus Stand': [11.7393, 79.0066],
  'Kallakurichi Market': [11.7380, 79.0050],
  'Kallakurichi Government Hospital': [11.7410, 79.0080],
  'Kallakurichi Railway Station': [11.7350, 79.0020],
  'Kallakurichi Collectorate': [11.7420, 79.0090],
  'Sankarapuram Bus Stand': [11.7550, 78.9800],
  'Ulundurpet Bus Stand': [11.6700, 79.3200],
  'Chinnasalem Town': [11.5700, 78.8600],
  'Tirukoilur Bus Stand': [11.9600, 79.1900],
  'Vridhachalam Bus Stand': [11.5200, 79.3100],
  'Thiyagadurgam': [11.8200, 79.0700],
}

function getCoords(name: string): [number, number] | undefined {
  if (KK_LOCATIONS[name]) return KK_LOCATIONS[name]
  for (const [key, coords] of Object.entries(KK_LOCATIONS)) {
    if (key.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(key.toLowerCase())) return coords
  }
  return undefined
}

/* ── Icons ─────────────────────────────────────────────────────── */
const BikeIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 8h10l-2-8z"/><path d="M12 6V3"/></svg>
const AutoIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 6v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
const HomeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
const RidesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
const UserIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>

/* ── Sound alert ─────────────────────────────────────────────────── */
function playAlert() {
  try {
    const ctx = new AudioContext()
    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    playBeep(880, 0, 0.15)
    playBeep(1100, 0.2, 0.15)
    playBeep(880, 0.4, 0.15)
    playBeep(1100, 0.6, 0.3)
  } catch {}
}

/* ── Map Component ────────────────────────────────────────────── */
function MapView({ pickup, drop, pickupCoords, dropCoords }: { pickup: string; drop: string; pickupCoords?: [number, number]; dropCoords?: [number, number] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      if (mapInstanceRef.current) { (mapInstanceRef.current as { remove: () => void }).remove(); mapInstanceRef.current = null }
      const map = L.map(mapRef.current!, { center: [11.7393, 79.0066], zoom: 13 })
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
      const greenIcon = L.divIcon({ html: `<div style="width:14px;height:14px;background:#00D97E;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: '' })
      const redIcon = L.divIcon({ html: `<div style="width:14px;height:14px;background:#FF4D6A;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: '' })
      if (pickupCoords) { L.marker(pickupCoords, { icon: greenIcon }).addTo(map).bindPopup(`Pickup: ${pickup}`) }
      if (dropCoords) { L.marker(dropCoords, { icon: redIcon }).addTo(map).bindPopup(`Drop: ${drop}`) }
      if (pickupCoords && dropCoords) {
        L.polyline([pickupCoords, dropCoords], { color: '#FFD600', weight: 4, dashArray: '8,8' }).addTo(map)
        map.fitBounds(L.latLngBounds([pickupCoords, dropCoords]), { padding: [40, 40] })
      }
    })
    return () => { if (mapInstanceRef.current) { (mapInstanceRef.current as { remove: () => void }).remove(); mapInstanceRef.current = null } }
  }, [pickup, drop, pickupCoords, dropCoords])

  return <div ref={mapRef} style={{ width: '100%', height: '200px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #2E2E38' }} />
}

/* ── Main App ─────────────────────────────────────────────────── */
type Screen = 'home' | 'rides' | 'profile' | 'auth'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userPhone, setUserPhone] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto'>('bike')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [openRides, setOpenRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
  const [isOnline, setIsOnline] = useState(true)
  const prevOpenCount = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function showToast(msg: string) { setStatus(msg); setTimeout(() => setStatus(''), 3000) }

  useEffect(() => {
    const token = localStorage.getItem('tn15d_token')
    const role = localStorage.getItem('tn15d_role')
    const p = localStorage.getItem('tn15d_phone')
    if (token && role === 'driver' && p) { setLoggedIn(true); setUserPhone(p); loadData() }
  }, [])

  // Auto-refresh every 10 seconds when online
  useEffect(() => {
    if (loggedIn && isOnline) {
      pollRef.current = setInterval(loadOpenRides, 10000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loggedIn, isOnline])

  async function loadData() {
    await Promise.all([loadOpenRides(), loadMyRides()])
  }

  async function loadOpenRides() {
    try {
      const r = await api<{ rides: Ride[] }>('/api/driver/rides/open')
      const newRides = r.rides ?? []
      // Play sound if new rides arrived
      if (newRides.length > prevOpenCount.current && prevOpenCount.current >= 0) {
        playAlert()
        showToast(`🔔 New ride request!`)
      }
      prevOpenCount.current = newRides.length
      setOpenRides(newRides)
    } catch {}
  }

  async function loadMyRides() {
    try {
      const r = await api<{ rides: Ride[] }>('/api/rides/mine')
      setMyRides(r.rides ?? [])
    } catch {}
  }

  async function doLogin() {
    setLoading(true)
    try {
      const r = await api<{ token: string; role: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
      if (r.role !== 'driver') { showToast('Use TN15 passenger app!'); setLoading(false); return }
      localStorage.setItem('tn15d_token', r.token)
      localStorage.setItem('tn15d_role', r.role)
      localStorage.setItem('tn15d_phone', phone)
      setLoggedIn(true); setUserPhone(phone); setScreen('home')
      await loadData()
      showToast('Welcome back! 👋')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Login failed') }
    setLoading(false)
  }

  async function doRegister() {
    setLoading(true)
    try {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ phone, password, role: 'driver', name: driverName, vehicleType, vehicleNumber }) })
      showToast('Registered! Please login.')
      setIsRegistering(false)
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Registration failed') }
    setLoading(false)
  }

  async function acceptRide(rideId: string) {
    setLoading(true)
    try {
      await api(`/api/driver/rides/${rideId}/accept`, { method: 'POST' })
      showToast('Ride accepted! 🎉')
      await loadData()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed to accept') }
    setLoading(false)
  }

  async function verifyOTP(rideId: string) {
    const otp = otpInputs[rideId]
    if (!otp || otp.length !== 4) { showToast('Enter 4 digit OTP'); return }
    setLoading(true)
    try {
      await api(`/api/driver/rides/${rideId}/verify-otp`, { method: 'POST', body: JSON.stringify({ otp }) })
      showToast('OTP verified! Ride started! 🎉')
      await loadData()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Invalid OTP') }
    setLoading(false)
  }

  function doLogout() {
    localStorage.clear(); setLoggedIn(false); setUserPhone('')
    setOpenRides([]); setMyRides([]); setScreen('home')
  }

  const statusColor = (s: string) => {
    if (s === 'requested') return '#FFB800'
    if (s === 'accepted') return '#00D97E'
    if (s === 'completed') return '#6C8EFF'
    if (s === 'cancelled') return '#FF4D6A'
    return '#888'
  }

  const totalEarnings = myRides.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.fare?.total ?? r.fareTotal ?? 0), 0)
  const acceptedRides = myRides.filter(r => r.status === 'accepted')

  return (
    <div className="app">
      {status && <div className="toast" onClick={() => setStatus('')}>{status}</div>}

      {/* Header */}
      <header className="hdr">
        <div className="hdr-brand">
          <span className="hdr-logo">TN<span className="hdr-num">15</span></span>
          <span className="hdr-tag">Driver</span>
        </div>
        <div className="hdr-right">
          {loggedIn && (
            <button className={`online-toggle ${isOnline ? 'online' : 'offline'}`} onClick={() => setIsOnline(!isOnline)}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </button>
          )}
          {!loggedIn && <button className="btn-accent sm" onClick={() => setScreen('auth')}>Login</button>}
        </div>
      </header>

      {/* Auth Screen */}
      {screen === 'auth' && (
        <div className="screen fade-in">
          <div className="auth-card">
            <div className="auth-title">{isRegistering ? 'Register as Driver' : 'Driver Login'}</div>
            <div className="auth-sub">TN15 Kallakurichi — Driver App</div>
            {!isRegistering ? (
              <>
                <input className="inp" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <input className="inp" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button className="btn-primary full" onClick={doLogin} disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
                <button className="btn-ghost full" onClick={() => setIsRegistering(true)}>New driver? Register here</button>
              </>
            ) : (
              <>
                <input className="inp" placeholder="Your name" value={driverName} onChange={e => setDriverName(e.target.value)} />
                <input className="inp" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <input className="inp" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                <div className="seg-row">
                  <button className={`seg ${vehicleType === 'bike' ? 'seg-on' : ''}`} onClick={() => setVehicleType('bike')}>🏍 Bike</button>
                  <button className={`seg ${vehicleType === 'auto' ? 'seg-on' : ''}`} onClick={() => setVehicleType('auto')}>🛺 Auto</button>
                </div>
                <input className="inp" placeholder="Vehicle number (e.g. TN45 AB 1234)" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} />
                <button className="btn-primary full" onClick={doRegister} disabled={loading}>{loading ? 'Registering…' : 'Register'}</button>
                <button className="btn-ghost full" onClick={() => setIsRegistering(false)}>Already registered? Login</button>
              </>
            )}
            <button className="btn-ghost full" onClick={() => setScreen('home')} style={{ marginTop: 4 }}>← Back</button>
          </div>
        </div>
      )}

      {/* Home Screen */}
      {screen === 'home' && (
        <div className="screen fade-in">
          {!loggedIn ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏍</div>
              <div className="hero-title" style={{ fontSize: 28, marginBottom: 8 }}>TN15 Driver</div>
              <div style={{ color: 'var(--muted)', marginBottom: 24 }}>Kallakurichi Bike & Auto Taxi</div>
              <button className="btn-primary full" onClick={() => setScreen('auth')}>Login to start driving</button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ padding: '20px 20px 0' }}>
                <div className="stats-row">
                  <div className="stat-box">
                    <div className="stat-val accent">₹{totalEarnings}</div>
                    <div className="stat-lbl">Total Earned</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">{myRides.filter(r => r.status === 'completed').length}</div>
                    <div className="stat-lbl">Completed</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val green">{openRides.length}</div>
                    <div className="stat-lbl">Open Requests</div>
                  </div>
                </div>
              </div>

              {/* Active ride — OTP verification */}
              {acceptedRides.length > 0 && (
                <div style={{ padding: '16px 20px 0' }}>
                  <div className="sec-title">Active Ride 🔥</div>
                  {acceptedRides.map(r => (
                    <div key={r.id} className="driver-card active-ride">
                      <div className="dc-head">
                        <span className="dc-type">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</span>
                        <span className="ride-badge" style={{ background: '#00D97E22', color: '#00D97E' }}>Accepted</span>
                      </div>
                      <div className="dc-route"><span className="ri-dot-sm green" /> {r.pickup}</div>
                      <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot-sm red" /> {r.drop ?? r.dropoff}</div>
                      <MapView pickup={r.pickup} drop={r.drop ?? r.dropoff ?? ''} pickupCoords={getCoords(r.pickup)} dropCoords={getCoords(r.drop ?? r.dropoff ?? '')} />
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Ask passenger for OTP:</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="inp" placeholder="Enter 4 digit OTP" maxLength={4} value={otpInputs[r.id] ?? ''}
                            onChange={e => setOtpInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                            style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center' }} />
                          <button className="btn-accent" onClick={() => verifyOTP(r.id)} disabled={loading}>Verify</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Open ride requests */}
              <div style={{ padding: '16px 20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="sec-title">Ride Requests</div>
                  <button className="btn-ghost sm" onClick={loadOpenRides}>↻ Refresh</button>
                </div>
                {!isOnline ? (
                  <div className="empty">You are offline.<br />Go online to receive rides! 🔴</div>
                ) : openRides.length === 0 ? (
                  <div className="empty">No ride requests right now.<br />Stay online — new rides coming! 🏍</div>
                ) : (
                  openRides.map(r => (
                    <div key={r.id} className="driver-card">
                      <div className="dc-head">
                        <span className="dc-type">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</span>
                        {(r.fare?.total ?? r.fareTotal) && <span className="dc-fare">₹{r.fare?.total ?? r.fareTotal}</span>}
                      </div>
                      <div className="dc-route"><span className="ri-dot-sm green" /> {r.pickup}</div>
                      <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot-sm red" /> {r.drop ?? r.dropoff}</div>
                      <MapView pickup={r.pickup} drop={r.drop ?? r.dropoff ?? ''} pickupCoords={getCoords(r.pickup)} dropCoords={getCoords(r.drop ?? r.dropoff ?? '')} />
                      <div className="dc-row" style={{ marginTop: 12 }}>
                        <span className="muted-text">{new Date(r.createdAt).toLocaleTimeString()}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-accent" onClick={() => acceptRide(r.id)} disabled={loading}>Accept 🏍</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* My Rides Screen */}
      {screen === 'rides' && (
        <div className="screen fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div className="sec-title" style={{ padding: 0 }}>My Rides</div>
            <button className="btn-ghost sm" onClick={loadMyRides}>↻ Refresh</button>
          </div>
          {myRides.length === 0 ? (
            <div className="empty">No rides yet.<br />Accept your first ride! 🏍</div>
          ) : (
            myRides.slice().reverse().map(r => (
              <div key={r.id} className="driver-card">
                <div className="dc-head">
                  <div className="dc-type">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</div>
                  <div className="ride-badge" style={{ background: statusColor(r.status) + '22', color: statusColor(r.status) }}>{r.status}</div>
                </div>
                <div className="dc-route"><span className="ri-dot-sm green" /> {r.pickup}</div>
                <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot-sm red" /> {r.drop ?? r.dropoff}</div>
                <div className="dc-row" style={{ marginTop: 8 }}>
                  <span className="muted-text">{new Date(r.createdAt).toLocaleString()}</span>
                  {(r.fare?.total ?? r.fareTotal) && <span className="dc-fare">₹{r.fare?.total ?? r.fareTotal}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Profile Screen */}
      {screen === 'profile' && (
        <div className="screen fade-in">
          <div className="auth-card" style={{ margin: '24px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,214,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 32 }}>🏍</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{userPhone}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Driver</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total earnings</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>₹{totalEarnings}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rides completed</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{myRides.filter(r => r.status === 'completed').length}</div>
            </div>
            <button className="btn-ghost full" style={{ color: 'var(--red)' }} onClick={doLogout}>Logout</button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="bnav">
        <button className={`bn ${screen === 'home' ? 'bn-on' : ''}`} onClick={() => { if (loggedIn) loadData(); setScreen('home') }}>
          <HomeIcon /><span>Home</span>
        </button>
        <button className={`bn ${screen === 'rides' ? 'bn-on' : ''}`} onClick={() => { if (loggedIn) { loadMyRides(); setScreen('rides') } else setScreen('auth') }}>
          <RidesIcon /><span>My Rides</span>
        </button>
        <button className={`bn ${screen === 'profile' ? 'bn-on' : ''}`} onClick={() => loggedIn ? setScreen('profile') : setScreen('auth')}>
          <UserIcon /><span>Profile</span>
        </button>
      </nav>
    </div>
  )
}
