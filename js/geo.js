export function haversine(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * radiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function routeUrl(from, to) {
  return `https://yandex.ru/maps/?rtext=${from[1]},${from[0]}~${to[1]},${to[0]}&rtt=auto`;
}

export function mapPointUrl(to) {
  return `https://yandex.ru/maps/?ll=${to[0]},${to[1]}&z=12&pt=${to[0]},${to[1]},pm2rdm`;
}
