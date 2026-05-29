import { useEffect, useRef } from 'react'

interface MapViewProps {
  pickup: string
  drop: string
  pickupCoords?: [number, number]
  dropCoords?: [number, number]
}

// Kallakurichi center coordinates
const KALLAKURICHI_CENTER: [number, number] = [11.7393, 79.0066]

export default function MapView({ pickup, drop, pickupCoords, dropCoords }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current) return

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default marker icons
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Destroy existing map instance
      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }

      // Create map centered on Kallakurichi
      const map = L.map(mapRef.current!, {
        center: KALLAKURICHI_CENTER,
        zoom: 13,
        zoomControl: true,
      })

      mapInstanceRef.current = map

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const markers: unknown[] = []
      const coords: [number, number][] = []

      // Green marker for pickup
      const greenIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#00D97E;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      })

      // Red marker for drop
      const redIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#FF4D6A;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      })

      if (pickupCoords) {
        const m = L.marker(pickupCoords, { icon: greenIcon })
          .addTo(map)
          .bindPopup(`<b>Pickup</b><br>${pickup}`)
        markers.push(m)
        coords.push(pickupCoords)
      }

      if (dropCoords) {
        const m = L.marker(dropCoords, { icon: redIcon })
          .addTo(map)
          .bindPopup(`<b>Drop</b><br>${drop}`)
        markers.push(m)
        coords.push(dropCoords)
      }

      // Draw route line if both coords exist
      if (pickupCoords && dropCoords) {
        L.polyline([pickupCoords, dropCoords], {
          color: '#FFD600',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }).addTo(map)

        // Fit map to show both markers
        const bounds = L.latLngBounds([pickupCoords, dropCoords])
        map.fitBounds(bounds, { padding: [40, 40] })
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
