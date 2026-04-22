import React, { useState, useEffect, useCallback, useRef, createContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Calendar, Users, MapPin, 
  Star, Clock, Info, 
  Calculator, Map as MapIcon,
  Plane, Car, Mail, Play,
  ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Send, Search,
  Plus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon, Home as HomeIcon, Download, Upload,
  MessageSquare, RotateCcw, Phone, LogOut, Lock
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
import AdminNotices from '../components/AdminNotices';
import AdminGolferQuotes from '../components/AdminGolferQuotes';
import AdminVideoGallery from '../components/AdminVideoGallery';
import AdminGallery from '../components/AdminGallery';
import AdminChatting from '../components/AdminChatting';
import AdminLab from '../components/AdminLab';
import AdminPricing from '../components/AdminPricing';
import AdminBooking from '../components/AdminBooking';
import AdminPhotoProcessor from '../components/AdminPhotoProcessor';

import AdminBulkPricing from '../components/AdminBulkPricing';
import AdminQuotes from '../components/AdminQuotes';
import AdminDashboard from '../components/AdminDashboard';
import AdminNFCTags from '../components/AdminNFCTags';
import AdminMenuSettings from '../components/AdminMenuSettings';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing' | 'bulkPricing' | 'quotes' | 'notices' | 'booking' | 'golferQuotes' | 'videoGallery' | 'gallery' | 'photoProcessor' | 'chatting' | 'lab' | 'nfcTags' | 'menuSettings'>('dashboard');
  const [menuTabs, setMenuTabs] = useState<{id: string, label: string}[]>([
    { id: 'dashboard', label: '대시보드' },
    { id: 'pricing', label: '골프장 정보' },
    { id: 'bulkPricing', label: '일괄 가격 수정' },
    { id: 'quotes', label: '문의 내역' },
    { id: 'booking', label: '예약요청 관리' },
    { id: 'notices', label: '공지사항 관리' },
    { id: 'golferQuotes', label: '골퍼 명언 모음' },
    { id: 'videoGallery', label: '동영상 관리' },
    { id: 'gallery', label: '갤러리 관리' },
    { id: 'photoProcessor', label: '사진속성변경' },
    { id: 'nfcTags', label: 'NFC 태그 관리' },
    { id: 'chatting', label: '채팅정보관리' },
    { id: 'lab', label: '실험실' },
    { id: 'menuSettings', label: '사용자 설정' },
  ]);
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
  const [accessConfig, setAccessConfig] = useState<{adminPassword?: string, allowedUsers?: string[]}>({});
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModal({ type: 'confirm', message, onConfirm });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPassword = accessConfig.adminPassword || '9175938';
    
    // 5938 입력 시 즉시 메인 화면으로 이동 (로그인 건너뜀)
    if (passwordInput === '5938') {
      setIsPasswordVerified(true);
      setUser({ email: 'master@jb-golf.local', displayName: '마스터 관리자' } as any);
      setFailedAttempts(0);
      return;
    }

    // 9175938 입력 시 구글 로그인 창 활성화
    if (passwordInput === '9175938') {
      setIsPasswordVerified(true);
      setFailedAttempts(0);
      return;
    }

    // 그 외 비밀번호 처리 (기존 로직 유지)
    if (passwordInput === targetPassword) {
      setIsPasswordVerified(true);
      setFailedAttempts(0);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPasswordInput('');
      
      if (newAttempts >= 5) {
        showAlert('비밀번호를 5회 틀렸습니다. 야나골 사이트로 이동합니다.');
        setTimeout(() => {
          window.location.href = "https://cskim17-ai.github.io/jb-golf/";
        }, 1500);
      } else {
        showAlert(`비밀번호가 올바르지 않습니다. (현재 오류 횟수: ${newAttempts}/5)`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      const allowedList = accessConfig.allowedUsers || [];
      
      if (email && allowedList.includes(email)) {
        setUser(result.user);
        setActiveTab('dashboard');
      } else {
        showAlert('관리자에게 문의해 주세요 (등록되지 않은 계정: ' + email + ')');
        await signOut(auth);
        setUser(null);
      }
    } catch (error: any) {
      console.error('Google Login Error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError(window.location.hostname);
        showAlert('현재 도메인이 Firebase 승인된 도메인에 등록되지 않았습니다. 하단의 가이드를 확인해 주세요.');
      } else {
        showAlert('로그인에 실패했습니다.');
      }
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

    // 메뉴 설정 및 접속 권한 설정 불러오기
    const fetchConfigs = async () => {
      try {
        const menuSnap = await getDoc(doc(db, 'settings', 'menuConfig'));
        if (menuSnap.exists()) {
          let savedTabs = menuSnap.data().tabs as {id: string, label: string}[];
          
          // Photo Processor가 없으면 Gallery 관리 옆에 추가
          if (!savedTabs.find(t => t.id === 'photoProcessor')) {
            const galleryIndex = savedTabs.findIndex(t => t.id === 'gallery');
            if (galleryIndex !== -1) {
              savedTabs.splice(galleryIndex + 1, 0, { id: 'photoProcessor', label: '사진속성변경' });
            } else {
              savedTabs.push({ id: 'photoProcessor', label: '사진속성변경' });
            }
          }

          if (!savedTabs.find(t => t.id === 'menuSettings')) {
            savedTabs.push({ id: 'menuSettings', label: '사용자 설정' });
          }
          setMenuTabs(savedTabs);
        }

        const accessSnap = await getDoc(doc(db, 'settings', 'accessConfig'));
        if (accessSnap.exists()) {
          const config = accessSnap.data();
          setAccessConfig(config);
          
          // 만약 allowedUsers 필드가 비어있거나 없으면 자동 로그인 처리
          if (!config.allowedUsers || config.allowedUsers.length === 0) {
            setUser({ email: 'auto-login@jb-golf.local', displayName: '자동 로그인' } as any);
          }
        } else {
          // 설정 자체가 없으면 모든 보안 해제 (최초 설정용)
          setUser({ email: 'setup-admin@jb-golf.local', displayName: '설정 관리자' } as any);
        }
        setIsConfigLoaded(true);
      } catch (e) {
        console.error("Config fetch error:", e);
        setIsConfigLoaded(true);
      }
    };
    fetchConfigs();

    return () => {
      unsubscribePricing();
      unsubscribeQuotes();
      unsubscribeNotices();
      unsubscribeGolferQuotes();
    };
  }, []);

  /* Firebase 인증 상태 감시 주석 처리
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email;
        let allowedList = accessConfig.allowedUsers;
        
        // 만약 accessConfig가 아직 로드되지 않았다면 직접 가져옴
        if (!allowedList) {
          const accessSnap = await getDoc(doc(db, 'settings', 'accessConfig'));
          if (accessSnap.exists()) {
            allowedList = accessSnap.data().allowedUsers;
          }
        }
        
        const finalAllowedList = allowedList || [];
        
        if (email && finalAllowedList.includes(email)) {
          setUser(currentUser);
        } else {
          setUser(null);
          if (email) showAlert('관리자에게 문의해 주세요 (등록되지 않은 계정: ' + email + ')');
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribeAuth();
  }, [accessConfig.allowedUsers]);
  */

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

  if (!isConfigLoaded) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime"></div>
      </div>
    );
  }

  // 1순위: 비밀번호 인증창
  if (!isPasswordVerified) {
    return (
      <div className="pt-40 pb-24 px-6 text-center min-h-screen flex items-center justify-center bg-forest">
        <div className="glass max-w-md w-full p-12 rounded-[30px] border border-white/10">
          <div className="w-16 h-16 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-lime" size={32} />
          </div>
          <h2 className="text-2xl serif mb-4 text-white font-bold">관리자 인증</h2>
          <p className="text-sm opacity-60 mb-8 font-medium">관리자 전용 비밀번호를 입력해 주세요</p>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input 
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:border-lime outline-none transition-all text-center tracking-[0.5em] text-white text-xl font-bold"
              placeholder="••••••"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full py-4 bg-lime text-forest rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
            >
              입장하기
            </button>
          </form>

          {failedAttempts > 0 && (
            <p className="mt-4 text-xs text-red-400 font-bold">
              비밀번호 오류: {failedAttempts}/5회 (5회 초과 시 강제 이동)
            </p>
          )}
        </div>
      </div>
    );
  }

  // 2순위: 구글 로그인창 (비밀번호가 9175938 일 때 보여짐)
  if (!user) {
    return (
      <div className="pt-40 pb-24 px-6 text-center min-h-screen flex items-center justify-center bg-forest">
        <div className="glass max-w-md w-full p-12 rounded-[30px] border border-white/10">
          <div className="w-16 h-16 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-6">
            <LogOut className="text-lime" size={32} />
          </div>
          <h2 className="text-2xl serif mb-4 text-white font-bold">관리자 로그인</h2>
          <p className="text-sm opacity-60 mb-8 font-medium">허용된 Gmail 계정으로 로그인해 주세요</p>
          
          <button 
            onClick={handleGoogleLogin}
            className="w-full py-4 bg-lime text-forest rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all flex items-center justify-center gap-3"
          >
            <HomeIcon size={20} />
            Google 로그인
          </button>

          {authError && (
            <div className="mt-8 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl text-left animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-2 text-red-500 font-bold mb-3">
                <AlertCircle size={18} />
                <span className="text-sm">Firebase 도메인 승인 필요</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed mb-4">
                Firebase 설정에서 현재 도메인을 승인해야 로그인이 가능합니다. 아래 주소를 복사하여 추가해 주세요.
              </p>
              
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-white/40 mb-1 font-medium">관리자 전용 주소 (현재)</p>
                  <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <code className="text-xs text-lime font-mono truncate mr-2">{authError}</code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(authError);
                        showAlert('도메인 주소가 복사되었습니다.');
                      }}
                      className="text-[10px] bg-white/5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-all font-bold flex-shrink-0"
                    >
                      복사
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] text-white/40 mb-2">설정도구 위치:</p>
                  <p className="text-[11px] text-white/70 bg-white/5 p-2.5 rounded-lg leading-tight font-medium">
                    Firebase Console → <span className="text-white">Authentication</span> → <span className="text-white">Settings</span> → <span className="text-white">Authorized domains</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest text-white flex flex-col">
      {/* Top Header - Main Page Style */}
      <header className="sticky top-0 z-50 border-b border-white/10 px-6 py-3 bg-forest">
        <div className="flex items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-lime rounded-lg flex items-center justify-center font-bold text-forest text-lg">
              JB
            </div>
            <div>
              <h1 className="text-lg font-bold">JB Golf Admin</h1>
              <p className="text-xs text-white/60">관리 시스템</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center flex-1">
            {menuTabs.map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "text-xs font-bold transition-all border-b-2 pb-1 whitespace-nowrap",
                  activeTab === tab.id ? "text-lime border-lime" : "text-white/40 border-transparent hover:text-white/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Login Info and Logout */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <p className="text-xs opacity-40 text-right">
              로그인: <span className="text-lime">{user?.email}</span>
            </p>
            <button 
              onClick={handleLogout}
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-full flex items-center gap-1 transition-all text-xs opacity-60 flex-shrink-0"
            >
              <LogOut size={14} />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-6 pb-24 px-32 max-w-[1600px] mx-auto w-full">

      {/* Content */}
      <AnimatePresence mode="wait">

        {activeTab === 'dashboard' && isPasswordVerified && <AdminDashboard showAlert={showAlert} />}

        {activeTab === 'pricing' && isPasswordVerified && <AdminPricing showAlert={showAlert} showConfirm={showConfirm} />}

        {activeTab === 'bulkPricing' && isPasswordVerified && <AdminBulkPricing showAlert={showAlert} showConfirm={showConfirm} />}

        {activeTab === 'quotes' && isPasswordVerified && <AdminQuotes showAlert={showAlert} showConfirm={showConfirm} />}

        {activeTab === 'notices' && isPasswordVerified && (
          <AdminNotices 
            isSaving={isSaving}
            setIsSaving={setIsSaving}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}

        {activeTab === 'golferQuotes' && isPasswordVerified && (
          <AdminGolferQuotes showAlert={showAlert} />
        )}

        {activeTab === 'videoGallery' && isPasswordVerified && (
          <AdminVideoGallery 
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}

        {activeTab === 'gallery' && isPasswordVerified && (
          <AdminGallery showAlert={showAlert} showConfirm={showConfirm} />
        )}

        {activeTab === 'photoProcessor' && isPasswordVerified && (
          <AdminPhotoProcessor showAlert={showAlert} showConfirm={showConfirm} />
        )}

        {activeTab === 'chatting' && isPasswordVerified && (
          <AdminChatting showAlert={showAlert} showConfirm={showConfirm} />
        )}

        {activeTab === 'lab' && isPasswordVerified && (
          <AdminLab showAlert={showAlert} showConfirm={showConfirm} />
        )}

        {activeTab === 'booking' && isPasswordVerified && (
          <AdminBooking showAlert={showAlert} showConfirm={showConfirm} />
        )}

        {activeTab === 'nfcTags' && isPasswordVerified && (
          <AdminNFCTags showAlert={showAlert} showConfirm={showConfirm} />
        )}

        {activeTab === 'menuSettings' && isPasswordVerified && (
          <AdminMenuSettings showAlert={showAlert} />
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
              {modal.type === 'confirm' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setModal({ type: null, message: '' })}
                    className="flex-1 bg-white/10 text-white border border-white/20 py-3 rounded-xl font-bold hover:bg-white/20 transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      modal.onConfirm?.();
                      setModal({ type: null, message: '' });
                    }}
                    className="flex-1 bg-lime text-forest py-3 rounded-xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setModal({ type: null, message: '' })}
                  className="w-full bg-lime text-forest py-3 rounded-xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
                >
                  확인
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
