import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Save, X, GripVertical, Check, AlertCircle, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  imageUrl: string;
  imageAlt: string;
  order: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

const CATEGORIES = ["예약/결제", "골프장 정보", "교통/숙박", "서비스 이용", "기타"];

interface AdminFAQsProps {
  showAlert: (msg: string) => void;
  showConfirm?: (msg: string, callback: () => void) => void;
}

export default function AdminFAQs({ showAlert, showConfirm }: AdminFAQsProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFaq, setCurrentFaq] = useState<Partial<FAQ>>({
    category: CATEGORIES[0],
    question: '',
    answer: '',
    imageUrl: '',
    imageAlt: '',
    order: 0,
    isActive: true
  });

  useEffect(() => {
    // 인덱스 오류를 피하기 위해 단일 orderBy 사용. 
    // 동일한 order 내에서의 정렬은 클라이언트 사이드에서 처리하거나, order 값을 세분화하여 관리하는 것을 권장합니다.
    const q = query(collection(db, 'faqs'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FAQ[];
      setFaqs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!currentFaq.question?.trim() || !currentFaq.answer?.trim()) {
      showAlert('질문과 답변을 모두 입력해주세요.');
      return;
    }

    try {
      const data = {
        ...currentFaq,
        updatedAt: serverTimestamp(),
      };

      if (currentFaq.id) {
        await updateDoc(doc(db, 'faqs', currentFaq.id), data);
        showAlert('FAQ가 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'faqs'), {
          ...data,
          createdAt: serverTimestamp(),
          order: faqs.length > 0 ? Math.max(...faqs.map(f => f.order)) + 1 : 0
        });
        showAlert('새 FAQ가 등록되었습니다.');
      }
      setIsEditing(false);
      resetForm();
    } catch (error) {
      console.error('Save FAQ error:', error);
      showAlert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, 'faqs', id));
        showAlert('FAQ가 삭제되었습니다.');
      } catch (error) {
        console.error('Delete FAQ error:', error);
        showAlert('삭제 중 오류가 발생했습니다.');
      }
    };

    if (showConfirm) {
      showConfirm('이 FAQ를 정말 삭제하시겠습니까?', performDelete);
    } else if (window.confirm('이 FAQ를 삭제하시겠습니까?')) {
      performDelete();
    }
  };

  const resetForm = () => {
    setCurrentFaq({
      category: CATEGORIES[0],
      question: '',
      answer: '',
      imageUrl: '',
      imageAlt: '',
      order: faqs.length,
      isActive: true
    });
  };

  const openEdit = (faq: FAQ) => {
    setCurrentFaq(faq);
    setIsEditing(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 용량 제한 (예: 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showAlert('이미지 용량은 2MB 이하여야 합니다.');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `faqs/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setCurrentFaq(prev => ({ ...prev, imageUrl: downloadURL }));
      showAlert('이미지가 업로드되었습니다.');
    } catch (error: any) {
      console.error('Image upload error:', error);
      if (error.code === 'storage/unauthorized') {
        showAlert('이미지 업로드 권한이 없습니다. Firebase Console에서 Storage 보안 규칙을 확인하거나, 구글 로그인을 시도해 주세요.');
      } else {
        showAlert('이미지 업로드 중 오류가 발생했습니다.');
      }
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 opacity-50">로딩 중...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-lime">자주 묻는 질문(FAQ) 관리</h2>
          <p className="text-sm text-white/40">사용자 웹사이트에 노출될 질문과 답변을 관리합니다.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsEditing(true);
          }}
          className="bg-lime text-forest px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
        >
          <Plus size={18} /> 새 질문 추가
        </button>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-forest/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a2a1a] border border-white/10 rounded-[32px] p-6 w-full max-w-2xl max-h-[95vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-xl font-bold text-white">
                  {currentFaq.id ? 'FAQ 수정' : '새 FAQ 등록'}
                </h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X size={24} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Category selection */}
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-3 ml-1">카테고리 선택</label>
                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.map(cat => {
                      const count = faqs.filter(f => f.category === cat).length;
                      return (
                        <label 
                          key={cat}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all
                            ${currentFaq.category === cat 
                              ? 'bg-lime border-lime text-forest font-bold' 
                              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}
                          `}
                        >
                          <input
                            type="radio"
                            name="category"
                            value={cat}
                            checked={currentFaq.category === cat}
                            onChange={(e) => setCurrentFaq({ ...currentFaq, category: e.target.value })}
                            className="hidden"
                          />
                          {cat}({count})
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2 ml-1">질문 (Question)</label>
                  <input
                    type="text"
                    value={currentFaq.question}
                    onChange={(e) => setCurrentFaq({ ...currentFaq, question: e.target.value })}
                    placeholder="질문을 입력하세요"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-lime outline-none transition-all text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2 ml-1">답변 (Answer)</label>
                  <textarea
                    value={currentFaq.answer}
                    onChange={(e) => setCurrentFaq({ ...currentFaq, answer: e.target.value })}
                    placeholder="답변 내용을 입력하세요"
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-lime outline-none transition-all text-white leading-relaxed resize-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-white/60 mb-2 ml-1">답변 이미지</label>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={currentFaq.imageUrl}
                          onChange={(e) => setCurrentFaq({ ...currentFaq, imageUrl: e.target.value })}
                          placeholder="이미지 URL을 입력하거나 사진을 업로드하세요"
                          className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                          <span className="text-xs font-bold whitespace-nowrap">업로드</span>
                        </button>
                        <input 
                          ref={fileInputRef}
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </div>
                      <input
                        type="text"
                        value={currentFaq.imageAlt}
                        onChange={(e) => setCurrentFaq({ ...currentFaq, imageAlt: e.target.value })}
                        placeholder="이미지에 대한 설명 (SEO용)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-lime outline-none transition-all text-xs text-white"
                      />
                    </div>
                  </div>
                  {currentFaq.imageUrl && (
                    <div className="relative group">
                      <label className="block text-sm font-bold text-white/60 mb-2 ml-1">미리보기</label>
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                        <img 
                          src={currentFaq.imageUrl} 
                          alt={currentFaq.imageAlt} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          onClick={() => setCurrentFaq({ ...currentFaq, imageUrl: '', imageAlt: '' })}
                          className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/40">노출 순서</span>
                      <input 
                        type="number"
                        value={isNaN(currentFaq.order as number) ? '' : currentFaq.order}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setCurrentFaq({ ...currentFaq, order: isNaN(val) ? 0 : val });
                        }}
                        className="bg-white/5 border border-white/10 rounded-lg w-16 px-3 py-1 text-center font-bold text-lime"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${currentFaq.isActive ? 'bg-lime border-lime' : 'border-white/20'}`}>
                        {currentFaq.isActive && <Check size={14} className="text-forest" strokeWidth={3} />}
                      </div>
                      <input 
                        type="checkbox"
                        checked={currentFaq.isActive}
                        onChange={(e) => setCurrentFaq({ ...currentFaq, isActive: e.target.checked })}
                        className="hidden"
                      />
                      <span className="text-xs font-bold text-white/40 group-hover:text-white/60 transition-colors">활성화</span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-3 rounded-xl font-bold text-white/60 hover:bg-white/5 transition-all"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      className="bg-lime text-forest px-8 py-3 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
                    >
                      저장하기
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-4">
        {faqs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[40px] opacity-30">
            <AlertCircle size={40} className="mx-auto mb-4" />
            등록된 FAQ가 없습니다.
          </div>
        ) : (
          faqs.map(faq => (
            <div 
              key={faq.id}
              className={`glass p-6 rounded-[32px] border transition-all ${faq.isActive ? 'border-white/10' : 'border-white/5 opacity-50'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-lime/10 text-lime text-[10px] font-bold rounded-full tracking-wider">
                      {faq.category}
                    </span>
                    {!faq.isActive && <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">[비활성]</span>}
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">ORDER: {faq.order}</span>
                  </div>
                  <h4 className="text-lg font-bold text-white">Q. {faq.question}</h4>
                  <div className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                    A. {faq.answer}
                  </div>
                  {faq.imageUrl && (
                    <div className="mt-4 flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 w-fit">
                      <ImageIcon size={16} className="text-lime" />
                      <span className="text-xs text-white/40 truncate max-w-xs">{faq.imageUrl}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-6">
                  <button 
                    onClick={() => openEdit(faq)}
                    className="p-3 bg-white/5 hover:bg-lime/20 hover:text-lime text-white/40 rounded-2xl transition-all"
                    title="수정"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(faq.id)}
                    className="p-3 bg-white/5 hover:bg-red-400/20 hover:text-red-400 text-white/40 rounded-2xl transition-all"
                    title="삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
