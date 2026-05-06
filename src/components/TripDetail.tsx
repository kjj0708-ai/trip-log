import { useState } from 'react';
import { Trip } from '../types';
import { 
  ArrowLeft, 
  Calendar, 
  Map as MapIcon, 
  BookOpen, 
  CheckSquare, 
  CreditCard,
  StickyNote,
  MoreVertical,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScheduleTimeline } from './ScheduleTimeline';
import { ExpenseTracker } from './ExpenseTracker';
import { JournalView } from './JournalView';
import { Checklist } from './Checklist';
import { TripMap } from './TripMap';
import { NotesView } from './NotesView';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';

interface TripDetailProps {
  trip: Trip;
  onBack: () => void;
}

type Tab = 'schedule' | 'map' | 'journal' | 'expenses' | 'checklist' | 'notes';

export function TripDetail({ trip, onBack }: TripDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTrip = async () => {
    setIsDeleting(true);
    const path = `trips/${trip.id}`;
    try {
      await deleteDoc(doc(db, 'trips', trip.id));
      setShowDeleteConfirm(false);
      onBack();
    } catch (error) {
      console.error('Error deleting trip:', error);
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = [
    { id: 'schedule', label: '일정', icon: Calendar },
    { id: 'map', label: '장소', icon: MapIcon },
    { id: 'journal', label: '일기', icon: BookOpen },
    { id: 'expenses', label: '비용', icon: CreditCard },
    { id: 'checklist', label: '체크', icon: CheckSquare },
    { id: 'notes', label: '노트', icon: StickyNote },
  ] as const;

  return (
    <div className="min-h-screen bg-natural-bg">
      {/* Top Bar */}
      <header className="bg-natural-sidebar sticky top-0 z-[60] border-b border-natural-border shadow-sm">
        <div className="flex items-center justify-between p-3 px-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-1 px-2.5 bg-white border border-natural-border rounded-lg hover:bg-natural-sidebar transition-all shadow-sm"
            >
              <ArrowLeft size={16} className="text-natural-olive" />
            </button>
            <div>
              <p className="text-[8px] font-black text-natural-terracotta uppercase tracking-[0.1em] leading-none mb-0.5">상세 일정</p>
              <h1 className="font-bold text-base text-natural-heading leading-tight truncate max-w-[150px] sm:max-w-none">
                {trip.title}
              </h1>
            </div>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showMenu ? "bg-natural-sidebar text-natural-terracotta shadow-inner" : "text-natural-muted hover:text-natural-terracotta"
              )}
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-11 z-20 w-40 bg-white rounded-xl shadow-xl border border-natural-border overflow-hidden"
                  >
                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-4 py-3 text-left text-[11px] font-bold text-natural-terracotta hover:bg-natural-terracotta/5 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      여행 삭제
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tab Bar - Fixed to fit on one line better */}
        <div className="bg-white border-t border-natural-border/50 overflow-x-auto no-scrollbar">
          <div className="flex max-w-4xl mx-auto justify-between sm:justify-start">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-3 px-1.5 sm:px-4 relative transition-all",
                    isActive ? "text-natural-olive" : "text-natural-muted font-medium"
                  )}
                >
                  <Icon size={14} className={cn("transition-transform", isActive && "scale-110")} />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter sm:tracking-tight">{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-olive"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto p-3 md:p-6 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'schedule' && <ScheduleTimeline trip={trip} />}
            {activeTab === 'expenses' && <ExpenseTracker trip={trip} />}
            {activeTab === 'journal' && <JournalView trip={trip} />}
            {activeTab === 'checklist' && <Checklist trip={trip} />}
            {activeTab === 'map' && <TripMap trip={trip} />}
            {activeTab === 'notes' && <NotesView trip={trip} />}
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-natural-heading/30 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm relative shadow-xl space-y-4"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                  <AlertTriangle size={24} />
                </div>
                <h2 className="text-lg font-bold text-natural-heading">여행 삭제</h2>
                <p className="text-xs text-natural-muted leading-relaxed">
                  '{trip.title}' 여행 정보를 모두 삭제할까요?<br />
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-gray-50 text-natural-muted rounded-xl font-bold hover:bg-gray-100 transition-colors border border-natural-border text-xs"
                >
                  취소
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={handleDeleteTrip}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg text-xs flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : '삭제하기'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
