export async function geocodeAddress(address) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q: address, format: "json", limit: 1 });

  const res = await fetch(url, {
    headers: { "User-Agent": "RescueRoute/1.0 (academic project)" }
  });

  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  if (!data.length) throw new Error("Address not found");

  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    displayName: data[0].display_name
  };
}
