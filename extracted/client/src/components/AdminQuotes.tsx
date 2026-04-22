import { Search, Calendar, Trash2, X, ChevronDown, Download } from 'lucide-react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface QuoteRequest {
  id: string;
  from_name: string;
  phone: string;
  email: string;
  golf_courses: string;
  travel_period?: string;
  schedule?: string;
  total_myr?: number | string;
  total_krw?: number | string;
  status?: string;
  timestamp?: any;
  remarks?: string;
  message?: string;
}

interface AdminQuotesProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

const safeFormat = (date: any, formatStr: string, fallback: string = '-') => {
  try {
    if (!date) return fallback;
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
};

export default function AdminQuotes({ showAlert, showConfirm }: AdminQuotesProps) {
  const [quotesData, setQuotesData] = useState<QuoteRequest[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);

  // Firebase quotes 데이터 로드
  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as QuoteRequest);
      setQuotesData(data);
      setLoading(false);
    }, (error) => {
      console.error("Quotes fetch error:", error);
      showAlert('문의 내역을 불러올 수 없습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showAlert]);

  const filteredQuotes = quotesData.filter(quote => {
    const matchName = quote.from_name?.toLowerCase().includes(filterName.toLowerCase());
    
    let matchDate = true;
    if (filterStartDate || filterEndDate) {
      const quoteDate = quote.timestamp?.toDate?.() || new Date(quote.timestamp);
      const startDate = filterStartDate ? new Date(filterStartDate) : new Date('1900-01-01');
      const endDate = filterEndDate ? new Date(filterEndDate + 'T23:59:59') : new Date('2099-12-31');
      
      matchDate = quoteDate >= startDate && quoteDate <= endDate;
    }

    return matchName && matchDate;
  });

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      // 배치 작업으로 최적화
      const batch = writeBatch(db);
      batch.update(doc(db, 'quotes', quoteId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      // 알림 제거 (자동 저장)
    } catch (error) {
      console.error("Status update error:", error);
      showAlert('상태 업데이트에 실패했습니다.');
    }
  };

  const handleDeleteQuote = (quoteId: string) => {
    showConfirm('이 문의를 삭제하시겠습니까?', async () => {
      try {
        await deleteDoc(doc(db, 'quotes', quoteId));
        showAlert('삭제되었습니다.');
      } catch (error) {
        console.error("Delete error:", error);
        showAlert('삭제에 실패했습니다.');
      }
    });
  };

  const exportToExcel = () => {
    const exportData = filteredQuotes.map(quote => ({
      '문의일시': safeFormat(quote.timestamp, 'yyyy-MM-dd HH:mm'),
      '신청자명': quote.from_name,
      '연락처': quote.phone,
      '이메일': quote.email,
      '골프장': quote.golf_courses,
      '일정': quote.travel_period || quote.schedule || '-',
      '비용(RM)': quote.total_myr || '-',
      '비용(₩)': quote.total_krw || '-',
      '상태': quote.status || '미처리',
      '메시지': quote.message || quote.remarks || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '문의내역');
    XLSX.writeFile(wb, `quotes_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
  };

  if (loading) {
    return (
      <motion.div
        key="quotes"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex items-center justify-center py-12"
      >
        <div className="text-white/60">로딩 중...</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="quotes"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">문의 내역</h2>
      </div>

      {/* Filters */}
      <div className="glass p-8 rounded-[40px] border border-white/10 flex flex-wrap gap-4 items-end">
        <div className="flex-grow min-w-[200px]">
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">신청자명</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
            <input 
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 w-full focus:border-lime outline-none transition-all text-white"
              placeholder="이름 검색..."
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">시작일</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
            <input 
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 focus:border-lime outline-none transition-all text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">종료일</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
            <input 
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 focus:border-lime outline-none transition-all text-white"
            />
          </div>
        </div>

        <button 
          onClick={() => {
            setFilterName('');
            setFilterStartDate('');
            setFilterEndDate('');
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-xl transition-all text-white"
        >
          초기화
        </button>

        <button 
          onClick={exportToExcel}
          className="bg-lime text-forest hover:bg-lime/90 px-6 py-2 rounded-xl transition-all font-bold"
        >
          엑셀 다운로드
        </button>
      </div>

      {/* Quotes Table */}
      <div className="glass rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40 bg-white/5">
                <th className="px-4 py-3 font-medium whitespace-nowrap">문의일시</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">신청자명</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">이메일</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">골프장</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">일정</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">비용(RM)</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">비용(₩)</th>
                <th className="px-4 py-3 font-medium text-center whitespace-nowrap">상태</th>
                <th className="px-4 py-3 font-medium text-center whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center opacity-40 italic">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap">
                      {safeFormat(quote.timestamp, 'yy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap max-w-[120px] truncate" title={quote.from_name}>
                      {quote.from_name}
                    </td>
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap">{quote.phone}</td>
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap max-w-[150px] truncate" title={quote.email}>
                      {quote.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="max-w-[200px] truncate text-lime block" title={quote.golf_courses}>
                        {quote.golf_courses}
                      </span>
                    </td>
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap">
                      {quote.travel_period || quote.schedule || '-'}
                    </td>
                    <td className="px-4 py-3 text-right opacity-60 whitespace-nowrap">
                      {quote.total_myr ? `${quote.total_myr}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right opacity-60 whitespace-nowrap">
                      {quote.total_krw ? `${quote.total_krw}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select 
                        value={quote.status || '접수확인'}
                        onChange={(e) => handleStatusChange(quote.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-0 outline-none transition-all ${
                          quote.status === '입금완료' ? 'bg-lime text-forest' :
                          quote.status === '견적확정' ? 'bg-yellow-400 text-forest' :
                          quote.status === '답변완료' ? 'bg-blue-400 text-forest' :
                          'bg-white text-forest'
                        }`}
                      >
                        <option value="접수확인" className="bg-forest text-white">접수확인</option>
                        <option value="답변완료" className="bg-forest text-white">답변완료</option>
                        <option value="견적확정" className="bg-forest text-white">견적확정</option>
                        <option value="입금완료" className="bg-forest text-white">입금완료</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedQuote(quote)}
                        className="px-3 py-1 bg-lime/20 text-lime rounded-lg text-xs font-bold hover:bg-lime/30 transition-all"
                      >
                        보기
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedQuote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedQuote(null)}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-forest border-2 border-lime rounded-[30px] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-lime">문의 상세 내역</h3>
                <button 
                  onClick={() => setSelectedQuote(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 text-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">신청자명</label>
                    <p className="font-bold text-lg">{selectedQuote.from_name}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">문의일시</label>
                    <p className="font-bold text-lg">{safeFormat(selectedQuote.timestamp, 'yyyy-MM-dd HH:mm')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">연락처</label>
                    <p className="font-bold">{selectedQuote.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">이메일</label>
                    <p className="font-bold">{selectedQuote.email}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs opacity-60 uppercase tracking-wider">골프장</label>
                  <p className="font-bold">{selectedQuote.golf_courses}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">여행 기간</label>
                    <p className="font-bold">{selectedQuote.travel_period || selectedQuote.schedule || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">상태</label>
                    <p className="font-bold">{selectedQuote.status || '접수확인'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">비용(RM)</label>
                    <p className="font-bold">{selectedQuote.total_myr || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">비용(₩)</label>
                    <p className="font-bold">{selectedQuote.total_krw || '-'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs opacity-60 uppercase tracking-wider">메시지</label>
                  <p className="whitespace-pre-wrap">{selectedQuote.message || selectedQuote.remarks || '-'}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
