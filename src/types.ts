export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  destination: string;
  countryCode: string; // e.g., 'jp', 'kr'
  userId: string;
  createdAt: number;
  budget?: number;
}

export interface ScheduleItem {
  id: string;
  tripId: string;
  day: number; // 1, 2, ...
  time: string; // HH:mm
  title: string;
  description: string;
  locationName: string;
  lat?: number;
  lng?: number;
  category: 'visit' | 'food' | 'shopping' | 'transport' | 'hotel' | 'other';
  order: number;
}

export interface JournalEntry {
  id: string;
  tripId: string;
  day: number;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  tripId: string;
  day: number; // or 0 for "Before trip"
  title: string;
  amount: number; // Final amount in base currency (KRW)
  localAmount: number; // Amount in local currency
  exchangeRate: number; // Exchange rate (1 local unit = X KRW)
  currency: string;
  category: string;
  date: string;
}

export interface ChecklistItem {
  id: string;
  tripId: string;
  text: string;
  completed: boolean;
  category: string;
}

export interface Note {
  id: string;
  tripId: string;
  title: string;
  content: string;
  url?: string;
  imageUrl?: string;
}
