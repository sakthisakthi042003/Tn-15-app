export type Role = 'passenger' | 'driver' | 'admin'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:4000'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('tn15_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? 'Request failed')
  return json as T
}

export async function health() {
  return api<{ ok: boolean; db: string }>('/api/health')
}

export async function sendOTP(phone: string) {
  return api<{ ok: boolean; message: string }>('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function verifyOTP(phone: string, otp: string) {
  return api<{ ok: boolean; message: string }>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  })
}

export async function forgotPassword(phone: string) {
  return api<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function resetPassword(phone: string, otp: string, newPassword: string) {
  return api<{ ok: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, newPassword }),
  })
}

export async function register(input: {
  phone: string
  password: string
  role?: 'passenger' | 'driver'
  name?: string
  vehicleType?: 'bike' | 'auto'
  vehicleNumber?: string
}) {
  return api<{ ok: boolean }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function login(input: { phone: string; password: string }) {
  return api<{ token: string; role: Role }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function estimateFare(input: { vehicleType: string; km: number }) {
  return api<{ estimate: { total: number } }>('/api/fare/estimate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export type Ride = {
  id: string
  pickup: string
  drop: string
  vehicleType: 'bike' | 'auto'
  km: number | null
  status: 'requested' | 'accepted' | 'completed' | 'cancelled'
  driverId: string | null
  createdAt: string
  fare: null | { total: number }
  otp?: string
  otpVerified?: number
}

export async function createRide(input: {
  pickup: string
  drop: string
  vehicleType: 'bike' | 'auto'
  km?: number
}) {
  return api<{ ride: Ride }>('/api/rides', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
}

export async function myRides() {
  return api<{ rides: Ride[] }>('/api/rides/mine', {
    headers: authHeaders(),
  })
}

export async function openRides() {
  return api<{ rides: Ride[] }>('/api/driver/rides/open', {
    headers: authHeaders(),
  })
}

export async function acceptRide(rideId: string) {
  return api<{ ride: Ride }>(`/api/driver/rides/${rideId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  })
}

export async function verifyRideOTP(rideId: string, otp: string) {
  return api<{ ok: boolean; message: string }>(`/api/driver/rides/${rideId}/verify-otp`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ otp }),
  })
}
export async function cancelRide(rideId: string) {
  return api<{ ok: boolean; message: string }>(`/api/rides/${rideId}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  })
}