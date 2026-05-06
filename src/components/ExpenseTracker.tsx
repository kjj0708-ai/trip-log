import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { Trip, Expense } from '../types';
import { Plus, Trash2, Wallet, RefreshCw, Calculator, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ExpenseTrackerProps {
  trip: Trip;
}

export function ExpenseTracker({ trip }: ExpenseTrackerProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingBudget, setIsManagingBudget] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tempBudget, setTempBudget] = useState(trip.budget ? String(trip.budget) : '');

  // Form state
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '', // Local amount
    currency: 'KRW',
    exchangeRate: '1',
    category: '식비',
  });

  useEffect(() => {
    const q = query(
      collection(db, `trips/${trip.id}/expenses`),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [trip.id]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const localAmount = Number(newExpense.amount);
      const exRate = Number(newExpense.exchangeRate) || 1;
      const amountInBase = localAmount * exRate;

      if (editingId) {
        await updateDoc(doc(db, `trips/${trip.id}/expenses`, editingId), {
          title: newExpense.title,
          localAmount: localAmount,
          exchangeRate: exRate,
          amount: amountInBase,
          currency: newExpense.currency.toUpperCase(),
          category: newExpense.category,
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, `trips/${trip.id}/expenses`), {
          title: newExpense.title,
          localAmount: localAmount,
          exchangeRate: exRate,
          amount: amountInBase,
          currency: newExpense.currency.toUpperCase(),
          category: newExpense.category,
          tripId: trip.id,
          date: new Date().toISOString()
        });
      }
      setIsAdding(false);
      setNewExpense({ title: '', amount: '', currency: 'KRW', exchangeRate: '1', category: '식비' });
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setNewExpense({
      title: expense.title,
      amount: String(expense.localAmount || expense.amount),
      currency: expense.currency || 'KRW',
      exchangeRate: String(expense.exchangeRate || 1),
      category: expense.category,
    });
    setIsAdding(true);
  };

  const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const budget = trip.budget || 0;
  const remaining = budget - totalAmount;
  const progress = budget > 0 ? (totalAmount / budget) * 100 : 0;

  const handleSaveBudget = async () => {
    try {
      await updateDoc(doc(db, 'trips', trip.id), {
        budget: Number(tempBudget) || 0
      });
      setIsManagingBudget(false);
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Total Card - More compact */}
      <div className="bg-natural-olive rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 transform translate-x-16 -translate-y-16 rounded-full" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
              <Wallet size={18} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider">나의 예산</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-white/70 text-[9px] font-bold tracking-widest uppercase mb-1">총 지출</p>
              <div className="text-2xl font-bold">₩ {totalAmount.toLocaleString()}</div>
            </div>

            {budget > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-white/70">예산 대비 {progress.toFixed(1)}%</span>
                  <span className={remaining < 0 ? "text-red-300" : "text-white/70"}>
                    남음: ₩ {remaining.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    className={cn(
                      "h-full transition-all",
                      progress > 90 ? "bg-red-400" : progress > 70 ? "bg-orange-400" : "bg-white"
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setIsAdding(true)}
          className="flex-1 bg-white border border-natural-border p-3 rounded-xl shadow-sm hover:bg-natural-sidebar transition-all flex items-center justify-center gap-2 text-xs font-bold text-natural-olive"
        >
          <Plus size={16} /> 지출 추가
        </button>
        <button 
          onClick={() => setIsManagingBudget(true)}
          className="flex-1 bg-white border border-natural-border p-3 rounded-xl shadow-sm hover:bg-natural-sidebar transition-all flex items-center justify-center gap-2 text-xs font-bold text-natural-terracotta"
        >
          <Calculator size={16} /> 예산 관리
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-[10px] text-natural-muted italic">로딩 중...</div>
      ) : expenses.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-natural-border border-dashed">
          <p className="text-xs text-natural-muted">등록된 지출이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[8px] font-bold text-natural-muted uppercase tracking-wider pl-1">지출 내역</p>
          {expenses.map((expense) => (
            <motion.div 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={expense.id}
              className="bg-white p-3 rounded-xl border border-natural-border flex items-center justify-between group hover:shadow-sm transition-all border-l-4 border-l-natural-olive"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-natural-sidebar rounded-lg flex items-center justify-center text-lg border border-natural-border/30 shrink-0">
                  {expense.category === '식비' ? '🍽️' : 
                   expense.category === '교통' ? '🚌' : 
                   expense.category === '쇼핑' ? '🛍️' : 
                   expense.category === '숙박' ? '🏨' : '🏷️'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-natural-heading truncate">{expense.title}</h4>
                  <p className="text-[8px] text-natural-muted font-bold uppercase">{expense.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-natural-heading">
                    {expense.amount.toLocaleString()} <span className="text-[8px] text-natural-muted ml-0.5">KRW</span>
                  </p>
                  {expense.currency !== 'KRW' && (
                    <p className="text-[8px] text-natural-muted font-bold">
                      {expense.localAmount?.toLocaleString()} {expense.currency}
                    </p>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => startEdit(expense)}
                    className="p-1 text-natural-muted hover:text-natural-olive"
                  >
                    <Plus size={14} className="rotate-45 scale-75" />
                  </button>
                  <button 
                    onClick={async () => {
                      if(confirm('삭제할까요?')) {
                        await deleteDoc(doc(db, `trips/${trip.id}/expenses`, expense.id));
                      }
                    }}
                    className="p-1 text-natural-muted hover:text-natural-terracotta"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Expense Modal - Compact version */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="absolute inset-0 bg-natural-heading/20 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-5 w-full max-w-sm relative shadow-2xl space-y-4"
            >
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase font-bold text-natural-terracotta">지출 기록</p>
                <h2 className="text-lg font-bold text-natural-heading">{editingId ? '지출 내역 수정' : '새 지출 추가'}</h2>
              </div>
              
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase">항목</label>
                  <input 
                    required
                    type="text" 
                    placeholder="도쿄 타워 입장료"
                    className="w-full p-2 bg-natural-sidebar border border-natural-border rounded-lg outline-none focus:bg-white text-sm"
                    value={newExpense.title}
                    onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-muted uppercase">통화</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-2 bg-natural-sidebar border border-natural-border rounded-lg outline-none focus:bg-white text-xs font-bold uppercase"
                      value={newExpense.currency}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setNewExpense({...newExpense, currency: val, exchangeRate: val === 'KRW' ? '1' : newExpense.exchangeRate});
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-muted uppercase">환율</label>
                    <input 
                      required
                      type="number" 
                      step="any"
                      className="w-full p-2 bg-natural-sidebar border border-natural-border rounded-lg outline-none focus:bg-white text-xs font-bold"
                      value={newExpense.exchangeRate}
                      disabled={newExpense.currency === 'KRW'}
                      onChange={(e) => setNewExpense({...newExpense, exchangeRate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase">금액 ({newExpense.currency})</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0"
                    className="w-full p-2 bg-natural-sidebar border border-natural-border rounded-lg outline-none focus:bg-white text-base font-bold"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  />
                  {newExpense.currency !== 'KRW' && (
                    <p className="text-[10px] text-natural-olive font-bold pl-1">
                      예상 한화: ₩ {(Number(newExpense.amount) * Number(newExpense.exchangeRate)).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase block">분류</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['식비', '교통', '쇼핑', '숙박', '기타'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewExpense({...newExpense, category: cat})}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all border ${
                          newExpense.category === cat 
                            ? "bg-natural-olive text-white border-natural-olive" 
                            : "bg-white text-natural-muted border-natural-border hover:bg-natural-sidebar"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setIsAdding(false); setEditingId(null); }}
                    className="flex-1 py-2 text-xs font-bold text-natural-muted hover:text-natural-text"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 bg-natural-olive text-white rounded-lg text-xs font-bold shadow-md"
                  >
                    {editingId ? '수정 완료' : '내역 저장'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Budget Management Modal */}
      <AnimatePresence>
        {isManagingBudget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManagingBudget(false)}
              className="absolute inset-0 bg-natural-heading/20 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-5 w-full max-w-sm relative shadow-2xl space-y-4"
            >
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase font-bold text-natural-terracotta">예산 설정</p>
                <h2 className="text-lg font-bold text-natural-heading">여행 총 예산</h2>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase">총 예산 (KRW)</label>
                  <input 
                    type="number" 
                    placeholder="예: 2000000"
                    className="w-full p-2 bg-natural-sidebar border border-natural-border rounded-lg outline-none focus:bg-white text-base font-bold"
                    value={tempBudget}
                    onChange={(e) => setTempBudget(e.target.value)}
                  />
                  <p className="text-[9px] text-natural-muted pl-1">설정된 예산에 맞춰 지출 현황을 보여줍니다.</p>
                </div>

                <div className="pt-3 flex gap-2">
                  <button 
                    onClick={() => setIsManagingBudget(false)}
                    className="flex-1 py-1 text-xs font-bold text-natural-muted"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleSaveBudget}
                    className="flex-1 py-2 bg-natural-olive text-white rounded-lg text-xs font-bold shadow-md"
                  >
                    설정 완료
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
