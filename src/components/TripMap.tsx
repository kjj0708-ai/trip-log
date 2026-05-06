import { useEffect, useState } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { db } from '../lib/firebase';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Trip, ScheduleItem } from '../types';

interface TripMapProps {
  trip: Trip;
}

const CATEGORY_COLORS: Record<string, { background: string; border: string; glyph: string }> = {
  food: { background: '#f59e0b', border: '#b45309', glyph: '#fff' },     // Amber/Orange
  hotel: { background: '#3b82f6', border: '#1d4ed8', glyph: '#fff' },    // Blue
  visit: { background: '#10b981', border: '#047857', glyph: '#fff' },    // Emerald
  shopping: { background: '#ec4899', border: '#be185d', glyph: '#fff' }, // Pink
  transport: { background: '#6b7280', border: '#374151', glyph: '#fff' },// Gray
  other: { background: '#9ca3af', border: '#4b5563', glyph: '#fff' }     // Light Gray
};

export function TripMap({ trip }: TripMapProps) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const map = useMap();

  useEffect(() => {
    // Reference the specific trip's schedule collection
    const scheduleRef = collection(db, `trips/${trip.id}/schedule`);
    
    // Using onSnapshot for real-time updates
    const unsubscribe = onSnapshot(scheduleRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleItem[];
      
      // Strict filtering: Only items with valid name AND valid numeric coordinates
      const mapItems = data.filter(item => 
        item.locationName && 
        typeof item.locationName === 'string' &&
        item.locationName.trim() !== '' &&
        typeof item.lat === 'number' && 
        typeof item.lng === 'number' &&
        !isNaN(item.lat) &&
        !isNaN(item.lng)
      );
      
      setItems(mapItems);
    }, (error) => {
      console.error("Firestore Map Error:", error);
    });

    return unsubscribe;
  }, [trip.id]);

  useEffect(() => {
    if (!map || items.length === 0 || typeof google === 'undefined') return;

    const bounds = new google.maps.LatLngBounds();
    items.forEach(item => {
      if (item.lat && item.lng) {
        bounds.extend({ lat: item.lat, lng: item.lng });
      }
    });
    
    map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
  }, [map, items]);

  return (
    <div className="w-full h-[60vh] rounded-[40px] overflow-hidden border border-natural-border shadow-inner relative">
      <Map
        defaultCenter={{ lat: 0, lng: 0 }}
        defaultZoom={3}
        gestureHandling={'greedy'}
        reuseMaps={true}
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        {items.map((item, idx) => {
          const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;
          return (
            <AdvancedMarker
              key={item.id}
              position={{ lat: item.lat!, lng: item.lng! }}
              zIndex={5000 + idx}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '2px 4px 2px 6px',
                  borderRadius: '4px',
                  border: '1.5px solid #000000',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  marginBottom: '2px',
                  zIndex: 6000,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}>
                  <span style={{
                    fontSize: '5pt',
                    fontWeight: '900',
                    color: '#000000',
                    whiteSpace: 'nowrap',
                    lineHeight: '1',
                    letterSpacing: '-0.01em'
                  }}>
                    {item.locationName}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`'${item.title}' 핀을 삭제할까요?`)) {
                        await deleteDoc(doc(db, `trips/${item.tripId}/schedule`, item.id));
                      }
                    }}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      border: 'none',
                      color: 'white',
                      fontSize: '8px',
                      lineHeight: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="핀 삭제"
                  >
                    ×
                  </button>
                </div>
                <Pin
                  background={colors.background}
                  borderColor={colors.border}
                  glyphColor={colors.glyph}
                  scale={0.7}
                />
              </div>
            </AdvancedMarker>
          );
        })}
      </Map>
      
      {items.length === 0 && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <h3 className="text-xl font-serif text-natural-heading italic">표시할 장소가 없습니다</h3>
            <p className="text-xs text-natural-muted">일정에서 장소를 검색해 추가해 보세요.</p>
          </div>
        </div>
      )}
    </div>
  );
}
