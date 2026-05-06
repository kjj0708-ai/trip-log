import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Trip } from './types';
import { TripCard } from './components/TripCard';
import { TripDetail } from './components/TripDetail';
import { 
  Plus, 
  Plane, 
  LogOut, 
  MapPin, 
  FileJson, 
  FileSpreadsheet, 
  ChevronDown, 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  Info,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { exportAllUserDataJSON, exportAllUserDataExcel } from './services/DataExportService';
import { readExcelFile, readWordFile, extractScheduleWithAI } from './services/SmartImportService';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/errorUtils';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

if (!API_KEY) {
  console.warn('Google Maps API Key is missing. Please set GOOGLE_MAPS_PLATFORM_KEY or VITE_GOOGLE_MAPS_PLATFORM_KEY in your environment variables.');
}

export function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isAddingTrip, setIsAddingTrip] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // Google Maps Places Library
  const placesLib = useMapsLibrary('places');

  // New trip form state
  const [newTrip, setNewTrip] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    countryCode: 'kr'
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      return;
    }

    const q = query(
      collection(db, 'trips'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trip[];
      setTrips(tripData);
    });

    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleDeleteTrip = async () => {
    if (!tripToDelete) return;
    setIsDeleting(true);
    const path = `trips/${tripToDelete.id}`;
    try {
      await deleteDoc(doc(db, 'trips', tripToDelete.id));
      setTripToDelete(null);
    } catch (error) {
      console.error('Error deleting trip:', error);
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsProcessing(true);
    setProcessingStatus('여행 정보를 생성하는 중...');
    
    try {
      const tripRef = await addDoc(collection(db, 'trips'), {
        ...newTrip,
        userId: user.uid,
        createdAt: Date.now()
      });

      if (importFile) {
        try {
          setProcessingStatus('파일을 읽어오는 중...');
          let aiInput: string | { data: string, mimeType: string } | null = null;
          
          if (importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls')) {
            aiInput = await readExcelFile(importFile);
          } else if (importFile.name.endsWith('.docx')) {
            aiInput = await readWordFile(importFile);
          } else if (importFile.type === 'application/pdf' || importFile.type.startsWith('image/')) {
            const base64 = await import('./services/SmartImportService').then(m => m.fileToBase64(importFile));
            aiInput = { data: base64, mimeType: importFile.type };
          }

          if (aiInput) {
            setProcessingStatus('AI가 일정을 분석하고 한국어로 번역하는 중...');
            const scheduleItems = await extractScheduleWithAI(aiInput, {
              startDate: newTrip.startDate,
              endDate: newTrip.endDate
            });

            setProcessingStatus(`분석된 ${scheduleItems.length}개의 일정과 장소를 매칭하는 중...`);
            const batchPromises = scheduleItems.map(async (item, idx) => {
              let lat: number | undefined;
              let lng: number | undefined;

              if (placesLib && item.locationName) {
                try {
                  const { places } = await placesLib.Place.searchByText({
                    textQuery: `${item.locationName} ${newTrip.destination}`,
                    fields: ['location'],
                    maxResultCount: 1
                  });
                  if (places?.[0]?.location) {
                    lat = places[0].location.lat();
                    lng = places[0].location.lng();
                  }
                } catch (err) {
                  console.warn(`Could not find coordinates for: ${item.locationName}`);
                }
              }

              return addDoc(collection(db, `trips/${tripRef.id}/schedule`), {
                ...item,
                tripId: tripRef.id,
                lat,
                lng,
                order: idx,
                createdAt: serverTimestamp()
              });
            });

            await Promise.all(batchPromises);
          }
        } catch (importErr) {
          console.error('Failed to import schedule:', importErr);
          alert('여행 정보는 저장되었으나, 파일 분석 중 오류가 발생했습니다.');
        }
      }

      setIsAddingTrip(false);
      setNewTrip({ title: '', destination: '', startDate: '', endDate: '', countryCode: 'kr' });
      setImportFile(null);
      setProcessingStatus('');
    } catch (error) {
      console.error('Error adding trip:', error);
      alert('여행을 추가하는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasValidKey = Boolean(API_KEY) && API_KEY !== '';

  if (loading) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-natural-bg flex flex-col items-center justify-center p-4 text-natural-text">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-sm w-full"
        >
          <div className="relative inline-block">
            <div className="bg-natural-sidebar w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-natural-border">
              <Plane size={32} className="text-natural-olive" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-natural-heading tracking-tight">Trip-Log</h1>
            <p className="text-natural-muted font-bold uppercase text-[10px] tracking-wider">나의 간결한 여행 기록</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-natural-border shadow-sm space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full bg-natural-olive text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:bg-[#4A4A35] transition-all flex items-center justify-center gap-2 text-base"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Google로 시작하기
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (activeTrip) {
    return <TripDetail trip={activeTrip} onBack={() => setActiveTrip(null)} />;
  }

  return (
    <div className="min-h-screen bg-natural-bg pb-12">
      {!hasValidKey && (
        <div className="mx-4 mt-4 bg-red-100 border border-red-200 p-3 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white flex-shrink-0 text-xs font-bold">!</div>
          <div className="flex-1">
            <p className="text-xs font-bold text-red-800">지도가 작동하지 않나요?</p>
            <p className="text-[10px] text-red-600 font-medium">설정 메뉴에서 GOOGLE_MAPS_PLATFORM_KEY를 추가해주세요.</p>
          </div>
        </div>
      )}

      <header className="bg-natural-sidebar border-b border-natural-border sticky top-0 z-50 px-4 py-2 md:px-6 flex justify-between items-center">
        <h1 className="text-lg font-bold text-natural-olive flex items-center gap-2 cursor-pointer" onClick={() => setActiveTrip(null)}>Trip-Log</h1>
        <div className="flex items-center gap-2 relative">
          <button onClick={() => setShowSettings(!showSettings)} className={cn("p-1.5 rounded-full transition-all flex items-center gap-1", showSettings ? "bg-white shadow-inner" : "hover:bg-white/50")}>
            <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-white shadow-sm" alt={user.displayName || ''} />
            <ChevronDown size={12} className={cn("text-natural-muted transition-transform", showSettings && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute right-0 top-10 z-20 w-48 bg-white rounded-xl shadow-xl border border-natural-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-natural-border bg-natural-sidebar/30">
                    <p className="text-[10px] font-bold text-natural-heading truncate">{user.displayName || '사용자'}</p>
                    <p className="text-[8px] text-natural-muted truncate">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <p className="text-[7px] font-black text-natural-terracotta px-3 py-1 uppercase opacity-50">데이터 관리</p>
                    <button onClick={() => { exportAllUserDataJSON(user.uid); setShowSettings(false); }} className="w-full px-3 py-2 text-left text-[11px] font-bold text-natural-text hover:bg-natural-sidebar flex items-center gap-2 rounded-lg transition-colors">
                      <FileJson size={14} className="text-blue-500" /> 전체 JSON 내보내기
                    </button>
                    <button onClick={() => { exportAllUserDataExcel(user.uid); setShowSettings(false); }} className="w-full px-3 py-2 text-left text-[11px] font-bold text-natural-text hover:bg-natural-sidebar flex items-center gap-2 rounded-lg transition-colors">
                      <FileSpreadsheet size={14} className="text-green-600" /> 전체 엑셀 내보내기
                    </button>
                  </div>
                  <div className="p-1 border-t border-natural-border bg-natural-sidebar/10">
                    <button onClick={handleLogout} className="w-full px-3 py-2 text-left text-[11px] font-bold text-natural-terracotta hover:bg-natural-terracotta/5 flex items-center gap-2 rounded-lg transition-colors">
                      <LogOut size={14} /> 로그아웃
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3 space-y-3">
        <header className="flex justify-between items-center px-0.5">
          <div>
            <p className="text-[7px] uppercase tracking-widest text-natural-muted font-bold">나의 여행</p>
            <h2 className="text-lg font-bold text-natural-heading">여행 목록</h2>
          </div>
          <button onClick={() => setIsAddingTrip(true)} className="bg-natural-olive text-white px-2.5 py-1 rounded-lg shadow-sm hover:translate-y-[-1px] transition-all flex items-center gap-1 font-bold text-[10px]">
            <Plus size={12} /> <span>추가</span>
          </button>
        </header>

        {trips.length === 0 && !isAddingTrip ? (
          <div className="py-20 text-center space-y-4 bg-white rounded-2xl border border-natural-border border-dashed">
            <div className="w-12 h-12 bg-natural-sidebar rounded-full flex items-center justify-center mx-auto">
              <MapPin size={20} className="text-natural-muted" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-natural-heading text-natural-muted">아직 기록이 없습니다</h3>
              <p className="text-xs text-natural-muted/60 lowercase italic">기록을 시작해보세요</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trips.map((trip) => (
              <TripCard 
                key={trip.id} 
                trip={trip} 
                onClick={() => setActiveTrip(trip)} 
                onDelete={() => setTripToDelete(trip)}
              />
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {tripToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setTripToDelete(null)}
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
                  '{tripToDelete.title}' 여행 정보를 모두 삭제할까요?<br />
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={isDeleting}
                  onClick={() => setTripToDelete(null)}
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
        
        {isAddingTrip && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingTrip(false)} className="absolute inset-0 bg-natural-heading/30 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="bg-white rounded-2xl p-6 w-full max-w-sm relative shadow-xl space-y-5">
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-widest text-natural-terracotta font-bold">새로운 여정</p>
                <h2 className="text-xl font-bold text-natural-heading">여행 추가</h2>
              </div>
              <form onSubmit={handleAddTrip} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase tracking-wider">여행 제목</label>
                  <input required type="text" placeholder="도쿄: 시티 워크" className="w-full p-3 bg-natural-sidebar border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-olive hover:bg-white transition-all outline-none text-sm" value={newTrip.title} onChange={(e) => setNewTrip({...newTrip, title: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-muted uppercase tracking-wider">목적지</label>
                  <input required type="text" placeholder="일본, 도쿄" className="w-full p-3 bg-natural-sidebar border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-olive hover:bg-white transition-all outline-none text-sm" value={newTrip.destination} onChange={(e) => setNewTrip({...newTrip, destination: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-muted uppercase tracking-wider">시작일</label>
                    <input required type="date" className="w-full p-3 bg-natural-sidebar border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-olive hover:bg-white transition-all outline-none text-sm" value={newTrip.startDate} onChange={(e) => setNewTrip({...newTrip, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-muted uppercase tracking-wider">종료일</label>
                    <input required type="date" className="w-full p-3 bg-natural-sidebar border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-olive hover:bg-white transition-all outline-none text-sm" value={newTrip.endDate} onChange={(e) => setNewTrip({...newTrip, endDate: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-natural-muted uppercase tracking-wider">스마트 일정 가져오기 (선택)</div>
                  <label className={cn("flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all", importFile ? "bg-natural-olive/5 border-natural-olive/30" : "bg-natural-sidebar border-natural-border hover:bg-white hover:border-natural-olive/20")}>
                    {importFile ? (
                      <div className="flex flex-col items-center gap-1 p-2 text-natural-olive text-center">
                        <CheckCircle2 size={24} />
                        <p className="text-[10px] font-bold line-clamp-1">{importFile.name}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-natural-muted">
                        <FileUp size={24} />
                        <p className="text-[10px] font-bold text-natural-heading">Excel, Word, PDF, 이미지 업로드</p>
                      </div>
                    )}
                    <input type="file" accept=".xlsx,.xls,.docx,.pdf,image/*" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                  <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => { setIsAddingTrip(false); setImportFile(null); setProcessingStatus(''); }} disabled={isProcessing} className="flex-1 py-3 bg-gray-50 text-natural-muted rounded-xl font-bold hover:bg-gray-100 transition-colors border border-natural-border text-xs">취소</button>
                  <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-natural-olive text-white rounded-xl font-bold hover:bg-[#4A4A35] transition-colors shadow-lg text-xs flex flex-col items-center justify-center gap-1 min-h-[52px]">
                    {isProcessing ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>처리 중...</span>
                        </div>
                        {processingStatus && <span className="text-[8px] font-medium opacity-80 whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-2">{processingStatus}</span>}
                      </>
                    ) : '여행 만들기'}
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

export default function App() {
  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <AppContent />
    </APIProvider>
  );
}
