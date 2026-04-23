import React, { useState, useEffect, useRef } from 'react';
import { motion, Reorder } from 'framer-motion';
import { GripVertical, Save, RefreshCcw, Info, Lock, UserPlus, Trash2, Plus, Image as ImageIcon, Upload, Loader2, X } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TabConfig {
  id: string;
  label: string;
}

const ADMIN_TABS: TabConfig[] = [
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
  { id: 'faqs', label: 'FAQ 관리' }
];

const CLIENT_TABS: TabConfig[] = [
  { id: 'home', label: '홈' },
  { id: 'notices', label: '공지사항' },
  { id: 'intro', label: '골프장 소개' },
  { id: 'activities', label: '할거리' },
  { id: 'relax', label: '휴식거리' },
  { id: 'pricing', label: '가격표' },
  { id: 'booking', label: '예약하기' },
  { id: 'gallery', label: '갤러리' }
];

export default function AdminMenuSettings({ showAlert }: { showAlert: (msg: string) => void }) {
  const [activeMode, setActiveMode] = useState<'admin' | 'client' | 'access' | 'logo'>('admin');
  const [adminTabs, setAdminTabs] = useState<TabConfig[]>(ADMIN_TABS);
  const [clientTabs, setClientTabs] = useState<TabConfig[]>(CLIENT_TABS);
  const [adminPassword, setAdminPassword] = useState('');
  const [googleLoginPassword, setGoogleLoginPassword] = useState('9175938');
  const [directBypassPassword, setDirectBypassPassword] = useState('5938');
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // 메뉴 설정 로드
        const adminSnap = await getDoc(doc(db, 'settings', 'menuConfig'));
        if (adminSnap.exists()) {
          const remoteTabs = adminSnap.data().tabs as TabConfig[];
          let merged = [...remoteTabs];
          ADMIN_TABS.forEach(def => {
            if (!merged.find(t => t.id === def.id)) {
              if (def.id === 'photoProcessor') {
                const galleryIndex = merged.findIndex(t => t.id === 'gallery');
                if (galleryIndex !== -1) {
                  merged.splice(galleryIndex + 1, 0, def);
                } else {
                  merged.push(def);
                }
              } else {
                merged.push(def);
              }
            }
          });
          setAdminTabs(merged);
        }

        const clientSnap = await getDoc(doc(db, 'settings', 'clientMenuConfig'));
        if (clientSnap.exists()) {
          const remoteTabs = clientSnap.data().tabs as TabConfig[];
          const merged = [...remoteTabs];
          CLIENT_TABS.forEach(def => {
            if (!merged.find(t => t.id === def.id)) merged.push(def);
          });
          setClientTabs(merged);
        }

        // 접속 권한 설정 로드
        const accessSnap = await getDoc(doc(db, 'settings', 'accessConfig'));
        if (accessSnap.exists()) {
          const data = accessSnap.data();
          setAdminPassword(data.adminPassword || '');
          setGoogleLoginPassword(data.googleLoginPassword || '9175938');
          setDirectBypassPassword(data.directBypassPassword || '5938');
          setAllowedUsers(data.allowedUsers || []);
        } else {
          setAllowedUsers([]);
        }

        // 로고 설정 로드
        const logoSnap = await getDoc(doc(db, 'settings', 'logo'));
        if (logoSnap.exists()) {
          setLogoUrl(logoSnap.data().logoUrl || '');
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveMenu = async () => {
    setIsSaving(true);
    const configPath = activeMode === 'admin' ? 'menuConfig' : 'clientMenuConfig';
    const tabsToSave = activeMode === 'admin' ? adminTabs : clientTabs;

    try {
      await setDoc(doc(db, 'settings', configPath), {
        tabs: tabsToSave,
        updatedAt: new Date().toISOString()
      });
      showAlert(`${activeMode === 'admin' ? '대시보드' : '야나골 웹사이트'} 메뉴 순서가 저장되었습니다.`);
    } catch (error) {
      console.error("Error saving menu settings:", error);
      showAlert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAccess = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'accessConfig'), {
        adminPassword,
        googleLoginPassword,
        directBypassPassword,
        allowedUsers,
        updatedAt: new Date().toISOString()
      });
      showAlert('접속 권한 설정이 저장되었습니다.');
    } catch (error) {
      console.error("Error saving access settings:", error);
      showAlert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUser = () => {
    if (!newUserEmail) return;
    if (allowedUsers.includes(newUserEmail)) {
      showAlert('이미 등록된 이메일입니다.');
      return;
    }
    setAllowedUsers([...allowedUsers, newUserEmail]);
    setNewUserEmail('');
  };

  const handleRemoveUser = (email: string) => {
    if (allowedUsers.length <= 1) {
      showAlert('최소 한 명의 관리자는 유지되어야 합니다.');
      return;
    }
    setAllowedUsers(allowedUsers.filter(u => u !== email));
  };

  const handleSaveLogo = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'logo'), {
        logoUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showAlert('로고이미지가 저장되었습니다.');
    } catch (error) {
      console.error("Error saving logo settings:", error);
      showAlert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showAlert('이미지 용량은 2MB를 초과할 수 없습니다.');
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `common/logo_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      setLogoUrl(downloadUrl);
      showAlert('로고 이미지가 업로드되었습니다. [저장] 버튼을 눌러주세요.');
    } catch (error) {
      console.error("Logo upload error:", error);
      showAlert('업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };
  const handleReset = () => {
    if (activeMode === 'admin') setAdminTabs(ADMIN_TABS.map(t => ({ ...t })));
    else setClientTabs(CLIENT_TABS.map(t => ({ ...t })));
  };

  const updateTabLabel = (id: string, newLabel: string) => {
    if (activeMode === 'admin') {
      setAdminTabs(adminTabs.map(t => t.id === id ? { ...t, label: newLabel } : t));
    } else {
      setClientTabs(clientTabs.map(t => t.id === id ? { ...t, label: newLabel } : t));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
      </div>
    );
  }

  const currentTabs = activeMode === 'admin' ? adminTabs : clientTabs;
  const setCurrentTabs = activeMode === 'admin' ? setAdminTabs : setClientTabs;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-lime mb-1">사용자 설정</h2>
          <p className="text-sm text-white/50">드래그하여 메뉴 노출 순서를 변경합니다.</p>
        </div>
        <div className="flex gap-3">
          {activeMode !== 'access' && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all"
              >
                <RefreshCcw size={16} />
                초기화
              </button>
              <button
                onClick={handleSaveMenu}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-lime text-forest rounded-lg text-sm font-bold hover:shadow-[0_0_15px_rgba(163,230,53,0.3)] transition-all disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? '저장 중...' : '순서 저장'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-8">
        <button
          onClick={() => setActiveMode('admin')}
          className={cn(
            "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
            activeMode === 'admin' ? "bg-white/10 text-lime" : "text-white/40 hover:text-white/60"
          )}
        >
          관리자 메뉴
        </button>
        <button
          onClick={() => setActiveMode('client')}
          className={cn(
            "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
            activeMode === 'client' ? "bg-white/10 text-lime" : "text-white/40 hover:text-white/60"
          )}
        >
          야나골 웹사이트 메뉴
        </button>
        <button
          onClick={() => setActiveMode('access')}
          className={cn(
            "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
            activeMode === 'access' ? "bg-white/10 text-lime" : "text-white/40 hover:text-white/60"
          )}
        >
          접속 권한 관리
        </button>
        <button
          onClick={() => setActiveMode('logo')}
          className={cn(
            "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
            activeMode === 'logo' ? "bg-white/10 text-lime" : "text-white/40 hover:text-white/60"
          )}
        >
          로고이미지
        </button>
      </div>

      {activeMode === 'logo' ? (
        <div className="space-y-6">
          <div className="glass p-8 rounded-3xl border border-white/5 space-y-8">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-2">관리자 페이지 로고 설정</h3>
              <p className="text-sm text-white/50">좌측 상단에 노출될 로고 이미지를 변경합니다.</p>
            </div>

            <div className="relative flex flex-col items-center gap-6 p-10 bg-white/5 rounded-3xl border border-dashed border-white/10 group hover:border-lime/30 transition-all">
              {logoUrl ? (
                <div className="relative group">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden bg-forest flex items-center justify-center p-2 border border-white/10">
                    <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                  </div>
                  <button 
                    onClick={() => setLogoUrl('')}
                    className="absolute -top-3 -right-3 p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-white/5 flex items-center justify-center">
                  <ImageIcon size={48} className="opacity-20" />
                </div>
              )}

              <div className="flex flex-col items-center gap-4">
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all text-sm disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  이미지 업로드
                </button>
                <p className="text-xs text-white/30 text-center">
                  권장 크기: 정방형 또는 가로 비율 (PNG, JPG 추천)<br/>
                  최대 2MB 이내
                </p>
              </div>
            </div>

            <button 
              onClick={handleSaveLogo}
              disabled={isSaving || isUploading}
              className="w-full py-5 bg-lime text-forest rounded-2xl font-bold text-lg hover:shadow-[0_0_20px_rgba(163,230,53,0.4)] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save size={20} />
              {isSaving ? '저장 중...' : '로고 설정 저장'}
            </button>
          </div>
        </div>
      ) : activeMode === 'access' ? (
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-lime">
                  <Lock size={16} />
                  1. 직접 통과 비밀번호 (bypass)
                </label>
                <input
                  type="password"
                  value={directBypassPassword}
                  onChange={(e) => setDirectBypassPassword(e.target.value)}
                  placeholder="예: 5938"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all"
                />
                <p className="text-[10px] opacity-40">입력 시 즉시 마스터 권한으로 입장합니다.</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-lime">
                  <Lock size={16} />
                  2. 구글 로그인 활성화 비밀번호
                </label>
                <input
                  type="password"
                  value={googleLoginPassword}
                  onChange={(e) => setGoogleLoginPassword(e.target.value)}
                  placeholder="예: 9175938"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all"
                />
                <p className="text-[10px] opacity-40">입력 시 구글 로그인 창이 나타납니다.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <label className="flex items-center gap-2 text-sm font-bold text-lime mb-4">
                <Lock size={16} />
                관리자 접속 비밀번호 (기본)
              </label>
              <div className="flex gap-4">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="비밀번호 설정"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all"
                />
                <button
                  onClick={handleSaveAccess}
                  disabled={isSaving}
                  className="px-6 bg-lime text-forest rounded-xl font-bold hover:shadow-[0_0_15px_rgba(163,230,53,0.3)] transition-all flex items-center gap-2"
                >
                  <Save size={16} />
                  설정 저장
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <label className="flex items-center gap-2 text-sm font-bold text-lime mb-4">
                <UserPlus size={16} />
                허용된 관리자 Gmail 목록
              </label>
              <div className="flex gap-4 mb-6">
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="추가할 Gmail 주소"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all"
                />
                <button
                  onClick={handleAddUser}
                  className="px-6 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                >
                  <Plus size={16} />
                  이메일 추가
                </button>
              </div>
              
              <div className="space-y-2">
                {allowedUsers.map((email) => (
                  <div key={email} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-sm font-medium">{email}</span>
                    <button
                      onClick={() => handleRemoveUser(email)}
                      className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveAccess}
                disabled={isSaving}
                className="w-full mt-6 py-4 bg-lime/10 text-lime border border-lime/20 rounded-xl font-bold hover:bg-lime/20 transition-all flex items-center justify-center gap-2"
              >
                <Save size={16} />
                허용 목록 최종 저장
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Reorder.Group axis="y" values={currentTabs} onReorder={setCurrentTabs} className="space-y-2">
          {currentTabs.map((tab) => (
            <Reorder.Item
              key={tab.id}
              value={tab}
              className="glass flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-white/20 transition-colors cursor-grab active:cursor-grabbing group"
            >
              <GripVertical className="text-white/20 group-hover:text-lime/50 transition-colors flex-shrink-0" size={20} />
              <div className="flex-1 flex flex-col min-w-0">
                <input
                  type="text"
                  value={tab.label}
                  onChange={(e) => updateTabLabel(tab.id, e.target.value)}
                  className="bg-transparent border-none border-b border-transparent focus:border-lime/50 focus:bg-white/5 rounded px-1 -ml-1 outline-none font-bold text-white w-full transition-all"
                  title="클릭하여 메뉴명 수정"
                />
                <span className="text-[10px] text-white/30 font-mono tracking-wider uppercase px-1">{tab.id}</span>
              </div>
              {activeMode === 'client' && (
                <div className="ml-auto px-3 py-1 rounded-full bg-lime/10 border border-lime/20 text-[10px] text-lime font-bold">
                  WEBSITE
                </div>
              )}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <div className="mt-8 p-6 rounded-2xl bg-lime/5 border border-lime/10">
        <h4 className="flex items-center gap-2 text-lime font-bold text-sm mb-2">
          <Info size={16} />
          알림 사항
        </h4>
        <ul className="text-xs text-white/50 space-y-1 ml-6 list-disc">
          {activeMode === 'access' || activeMode === 'logo' ? (
            <>
              <li><strong>비밀번호:</strong> 관리자 페이지 진입 시 2차 인증용으로 사용됩니다.</li>
              <li><strong>Gmail 목록:</strong> 등록된 이메일로 로그인한 사용자만 대시보드 접근이 가능합니다.</li>
              <li><strong>로고이미지:</strong> 업로드 후 반드시 [저장] 버튼을 눌러야 반영됩니다.</li>
            </>
          ) : (
            <>
              <li><strong>관리자 메뉴:</strong> 대시보드 상단 탭의 순서와 구성이 변경됩니다.</li>
              <li><strong>야나골 메뉴:</strong> 야나골 골프클럽 메인 웹사이트의 상단 네비게이션 순서가 변경됩니다.</li>
              <li>변경 후 반드시 우측 상단의 <strong>[순서 저장]</strong> 버튼을 눌러주세요.</li>
            </>
          )}
        </ul>
      </div>
    </motion.div>
  );
}
