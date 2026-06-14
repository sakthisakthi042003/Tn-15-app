import { useEffect, useRef } from 'react'

interface MapViewProps {
  pickup: string
  drop: string
  pickupCoords?: [number, number]
  dropCoords?: [number, number]
  rideId?: string
  showDriverLocation?: boolean
}

const KALLAKURICHI_CENTER: [number, number] = [11.7393, 79.0066]

export default function MapView({ pickup, drop, pickupCoords, dropCoords, rideId, showDriverLocation }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const driverMarkerRef = useRef<unknown>(null)
  const socketRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(async (L) => {
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapRef.current!, { center: KALLAKURICHI_CENTER, zoom: 13 })
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map)

      const greenIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#00D97E;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8], className: '',
      })

      const redIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#FF4D6A;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8], className: '',
      })

      const driverIcon = L.divIcon({
        html: `<div style="width:36px;height:36px;background:#FFD600;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(255,214,0,0.6);display:flex;align-items:center;justify-content:center;font-size:18px">🏍</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: '',
      })

      if (pickupCoords) {
        L.marker(pickupCoords, { icon: greenIcon }).addTo(map).bindPopup(`<b>Pickup</b><br>${pickup}`)
      }

      if (dropCoords) {
        L.marker(dropCoords, { icon: redIcon }).addTo(map).bindPopup(`<b>Drop</b><br>${drop}`)
      }

      if (pickupCoords && dropCoords) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`
          const res = await fetch(url)
          const data = await res.json()
          if (data.code === 'Ok' && data.routes?.[0]) {
            const coords = data.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            )
            L.polyline(coords, { color: '#FFD600', weight: 5, opacity: 0.9 }).addTo(map)
            map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
          } else throw new Error('no route')
        } catch {
          L.polyline([pickupCoords, dropCoords], { color: '#FFD600', weight: 4, dashArray: '8,8' }).addTo(map)
          map.fitBounds(L.latLngBounds([pickupCoords, dropCoords]), { padding: [40, 40] })
        }
      }

      // Connect to socket and listen for driver location
      if (showDriverLocation && rideId) {
        try {
          const { io } = await import('socket.io-client')
          const apiBase = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? 'http://localhost:4000'
          const socket = io(apiBase)
          socketRef.current = socket

          socket.emit('passenger:join', { rideId })

          socket.on('driver:location', ({ lat, lng }: { lat: number; lng: number }) => {
            const pos: [number, number] = [lat, lng]
            if (driverMarkerRef.current) {
              // Move existing driver marker
              ;(driverMarkerRef.current as { setLatLng: (pos: [number, number]) => void }).setLatLng(pos)
            } else {
              // Create driver marker
              const marker = L.marker(pos, { icon: driverIcon })
                .addTo(map)
                .bindPopup('🏍 Driver is here!')
              driverMarkerRef.current = marker
            }
          })
        } catch {}
      }
    })

    return () => {
      if (socketRef.current) {
        ;(socketRef.current as { disconnect: () => void }).disconnect()
        socketRef.current = null
      }
      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [pickup, drop, pickupCoords, dropCoords, rideId, showDriverLocation])

  return (
    <div ref={mapRef} style={{
      width: '100%', height: '220px', borderRadius: '16px',
      overflow: 'hidden', border: '1px solid #2E2E38',
    }} />
  )
}