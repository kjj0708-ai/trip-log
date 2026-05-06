import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

export const exportAllUserDataJSON = async (userId: string) => {
  try {
    const tripsSnapshot = await getDocs(query(collection(db, 'trips'), where('userId', '==', userId)));
    const allData: any[] = [];

    for (const tripDoc of tripsSnapshot.docs) {
      const tripId = tripDoc.id;
      const tripData = { id: tripId, ...tripDoc.data() };
      const subData: any = { trip: tripData, schedule: [], journal: [], expenses: [], checklist: [], notes: [] };
      
      const collections = ['schedule', 'journal', 'expenses', 'checklist', 'notes'];
      for (const colName of collections) {
        const snapshot = await getDocs(collection(db, `trips/${tripId}/${colName}`));
        subData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      allData.push(subData);
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trip_log_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('All data export failed:', error);
    alert(`전체 내보내기 실패: ${error.message || error}`);
  }
};

export const exportAllUserDataExcel = async (userId: string) => {
  try {
    const workbook = XLSX.utils.book_new();
    const tripsSnapshot = await getDocs(query(collection(db, 'trips'), where('userId', '==', userId)));

    // Create a master trip list sheet
    const tripsData = tripsSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        제목: d.title,
        목적지: d.destination,
        시작일: d.startDate,
        종료일: d.endDate,
        예산: d.budget || 0
      };
    });
    const tripsSheet = XLSX.utils.json_to_sheet(tripsData);
    XLSX.utils.book_append_sheet(workbook, tripsSheet, '여행목록');

    const collections = [
      { id: 'schedule', name: '전체일정' },
      { id: 'journal', name: '전체일기' },
      { id: 'expenses', name: '전체지출' },
      { id: 'checklist', name: '전체체크리스트' },
      { id: 'notes', name: '전체노트' }
    ];

    for (const col of collections) {
      let aggregatedData: any[] = [];
      for (const tripDoc of tripsSnapshot.docs) {
        const tripTitle = (tripDoc.data() as any).title;
        const snapshot = await getDocs(collection(db, `trips/${tripDoc.id}/${col.id}`));
        const items = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          // Flatten data and ensure only primitives for excel
          const flat: any = { id: doc.id, 여행제목: tripTitle };
          Object.keys(data).forEach(key => {
            const val = data[key];
            if (val && typeof val === 'object' && val.toDate) {
              flat[key] = val.toDate().toLocaleString();
            } else if (typeof val !== 'object' || val === null) {
              flat[key] = val;
            } else {
              flat[key] = JSON.stringify(val);
            }
          });
          return flat;
        });
        aggregatedData = [...aggregatedData, ...items];
      }
      if (aggregatedData.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(aggregatedData);
        XLSX.utils.book_append_sheet(workbook, worksheet, col.name);
      }
    }

    XLSX.writeFile(workbook, `trip_log_excel_backup.xlsx`);
  } catch (error: any) {
    console.error('All data excel export failed:', error);
    alert(`전체 엑셀 내보내기 실패: ${error.message || error}`);
  }
};

export const importAllUserDataJSON = async (userId: string, file: File) => {
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const allData = JSON.parse(content);

      if (!Array.isArray(allData)) {
        alert('잘못된 파일 형식입니다.');
        return;
      }

      for (const tripEntry of allData) {
        const { trip, ...subCollections } = tripEntry;
        const { id, ...tripFields } = trip;
        
        const newTripRef = await addDoc(collection(db, 'trips'), {
          ...tripFields,
          userId: userId 
        });

        const newTripId = newTripRef.id;

        for (const [colName, items] of Object.entries(subCollections)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              const { id: oldId, ...itemFields } = item as any;
              await addDoc(collection(db, `trips/${newTripId}/${colName}`), {
                ...itemFields,
                tripId: newTripId
              });
            }
          }
        }
      }
      alert('전체 데이터 가져오기 성공');
      window.location.reload();
    };
    reader.readAsText(file);
  } catch (error) {
    console.error('Bulk import failed:', error);
    alert('가져오기 실패');
  }
};
