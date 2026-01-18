const map = L.map('map').setView([61, 100], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

fetch('data/checkpoints.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        const p = feature.properties;

        layer.bindPopup(`
          <strong>${p.name}</strong><br>
          Country: ${p.country}<br>
          Type: ${p.type}<br>
          Status: ${p.status}
        `);
      }
    }).addTo(map);
  })
  .catch(err => console.error(err));
