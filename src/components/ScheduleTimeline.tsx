import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { Trip, ScheduleItem } from '../types';
import { Plus, Trash2, Pencil, Clock, MapPin, Coffee, Utensils, ShoppingBag, Car, Hotel, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface ScheduleTimelineProps {
  trip: Trip;
}

const CATEGORY_ICONS = {
  visit: MapPin,
  food: Utensils,
  shopping: ShoppingBag,
  transport: Car,
  hotel: Hotel,
  other: Info
};

const CATEGORY_LABELS = {
  visit: '방문',
  food: '식사',
  shopping: '쇼핑',
  transport: '교통',
  hotel: '숙소',
  other: '기타'
};

export function ScheduleTimeline({ trip }: ScheduleTimelineProps) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const placesLib = useMapsLibrary('places');
  const autocompleteInputRef = useRef<HTMLInputElement>(null);

  // New item form
  const [newItem, setNewItem] = useState({
    title: '',
    time: '09:00',
    description: '',
    locationName: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    category: 'visit' as ScheduleItem['category']
  });

  useEffect(() => {
    if (!placesLib || (!isAdding && !editingItem) || !autocompleteInputRef.current || typeof google === 'undefined') return;

    const autocomplete = new google.maps.places.Autocomplete(autocompleteInputRef.current, {
      fields: ['geometry', 'name', 'formatted_address']
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place && place.geometry && place.geometry.location) {
        setNewItem(prev => ({
          ...prev,
          locationName: place.name || '',
          lat: place.geometry!.location!.lat(),
          lng: place.geometry!.location!.lng(),
          title: prev.title || place.name || ''
        }));
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [placesLib, isAdding, editingItem]);

  const totalDays = Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  useEffect(() => {
    const q = query(
      collection(db, `trips/${trip.id}/schedule`),
      orderBy('time', 'asc'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleItem[];
      setItems(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [trip.id]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Relaxed coordinate requirement to allow non-geographic items
    /* 
    if (!newItem.lat || !newItem.lng) {
      alert('정확한 일정을 위해 지도에서 장소를 검색하여 선택해주세요.');
      return;
    }
    */

    const dataToSave = {
      ...newItem,
      locationName: newItem.locationName?.trim() || '',
      lat: (newItem.locationName?.trim()) ? (newItem.lat ?? null) : null,
      lng: (newItem.locationName?.trim()) ? (newItem.lng ?? null) : null,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, `trips/${trip.id}/schedule`, editingItem.id), dataToSave);
        setEditingItem(null);
      } else {
        await addDoc(collection(db, `trips/${trip.id}/schedule`), {
          ...dataToSave,
          tripId: trip.id,
          day: activeDay,
          order: items.filter(i => i.day === activeDay).length
        });
        setIsAdding(false);
      }
      setNewItem({ title: '', time: '09:00', description: '', locationName: '', lat: undefined, lng: undefined, category: 'visit' });
    } catch (error) {
      console.error('Error saving schedule item:', error);
    }
  };

  const startEditing = (item: ScheduleItem) => {
    setEditingItem(item);
    setNewItem({
      title: item.title,
      time: item.time,
      description: item.description,
      locationName: item.locationName,
      lat: item.lat,
      lng: item.lng,
      category: item.category
    });
  };

  const dayDate = addDays(parseISO(trip.startDate), activeDay - 1);
  const filteredItems = items.filter(item => item.day === activeDay);

  return (
    <div className="space-y-6">
      {/* Day Selector */}
      <div className="flex flex-wrap gap-1.5 pb-2">
        {Array.from({ length: totalDays }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i + 1)}
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-all border ${
              activeDay === i + 1 
                ? "bg-natural-olive text-white border-natural-olive shadow-sm" 
                : "bg-white text-natural-muted border-natural-border hover:bg-natural-sidebar"
            }`}
          >
            <span className="text-[7px] font-bold opacity-70">DAY</span>
            <span className="text-xs font-bold">{i + 1}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center bg-natural-sidebar p-6 rounded-3xl border border-natural-border">
        <div>
          <p className="text-[10px] font-black text-natural-terracotta uppercase tracking-[0.2em] mb-1">일정 타임라인</p>
          <h3 className="text-2xl font-serif text-natural-heading">
            {format(dayDate, 'M월 d일 (E)', { locale: ko })}
          </h3>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-natural-olive text-white p-4 rounded-full shadow-lg hover:bg-[#4A4A35] transition-all"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-natural-muted italic">일정을 불러오는 중입니다...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-32 text-center space-y-6 bg-white/50 rounded-4xl border border-natural-border border-dashed">
          <div className="w-20 h-20 bg-natural-sidebar rounded-full flex items-center justify-center mx-auto opacity-50">
            <Clock size={32} className="text-natural-muted" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-serif text-natural-heading italic">기록된 일정이 없습니다</p>
            <p className="text-sm text-natural-muted">이날의 첫 번째 목적지를 추가해보세요.</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="text-natural-terracotta font-bold text-sm tracking-wide uppercase underline underline-offset-4"
          >
            새 일정 추가하기
          </button>
        </div>
      ) : (
        <div className="relative pl-0 space-y-2 py-1">
          {/* Vertical Timeline Line - Removed for more horizontal space */}
          
          {filteredItems.map((item, idx) => {
            const Icon = CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS] || Info;
            return (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={item.id} 
                className="relative flex gap-1.5 sm:gap-2 items-center group"
              >
                <div className="w-8 sm:w-10 flex-shrink-0">
                  <p className="text-[10px] font-black text-natural-olive uppercase tracking-tighter">{item.time}</p>
                </div>
                
                <div 
                  onClick={() => startEditing(item)}
                  className="flex-1 flex items-start justify-between min-w-0 bg-white/30 hover:bg-white/60 p-2 rounded-xl transition-all cursor-pointer group/item"
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="font-bold text-xs text-natural-heading truncate">{item.title}</h4>
                      {item.locationName && (
                        <div className="flex items-center gap-0.5 text-natural-muted text-[9px] font-medium truncate">
                          <MapPin size={8} className="text-natural-terracotta flex-shrink-0" />
                          <span className="truncate opacity-80">{item.locationName}</span>
                        </div>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[#9A9186] text-[9px] leading-relaxed opacity-70 whitespace-pre-wrap">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 opacity-40 group-hover/item:opacity-100 transition-all">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(item);
                      }}
                      className="p-1 text-natural-muted hover:text-natural-olive transition-all"
                      title="수정"
                    >
                      <Pencil size={11} />
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if(confirm('이 일정을 삭제할까요?')) {
                          await deleteDoc(doc(db, `trips/${trip.id}/schedule`, item.id));
                        }
                      }}
                      className="p-1 text-natural-muted hover:text-natural-terracotta transition-all"
                      title="삭제"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      <AnimatePresence>
        {(isAdding || editingItem) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                setEditingItem(null);
                setNewItem({ title: '', time: '09:00', description: '', locationName: '', lat: undefined, lng: undefined, category: 'visit' });
              }}
              className="absolute inset-0 bg-natural-heading/30 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-sm relative shadow-2xl space-y-3 sm:space-y-4"
            >
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-widest text-natural-terracotta font-black">{activeDay}일차</p>
                <h2 className="text-xl sm:text-2xl font-serif text-natural-heading italic">
                  {editingItem ? '일정 수정' : '일정 추가'}
                </h2>
              </div>
              
              <form onSubmit={handleAddItem} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-muted uppercase">시간</label>
                    <input 
                      required
                      type="time" 
                      className="w-full p-2.5 bg-natural-sidebar border border-natural-border rounded-xl text-sm outline-none focus:bg-white transition-all font-bold"
                      value={newItem.time}
                      onChange={(e) => setNewItem({...newItem, time: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-natural-muted uppercase">일정 제목</label>
                    <input 
                      required
                      type="text" 
                      placeholder="일정을 입력하세요"
                      className="w-full p-2.5 bg-natural-sidebar border border-natural-border rounded-xl text-sm outline-none focus:bg-white transition-all"
                      value={newItem.title}
                      onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-natural-muted uppercase">장소</label>
                    {newItem.locationName && (
                      <button 
                        type="button"
                        onClick={() => setNewItem({...newItem, locationName: '', lat: undefined, lng: undefined})}
                        className="text-[8px] font-bold text-natural-terracotta underline"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                  <input 
                    ref={autocompleteInputRef}
                    type="text"
                    placeholder="장소를 검색하거나 입력하세요"
                    className="w-full p-2.5 bg-natural-sidebar border border-natural-border rounded-xl text-sm outline-none focus:bg-white transition-all font-medium"
                    value={newItem.locationName}
                    onChange={(e) => setNewItem({...newItem, locationName: e.target.value})}
                  />
                  {!newItem.lat && (
                    <p className="text-[8px] text-natural-terracotta font-medium pl-1 italic">
                      * 지도 표시를 위해 검색 목록에서 항목을 선택하는 것이 좋습니다.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase">메모</label>
                  <textarea 
                    rows={2}
                    placeholder="간단한 메모를 남기세요"
                    className="w-full p-2.5 bg-natural-sidebar border border-natural-border rounded-xl text-sm outline-none focus:bg-white transition-all resize-none"
                    value={newItem.description}
                    onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(CATEGORY_ICONS) as Array<keyof typeof CATEGORY_ICONS>).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewItem({...newItem, category: cat})}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
                          newItem.category === cat 
                            ? "bg-natural-olive text-white border-natural-olive shadow-sm" 
                            : "bg-white text-natural-muted border-natural-border hover:bg-natural-sidebar"
                        }`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAdding(false);
                      setEditingItem(null);
                      setNewItem({ title: '', time: '09:00', description: '', locationName: '', lat: undefined, lng: undefined, category: 'visit' });
                    }}
                    className="flex-1 py-3 bg-gray-50 text-natural-muted rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors border border-natural-border"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-natural-olive text-white rounded-xl text-xs font-bold hover:bg-[#4A4A35] transition-colors shadow-lg"
                  >
                    {editingItem ? '수정 완료' : '등록'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
