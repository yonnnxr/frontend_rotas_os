import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrige o problema dos ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  geojsonData?: GeoJSON.FeatureCollection;
}

export default function Map({ geojsonData }: MapProps) {
  useEffect(() => {
    // Força o recálculo do tamanho do mapa quando o componente é montado
    window.dispatchEvent(new Event('resize'));
  }, []);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[-23.5505, -46.6333]} // São Paulo
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojsonData && (
          <GeoJSON 
            data={geojsonData}
            style={() => ({
              color: '#3B82F6',
              weight: 2,
              opacity: 0.65
            })}
          />
        )}
      </MapContainer>
    </div>
  );
} 