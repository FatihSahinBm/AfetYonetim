// Web-only: Leaflet haritasını iframe içinde gösterir
// React 19 uyumlu — findDOMNode kullanılmaz
import React, { useMemo } from 'react';

interface Report {
  id: string;
  lat: number | null;
  lon: number | null;
  user_id?: string;
  created_at?: string;
}

export default function TrapMap({ reports }: { reports: Report[] }) {
  const validReports = reports.filter(r => r.lat != null && r.lon != null);

  const center = validReports.length > 0
    ? { lat: validReports[0].lat!, lon: validReports[0].lon! }
    : { lat: 39.9334, lon: 32.8597 }; // Ankara

  const markersJs = validReports.map(r => {
    const time = r.created_at
      ? new Date(r.created_at).toLocaleString('tr-TR')
      : 'Bilinmiyor';
    const uid = r.user_id ? r.user_id.substring(0, 12) + '...' : 'Anonim';
    return `
      L.marker([${r.lat}, ${r.lon}], { icon: redIcon })
        .bindPopup(\`
          <div style="font-family:sans-serif;min-width:160px;">
            <b style="color:#EF4444;">🆘 MAHSUR KALAN</b><br/>
            <hr style="margin:6px 0;"/>
            <small>Kullanıcı: ${uid}</small><br/>
            <small>Bildirim: ${time}</small>
          </div>
        \`).addTo(map);
    `;
  }).join('\n');

  const fitBoundsJs = validReports.length > 1
    ? `map.fitBounds([${validReports.map(r => `[${r.lat},${r.lon}]`).join(',')}], {padding:[40,40]});`
    : '';

  const noDataPopup = validReports.length === 0
    ? `L.popup().setLatLng([${center.lat},${center.lon}]).setContent('<b>Konumu kayıtlı mahsur kalan bulunmuyor.</b>').openOn(map);`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.8); }
      70%  { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
      100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    }
    .trap-icon { animation: pulse 1.6s infinite; border-radius:50%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${center.lat}, ${center.lon}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    var redIcon = L.divIcon({
      className: '',
      html: '<div class="trap-icon" style="width:34px;height:34px;background:#EF4444;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🆘</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -20]
    });

    ${markersJs}
    ${fitBoundsJs}
    ${noDataPopup}
  </script>
</body>
</html>`;

  const blobUrl = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length, JSON.stringify(validReports.map(r => r.id))]);

  return React.createElement('iframe', {
    src: blobUrl,
    style: {
      width: '100%',
      height: 300,
      border: 'none',
      borderRadius: 12,
      display: 'block',
    },
    title: 'Mahsur Kalan Haritası',
  });
}
