import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  orderBy
} from 'firebase/firestore';
import { Trip, Note } from '../types';
import { Plus, Trash2, Edit3, Image as ImageIcon, Link as LinkIcon, StickyNote, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotesViewProps {
  trip: Trip;
}

export function NotesView({ trip }: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    url: '',
    imageUrl: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, `trips/${trip.id}/notes`),
      orderBy('title', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [trip.id]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.title.trim() || !newNote.content.trim()) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, `trips/${trip.id}/notes`, editingId), {
          title: newNote.title,
          content: newNote.content,
          url: newNote.url || null,
          imageUrl: newNote.imageUrl || null
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, `trips/${trip.id}/notes`), {
          tripId: trip.id,
          title: newNote.title,
          content: newNote.content,
          url: newNote.url || null,
          imageUrl: newNote.imageUrl || null,
          createdAt: Date.now()
        });
      }
      setIsAdding(false);
      setNewNote({ title: '', content: '', url: '', imageUrl: '' });
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setNewNote({
      title: note.title,
      content: note.content,
      url: note.url || '',
      imageUrl: note.imageUrl || ''
    });
    setIsAdding(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-natural-sidebar p-3 rounded-xl border border-natural-border shadow-sm flex justify-between items-center">
        <div>
          <p className="text-[8px] font-bold text-natural-terracotta uppercase tracking-[0.2em] mb-0.5">나의 보관함</p>
          <h3 className="text-sm font-bold text-natural-heading italic">여행 노트</h3>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="p-1.5 bg-natural-olive text-white rounded-lg shadow-sm hover:translate-y-[-1px] transition-all"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white p-4 rounded-xl border border-natural-border shadow-sm space-y-3"
          >
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="노트 제목"
                className="w-full text-sm font-bold text-natural-heading outline-none border-b border-natural-sidebar pb-1 placeholder-natural-muted/50"
                value={newNote.title}
                onChange={(e) => setNewNote({...newNote, title: e.target.value})}
              />
              <textarea 
                rows={3}
                placeholder="내용을 입력하세요..."
                className="w-full text-xs text-natural-text outline-none resize-none placeholder-natural-muted/50"
                value={newNote.content}
                onChange={(e) => setNewNote({...newNote, content: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 p-2 bg-natural-sidebar rounded-lg border border-natural-border text-natural-muted focus-within:ring-1 focus-within:ring-natural-olive">
                <ImageIcon size={12} />
                <input 
                  type="text" 
                  placeholder="이미지 URL"
                  className="flex-1 bg-transparent text-[10px] outline-none text-natural-text"
                  value={newNote.imageUrl}
                  onChange={(e) => setNewNote({...newNote, imageUrl: e.target.value})}
                />
              </div>
              <div className="flex items-center gap-1.5 p-2 bg-natural-sidebar rounded-lg border border-natural-border text-natural-muted focus-within:ring-1 focus-within:ring-natural-olive">
                <LinkIcon size={12} />
                <input 
                  type="text" 
                  placeholder="링크 URL"
                  className="flex-1 bg-transparent text-[10px] outline-none text-natural-text"
                  value={newNote.url}
                  onChange={(e) => setNewNote({...newNote, url: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setNewNote({ title: '', content: '', url: '', imageUrl: '' });
                }}
                className="px-3 py-1.5 text-[10px] font-bold text-natural-muted hover:text-natural-text"
              >
                취소
              </button>
              <button 
                onClick={handleSaveNote}
                className="px-4 py-1.5 bg-natural-olive text-white rounded-lg text-[10px] font-bold shadow-sm"
              >
                {editingId ? '수정 완료' : '노트 저장'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="py-10 text-center text-[10px] text-natural-muted">로딩 중...</div>
      ) : notes.length === 0 ? (
        <div className="py-12 text-center bg-white/50 rounded-xl border border-natural-border border-dashed">
          <StickyNote size={24} className="text-natural-muted mx-auto opacity-20 mb-2" />
          <p className="text-xs text-natural-muted italic">보관된 노트가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map((note) => (
            <motion.div 
              layout
              key={note.id}
              className="bg-white rounded-xl border border-natural-border shadow-sm overflow-hidden group hover:shadow-md transition-all flex flex-col"
            >
              {note.imageUrl && (
                <div className="aspect-video relative overflow-hidden shrink-0 border-b border-natural-border">
                  <img 
                    src={note.imageUrl} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt={note.title}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-bold text-natural-heading">{note.title}</h4>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(note)}
                        className="p-1 text-natural-muted hover:text-natural-olive"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button 
                        onClick={async () => {
                          if(confirm('노트를 삭제할까요?')) {
                            await deleteDoc(doc(db, `trips/${trip.id}/notes`, note.id));
                          }
                        }}
                        className="p-1 text-natural-muted hover:text-natural-terracotta"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-natural-muted line-clamp-3 whitespace-pre-wrap">{note.content}</p>
                </div>
                {note.url && (
                  <a 
                    href={note.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-[9px] text-natural-terracotta font-bold hover:underline"
                  >
                    <ExternalLink size={10} />
                    관련 링크 바로가기
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
