import { useEffect, useState, useRef } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'

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

async function publicApi<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
  return json as T
}

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

const KK_LOCATIONS: Record<string, [number, number]> = {
  'Kallakurichi Bus Stand': [11.7393, 79.0066],
  'Kallakurichi Government Hospital': [11.7460, 79.0040],
  'Kallakurichi Railway Station': [11.7280, 78.9950],
  'Sankarapuram': [11.7800, 78.9500],
  'Ulundurpet': [11.6700, 79.3200],
  'Chinnasalem': [11.5700, 78.8600],
  'Tirukoilur': [11.9600, 79.1900],
  'Vridhachalam': [11.5200, 79.3100],
  'Rishivandiyam': [11.7950, 78.9300],
  'Thiyagadurgam': [11.8300, 79.0750],
}

function getCoords(name: string): [number, number] | undefined {
  if (KK_LOCATIONS[name]) return KK_LOCATIONS[name]
  for (const [key, coords] of Object.entries(KK_LOCATIONS)) {
    if (key.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(key.toLowerCase())) return coords
  }
  return undefined
}

const BikeIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 8h10l-2-8z"/><path d="M12 6V3"/></svg>
const AutoIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 6v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
const HomeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
const RidesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
const UserIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>

let ringtoneInterval: ReturnType<typeof setInterval> | null = null

function playAlert() {
  try {
    const ctx = new AudioContext()
    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + duration)
    }
    playBeep(880, 0, 0.15); playBeep(1100, 0.2, 0.15); playBeep(880, 0.4, 0.15); playBeep(1100, 0.6, 0.3)
  } catch {}
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300])
}

function startRingtone() { stopRingtone(); playAlert(); ringtoneInterval = setInterval(playAlert, 2000) }
function stopRingtone() { if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null } }

function MapView({ pickup, drop, pickupCoords, dropCoords }: { pickup: string; drop: string; pickupCoords?: [number, number]; dropCoords?: [number, number] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(async (L) => {
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
      if (pickupCoords) L.marker(pickupCoords, { icon: greenIcon }).addTo(map).bindPopup(`Pickup: ${pickup}`)
      if (dropCoords) L.marker(dropCoords, { icon: redIcon }).addTo(map).bindPopup(`Drop: ${drop}`)
      if (pickupCoords && dropCoords) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`
          const res = await fetch(url)
          const data = await res.json()
          if (data.code === 'Ok' && data.routes?.[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number])
            L.polyline(coords, { color: '#FFD600', weight: 5, opacity: 0.9 }).addTo(map)
            map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
          } else throw new Error('no route')
        } catch {
          L.polyline([pickupCoords, dropCoords], { color: '#FFD600', weight: 4, dashArray: '8,8' }).addTo(map)
          map.fitBounds(L.latLngBounds([pickupCoords, dropCoords]), { padding: [40, 40] })
        }
      }
    })
    return () => { if (mapInstanceRef.current) { (mapInstanceRef.current as { remove: () => void }).remove(); mapInstanceRef.current = null } }
  }, [pickup, drop, pickupCoords, dropCoords])

  return <div ref={mapRef} style={{ width: '100%', height: '200px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #2E2E38' }} />
}

type Screen = 'home' | 'rides' | 'profile' | 'auth'
type AuthMode = 'login' | 'register_phone' | 'register_otp' | 'register_details' | 'forgot_phone' | 'forgot_otp' | 'forgot_password'

const OTPInput = ({ value, onChange, prefix }: { value: string; onChange: (v: string) => void; prefix: string }) => (
  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
    {[0,1,2,3].map(i => (
      <input key={i} id={`${prefix}-${i}`} className="inp" maxLength={1}
        value={value[i] ?? ''}
        style={{ width: 60, textAlign: 'center', fontSize: 28, fontWeight: 800, padding: '12px 0' }}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '')
          const arr = value.split('')
          arr[i] = val
          onChange(arr.join('').slice(0, 4))
          if (val && i < 3) document.getElementById(`${prefix}-${i+1}`)?.focus()
        }}
        onKeyDown={e => { if (e.key === 'Backspace' && !value[i] && i > 0) document.getElementById(`${prefix}-${i-1}`)?.focus() }}
      />
    ))}
  </div>
)

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userPhone, setUserPhone] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto'>('bike')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [openRides, setOpenRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
  const [isOnline, setIsOnline] = useState(true)
  const [newRideAlert, setNewRideAlert] = useState<Ride | null>(null)
  const prevOpenCount = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const locationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const socketRef = useRef<unknown>(null)

  function showToast(msg: string) { setStatus(msg); setTimeout(() => setStatus(''), 3000) }

  useEffect(() => {
    const token = localStorage.getItem('tn15d_token')
    const role = localStorage.getItem('tn15d_role')
    const p = localStorage.getItem('tn15d_phone')
    if (token && role === 'driver' && p) { setLoggedIn(true); setUserPhone(p); loadData() }
  }, [])

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendTimer])

  useEffect(() => {
    if (loggedIn && isOnline) { pollRef.current = setInterval(loadOpenRides, 10000) }
    if (!isOnline) { stopRingtone(); setNewRideAlert(null) }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loggedIn, isOnline])

  async function startLocationTracking(rideId: string) {
    try {
      const { io } = await import('socket.io-client')
      const socket = io(API_BASE)
      socketRef.current = socket
      socket.emit('driver:join', { rideId })
      locationRef.current = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            (socket as { emit: (e: string, d: unknown) => void }).emit('driver:location', {
              rideId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              driverId: localStorage.getItem('tn15d_phone')
            })
          })
        }
      }, 5000)
    } catch {}
  }

  function stopLocationTracking() {
    if (locationRef.current) { clearInterval(locationRef.current); locationRef.current = null }
    if (socketRef.current) { (socketRef.current as { disconnect: () => void }).disconnect(); socketRef.current = null }
  }

  async function loadData() { await Promise.all([loadOpenRides(), loadMyRides()]) }

  async function loadOpenRides() {
    try {
      const r = await api<{ rides: Ride[] }>('/api/driver/rides/open')
      const newRides = r.rides ?? []
      if (newRides.length > prevOpenCount.current && prevOpenCount.current >= 0 && newRides.length > 0) {
        startRingtone(); setNewRideAlert(newRides[0])
      }
      prevOpenCount.current = newRides.length
      setOpenRides(newRides)
    } catch {}
  }

  async function loadMyRides() {
    try { const r = await api<{ rides: Ride[] }>('/api/rides/mine'); setMyRides(r.rides ?? []) } catch {}
  }

  async function doLogin() {
    setLoading(true)
    try {
      const r = await publicApi<{ token: string; role: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
      if (r.role !== 'driver') { showToast('Use TN15 passenger app!'); setLoading(false); return }
      localStorage.setItem('tn15d_token', r.token)
      localStorage.setItem('tn15d_role', r.role)
      localStorage.setItem('tn15d_phone', phone)
      setLoggedIn(true); setUserPhone(phone); setScreen('home')
      await loadData(); showToast('Welcome back! 👋')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Login failed') }
    setLoading(false)
  }

  async function doSendRegOTP() {
    if (!phone || phone.length !== 10) { showToast('Enter valid 10 digit phone number'); return }
    if (!driverName) { showToast('Enter your name'); return }
    setLoading(true)
    try {
      await publicApi('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) })
      setResendTimer(60); setAuthMode('register_otp')
      showToast('OTP sent to ' + phone + '! 📱')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed to send OTP') }
    setLoading(false)
  }

  async function doVerifyRegOTP() {
    if (!otp || otp.length !== 4) { showToast('Enter 4 digit OTP'); return }
    setLoading(true)
    try {
      await publicApi('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) })
      setAuthMode('register_details'); showToast('OTP verified! ✅')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Invalid OTP') }
    setLoading(false)
  }

  async function doCompleteRegister() {
    if (!password || password.length < 6) { showToast('Password must be at least 6 characters'); return }
    if (!vehicleNumber) { showToast('Enter vehicle number'); return }
    setLoading(true)
    try {
      await publicApi('/api/auth/register', { method: 'POST', body: JSON.stringify({ phone, password, role: 'driver', name: driverName, vehicleType, vehicleNumber }) })
      showToast('Registered! Please login. 🎉')
      setAuthMode('login'); setOtp(''); setPassword('')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Registration failed') }
    setLoading(false)
  }

  async function doForgotSendOTP() {
    if (!phone || phone.length !== 10) { showToast('Enter valid 10 digit phone number'); return }
    setLoading(true)
    try {
      await publicApi('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ phone }) })
      setResendTimer(60); setAuthMode('forgot_otp')
      showToast('OTP sent to ' + phone + '! 📱')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Phone not registered') }
    setLoading(false)
  }

  async function doForgotVerifyOTP() {
    if (!otp || otp.length !== 4) { showToast('Enter 4 digit OTP'); return }
    setLoading(true)
    try {
      await publicApi('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) })
      setAuthMode('forgot_password'); showToast('OTP verified! ✅')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Invalid OTP') }
    setLoading(false)
  }

  async function doResetPassword() {
    if (!newPassword || newPassword.length < 6) { showToast('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await publicApi('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ phone, otp, newPassword }) })
      showToast('Password reset! Please login. 🎉')
      setAuthMode('login'); setOtp(''); setNewPassword('')
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Reset failed') }
    setLoading(false)
  }

  async function acceptRide(rideId: string) {
    setLoading(true); stopRingtone(); setNewRideAlert(null)
    try {
      await api(`/api/driver/rides/${rideId}/accept`, { method: 'POST' })
      showToast('Ride accepted! 🎉')
      await loadData()
      startLocationTracking(rideId)
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed to accept') }
    setLoading(false)
  }

  function dismissAlert() { stopRingtone(); setNewRideAlert(null) }

  async function verifyOTP(rideId: string) {
    const otp = otpInputs[rideId]
    if (!otp || otp.length !== 4) { showToast('Enter 4 digit OTP'); return }
    setLoading(true)
    try {
      await api(`/api/driver/rides/${rideId}/verify-otp`, { method: 'POST', body: JSON.stringify({ otp }) })
      showToast('OTP verified! Ride completed! 🎉')
      stopLocationTracking()
      await loadData()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Invalid OTP') }
    setLoading(false)
  }

  function doLogout() {
    stopLocationTracking()
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

      {newRideAlert && (
        <div className="ride-alert-overlay">
          <div className="ride-alert-modal">
            <div className="ride-alert-pulse">🔔</div>
            <div className="ride-alert-title">New Ride Request!</div>
            <div className="dc-route" style={{ justifyContent: 'center', marginTop: 12 }}>
              <span className="ri-dot-sm green" /> {newRideAlert.pickup}
            </div>
            <div className="dc-route" style={{ justifyContent: 'center', marginTop: 6 }}>
              <span className="ri-dot-sm red" /> {newRideAlert.drop ?? newRideAlert.dropoff}
            </div>
            {(newRideAlert.fare?.total ?? newRideAlert.fareTotal) && (
              <div className="ride-alert-fare">₹{newRideAlert.fare?.total ?? newRideAlert.fareTotal}</div>
            )}
            <div className="ride-alert-btns">
              <button className="btn-ghost full" onClick={dismissAlert} disabled={loading}>Ignore</button>
              <button className="btn-primary full" onClick={() => acceptRide(newRideAlert.id)} disabled={loading}>Accept 🏍</button>
            </div>
          </div>
        </div>
      )}

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
          {!loggedIn && <button className="btn-accent sm" onClick={() => { setAuthMode('login'); setScreen('auth') }}>Login</button>}
        </div>
      </header>

      {screen === 'auth' && (
        <div className="screen fade-in">
          <div className="auth-card">
            {authMode === 'login' && (
              <>
                <div className="auth-title">Driver Login</div>
                <div className="auth-sub">TN15 Kallakurichi — Driver App</div>
                <input className="inp" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <input className="inp" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button className="btn-primary full" onClick={doLogin} disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
                <button className="btn-ghost full" onClick={() => { setAuthMode('register_phone'); setPhone(''); setOtp(''); setPassword(''); setDriverName(''); setVehicleNumber('') }}>New driver? Register here</button>
                <button className="btn-ghost full" style={{ color: 'var(--accent)' }} onClick={() => { setAuthMode('forgot_phone'); setPhone('') }}>Forgot password?</button>
                <button className="btn-ghost full" onClick={() => setScreen('home')}>← Back</button>
              </>
            )}
            {authMode === 'register_phone' && (
              <>
                <div className="auth-title">Register as Driver</div>
                <div className="auth-sub">Step 1 of 3 — Enter your details</div>
                <input className="inp" placeholder="Your name" value={driverName} onChange={e => setDriverName(e.target.value)} />
                <input className="inp" placeholder="Phone number (10 digits)" value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <button className="btn-primary full" onClick={doSendRegOTP} disabled={loading || phone.length !== 10}>{loading ? 'Sending OTP…' : 'Send OTP 📱'}</button>
                <button className="btn-ghost full" onClick={() => setAuthMode('login')}>← Back to Login</button>
              </>
            )}
            {authMode === 'register_otp' && (
              <>
                <div className="auth-title">Verify phone 📱</div>
                <div className="auth-sub">Step 2 of 3 — Enter OTP sent to {phone}</div>
                <OTPInput value={otp} onChange={setOtp} prefix="rotp" />
                <button className="btn-primary full" onClick={doVerifyRegOTP} disabled={loading || otp.length !== 4}>{loading ? 'Verifying…' : 'Verify OTP ✅'}</button>
                {resendTimer > 0 ? <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Resend OTP in {resendTimer}s</div> : <button className="btn-ghost full" onClick={doSendRegOTP} disabled={loading}>Resend OTP</button>}
                <button className="btn-ghost full" onClick={() => setAuthMode('register_phone')}>← Back</button>
              </>
            )}
            {authMode === 'register_details' && (
              <>
                <div className="auth-title">Vehicle details 🏍</div>
                <div className="auth-sub">Step 3 of 3 — Set up your vehicle & password</div>
                <div className="seg-row">
                  <button className={`seg ${vehicleType === 'bike' ? 'seg-on' : ''}`} onClick={() => setVehicleType('bike')}>🏍 Bike</button>
                  <button className={`seg ${vehicleType === 'auto' ? 'seg-on' : ''}`} onClick={() => setVehicleType('auto')}>🛺 Auto</button>
                </div>
                <input className="inp" placeholder="Vehicle number (e.g. TN45 AB 1234)" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} />
                <input className="inp" placeholder="Create password (min 6 chars)" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                <button className="btn-primary full" onClick={doCompleteRegister} disabled={loading || password.length < 6}>{loading ? 'Registering…' : 'Complete Registration 🎉'}</button>
                <button className="btn-ghost full" onClick={() => setAuthMode('register_otp')}>← Back</button>
              </>
            )}
            {authMode === 'forgot_phone' && (
              <>
                <div className="auth-title">Forgot password? 🔑</div>
                <div className="auth-sub">Enter your registered phone number</div>
                <input className="inp" placeholder="Phone number (10 digits)" value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <button className="btn-primary full" onClick={doForgotSendOTP} disabled={loading || phone.length !== 10}>{loading ? 'Sending OTP…' : 'Send OTP 📱'}</button>
                <button className="btn-ghost full" onClick={() => setAuthMode('login')}>← Back to Login</button>
              </>
            )}
            {authMode === 'forgot_otp' && (
              <>
                <div className="auth-title">Verify phone 📱</div>
                <div className="auth-sub">Enter OTP sent to {phone}</div>
                <OTPInput value={otp} onChange={setOtp} prefix="fotp" />
                <button className="btn-primary full" onClick={doForgotVerifyOTP} disabled={loading || otp.length !== 4}>{loading ? 'Verifying…' : 'Verify OTP ✅'}</button>
                {resendTimer > 0 ? <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Resend OTP in {resendTimer}s</div> : <button className="btn-ghost full" onClick={doForgotSendOTP} disabled={loading}>Resend OTP</button>}
                <button className="btn-ghost full" onClick={() => setAuthMode('forgot_phone')}>← Back</button>
              </>
            )}
            {authMode === 'forgot_password' && (
              <>
                <div className="auth-title">New password 🔐</div>
                <div className="auth-sub">Enter your new password</div>
                <input className="inp" placeholder="New password (min 6 chars)" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <button className="btn-primary full" onClick={doResetPassword} disabled={loading || newPassword.length < 6}>{loading ? 'Resetting…' : 'Reset Password ✅'}</button>
                <button className="btn-ghost full" onClick={() => setAuthMode('forgot_otp')}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {screen === 'home' && (
        <div className="screen fade-in">
          {!loggedIn ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏍</div>
              <div className="hero-title" style={{ fontSize: 28, marginBottom: 8 }}>TN15 Driver</div>
              <div style={{ color: 'var(--muted)', marginBottom: 24 }}>Kallakurichi Bike & Auto Taxi</div>
              <button className="btn-primary full" onClick={() => { setAuthMode('login'); setScreen('auth') }}>Login to start driving</button>
            </div>
          ) : (
            <>
              <div style={{ padding: '20px 20px 0' }}>
                <div className="stats-row">
                  <div className="stat-box"><div className="stat-val accent">₹{totalEarnings}</div><div className="stat-lbl">Total Earned</div></div>
                  <div className="stat-box"><div className="stat-val">{myRides.filter(r => r.status === 'completed').length}</div><div className="stat-lbl">Completed</div></div>
                  <div className="stat-box"><div className="stat-val green">{openRides.length}</div><div className="stat-lbl">Open Requests</div></div>
                </div>
              </div>

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
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8 }}>📍 Sharing your live location with passenger</div>
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
                        <button className="btn-accent" onClick={() => acceptRide(r.id)} disabled={loading}>Accept 🏍</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

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

      <nav className="bnav">
        <button className={`bn ${screen === 'home' ? 'bn-on' : ''}`} onClick={() => { if (loggedIn) loadData(); setScreen('home') }}>
          <HomeIcon /><span>Home</span>
        </button>
        <button className={`bn ${screen === 'rides' ? 'bn-on' : ''}`} onClick={() => { if (loggedIn) { loadMyRides(); setScreen('rides') } else { setAuthMode('login'); setScreen('auth') } }}>
          <RidesIcon /><span>My Rides</span>
        </button>
        <button className={`bn ${screen === 'profile' ? 'bn-on' : ''}`} onClick={() => { if (loggedIn) setScreen('profile'); else { setAuthMode('login'); setScreen('auth') } }}>
          <UserIcon /><span>Profile</span>
        </button>
      </nav>
    </div>
  )
}