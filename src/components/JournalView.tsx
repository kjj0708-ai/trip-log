import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  doc,
  setDoc
} from 'firebase/firestore';
import { Trip, JournalEntry } from '../types';
import { Plus, Trash2, Camera, MapPin, Heart, BookOpen, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface JournalViewProps {
  trip: Trip;
}

export function JournalView({ trip }: JournalViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const totalDays = Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  useEffect(() => {
    const q = query(
      collection(db, `trips/${trip.id}/journal`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JournalEntry[];
      setEntries(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [trip.id]);

  const handleAddEntry = async () => {
    if (!newContent.trim()) return;
    try {
      if (editingId) {
        await setDoc(doc(db, `trips/${trip.id}/journal`, editingId), {
          tripId: trip.id,
          day: activeDay,
          content: newContent,
          imageUrl: imageUrl || null,
          linkUrl: linkUrl || null,
          updatedAt: Date.now()
        }, { merge: true });
        setEditingId(null);
      } else {
        await addDoc(collection(db, `trips/${trip.id}/journal`), {
          tripId: trip.id,
          day: activeDay,
          content: newContent,
          imageUrl: imageUrl || null,
          linkUrl: linkUrl || null,
          createdAt: Date.now()
        });
      }
      setIsAdding(false);
      setNewContent('');
      setImageUrl('');
      setLinkUrl('');
    } catch (error) {
      console.error('Error adding journal entry:', error);
    }
  };

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setNewContent(entry.content);
    setImageUrl(entry.imageUrl || '');
    setLinkUrl(entry.linkUrl || '');
    setIsAdding(true);
  };

  const dayDate = addDays(parseISO(trip.startDate), activeDay - 1);
  const dayEntries = entries.filter(e => e.day === activeDay);

  return (
    <div className="space-y-4">
      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomImage(null)}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={zoomImage} 
              className="max-w-full max-h-full rounded-lg shadow-2xl" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Selector - Compact & Wrap */}
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

      <div className="bg-natural-sidebar p-3 rounded-xl border border-natural-border space-y-2 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[8px] font-bold text-natural-terracotta uppercase tracking-wider">나의 기록</p>
            <h3 className="text-sm font-bold text-natural-heading">
              {format(dayDate, 'M월 d일 (E)', { locale: ko })}
            </h3>
          </div>
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="p-2 bg-natural-olive text-white rounded-lg shadow-sm hover:bg-[#4A4A35] transition-all"
            >
              <Camera size={16} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <textarea 
                autoFocus
                className="w-full bg-white p-2.5 rounded-lg border border-natural-border text-xs placeholder-natural-muted min-h-[80px] resize-none outline-none focus:ring-1 focus:ring-natural-olive"
                placeholder="어떤 일이 있었나요?"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-natural-border text-natural-muted focus-within:ring-1 focus-within:ring-natural-olive">
                  <Camera size={12} />
                  <input 
                    type="text" 
                    placeholder="이미지 URL (선택)" 
                    className="flex-1 bg-transparent text-[10px] outline-none text-natural-text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-natural-border text-natural-muted focus-within:ring-1 focus-within:ring-natural-olive">
                  <LinkIcon size={12} />
                  <input 
                    type="text" 
                    placeholder="링크 URL (선택)" 
                    className="flex-1 bg-transparent text-[10px] outline-none text-natural-text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                      setNewContent('');
                      setImageUrl('');
                      setLinkUrl('');
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold text-natural-muted hover:text-natural-text"
                  >취소</button>
                  <button 
                    onClick={handleAddEntry}
                    className="px-4 py-1.5 bg-natural-terracotta text-white rounded-lg text-[10px] font-bold shadow-sm"
                  >
                    {editingId ? '수정 완료' : '저장하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading ? (
        <div className="py-6 text-center text-[10px] text-natural-muted italic">로딩 중...</div>
      ) : dayEntries.length === 0 ? (
        <div className="py-12 text-center space-y-3 bg-white/50 rounded-xl border border-natural-border border-dashed">
          <BookOpen size={20} className="text-natural-muted mx-auto opacity-20" />
          <p className="text-xs font-medium text-natural-muted">기록이 비어있습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {dayEntries.map((entry) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              key={entry.id} 
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-natural-border group flex flex-col sm:flex-row"
            >
              {entry.imageUrl && (
                <div className="sm:w-1/4 aspect-video sm:aspect-square relative overflow-hidden shrink-0">
                  <img 
                    src={entry.imageUrl} 
                    onClick={() => setZoomImage(entry.imageUrl!)}
                    className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-500" 
                    alt="Travel Moment" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <p className="text-xs text-natural-heading leading-snug whitespace-pre-wrap">{entry.content}</p>
                      {entry.linkUrl && (
                        <a 
                          href={entry.linkUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-natural-sidebar rounded-md text-[9px] text-natural-olive hover:bg-natural-olive hover:text-white transition-all border border-natural-border"
                        >
                          <LinkIcon size={10} />
                          참고 링크
                        </a>
                      )}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                      <button 
                        onClick={() => startEdit(entry)}
                        className="p-1 text-natural-muted hover:text-natural-olive"
                      >
                        <Plus size={12} className="rotate-45" />
                      </button>
                      <button 
                        onClick={async () => {
                          if(confirm('삭제할까요?')) {
                            await deleteDoc(doc(db, `trips/${trip.id}/journal`, entry.id));
                          }
                        }}
                        className="p-1 text-natural-muted hover:text-natural-terracotta"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[8px] text-natural-muted font-bold pt-2 border-t border-natural-sidebar">
                  <span className="flex items-center gap-1">
                    <MapPin size={9} className="text-natural-terracotta" /> {trip.destination}
                  </span>
                  <span>{format(entry.createdAt || Date.now(), 'HH:mm')}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
