import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Calendar, Users, MapPin, 
  Star, Clock, Info, 
  Calculator, Map as MapIcon,
  Plane, Car, Mail, Play,
  ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Send, Search,
  Plus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon, Home as HomeIcon, Download, Upload,
  MessageSquare, RotateCcw, Phone, LogOut
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  getDocs,
  getDoc,
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  where,
  limit,
  collectionGroup
} from 'firebase/firestore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import { db, auth } from '../firebase';
import * as XLSX from 'xlsx';

/**
 * Design Philosophy: Admin Dashboard
 * - Dark forest green background (#2d4a2d) with lime accents (#39d353)
 * - Professional admin interface with glass-morphism panels
 * - Responsive layout for all screen sizes
 * - Focus on data management and content control
 */

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

interface PricingRow {
  item: string;
  division: string;
  morning: number | string;
  afternoon: number | string;
}

interface CoursePricing {
  id: string;
  courseName: string;
  category?: string;
  remarks: string;
  adminMemo?: string;
  rows: PricingRow[];
  order?: number;
  operatingHours?: string;
  courseInfo?: string;
  caddyInfo?: string;
  promotionInfo?: string;
  premiumInfo?: string;
  photoUrl?: string;
  address?: string;
  websiteUrl?: string;
}

interface QuoteRequest {
  id: string;
  timestamp: string;
  from_name: string;
  email: string;
  phone: string;
  golf_courses: string;
  travel_period: string;
  message: string;
  total_myr: string;
  total_krw: string;
  summary: string;
  status?: '접수확인' | '답변완료' | '견적확정' | '입금완료';
}

interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  showAsPopup?: boolean;
  imageUrl?: string;
  author?: string;
}

interface GolferQuote {
  id: string;
  name: string;
  nationality: string;
  birthYear: string;
  gender: string;
  photoUrl: string;
  quote: string;
  source: string;
  stats: string;
}

interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  order?: number;
  createdAt: any;
}

interface GalleryTopic {
  id: string;
  title: string;
  order: number;
  photos: GalleryPhoto[];
}

interface VideoItem {
  id: string;
  url: string;
  title: string;
  description: string;
  order?: number;
  createdAt: any;
}

interface VideoTopic {
  id: string;
  title: string;
  order: number;
  videos: VideoItem[];
}

interface Chatting {
  id: string;
  name_ko: string;
  name_en?: string;
  region_tag: string;
  price_wd_am: number;
  price_note?: string;
  total_holes: number;
  course_names?: string;
  course_desc_legacy?: string;
  image_url_main: string;
  location: string;
  main_features: string;
  expert_pros: string;
  contact_no: string;
  map_url: string;
  search_keywords: string;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'pricing' | 'quotes' | 'notices' | 'golferQuotes' | 'videoGallery' | 'gallery' | 'chatting' | 'lab'>('pricing');
  const [pricingData, setPricingData] = useState<CoursePricing[]>([]);
  const [quotesData, setQuotesData] = useState<QuoteRequest[]>([]);
  const [noticesData, setNoticesData] = useState<Notice[]>([]);
  const [golferQuotesData, setGolferQuotesData] = useState<GolferQuote[]>([]);
  const [videoGalleryData, setVideoGalleryData] = useState<VideoTopic[]>([]);
  const [galleryData, setGalleryData] = useState<GalleryTopic[]>([]);
  const [chattingData, setChattingData] = useState<Chatting[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);

  // Modal state
  const [modal, setModal] = useState<{
    type: 'alert' | 'confirm' | null;
    message: string;
    onConfirm?: () => void;
  }>({ type: null, message: '' });

  const showAlert = (message: string) => {
    setModal({ type: 'alert', message });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '9175938') {
      setIsPasswordVerified(true);
      setFailedAttempts(0);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPasswordInput('');
      if (newAttempts >= 5) {
        showAlert('비밀번호를 5회 이상 틀렸습니다. 홈화면으로 이동합니다.');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        showAlert(`비밀번호가 틀렸습니다. (남은 횟수: ${5 - newAttempts})`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      if (email === 'cskim1747@gmail.com' || email === 'jco119@gmail.com') {
        setUser(result.user);
      } else {
        showAlert('관리자에게 문의해 주세요');
        await signOut(auth);
        setUser(null);
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
    } catch (error) {
      console.error('Google Login Error:', error);
      showAlert('로그인에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await signOut(auth);
      }
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    
    const unsubscribePricing = onSnapshot(collection(db, 'pricing'), (snapshot) => {
      const data = snapshot.docs
        .filter(doc => !/^\d+$/.test(doc.id))
        .map(doc => {
          const d = doc.data() as CoursePricing;
          return {
            ...d,
            rows: d.rows || []
          };
        });
      data.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setPricingData(data);
    }, (error) => {
      console.error("Pricing fetch error:", error);
    });

    const q = query(collection(db, 'quotes'), orderBy('timestamp', 'desc'));
    const unsubscribeQuotes = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as QuoteRequest);
      setQuotesData(data);
      setLoading(false);
    }, (error) => {
      console.error("Quotes fetch error:", error);
      setLoading(false);
    });

    const unsubscribeNotices = onSnapshot(collection(db, 'notices'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Notice);
      data.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setNoticesData(data);
    }, (error) => {
      console.error("Notices fetch error:", error);
    });

    const unsubscribeGolferQuotes = onSnapshot(collection(db, 'golferQuotes'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GolferQuote);
      setGolferQuotesData(data);
    }, (error) => {
      console.error("Golfer quotes fetch error:", error);
    });

    return () => {
      unsubscribePricing();
      unsubscribeQuotes();
      unsubscribeNotices();
      unsubscribeGolferQuotes();
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredQuotes = quotesData.filter(quote => {
    const nameMatch = quote.from_name.toLowerCase().includes(filterName.toLowerCase());
    const startMatch = !filterStartDate || new Date(quote.timestamp) >= new Date(filterStartDate);
    const endMatch = !filterEndDate || new Date(quote.timestamp) <= new Date(filterEndDate);
    return nameMatch && startMatch && endMatch;
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredQuotes.map(q => ({
        '문의일시': safeFormat(q.timestamp, 'yyyy-MM-dd HH:mm'),
        '신청자명': q.from_name,
        '연락처': q.phone,
        '이메일': q.email,
        '골프장': q.golf_courses,
        '일정': q.travel_period,
        '비용(RM)': q.total_myr,
        '비용(₩)': q.total_krw,
        '메시지': q.message || '-'
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '예약요청');
    XLSX.writeFile(workbook, `예약요청_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isPasswordVerified) {
    return (
      <div className="pt-40 pb-24 px-6 text-center min-h-screen flex items-center justify-center">
        <div className="glass max-w-md w-full p-12 rounded-[40px] border border-white/10">
          <div className="w-16 h-16 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-6">
            <Clock className="text-lime" size={32} />
          </div>
          <h2 className="text-2xl serif mb-4 text-white">관리자 전용 화면입니다.</h2>
          <p className="text-sm opacity-60 mb-8">비밀번호를 입력해 주세요</p>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input 
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all text-center tracking-[0.5em] text-white"
              placeholder="•••••••"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full py-4 bg-lime text-forest rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
            >
              확인
            </button>
          </form>
          
          {failedAttempts > 0 && (
            <p className="mt-4 text-xs text-red-400">
              비밀번호 오류: {failedAttempts}/5회
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-40 pb-24 px-32 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-forest/60 backdrop-blur-xl p-10 rounded-[40px] border border-white/10 mb-12">
        <div className="flex flex-col gap-8">
          {/* Login Info */}
          <p className="text-xs opacity-40">
            로그인 계정: <span className="text-lime">{user?.email}</span>
          </p>

          {/* Tabs and Actions */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {[
                { id: 'pricing', label: '골프장 정보' },
                { id: 'quotes', label: '문의 내역' },
                { id: 'notices', label: '공지사항 관리' },
                { id: 'golferQuotes', label: '골퍼 명언 모음' },
                { id: 'videoGallery', label: '동영상 관리' },
                { id: 'gallery', label: '갤러리 관리' },
                { id: 'chatting', label: '채팅정보관리' },
                { id: 'lab', label: '실험실' },
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "text-xl font-bold transition-all border-b-4 pb-2",
                    activeTab === tab.id ? "text-lime border-lime" : "text-white/40 border-transparent hover:text-white/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={handleLogout}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-full flex items-center gap-2 transition-all text-sm opacity-60"
              >
                <LogOut size={18} />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'quotes' && (
          <motion.div
            key="quotes"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Filters */}
            <div className="glass p-10 rounded-[40px] border border-white/10 flex flex-wrap gap-6 items-end">
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
              <div className="w-48">
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
              <div className="w-48">
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
              <button 
                onClick={() => {
                  setFilterName('');
                  setFilterStartDate('');
                  setFilterEndDate('');
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

            {/* Quotes Table */}
            <div className="glass rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40">
                      <th className="px-6 py-4 font-medium whitespace-nowrap">문의일시</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">신청자명</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">연락처</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">이메일</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">골프장</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">일정</th>
                      <th className="px-6 py-4 font-medium text-right whitespace-nowrap">비용(RM)</th>
                      <th className="px-6 py-4 font-medium text-right whitespace-nowrap">비용(₩)</th>
                      <th className="px-6 py-4 font-medium text-center whitespace-nowrap">상태</th>
                      <th className="px-6 py-4 font-medium text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {filteredQuotes.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-12 text-center opacity-40 italic">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredQuotes.map((quote) => (
                        <tr key={quote.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 opacity-60 whitespace-nowrap">
                            {safeFormat(quote.timestamp, 'yy-MM-dd HH:mm')}
                          </td>
                          <td className="px-6 py-4 font-medium whitespace-nowrap max-w-[150px] truncate" title={quote.from_name}>{quote.from_name}</td>
                          <td className="px-6 py-4 opacity-60 whitespace-nowrap">{quote.phone}</td>
                          <td className="px-6 py-4 opacity-60 whitespace-nowrap max-w-[200px] truncate" title={quote.email}>{quote.email}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => setSelectedQuote(quote)}
                              className="max-w-[250px] truncate text-lime hover:underline text-left block w-full" 
                              title="상세 내역 보기"
                            >
                              {quote.golf_courses}
                            </button>
                          </td>
                          <td className="px-6 py-4 opacity-60 whitespace-nowrap max-w-[200px] truncate" title={quote.travel_period}>
                            {quote.travel_period}
                          </td>
                          <td className="px-6 py-4 text-right opacity-60 whitespace-nowrap">RM {quote.total_myr}</td>
                          <td className="px-6 py-4 text-right opacity-60 whitespace-nowrap">₩{quote.total_krw}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs bg-lime/20 text-lime px-3 py-1 rounded-full">
                              {quote.status || '접수확인'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button className="text-lime hover:text-lime/80 transition-colors">
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
          </motion.div>
        )}

        {activeTab !== 'quotes' && (
          <motion.div
            key="other"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-10 rounded-[40px] border border-white/10 text-center"
          >
            <p className="text-white/60">이 탭은 개발 중입니다.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quote Detail Modal */}
      <AnimatePresence>
        {selectedQuote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedQuote(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass rounded-[40px] border border-white/10 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-6">예약 요청 상세</h2>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">신청자명</label>
                    <p className="text-lg font-medium">{selectedQuote.from_name}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">연락처</label>
                    <p className="text-lg font-medium">{selectedQuote.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">이메일</label>
                    <p className="text-lg font-medium">{selectedQuote.email}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">문의일시</label>
                    <p className="text-lg font-medium">
                      {safeFormat(selectedQuote.timestamp, 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">골프장</label>
                  <p className="text-lg font-medium text-lime">{selectedQuote.golf_courses}</p>
                </div>

                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">여행 일정</label>
                  <p className="text-lg font-medium">{selectedQuote.travel_period}</p>
                </div>

                {selectedQuote.message && (
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">추가 메시지</label>
                    <p className="text-white/80 italic">"{selectedQuote.message}"</p>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs tracking-widest uppercase opacity-40">합계(링깃)</span>
                    <span className="text-2xl serif text-white">RM {selectedQuote.total_myr}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs tracking-widest uppercase text-lime font-bold">총 예상 비용(원)</span>
                    <span className="text-3xl serif text-lime font-bold">₩{selectedQuote.total_krw}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="flex-1 bg-lime text-forest py-3 rounded-xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      <AnimatePresence>
        {modal.type && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-[40px] border border-white/10 max-w-md w-full p-8"
            >
              <p className="text-white mb-6">{modal.message}</p>
              <button
                onClick={() => setModal({ type: null, message: '' })}
                className="w-full bg-lime text-forest py-3 rounded-xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
