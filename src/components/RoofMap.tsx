import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { BuildingFootprint, GeoPoint } from "../lib/geo";
import "leaflet/dist/leaflet.css";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function Recenter({ center, zoom }: { center: GeoPoint; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], zoom);
  }, [center.lat, center.lon, zoom, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (p: GeoPoint) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

interface Props {
  center: GeoPoint;
  pin: GeoPoint;
  buildings: BuildingFootprint[];
  selectedKey?: string;
  onPinMove: (p: GeoPoint) => void;
  onSelectBuilding?: (b: BuildingFootprint) => void;
  height?: number;
}

function buildingKey(b: BuildingFootprint): string {
  return b.osmId != null
    ? `osm-${b.osmId}`
    : `${b.source}-${b.center.lat.toFixed(5)}-${b.center.lon.toFixed(5)}`;
}

export function RoofMap({
  center,
  pin,
  buildings,
  selectedKey,
  onPinMove,
  onSelectBuilding,
  height = 360,
}: Props) {
  return (
    <div className="roof-map" style={{ height }}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={19}
        style={{ height: "100%", width: "100%", borderRadius: 12 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <Recenter center={center} zoom={19} />
        <ClickHandler onClick={onPinMove} />
        <Marker
          position={[pin.lat, pin.lon]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const ll = m.getLatLng();
              onPinMove({ lat: ll.lat, lon: ll.lng });
            },
          }}
        />
        {buildings.map((b) => {
          const key = buildingKey(b);
          const selected = selectedKey === key;
          const positions = b.ring.map(
            ([lon, lat]) => [lat, lon] as [number, number]
          );
          return (
            <Polygon
              key={key}
              positions={positions}
              pathOptions={{
                color: selected ? "#3dd68c" : "#f5b942",
                weight: selected ? 3 : 1.5,
                fillColor: selected ? "#3dd68c" : "#f5b942",
                fillOpacity: selected ? 0.35 : 0.15,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectBuilding?.(b);
                },
              }}
            />
          );
        })}
      </MapContainer>
      <div className="map-hint">
        Click map or drag pin · click outline to select building
      </div>
    </div>
  );
}

export { buildingKey };
