import L from "leaflet";

const iconBase =
  "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/";

const baseOptions = {
  shadowUrl: `${iconBase}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
};

export const fireIcon = new L.Icon({
  ...baseOptions,
  iconUrl: `${iconBase}marker-icon-red.png`
});

export const ambulanceIcon = new L.Icon({
  ...baseOptions,
  iconUrl: `${iconBase}marker-icon-green.png`
});

export const policeIcon = new L.Icon({
  ...baseOptions,
  iconUrl: `${iconBase}marker-icon-blue.png`
});

export function getResponderIcon(role) {
  switch (role) {
    case "FIRE":
      return fireIcon;
    case "AMBULANCE":
      return ambulanceIcon;
    case "POLICE":
      return policeIcon;
    default:
      return ambulanceIcon;
  }
}
