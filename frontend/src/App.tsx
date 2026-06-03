import { useEffect, useState } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'
import MapView from './mapview'
import {
  createRide,
  estimateFare,
  health,
  login,
  myRides,
  register,
  type Ride,
} from './api'

/* ─── Icons ─────────────────────────────────────────────────────── */
const BikeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6h-5l-3 8h10l-2-8z"/><path d="M12 6V3"/>
  </svg>
)
const AutoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 6v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const RideIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
)
const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)

/* ─── Kallakurichi locations ─────────────────────────────────────── */
const KK_LOCATIONS: { name: string; coords: [number, number] }[] = [
  { name: 'Kallakurichi Bus Stand', coords: [11.7393, 79.0066] },
  { name: 'Kallakurichi Market', coords: [11.7380, 79.0050] },
  { name: 'Kallakurichi Government Hospital', coords: [11.7410, 79.0080] },
  { name: 'Kallakurichi Railway Station', coords: [11.7350, 79.0020] },
  { name: 'Kallakurichi Collectorate', coords: [11.7420, 79.0090] },
  { name: 'Kallakurichi Court', coords: [11.7400, 79.0070] },
  { name: 'Kallakurichi Anna Nagar', coords: [11.7430, 79.0100] },
  { name: 'Kallakurichi TNEB Office', coords: [11.7360, 79.0040] },
  { name: 'Sankarapuram Bus Stand', coords: [11.7550, 78.9800] },
  { name: 'Sankarapuram Market', coords: [11.7540, 78.9810] },
  { name: 'Ulundurpet Bus Stand', coords: [11.6700, 79.3200] },
  { name: 'Ulundurpet Market', coords: [11.6710, 79.3210] },
  { name: 'Chinnasalem Town', coords: [11.5700, 78.8600] },
  { name: 'Chinnasalem Bus Stand', coords: [11.5710, 78.8610] },
  { name: 'Tirukoilur Bus Stand', coords: [11.9600, 79.1900] },
  { name: 'Tirukoilur Market', coords: [11.9610, 79.1910] },
  { name: 'Vridhachalam Bus Stand', coords: [11.5200, 79.3100] },
  { name: 'Rishivandiyam', coords: [11.7900, 78.9400] },
  { name: 'Thiyagadurgam', coords: [11.8200, 79.0700] },
  { name: 'Kachirayipalayam', coords: [11.7300, 79.0150] },
  { name: 'Kammapuram', coords: [11.6900, 79.0500] },
  { name: 'Periyavadavadi', coords: [11.8100, 79.0300] },
  { name: 'Manalurpet', coords: [11.8500, 79.0900] },
  { name: 'Nathamedu', coords: [11.7200, 79.0200] },
  { name: 'Vazhapadi', coords: [11.7100, 78.9900] },
]

function searchLocations(query: string) {
  if (!query) return []
  const q = query.toLowerCase()
  return KK_LOCATIONS.filter(l =>
    l.name.toLowerCase().includes(q)
  ).slice(0, 7)
}

function getCoordsForLocation(name: string): [number, number] | undefined {
  const found = KK_LOCATIONS.find(l =>
    l.name.toLowerCase() === name.toLowerCase() ||
    l.name.toLowerCase().includes(name.toLowerCase())
  )
  return found?.coords
}

type Screen = 'home' | 'search' | 'confirm' | 'rides' | 'profile' | 'auth'

export default function PassengerApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userPhone, setUserPhone] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [backend, setBackend] = useState<{ ok: boolean } | null>(null)

  // Booking state
  const [pickup, setPickup] = useState('')
  const [drop, setDrop] = useState('')
  const [pickupCoords, setPickupCoords] = useState<[number, number] | undefined>()
  const [dropCoords, setDropCoords] = useState<[number, number] | undefined>()
  const [activeInput, setActiveInput] = useState<'pickup' | 'drop'>('pickup')
  const [searchQuery, setSearchQuery] = useState('')
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto'>('bike')
  const [km, setKm] = useState(3)
  const [fare, setFare] = useState<number | null>(null)
  const [rides, setRides] = useState<Ride[]>([])

  useEffect(() => {
    health().then(setBackend).catch(() => setBackend({ ok: false, db: 'down' } as never))
    const token = localStorage.getItem('tn15_token')
    const role = localStorage.getItem('tn15_role')
    const p = localStorage.getItem('tn15_phone')
    if (token && role === 'passenger' && p) {
      setLoggedIn(true)
      setUserPhone(p)
      loadRides()
    }
  }, [])

  async function loadRides() {
    try {
      const r = await myRides()
      setRides(r.rides)
    } catch {}
  }

  function showToast(msg: string) {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }

  async function doLogin() {
    setLoading(true)
    try {
      const r = await login({ phone, password })
      if (r.role !== 'passenger') {
        showToast('Use TN15 Driver app for drivers!')
        setLoading(false)
        return
      }
      localStorage.setItem('tn15_token', r.token)
      localStorage.setItem('tn15_role', r.role)
      localStorage.setItem('tn15_phone', phone)
      setLoggedIn(true)
      setUserPhone(phone)
      setScreen('home')
      await loadRides()
      showToast('Welcome back! 👋')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Login failed')
    }
    setLoading(false)
  }

  async function doRegister() {
    setLoading(true)
    try {
      await register({ phone, password, role: 'passenger', name })
      showToast('Registered! Please login.')
      setIsRegistering(false)
    
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Registration failed')
    }
    setLoading(false)
  }

  function doLogout() {
    localStorage.clear()
    setLoggedIn(false)
    setUserPhone('')
    setRides([])
    setScreen('home')
  }

  async function calcFare() {
    try {
      const r = await estimateFare({ vehicleType, km })
      setFare(r.estimate.total)
    } catch {}
  }

  async function bookRide() {
    if (!pickup || !drop) { showToast('Enter pickup and drop!'); return }
    setLoading(true)
    try {
      await createRide({ pickup, drop, vehicleType, km })
      showToast('Ride booked! 🎉')
      setPickup(''); setDrop('')
      setPickupCoords(undefined); setDropCoords(undefined)
      setFare(null)
      await loadRides()
      setScreen('rides')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Booking failed')
    }
    setLoading(false)
  }

  function selectLocation(loc: { name: string; coords: [number, number] }) {
    if (activeInput === 'pickup') {
      setPickup(loc.name)
      setPickupCoords(loc.coords)
    } else {
      setDrop(loc.name)
      setDropCoords(loc.coords)
    }
    setSearchQuery('')
    setScreen('confirm')
  }

  const statusColor = (s: string) => {
    if (s === 'requested') return '#FFB800'
    if (s === 'accepted') return '#00D97E'
    if (s === 'completed') return '#6C8EFF'
    if (s === 'cancelled') return '#FF4D6A'
    return '#888'
  }

  const suggestions = searchLocations(searchQuery)

  return (
    <div className="app">
      {status && <div className="toast" onClick={() => setStatus('')}>{status}</div>}

      {/* ── HEADER ── */}
      <header className="hdr">
        <div className="hdr-brand">
          <span className="hdr-logo">TN<span className="hdr-num">15</span></span>
          <span className="hdr-tag">Kallakurichi</span>
        </div>
        <div className="hdr-right">
          <span className={`dot ${backend?.ok ? 'dot-on' : 'dot-off'}`} />
          {loggedIn ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{userPhone}</div>
          ) : (
            <button className="btn-accent sm" onClick={() => setScreen('auth')}>Login</button>
          )}
        </div>
      </header>

      {/* ── AUTH SCREEN ── */}
      {screen === 'auth' && (
        <div className="screen fade-in">
          <div className="auth-card">
            <div className="auth-title">{isRegistering ? 'Create account' : 'Welcome back'}</div>
            <div className="auth-sub">Kallakurichi Bike & Auto Taxi</div>

            {!isRegistering ? (
              <>
                <input className="inp" placeholder="Phone number" value={phone}
                  onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <input className="inp" placeholder="Password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button className="btn-primary full" onClick={doLogin} disabled={loading}>
                  {loading ? 'Logging in…' : 'Login'}
                </button>
                <button className="btn-ghost full" onClick={() => setIsRegistering(true)}>
                  New user? Register here
                </button>
              </>
            ) : (
              <>
                <input className="inp" placeholder="Your name" value={name}
                  onChange={e => setName(e.target.value)} />
                <input className="inp" placeholder="Phone number" value={phone}
                  onChange={e => setPhone(e.target.value)} type="tel" maxLength={10} />
                <input className="inp" placeholder="Create password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} />
                <button className="btn-primary full" onClick={doRegister} disabled={loading}>
                  {loading ? 'Registering…' : 'Register'}
                </button>
                <button className="btn-ghost full" onClick={() => setIsRegistering(false)}>
                  Already have account? Login
                </button>
              </>
            )}
            <button className="btn-ghost full" onClick={() => setScreen('home')} style={{ marginTop: 4 }}>← Back</button>
          </div>
        </div>
      )}

      {/* ── HOME SCREEN ── */}
      {screen === 'home' && (
        <div className="screen fade-in">
          <div className="hero">
            <div className="hero-city">Kallakurichi District</div>
            <div className="hero-title">Where to?</div>
            {loggedIn && <div className="hero-sub">Hello, <b>{userPhone}</b> 👋</div>}
          </div>

          {/* Map */}
          <div style={{ padding: '0 20px 16px' }}>
            <MapView
              pickup={pickup || 'Kallakurichi Bus Stand'}
              drop={drop}
              pickupCoords={pickupCoords || [11.7393, 79.0066]}
              dropCoords={dropCoords}
            />
          </div>

          {/* Search bar */}
          <div className="rapido-search" onClick={() => {
            if (!loggedIn) { setScreen('auth'); return }
            setActiveInput('pickup')
            setSearchQuery('')
            setScreen('search')
          }}>
            <SearchIcon />
            <span style={{ color: 'var(--muted)' }}>
              {pickup ? pickup : 'Search pickup location…'}
            </span>
          </div>

          {pickup && (
            <div className="rapido-search" style={{ marginTop: 8 }} onClick={() => {
              setActiveInput('drop')
              setSearchQuery('')
              setScreen('search')
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
              <span style={{ color: drop ? 'var(--text)' : 'var(--muted)' }}>
                {drop ? drop : 'Search drop location…'}
              </span>
            </div>
          )}

          {/* Vehicle selection */}
          <div className="vh-row">
            <button className={`vh-card ${vehicleType === 'bike' ? 'vh-on' : ''}`} onClick={() => { setVehicleType('bike'); calcFare() }}>
              <BikeIcon /><div className="vh-name">Bike</div><div className="vh-eta">₹{vehicleType === 'bike' && fare ? fare : '—'}</div>
            </button>
            <button className={`vh-card ${vehicleType === 'auto' ? 'vh-on' : ''}`} onClick={() => { setVehicleType('auto'); calcFare() }}>
              <AutoIcon /><div className="vh-name">Auto</div><div className="vh-eta">₹{vehicleType === 'auto' && fare ? fare : '—'}</div>
            </button>
          </div>

          {pickup && drop && (
            <div style={{ padding: '0 20px' }}>
              <button className="btn-primary full big" onClick={() => setScreen('confirm')}>
                Confirm Booking →
              </button>
            </div>
          )}

          {/* Recent rides */}
          {rides.length > 0 && (
            <div className="section" style={{ marginTop: 20 }}>
              <div className="sec-title">Recent rides</div>
              {rides.slice(0, 2).map(r => (
                <div key={r.id} className="ride-row" onClick={() => setScreen('rides')}>
                  <div className="ride-icon">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</div>
                  <div className="ride-info">
                    <div className="ride-route">{r.pickup} → {r.drop}</div>
                    <div className="ride-meta">{new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="ride-badge" style={{ background: statusColor(r.status) + '22', color: statusColor(r.status) }}>
                    {r.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SEARCH SCREEN ── */}
      {screen === 'search' && (
        <div className="screen fade-in" style={{ background: 'var(--bg)' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setScreen(pickup ? 'confirm' : 'home')} style={{ color: 'var(--text)' }}>
              <BackIcon />
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="inp"
                placeholder={activeInput === 'pickup' ? 'Search pickup location…' : 'Search drop location…'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                style={{ paddingLeft: 40 }}
              />
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                <SearchIcon />
              </div>
            </div>
          </div>

          {/* Popular locations */}
          <div style={{ padding: '0 20px 8px', fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {searchQuery ? 'Search results' : 'Popular in Kallakurichi'}
          </div>

          <div style={{ overflow: 'auto' }}>
            {(searchQuery ? suggestions : KK_LOCATIONS.slice(0, 10)).map(loc => (
              <div key={loc.name} className="search-result-item" onClick={() => selectLocation(loc)}>
                <div className="sri-dot" style={{ background: activeInput === 'pickup' ? 'var(--green)' : 'var(--red)' }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{loc.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kallakurichi District</div>
                </div>
              </div>
            ))}
            {searchQuery && suggestions.length === 0 && (
              <div className="empty">No locations found for "{searchQuery}"</div>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIRM SCREEN ── */}
      {screen === 'confirm' && (
        <div className="screen fade-in">
          <button className="back-btn" onClick={() => setScreen('home')}>← Back</button>
          <div className="book-card">
            <div className="sec-title">Confirm your ride</div>

            {/* Route display */}
            <div className="route-inputs">
              <div className="ri-row" onClick={() => { setActiveInput('pickup'); setSearchQuery(''); setScreen('search') }}>
                <span className="ri-dot green" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pickup</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{pickup || 'Select pickup'}</div>
                </div>
              </div>
              <div className="ri-line" />
              <div className="ri-row" onClick={() => { setActiveInput('drop'); setSearchQuery(''); setScreen('search') }}>
                <span className="ri-dot red" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Drop</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{drop || 'Select drop'}</div>
                </div>
              </div>
            </div>

            {/* Map */}
            {(pickup || drop) && (
              <MapView pickup={pickup} drop={drop} pickupCoords={pickupCoords} dropCoords={dropCoords} />
            )}

            {/* Vehicle */}
            <div className="vh-row">
              <button className={`vh-card ${vehicleType === 'bike' ? 'vh-on' : ''}`} onClick={() => { setVehicleType('bike'); calcFare() }}>
                <BikeIcon /><div className="vh-name">Bike</div>
              </button>
              <button className={`vh-card ${vehicleType === 'auto' ? 'vh-on' : ''}`} onClick={() => { setVehicleType('auto'); calcFare() }}>
                <AutoIcon /><div className="vh-name">Auto</div>
              </button>
            </div>

            {/* Distance */}
            <div className="km-row">
              <span className="km-label">Distance (km)</span>
              <div className="km-ctrl">
                <button className="km-btn" onClick={() => { setKm(Math.max(1, km - 1)); setFare(null) }}>−</button>
                <span className="km-val">{km}</span>
                <button className="km-btn" onClick={() => { setKm(km + 1); setFare(null) }}>+</button>
              </div>
            </div>

            {/* Fare */}
            <div className="fare-row">
              <button className="btn-ghost" onClick={calcFare}>Estimate fare</button>
              {fare !== null && <div className="fare-pill">₹{fare}</div>}
            </div>

            <button className="btn-primary full big" onClick={bookRide} disabled={loading || !pickup || !drop}>
              {loading ? 'Booking…' : `Book ${vehicleType === 'bike' ? '🏍' : '🛺'} Now`}
            </button>
          </div>
        </div>
      )}

      {/* ── RIDES SCREEN ── */}
      {screen === 'rides' && (
        <div className="screen fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div className="sec-title" style={{ padding: 0 }}>My Rides</div>
            <button className="btn-ghost sm" onClick={loadRides}>↻ Refresh</button>
          </div>
          {rides.length === 0 ? (
            <div className="empty">No rides yet.<br />Book your first ride! 🏍</div>
          ) : (
            rides.slice().reverse().map(r => (
              <div key={r.id} className="driver-card">
                <div className="dc-head">
                  <div className="dc-type">{r.vehicleType === 'bike' ? <BikeIcon /> : <AutoIcon />}</div>
                  <div className="ride-badge" style={{ background: statusColor(r.status) + '22', color: statusColor(r.status) }}>
                    {r.status}
                  </div>
                </div>
                <div className="dc-route"><span className="ri-dot green sm" /> {r.pickup}</div>
                <div className="dc-route" style={{ marginTop: 4 }}><span className="ri-dot red sm" /> {r.drop}</div>

                {/* OTP Display */}
                {r.status === 'accepted' && (r as Ride & { otp?: string }).otp && (
                  <div style={{
                    background: 'rgba(255,214,0,0.1)',
                    border: '2px dashed #FFD600',
                    borderRadius: 12,
                    padding: '12px 16px',
                    margin: '10px 0',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>🔐 Share this OTP with driver</div>
                    <div style={{ fontSize: 40, fontWeight: 800, color: '#FFD600', letterSpacing: 12 }}>
                      {(r as Ride & { otp?: string }).otp}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Driver is on the way!</div>
                  </div>
                )}

                <div style={{ margin: '10px 0' }}>
                  <MapView
                    pickup={r.pickup}
                    drop={r.drop}
                    pickupCoords={getCoordsForLocation(r.pickup)}
                    dropCoords={getCoordsForLocation(r.drop)}
                  />
                </div>
                <div className="dc-row">
                  <span className="muted-text">{new Date(r.createdAt).toLocaleString()}</span>
                  {r.fare?.total && <span className="dc-fare">₹{r.fare.total}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── PROFILE SCREEN ── */}
      {screen === 'profile' && (
        <div className="screen fade-in">
          <div className="auth-card" style={{ margin: '24px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(255,214,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 32
              }}>👤</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{userPhone}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Passenger</div>
            </div>
            <div style={{
              background: 'var(--bg3)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 12
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total rides</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{rides.length}</div>
            </div>
            <button className="btn-ghost full" style={{ color: 'var(--red)' }} onClick={doLogout}>
              Logout
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav className="bnav">
        <button className={`bn ${screen === 'home' || screen === 'search' || screen === 'confirm' ? 'bn-on' : ''}`}
          onClick={() => setScreen('home')}>
          <HomeIcon /><span>Home</span>
        </button>
        <button className={`bn ${screen === 'rides' ? 'bn-on' : ''}`}
          onClick={() => { if (loggedIn) { loadRides(); setScreen('rides') } else setScreen('auth') }}>
          <RideIcon /><span>My Rides</span>
        </button>
        <button className={`bn ${screen === 'profile' ? 'bn-on' : ''}`}
          onClick={() => loggedIn ? setScreen('profile') : setScreen('auth')}>
          <UserIcon /><span>Profile</span>
        </button>
      </nav>
    </div>
  )
}
