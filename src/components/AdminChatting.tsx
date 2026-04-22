import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { collection, onSnapshot, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';

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

interface AdminChattingProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

export default function AdminChatting({ showAlert, showConfirm }: AdminChattingProps) {
  const [chattingData, setChattingData] = useState<Chatting[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Firebase 채팅 데이터 로드
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chatting'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Chatting);
      setChattingData(data.sort((a, b) => a.name_ko.localeCompare(b.name_ko)));
      setLoading(false);
    }, (error) => {
      console.error("Chatting fetch error:", error);
      showAlert('채팅 정보를 불러올 수 없습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showAlert]);

  const handleAddNewChatting = async () => {
    const newId = prompt('새 골프장 문서 ID (영문)를 입력하세요:');
    if (!newId) return;

    const newChat: Chatting = {
      id: newId,
      name_ko: '새 골프장',
      name_en: '',
      region_tag: '[시내권]',
      price_wd_am: 0,
      price_note: '',
      total_holes: 18,
      course_names: '',
      course_desc_legacy: '',
      image_url_main: '',
      location: '',
      main_features: '',
      expert_pros: '',
      contact_no: '',
      map_url: '',
      search_keywords: ''
    };

    try {
      await setDoc(doc(db, 'chatting', newId), newChat);
      showAlert('새 채팅 정보가 추가되었습니다.');
      setSelectedChatId(newId);
    } catch (error) {
      console.error("Chatting add error:", error);
      showAlert('추가에 실패했습니다.');
    }
  };

  const handleSaveChatting = async () => {
    if (!selectedChatId) return;
    
    const chat = chattingData.find(c => c.id === selectedChatId);
    if (!chat) return;

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'chatting', chat.id), chat);
      showAlert('저장되었습니다.');
    } catch (error) {
      console.error("Chatting save error:", error);
      showAlert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChatting = () => {
    if (!selectedChatId) return;

    showConfirm('이 골프장 채팅 정보를 삭제하시겠습니까?', async () => {
      try {
        await deleteDoc(doc(db, 'chatting', selectedChatId));
        setSelectedChatId(null);
        showAlert('삭제되었습니다.');
      } catch (error) {
        console.error("Chatting delete error:", error);
        showAlert('삭제에 실패했습니다.');
      }
    });
  };

  const updateChattingField = (field: keyof Chatting, value: any) => {
    if (!selectedChatId) return;

    const newData = [...chattingData];
    const idx = newData.findIndex(c => c.id === selectedChatId);
    if (idx !== -1) {
      newData[idx] = { ...newData[idx], [field]: value };
      setChattingData(newData);
    }
  };

  if (loading) {
    return (
      <motion.div
        key="chatting"
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
      key="chatting"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">채팅정보관리</h2>
        <button 
          onClick={handleAddNewChatting}
          className="bg-lime text-forest px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
        >
          <Plus size={18} /> 새 골프장 추가
        </button>
      </div>

      <div className="glass p-12 rounded-[40px] border border-white/10 space-y-8">
        {/* Golf Course Selection */}
        <div>
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장 선택 (조회조건)</label>
          <select 
            value={selectedChatId || ''}
            onChange={(e) => setSelectedChatId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all appearance-none cursor-pointer text-lg serif"
          >
            <option value="" className="bg-forest">골프장을 선택하세요</option>
            {chattingData.map(chat => (
              <option key={chat.id} value={chat.id} className="bg-forest">
                {chat.name_ko} ({chat.id})
              </option>
            ))}
          </select>
        </div>

        {/* Chatting Details */}
        {selectedChatId && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-500"
          >
            {/* Left Column */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장명 (국문) name_ko</label>
                  <input 
                    type="text"
                    value={chattingData.find(c => c.id === selectedChatId)?.name_ko || ''}
                    onChange={(e) => updateChattingField('name_ko', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장명 (영문) name_en</label>
                  <input 
                    type="text"
                    value={chattingData.find(c => c.id === selectedChatId)?.name_en || ''}
                    onChange={(e) => updateChattingField('name_en', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">지역 태그 region_tag</label>
                  <input 
                    type="text"
                    value={chattingData.find(c => c.id === selectedChatId)?.region_tag || ''}
                    onChange={(e) => updateChattingField('region_tag', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">주중 오전 가격 price_wd_am</label>
                  <input 
                    type="number"
                    value={chattingData.find(c => c.id === selectedChatId)?.price_wd_am || 0}
                    onChange={(e) => updateChattingField('price_wd_am', parseInt(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">총 홀 수 total_holes</label>
                  <input 
                    type="number"
                    value={chattingData.find(c => c.id === selectedChatId)?.total_holes || 18}
                    onChange={(e) => updateChattingField('total_holes', parseInt(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">가격 설명 price_note</label>
                  <input 
                    type="text"
                    value={chattingData.find(c => c.id === selectedChatId)?.price_note || ''}
                    onChange={(e) => updateChattingField('price_note', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">위치 location</label>
                <input 
                  type="text"
                  value={chattingData.find(c => c.id === selectedChatId)?.location || ''}
                  onChange={(e) => updateChattingField('location', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">코스명 course_names</label>
                <input 
                  type="text"
                  value={chattingData.find(c => c.id === selectedChatId)?.course_names || ''}
                  onChange={(e) => updateChattingField('course_names', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">메인 이미지 URL image_url_main</label>
                <input 
                  type="text"
                  value={chattingData.find(c => c.id === selectedChatId)?.image_url_main || ''}
                  onChange={(e) => updateChattingField('image_url_main', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">코스 설명 course_desc_legacy</label>
                <textarea 
                  value={chattingData.find(c => c.id === selectedChatId)?.course_desc_legacy || ''}
                  onChange={(e) => updateChattingField('course_desc_legacy', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">주요 특징 main_features</label>
                <textarea 
                  value={chattingData.find(c => c.id === selectedChatId)?.main_features || ''}
                  onChange={(e) => updateChattingField('main_features', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">전문가 한마디 expert_pros</label>
                <textarea 
                  value={chattingData.find(c => c.id === selectedChatId)?.expert_pros || ''}
                  onChange={(e) => updateChattingField('expert_pros', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">연락처 contact_no</label>
                  <input 
                    type="text"
                    value={chattingData.find(c => c.id === selectedChatId)?.contact_no || ''}
                    onChange={(e) => updateChattingField('contact_no', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">구글맵 URL map_url</label>
                  <input 
                    type="text"
                    value={chattingData.find(c => c.id === selectedChatId)?.map_url || ''}
                    onChange={(e) => updateChattingField('map_url', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">검색 키워드 search_keywords</label>
                <input 
                  type="text"
                  value={chattingData.find(c => c.id === selectedChatId)?.search_keywords || ''}
                  onChange={(e) => updateChattingField('search_keywords', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Save/Delete Buttons */}
        {selectedChatId && (
          <div className="pt-4 flex gap-4">
            <button 
              onClick={handleSaveChatting}
              disabled={isSaving}
              className="flex-grow bg-lime text-forest py-4 rounded-2xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '채팅 정보 저장하기'}
            </button>
            <button 
              onClick={handleDeleteChatting}
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 rounded-2xl transition-all text-red-400"
            >
              <Trash2 size={24} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
