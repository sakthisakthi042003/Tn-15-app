import { useEffect, useRef } from 'react'

interface MapViewProps {
  pickup: string
  drop: string
  pickupCoords?: [number, number]
  dropCoords?: [number, number]
}

const KALLAKURICHI_CENTER: [number, number] = [11.7393, 79.0066]

export default function MapView({ pickup, drop, pickupCoords, dropCoords }: MapViewProps) {
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

      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapRef.current!, {
        center: KALLAKURICHI_CENTER,
        zoom: 13,
        zoomControl: true,
      })

      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const greenIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#00D97E;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      })

      const redIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#FF4D6A;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      })

      if (pickupCoords) {
        L.marker(pickupCoords, { icon: greenIcon })
          .addTo(map)
          .bindPopup(`<b>Pickup</b><br>${pickup}`)
      }

      if (dropCoords) {
        L.marker(dropCoords, { icon: redIcon })
          .addTo(map)
          .bindPopup(`<b>Drop</b><br>${drop}`)
      }

      if (pickupCoords && dropCoords) {
        // Try OSRM real road route first
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`
          const res = await fetch(url)
          const data = await res.json()

          if (data.code === 'Ok' && data.routes?.[0]) {
            const route = data.routes[0]
            const coords = route.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            )

            // Draw real road route
            L.polyline(coords, {
              color: '#FFD600',
              weight: 5,
              opacity: 0.9,
            }).addTo(map)

            // Fit map to route
            const bounds = L.latLngBounds(coords)
            map.fitBounds(bounds, { padding: [40, 40] })
          } else {
            throw new Error('No route found')
          }
        } catch {
          // Fallback to straight line if OSRM fails
          L.polyline([pickupCoords, dropCoords], {
            color: '#FFD600',
            weight: 4,
            opacity: 0.8,
            dashArray: '8, 8',
          }).addTo(map)

          const bounds = L.latLngBounds([pickupCoords, dropCoords])
          map.fitBounds(bounds, { padding: [40, 40] })
        }
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [pickup, drop, pickupCoords, dropCoords])

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '220px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid #2E2E38',
      }}
    />
  )
}