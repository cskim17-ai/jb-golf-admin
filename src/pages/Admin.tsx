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
  MessageSquare, RotateCcw, Phone, LogOut, Lock, Eye, EyeOff
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
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously, type User } from 'firebase/auth';
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
import AdminFAQs from '../components/AdminFAQs';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing' | 'bulkPricing' | 'quotes' | 'notices' | 'booking' | 'golferQuotes' | 'videoGallery' | 'gallery' | 'photoProcessor' | 'chatting' | 'lab' | 'nfcTags' | 'menuSettings' | 'faqs'>('dashboard');
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
    { id: 'faqs', label: 'FAQ 관리' },
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
  const [isBypassed, setIsBypassed] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [accessConfig, setAccessConfig] = useState<{
    adminPassword?: string, 
    googleLoginPassword?: string, 
    directBypassPassword?: string, 
    allowedUsers?: string[]
  }>({});
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  // Logo loading
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'logo'), (snap) => {
      if (snap.exists()) {
        setLogoUrl(snap.data().logoUrl || '');
      }
    });
    return () => unsubscribe();
  }, []);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isStorageDegraded, setIsStorageDegraded] = useState(false);

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

  const showAlert = useCallback((message: string) => {
    setModal({ type: 'alert', message });
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setModal({ type: 'confirm', message, onConfirm });
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Firestore에서 가져온 비밀번호 설정 사용
    const directBypassPassword = accessConfig.directBypassPassword;
    const googleLoginPassword = accessConfig.googleLoginPassword;
    const targetPassword = accessConfig.adminPassword;
    
    const performAnonymousLogin = () => {
      signInAnonymously(auth).then((result) => {
        setUser(result.user);
        setIsStorageDegraded(false);
      }).catch(err => {
        console.error("Anonymous sign-in error:", err);
        if (err.code === 'auth/admin-restricted-operation') {
          setIsStorageDegraded(true);
        }
        setUser({ email: 'master@jb-golf.local', displayName: '마스터 관리자', isAnonymous: true } as any);
      });
    };

    // 1, 2, 3. 입력값이 directBypassPassword, adminPassword, 또는 googleLoginPassword 인 경우의 처리
    const inputClean = passwordInput.trim();
    const isBypassMatch = directBypassPassword && inputClean === directBypassPassword.trim();
    const isAdminMatch = targetPassword && inputClean === targetPassword.trim();
    const isGooglePassMatch = googleLoginPassword && inputClean === googleLoginPassword.trim();

    if (isBypassMatch || isAdminMatch || isGooglePassMatch) {
      setFailedAttempts(0);
      
      // 구글 로그인 활성화 여부 체크: googleLoginPassword 필드에 값이 있는 경우
      const isGoogleAuthActive = googleLoginPassword && googleLoginPassword.trim().length > 0;

      if (isGoogleAuthActive) {
        // 구글 로그인 설정이 있는 경우: 입력한 비번에 상관없이 구글 2차 인증 과정을 거침
        setIsBypassed(false);
        setIsPasswordVerified(true);
        
        // 구글 로그인 창 노출을 위해 현재 유저 상태 초기화 및 팝업 유도
        if (auth.currentUser) {
          signOut(auth).then(() => {
            setUser(null);
            handleGoogleLogin();
          }).catch(() => {
            setUser(null);
            handleGoogleLogin();
          });
        } else {
          setUser(null);
          handleGoogleLogin();
        }
      } else {
        // 구글 로그인 설정이 없는 경우: 즉시 진입 (Bypass 허용)
        setIsBypassed(true);
        setIsPasswordVerified(true);
        performAnonymousLogin();
      }
      return;
    }

    // 실패 처리
    const newAttempts = failedAttempts + 1;
    setPasswordInput('');
    
    if (newAttempts >= 5) {
      setFailedAttempts(0);
      showAlert('관리자에게 문의해 주세요.');
    } else {
      setFailedAttempts(newAttempts);
      showAlert(`비밀번호가 올바르지 않습니다. (현재 오류 횟수: ${newAttempts}/5)`);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase().trim();
      const allowedList = (accessConfig.allowedUsers || []).map(u => u.toLowerCase().trim());
      
      if (email && allowedList.includes(email)) {
        setUser(result.user);
        setIsPasswordVerified(true); // 구글 로그인 성공 시 암호 인증도 통과된 것으로 간주
        setActiveTab('dashboard');
      } else {
        showAlert('관리자에게 문의해 주세요.');
        await signOut(auth);
        setUser(null);
        setIsPasswordVerified(false); // 다시 관리자 로그인 암호창이 나오도록 함
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
      setIsPasswordVerified(false);
      setIsBypassed(false);
      setPasswordInput('');
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
          let savedTabs = (menuSnap.data().tabs as {id: string, label: string}[])
            .filter(t => t.id !== 'accessControl'); // 접속 권한 관리 메뉴 삭제
          
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

          if (!savedTabs.find(t => t.id === 'faqs')) {
            savedTabs.push({ id: 'faqs', label: 'FAQ 관리' });
          }
          setMenuTabs(savedTabs);
        }

        const accessSnap = await getDoc(doc(db, 'settings', 'accessConfig'));
        if (accessSnap.exists()) {
          const config = accessSnap.data();
          setAccessConfig(config);
          
          // 암호 설정(adminPassword 또는 directBypassPassword)이 아예 없는 경우 자동 로그인 처리
          const adminPass = (config.adminPassword || '').trim();
          const bypassPass = (config.directBypassPassword || '').trim();
          const googlePass = (config.googleLoginPassword || '').trim();
          
          const hasPasswordConfig = adminPass.length > 0 || bypassPass.length > 0;
          const isGoogleAuthActive = googlePass.length > 0;

          // 1. 관리자 암호(adminPassword)가 없는 경우 바로 인증 통과 처리
          if (adminPass.length === 0) {
            setIsPasswordVerified(true);
            if (isGoogleAuthActive) {
              // 구글 2차 인증이 필요한 경우 (암호창만 건너뜀)
              setIsBypassed(false);
            } else {
              // 구글 인증도 필요 없는 경우 바로 로그인 처리
              setIsBypassed(true);
              signInAnonymously(auth).then((result) => {
                setUser(result.user);
              });
            }
          } 
          // 2. 그 외 (암호는 있지만) 허용 사용자도 없고 구글로그인 설정도 없는 경우 자동 로그인
          else if (!hasPasswordConfig && (!config.allowedUsers || config.allowedUsers.length === 0) && !isGoogleAuthActive) {
            signInAnonymously(auth).then((result) => {
              setUser(result.user);
              setIsPasswordVerified(true);
              setIsBypassed(true);
              setIsStorageDegraded(false);
            }).catch((err) => {
              if (err.code === 'auth/admin-restricted-operation') {
                setIsStorageDegraded(true);
              }
              setUser({ email: 'auto-login@jb-golf.local', displayName: '자동 로그인', isAnonymous: true } as any);
              setIsPasswordVerified(true);
              setIsBypassed(true);
            });
          }
        } else {
          // 설정 자체가 없으면 보안 해제
          signInAnonymously(auth).then((result) => {
            setUser(result.user);
            setIsPasswordVerified(true);
            setIsStorageDegraded(false);
          });
        }
        setIsConfigLoaded(true);
      } catch (e) {
        console.error("Config fetch error:", e);
        setIsConfigLoaded(true);
      }
    };
    fetchConfigs();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email?.toLowerCase().trim();
        
        // accessConfig 로드 대기
        let allowedList = accessConfig.allowedUsers;
        if (!allowedList) {
          try {
            const accessSnap = await getDoc(doc(db, 'settings', 'accessConfig'));
            if (accessSnap.exists()) {
              allowedList = accessSnap.data().allowedUsers || [];
            }
          } catch (err) {
            console.error("Auth reload config fetch error:", err);
          }
        }
        
        const finalAllowedList = (allowedList || []).map(u => u.toLowerCase().trim());
        
        if (email && finalAllowedList.includes(email)) {
          setUser(currentUser);
          // 보안을 위해 새로고침 시에는 setIsPasswordVerified(true)를 여기서 호출하지 않음
          // 사용자가 암호를 먼저 입력해야 함. (단, 이미 암호를 입력한 상태라면 유지됨)
        } else if (currentUser.isAnonymous) {
          setUser(currentUser);
          // 익명 로그인 역시 새로고침 시 암호창을 거치도록 유지
        } else {
          // 허용되지 않은 구글 계정인 경우 로그아웃
          setUser(null);
          setIsPasswordVerified(false);
          await signOut(auth);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      unsubscribePricing();
      unsubscribeQuotes();
      unsubscribeNotices();
      unsubscribeGolferQuotes();
      unsubscribeAuth();
    };
  }, [accessConfig.allowedUsers]);

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
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 pr-12 focus:border-lime outline-none transition-all text-center tracking-[0.5em] text-white text-xl font-bold"
                placeholder="••••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-lime text-forest rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
            >
              입장하기
            </button>
          </form>

          {failedAttempts > 0 && (
            <p className="mt-4 text-xs text-red-400 font-bold">
              비밀번호 오류: {failedAttempts}/5회
            </p>
          )}
        </div>
      </div>
    );
  }

  // 2순위: 구글 로그인창 (비밀번호 인증 후 구글 2차 인증이 필요한 경우)
  if (!isBypassed && (!user || user.isAnonymous)) {
    // 만약 구글 로그인이 설정되어 있는데 현재 익명이거나 로그인이 안되어 있다면
    const googlePass = (accessConfig.googleLoginPassword || '').trim();
    const isGoogleAuthActive = googlePass.length > 0;

    if (isGoogleAuthActive && (!user || user.isAnonymous)) {
      return (
        <div className="pt-40 pb-24 px-6 text-center min-h-screen flex items-center justify-center bg-forest">
          <div className="glass max-w-md w-full p-12 rounded-[30px] border border-white/10">
            <div className="w-16 h-16 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-6">
              <LogOut className="text-lime" size={32} />
            </div>
            <h2 className="text-2xl serif mb-4 text-white font-bold">2차 구글 인증</h2>
            <p className="text-sm opacity-60 mb-8 font-medium">허용된 Gmail 계정으로 로그인해 주세요</p>
            
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-lime text-forest rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all flex items-center justify-center gap-3"
            >
              <ImageIcon size={20} />
              Google 계정 선택
            </button>
            
            <button
              onClick={() => {
                setIsPasswordVerified(false);
                setIsBypassed(false);
                setUser(null);
                signOut(auth);
              }}
              className="mt-6 text-xs text-white/40 hover:text-white transition-all font-medium"
            >
              인증창으로 돌아가기
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
  }

  return (
    <div className="min-h-screen bg-forest text-white flex flex-col">
      {/* Top Header - Main Page Style */}
      <header className="sticky top-0 z-50 border-b border-white/10 px-6 py-3 bg-forest">
        <div className="flex items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {logoUrl ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center p-1 bg-white/5 border border-white/10">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-lime rounded-lg flex items-center justify-center font-bold text-forest text-lg">
                JB
              </div>
            )}
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

      {isStorageDegraded && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-red-500/20 border border-red-500/30 rounded-[30px] flex items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4 text-red-400">
            <AlertCircle size={24} />
            <div>
              <p className="font-bold">이미지 업로드 기능이 제한됨 (Firebase 설정 필요)</p>
              <p className="text-sm opacity-80">Firebase Console → Authentication → Settings → User actions 에서 '사용자가 계정을 만들 수 있도록 허용'을 체크해야 합니다.</p>
            </div>
          </div>
          <button 
            onClick={() => window.open('https://console.firebase.google.com/', '_blank')}
            className="bg-red-500 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-600 transition-all shrink-0"
          >
            설정하러 가기
          </button>
        </motion.div>
      )}

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

        {activeTab === 'faqs' && isPasswordVerified && (
          <AdminFAQs showAlert={showAlert} showConfirm={showConfirm} />
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
