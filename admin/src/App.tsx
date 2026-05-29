import { useEffect, useState } from 'react'
import './App.css'
import { getAllRides, getAllDrivers, getAllPassengers, updateRideStatus, toggleDriverStatus, adminLogin, type AdminRide, type AdminDriver, type AdminPassenger } from './api'

/* ── Icons ─────────────────────────────────────────────────────── */
const Icon = {
  dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>,
  rides:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 8h10l-2-8z"/><path d="M12 6V3"/></svg>,
  drivers:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  passengers:() => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  logout:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  refresh:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  check:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  x:         () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bike:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 8h10l-2-8z"/></svg>,
  auto:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 6v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  search:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
}

type Tab = 'dashboard' | 'rides' | 'drivers' | 'passengers'

/* ── Mock data fallback (when API not ready) ────────────────────── */
const MOCK_RIDES: AdminRide[] = [
  { id: 'r001', pickup: 'Srirangam', drop: 'Trichy Junction', vehicleType: 'bike', status: 'completed', fare: { total: 45 }, createdAt: new Date(Date.now()-3600000).toISOString(), passengerPhone: '9876543210', driverPhone: '9123456789' },
  { id: 'r002', pickup: 'Woraiyur', drop: 'Ariyamangalam', vehicleType: 'auto', status: 'pending', fare: { total: 80 }, createdAt: new Date(Date.now()-1800000).toISOString(), passengerPhone: '9001234567', driverPhone: null },
  { id: 'r003', pickup: 'Thillai Nagar', drop: 'Chatram Bus Stand', vehicleType: 'bike', status: 'accepted', fare: { total: 55 }, createdAt: new Date(Date.now()-900000).toISOString(), passengerPhone: '9345678901', driverPhone: '9876501234' },
  { id: 'r004', pickup: 'KK Nagar', drop: 'Cantonment', vehicleType: 'auto', status: 'cancelled', fare: { total: 70 }, createdAt: new Date(Date.now()-7200000).toISOString(), passengerPhone: '9456789012', driverPhone: null },
  { id: 'r005', pickup: 'Palpannai', drop: 'Rock Fort', vehicleType: 'bike', status: 'completed', fare: { total: 35 }, createdAt: new Date(Date.now()-10800000).toISOString(), passengerPhone: '9567890123', driverPhone: '9234567890' },
]
const MOCK_DRIVERS: AdminDriver[] = [
  { id: 'd001', name: 'Murugan K', phone: '9123456789', vehicleType: 'bike', vehicleNumber: 'TN45 AB 1234', isActive: true, totalRides: 128, rating: 4.8 },
  { id: 'd002', name: 'Selvam R', phone: '9876501234', vehicleType: 'auto', vehicleNumber: 'TN45 CD 5678', isActive: true, totalRides: 87, rating: 4.6 },
  { id: 'd003', name: 'Arjun P', phone: '9234567890', vehicleType: 'bike', vehicleNumber: 'TN45 EF 9012', isActive: false, totalRides: 43, rating: 4.3 },
  { id: 'd004', name: 'Rajan S', phone: '9345001234', vehicleType: 'auto', vehicleNumber: 'TN45 GH 3456', isActive: true, totalRides: 201, rating: 4.9 },
]
const MOCK_PASSENGERS: AdminPassenger[] = [
  { id: 'p001', phone: '9876543210', totalRides: 22, createdAt: '2026-01-15T00:00:00Z' },
  { id: 'p002', phone: '9001234567', totalRides: 5,  createdAt: '2026-03-02T00:00:00Z' },
  { id: 'p003', phone: '9345678901', totalRides: 14, createdAt: '2026-02-10T00:00:00Z' },
  { id: 'p004', phone: '9456789012', totalRides: 3,  createdAt: '2026-04-20T00:00:00Z' },
  { id: 'p005', phone: '9567890123', totalRides: 31, createdAt: '2025-12-01T00:00:00Z' },
]

export default function AdminApp() {
  const [authed, setAuthed]         = useState(() => !!localStorage.getItem('tn15_admin_token'))
  const [adminPhone, setAdminPhone] = useState('')
  const [adminPass, setAdminPass]   = useState('')
  const [authErr, setAuthErr]       = useState('')
  const [tab, setTab]               = useState<Tab>('dashboard')
  const [rides, setRides]           = useState<AdminRide[]>(MOCK_RIDES)
  const [drivers, setDrivers]       = useState<AdminDriver[]>(MOCK_DRIVERS)
  const [passengers, setPassengers] = useState<AdminPassenger[]>(MOCK_PASSENGERS)
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState('')
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

 async function doLogin() {
    setAuthErr('')
    try {
      const r = await adminLogin({ phone: adminPhone, password: adminPass })
      localStorage.setItem('tn15_admin_token', r.token)
      setAuthed(true)
    } catch (e: unknown) {
      setAuthErr(e instanceof Error ? e.message : 'Invalid credentials')
    }
  } 

async function loadData() {
    setLoading(true)
    try {
      const [r, d, p] = await Promise.all([getAllRides(), getAllDrivers(), getAllPassengers()])
      if (r.rides) setRides(r.rides)
      if (d.drivers) setDrivers(d.drivers)
      if (p.passengers) setPassengers(p.passengers)
    } catch (e) {
      console.error('Failed to load data:', e)
      showToast('Failed to load real data — check backend')
    }
    setLoading(false)
  }

  useEffect(() => { if (authed) loadData() }, [authed])

  async function handleRideStatus(id: string, status: string) {
    try {
      await updateRideStatus(id, status)
    } catch {}
    setRides(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    showToast(`Ride ${status}`)
  }

  async function handleToggleDriver(id: string) {
    const driver = drivers.find(d => d.id === id)
    if (!driver) return
    try { await toggleDriverStatus(id, !driver.isActive) } catch {}
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d))
    showToast(driver.isActive ? 'Driver deactivated' : 'Driver activated')
  }

  /* ── Stats ─── */
  const stats = {
    totalRides:     rides.length,
    activeRides:    rides.filter(r => r.status === 'accepted' || r.status === 'pending').length,
    completedToday: rides.filter(r => r.status === 'completed').length,
    revenue:        rides.filter(r => r.status === 'completed').reduce((s, r) => s + (r.fare?.total ?? 0), 0),
    activeDrivers:  drivers.filter(d => d.isActive).length,
    totalPassengers:passengers.length,
  }

  const filteredRides = rides.filter(r => {
    const matchSearch = !search || r.pickup.toLowerCase().includes(search.toLowerCase()) || r.drop.toLowerCase().includes(search.toLowerCase()) || r.passengerPhone?.includes(search)
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const statusColor = (s: string) => {
    if (s === 'pending')   return { bg: '#FFB80020', text: '#FFB800' }
    if (s === 'accepted')  return { bg: '#00D97E20', text: '#00D97E' }
    if (s === 'completed') return { bg: '#6C8EFF20', text: '#6C8EFF' }
    if (s === 'cancelled') return { bg: '#FF4D6A20', text: '#FF4D6A' }
    return { bg: '#88889620', text: '#888896' }
  }

  /* ── Login screen ─────────────────────────────────────────────── */
  if (!authed) return (
    <div className="adm-app">
      <div className="login-wrap">
        <div className="login-brand">TN<span className="acc">15</span></div>
        <div className="login-title">Admin Panel</div>
        <div className="login-sub">Bike & Auto Taxi — Kallakurichii</div>
        <div className="login-card">
          <input className="adm-inp" placeholder="Admin phone" value={adminPhone} onChange={e => setAdminPhone(e.target.value)} />
          <input className="adm-inp" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()} />
          {authErr && <div className="login-err">{authErr}</div>}
          <button className="adm-btn-primary" onClick={doLogin}>Login</button>
          <div className="login-hint">Demo: 9999999999 / admin123</div>
        </div>
      </div>
    </div>
  )

  /* ── Main dashboard ───────────────────────────────────────────── */
  return (
    <div className="adm-app">
      {toast && <div className="adm-toast">{toast}</div>}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sb-brand">TN<span className="acc">15</span></div>
        <div className="sb-label">Admin</div>
        <nav className="sb-nav">
          {([['dashboard','Dashboard'],['rides','Rides'],['drivers','Drivers'],['passengers','Passengers']] as [Tab,string][]).map(([t, label]) => (
            <button key={t} className={`sb-item ${tab === t ? 'sb-on' : ''}`} onClick={() => setTab(t)}>
              {Icon[t]()}
              <span>{label}</span>
              {t === 'rides' && stats.activeRides > 0 && <span className="sb-badge">{stats.activeRides}</span>}
            </button>
          ))}
        </nav>
        <button className="sb-logout" onClick={() => { localStorage.removeItem('tn15_admin_token'); setAuthed(false) }}>
          {Icon.logout()} Logout
        </button>
      </aside>

      {/* Main */}
      <main className="adm-main">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">
            {tab === 'dashboard' && 'Overview'}
            {tab === 'rides' && 'All Rides'}
            {tab === 'drivers' && 'Drivers'}
            {tab === 'passengers' && 'Passengers'}
          </div>
          <button className="adm-btn-ghost icon-btn" onClick={loadData} disabled={loading}>
            <span style={{ display:'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>{Icon.refresh()}</span>
          </button>
        </div>

        {/* ── DASHBOARD TAB ── */}
        {tab === 'dashboard' && (
          <div className="tab-content fade-in">
            <div className="stats-grid">
              <div className="stat-card accent">
                <div className="stat-val">₹{stats.revenue}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.totalRides}</div>
                <div className="stat-label">Total Rides</div>
              </div>
              <div className="stat-card green">
                <div className="stat-val">{stats.activeRides}</div>
                <div className="stat-label">Active Now</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.completedToday}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.activeDrivers}</div>
                <div className="stat-label">Active Drivers</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.totalPassengers}</div>
                <div className="stat-label">Passengers</div>
              </div>
            </div>

            {/* Recent rides */}
            <div className="section-title">Recent Rides</div>
            <div className="table-wrap">
              <table className="adm-table">
                <thead><tr><th>Route</th><th>Type</th><th>Fare</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>
                  {rides.slice(0,5).map(r => {
                    const sc = statusColor(r.status)
                    return (
                      <tr key={r.id}>
                        <td><div className="route-cell">{r.pickup} <span className="arr">→</span> {r.drop}</div></td>
                        <td><span className="type-badge">{r.vehicleType === 'bike' ? <>{Icon.bike()} Bike</> : <>{Icon.auto()} Auto</>}</span></td>
                        <td className="fare-cell">₹{r.fare?.total ?? '-'}</td>
                        <td><span className="status-badge" style={{ background: sc.bg, color: sc.text }}>{r.status}</span></td>
                        <td className="time-cell">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── RIDES TAB ── */}
        {tab === 'rides' && (
          <div className="tab-content fade-in">
            <div className="filter-bar">
              <div className="search-box">
                {Icon.search()}
                <input className="search-inp" placeholder="Search by location or phone…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="filter-pills">
                {['all','pending','accepted','completed','cancelled'].map(s => (
                  <button key={s} className={`filter-pill ${statusFilter === s ? 'pill-on' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table className="adm-table">
                <thead><tr><th>ID</th><th>Route</th><th>Type</th><th>Passenger</th><th>Driver</th><th>Fare</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredRides.map(r => {
                    const sc = statusColor(r.status)
                    return (
                      <tr key={r.id}>
                        <td className="id-cell">{r.id.slice(0,8)}</td>
                        <td><div className="route-cell">{r.pickup} <span className="arr">→</span> {r.drop}</div></td>
                        <td><span className="type-badge">{r.vehicleType === 'bike' ? <>{Icon.bike()} Bike</> : <>{Icon.auto()} Auto</>}</span></td>
                        <td className="phone-cell">{r.passengerPhone ?? '-'}</td>
                        <td className="phone-cell">{r.driverPhone ?? <span className="muted">Unassigned</span>}</td>
                        <td className="fare-cell">₹{r.fare?.total ?? '-'}</td>
                        <td><span className="status-badge" style={{ background: sc.bg, color: sc.text }}>{r.status}</span></td>
                        <td>
                          <div className="action-row">
                            {r.status === 'pending' && (
                              <>
                                <button className="act-btn green-btn" onClick={() => handleRideStatus(r.id, 'accepted')} title="Accept">{Icon.check()}</button>
                                <button className="act-btn red-btn" onClick={() => handleRideStatus(r.id, 'cancelled')} title="Cancel">{Icon.x()}</button>
                              </>
                            )}
                            {r.status === 'accepted' && (
                              <button className="act-btn blue-btn" onClick={() => handleRideStatus(r.id, 'completed')} title="Complete">{Icon.check()}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredRides.length === 0 && <div className="empty-state">No rides found</div>}
            </div>
          </div>
        )}

        {/* ── DRIVERS TAB ── */}
        {tab === 'drivers' && (
          <div className="tab-content fade-in">
            <div className="cards-grid">
              {drivers.map(d => (
                <div key={d.id} className={`driver-card ${d.isActive ? 'dc-active' : 'dc-inactive'}`}>
                  <div className="dc-top">
                    <div className="dc-avatar">{d.name.charAt(0)}</div>
                    <div className="dc-info">
                      <div className="dc-name">{d.name}</div>
                      <div className="dc-phone">{d.phone}</div>
                    </div>
                    <div className={`dc-status-dot ${d.isActive ? 'dot-on' : 'dot-off'}`} />
                  </div>
                  <div className="dc-details">
                    <span className="type-badge">{d.vehicleType === 'bike' ? <>{Icon.bike()} Bike</> : <>{Icon.auto()} Auto</>}</span>
                    <span className="dc-vehicle">{d.vehicleNumber}</span>
                  </div>
                  <div className="dc-stats">
                    <div className="dc-stat"><div className="dc-stat-val">{d.totalRides}</div><div className="dc-stat-lbl">Rides</div></div>
                    <div className="dc-stat"><div className="dc-stat-val">{d.rating}</div><div className="dc-stat-lbl">Rating</div></div>
                  </div>
                  <button className={`adm-toggle-btn ${d.isActive ? 'toggle-off' : 'toggle-on'}`} onClick={() => handleToggleDriver(d.id)}>
                    {d.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PASSENGERS TAB ── */}
        {tab === 'passengers' && (
          <div className="tab-content fade-in">
            <div className="table-wrap">
              <table className="adm-table">
                <thead><tr><th>Phone</th><th>Total Rides</th><th>Joined</th><th>Status</th></tr></thead>
                <tbody>
                  {passengers.map(p => (
                    <tr key={p.id}>
                      <td className="phone-cell">{p.phone}</td>
                      <td><span className="rides-count">{p.totalRides}</span></td>
                      <td className="time-cell">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td><span className="status-badge" style={{ background: '#00D97E20', color: '#00D97E' }}>Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
