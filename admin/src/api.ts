export type Role = 'passenger' | 'driver' | 'admin'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:4000'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('tn15_admin_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(opts?.headers ?? {}) as Record<string, string>,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? err.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/* ── Types ────────────────────────────────────────────────────── */
export interface AdminRide {
  id: string
  pickup: string
  drop: string
  vehicleType: 'bike' | 'auto'
  status: string
  fare?: { total: number }
  createdAt: string
  passengerPhone: string | null
  driverPhone: string | null
}

export interface AdminDriver {
  id: string
  name: string
  phone: string
  vehicleType: 'bike' | 'auto'
  vehicleNumber: string
  isActive: boolean
  totalRides: number
  rating: number
}

export interface AdminPassenger {
  id: string
  phone: string
  totalRides: number
  createdAt: string
}

/* ── Auth ─────────────────────────────────────────────────────── */
export const adminLogin = (body: { phone: string; password: string }) =>
  req<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })

/* ── Rides ────────────────────────────────────────────────────── */
export const getAllRides = () =>
  req<{ rides: AdminRide[] }>('/api/admin/rides')

export const updateRideStatus = (id: string, status: string) =>
  req<{ ride: AdminRide }>(`/api/admin/rides/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

/* ── Drivers ──────────────────────────────────────────────────── */
export const getAllDrivers = () =>
  req<{ drivers: AdminDriver[] }>('/api/admin/drivers')

export const toggleDriverStatus = (id: string, isActive: boolean) =>
  req<{ driver: AdminDriver }>(`/api/admin/drivers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })

/* ── Passengers ───────────────────────────────────────────────── */
export const getAllPassengers = () =>
  req<{ passengers: AdminPassenger[] }>('/api/admin/passengers')