import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { Trip, ChecklistItem } from '../types';
import { Plus, Trash2, CheckCircle2, Circle, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChecklistProps {
  trip: Trip;
}

export function Checklist({ trip }: ChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'All', label: '전체' },
    { id: 'Packing', label: '준비물' },
    { id: 'Ticket', label: '티켓/패스' },
    { id: 'Gadgets', label: '전자기기' },
    { id: 'Documents', label: '서류' },
    { id: 'Other', label: '기타' }
  ];

  useEffect(() => {
    const q = query(collection(db, `trips/${trip.id}/checklist`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChecklistItem[];
      setItems(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [trip.id]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, `trips/${trip.id}/checklist`, editingId), {
          text: newItem
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, `trips/${trip.id}/checklist`), {
          tripId: trip.id,
          text: newItem,
          completed: false,
          category: activeCategory === 'All' ? 'Packing' : activeCategory
        });
      }
      setNewItem('');
    } catch (error) {
      console.error('Error adding checklist item:', error);
    }
  };

  const toggleItem = async (item: ChecklistItem) => {
    try {
      await updateDoc(doc(db, `trips/${trip.id}/checklist`, item.id), {
        completed: !item.completed
      });
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const filteredItems = activeCategory === 'All' 
    ? items 
    : items.filter(item => item.category === activeCategory);

  return (
    <div className="space-y-4">
      <div className="bg-natural-sidebar p-4 rounded-xl border border-natural-border space-y-3">
        <div className="space-y-0.5">
          <p className="text-[8px] font-bold text-natural-terracotta uppercase tracking-wider">준비물</p>
          <h3 className="text-sm font-bold text-natural-heading">체크리스트</h3>
        </div>
        <form onSubmit={handleAddItem} className="relative group">
          <input 
            type="text" 
            placeholder={editingId ? "수정 중..." : "항목 추가..."}
            className="w-full p-2.5 pr-10 bg-white border border-natural-border rounded-lg shadow-sm text-sm focus:ring-1 focus:ring-natural-olive transition-all outline-none"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button 
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-natural-olive text-white rounded-md shadow-sm"
          >
            {editingId ? <CheckCircle2 size={16} /> : <Plus size={16} />}
          </button>
        </form>
      </div>

      {/* Category Filter - Wrap onto multiple lines if needed */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-all border whitespace-nowrap ${
              activeCategory === cat.id 
                ? "bg-natural-olive text-white border-natural-olive shadow-sm" 
                : "bg-white text-natural-muted border-natural-border hover:bg-natural-sidebar"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-[10px] text-natural-muted">로딩 중...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-natural-border border-dashed">
          <p className="text-xs text-natural-muted">등록된 항목이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-natural-border overflow-hidden shadow-sm">
          {filteredItems.map((item) => (
            <motion.div 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={item.id}
              className={`flex items-center justify-between p-3 border-b border-natural-sidebar last:border-0 group transition-all ${
                item.completed ? "bg-natural-sidebar/20" : "hover:bg-natural-sidebar/40"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button 
                  onClick={() => toggleItem(item)}
                  className={`shrink-0 transition-colors ${item.completed ? "text-natural-terracotta" : "text-natural-muted hover:text-natural-olive"}`}
                >
                  {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm truncate transition-all ${
                    item.completed ? "text-natural-muted line-through opacity-50" : "text-natural-heading font-medium"
                  }`}>
                    {item.text}
                  </span>
                  <span className="text-[7px] uppercase font-bold text-natural-terracotta opacity-40">
                    {categories.find(c => c.id === item.category)?.label || item.category}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                <button 
                  onClick={() => {
                    setEditingId(item.id);
                    setNewItem(item.text);
                  }}
                  className="p-1.5 text-natural-muted hover:text-natural-olive bg-white rounded-md border border-natural-border"
                >
                  <Edit3 size={12} />
                </button>
                <button 
                  onClick={async () => {
                    if(confirm('삭제하시겠습니까?')) {
                      await deleteDoc(doc(db, `trips/${trip.id}/checklist`, item.id));
                    }
                  }}
                  className="p-1.5 text-natural-muted hover:text-natural-terracotta bg-white rounded-md border border-natural-border"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
