import { Trash2, Search, Calendar, Download, X } from 'lucide-react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, writeBatch, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

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

interface AdminBookingProps {
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

export default function AdminBooking({ showAlert, showConfirm }: AdminBookingProps) {
  const [bookingData, setBookingData] = useState<QuoteRequest[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<QuoteRequest | null>(null);

  // Firebase quotes 데이터 로드 (문의내역과 동일한 컬렉션)
  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as QuoteRequest);
      setBookingData(data);
      setLoading(false);
    }, (error) => {
      console.error("Quotes fetch error:", error);
      showAlert('예약요청 데이터를 불러올 수 없습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showAlert]);

  const filteredBookings = bookingData.filter(booking => {
    const matchesName = booking.from_name?.toLowerCase().includes(filterName.toLowerCase());
    
    let matchesStartDate = true;
    let matchesEndDate = true;
    if (filterStartDate || filterEndDate) {
      const bookingDate = booking.timestamp?.toDate?.() || new Date(booking.timestamp);
      matchesStartDate = !filterStartDate || bookingDate >= new Date(filterStartDate);
      matchesEndDate = !filterEndDate || bookingDate <= new Date(filterEndDate + 'T23:59:59');
    }
    
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
    
    return matchesName && matchesStartDate && matchesEndDate && matchesStatus;
  });

  const handleSearch = () => {
    if (filteredBookings.length === 0) {
      showAlert('검색 결과가 없습니다.');
    } else {
      showAlert(`${filteredBookings.length}개의 예약요청을 조회했습니다.`);
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'quotes', bookingId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    } catch (error) {
      console.error("Status update error:", error);
      showAlert('상태 업데이트에 실패했습니다.');
    }
  };

  const handleDeleteBooking = (bookingId: string) => {
    showConfirm('이 예약요청을 삭제하시겠습니까?', async () => {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'quotes', bookingId));
        await batch.commit();
        showAlert('예약요청이 삭제되었습니다.');
      } catch (error) {
        console.error("Delete error:", error);
        showAlert('삭제에 실패했습니다.');
      }
    });
  };

  const exportToExcel = () => {
    if (filteredBookings.length === 0) {
      showAlert('내보낼 데이터가 없습니다.');
      return;
    }

    const data = filteredBookings.map(booking => ({
      '문의일시': safeFormat(booking.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      '신청자명': booking.from_name || '-',
      '연락처': booking.phone || '-',
      '이메일': booking.email || '-',
      '골프장': booking.golf_courses || '-',
      '일정': booking.schedule || booking.travel_period || '-',
      '비용(RM)': booking.total_myr || '-',
      '비용(₩)': booking.total_krw || '-',
      '상태': booking.status || '접수확인',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
    XLSX.writeFile(workbook, `예약요청_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    showAlert('엑셀 파일이 다운로드되었습니다.');
  };

  if (loading) {
    return (
      <motion.div
        key="booking"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-6"
      >
        <div className="text-center opacity-40 py-12">로딩 중...</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="booking"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">예약요청 관리</h2>
      </div>

      {/* Filter Section */}
      <div className="glass rounded-[40px] border border-white/10 p-6 space-y-4">
        <div className="flex gap-4 items-end flex-wrap">
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

          <div className="w-40">
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">시작일</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
              <input 
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 w-full focus:border-lime outline-none transition-all text-white"
              />
            </div>
          </div>

          <div className="w-40">
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">종료일</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
              <input 
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 w-full focus:border-lime outline-none transition-all text-white"
              />
            </div>
          </div>

          <div className="w-40">
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">상태</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-white cursor-pointer"
            >
              <option value="all" className="bg-forest text-white">전체</option>
              <option value="접수확인" className="bg-forest text-white">접수확인</option>
              <option value="답변완료" className="bg-forest text-white">답변완료</option>
              <option value="견적확정" className="bg-forest text-white">견적확정</option>
              <option value="입금완료" className="bg-forest text-white">입금완료</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            onClick={handleSearch}
            className="bg-lime text-forest hover:bg-lime/90 px-6 py-2 rounded-xl transition-all font-bold"
          >
            조회
          </button>

          <button 
            onClick={() => {
              setFilterName('');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterStatus('all');
            }}
            className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-xl transition-all"
          >
            초기화
          </button>

          <button 
            onClick={exportToExcel}
            className="bg-lime text-forest hover:bg-lime/90 px-6 py-2 rounded-xl transition-all font-bold flex items-center gap-2"
          >
            <Download size={18} />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Bookings Table */}
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
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center opacity-40 italic">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap">
                      {safeFormat(booking.timestamp, 'yy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap max-w-[120px] truncate" title={booking.from_name}>
                      {booking.from_name}
                    </td>
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap">{booking.phone}</td>
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap max-w-[150px] truncate" title={booking.email}>
                      {booking.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="max-w-[200px] truncate text-lime block" title={booking.golf_courses}>
                        {booking.golf_courses}
                      </span>
                    </td>
                    <td className="px-4 py-3 opacity-60 whitespace-nowrap">
                      {booking.travel_period || booking.schedule || '-'}
                    </td>
                    <td className="px-4 py-3 text-right opacity-60 whitespace-nowrap">
                      {booking.total_myr ? `${booking.total_myr}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right opacity-60 whitespace-nowrap">
                      {booking.total_krw ? `${booking.total_krw}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select 
                        value={booking.status || '접수확인'}
                        onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border outline-none transition-all ${
                          booking.status === '입금완료' ? 'bg-lime text-forest border-lime' :
                          booking.status === '견적확정' ? 'bg-yellow-400 text-forest border-yellow-400' :
                          booking.status === '답변완료' ? 'bg-blue-400 text-forest border-blue-400' :
                          'bg-forest text-white border-white/20'
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
                        onClick={() => setSelectedBooking(booking)}
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
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedBooking(null)}
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
                <h3 className="text-2xl font-bold text-lime">예약 상세 내역</h3>
                <button 
                  onClick={() => setSelectedBooking(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 text-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">신청자명</label>
                    <p className="font-bold text-lg">{selectedBooking.from_name}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">문의일시</label>
                    <p className="font-bold text-lg">{safeFormat(selectedBooking.timestamp, 'yyyy-MM-dd HH:mm')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">연락처</label>
                    <p className="font-bold">{selectedBooking.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">이메일</label>
                    <p className="font-bold">{selectedBooking.email}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs opacity-60 uppercase tracking-wider">골프장</label>
                  <p className="font-bold">{selectedBooking.golf_courses}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">여행 기간</label>
                    <p className="font-bold">{selectedBooking.travel_period || selectedBooking.schedule || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">상태</label>
                    <p className="font-bold">{selectedBooking.status || '접수확인'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">비용(RM)</label>
                    <p className="font-bold">{selectedBooking.total_myr || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 uppercase tracking-wider">비용(₩)</label>
                    <p className="font-bold">{selectedBooking.total_krw || '-'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs opacity-60 uppercase tracking-wider">메시지</label>
                  <p className="whitespace-pre-wrap">{selectedBooking.message || selectedBooking.remarks || '-'}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
