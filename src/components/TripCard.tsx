import React from 'react';
import { Trip } from '../types';
import { Calendar, MapPin, ChevronRight, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'motion/react';

interface TripCardProps {
  trip: Trip;
  onClick: () => void;
  onDelete?: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onClick, onDelete }) => {
  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const totalDays = differenceInDays(end, start) + 1;
  
  const today = new Date();
  const daysLeft = differenceInDays(start, today);
  const isPast = daysLeft < -totalDays;
  const isOngoing = daysLeft <= 0 && daysLeft >= -totalDays;

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-white rounded-xl overflow-hidden border border-natural-border group cursor-pointer transition-all hover:bg-natural-sidebar/20"
    >
      <div className="p-3 relative">
        <div className="flex justify-between items-start mb-2">
          {isOngoing ? (
            <div className="bg-natural-terracotta text-white text-[7px] px-1.5 py-0 rounded-full animate-pulse font-bold uppercase tracking-tighter">여행 중</div>
          ) : daysLeft > 0 ? (
            <div className="bg-natural-olive/10 text-natural-olive text-[7px] px-1.5 py-0 rounded-full font-bold uppercase tracking-tighter">D-{daysLeft}</div>
          ) : (
            <div className="bg-natural-muted/5 text-natural-muted/60 text-[7px] px-1.5 py-0 rounded-full font-bold uppercase tracking-tighter">완료</div>
          )}
          <span className="text-[8px] font-black text-natural-muted/40 uppercase tracking-widest px-1">
            {totalDays}DAYS
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-natural-heading truncate flex-1">{trip.title}</h3>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-natural-olive shrink-0 whitespace-nowrap">
              {format(start, 'yy.MM.dd', { locale: ko })} — {format(end, 'MM.dd', { locale: ko })}
            </p>
            {onDelete && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 text-natural-muted hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        
        <ChevronRight size={10} className="absolute right-1 bottom-1 text-natural-muted/20 group-hover:text-natural-terracotta transition-colors" />
      </div>
    </motion.div>
  );
}
