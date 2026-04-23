import { motion } from 'framer-motion';
import { Download, Trash2, ImageIcon, X, Loader2 } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  showAsPopup?: boolean;
  imageUrl?: string;
  url?: string;
  author?: string;
}

interface AdminNoticesProps {
  isSaving: boolean;
  setIsSaving: (value: boolean) => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

const MAX_FILE_SIZE_MB = 0.8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const supportsWebP = (): boolean => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
};

const compressImage = async (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > 1200) {
          height *= 1200 / width;
          width = 1200;
        }
      } else {
        if (height > 1200) {
          width *= 1200 / height;
          height = 1200;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      
      if (supportsWebP()) {
        resolve(canvas.toDataURL('image/webp', 0.75));
      } else {
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      }
    };
    img.src = dataUrl;
  });
};

export default function AdminNotices({ isSaving, setIsSaving, showAlert, showConfirm }: AdminNoticesProps) {
  const [noticesData, setNoticesData] = useState<Notice[]>([]);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newNotice, setNewNotice] = useState<Partial<Notice>>({
    title: '',
    content: '',
    isPinned: false,
    showAsPopup: false,
    imageUrl: '',
    url: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'notices'), (snapshot) => {
      const notices: Notice[] = [];
      snapshot.forEach((doc) => {
        notices.push({ id: doc.id, ...doc.data() } as Notice);
      });
      setNoticesData(notices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!newNotice.title || !newNotice.content) {
      showAlert('제목과 내용을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingNoticeId) {
        await updateDoc(doc(db, 'notices', editingNoticeId), {
          ...newNotice,
          updatedAt: new Date().toISOString()
        });
        showAlert('공지사항이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'notices'), {
          ...newNotice,
          createdAt: new Date().toISOString()
        });
        showAlert('공지사항이 등록되었습니다.');
      }
      setNewNotice({ title: '', content: '', isPinned: false, showAsPopup: false, imageUrl: '', url: '' });
      setEditingNoticeId(null);
    } catch (error) {
      console.error("Notice save error:", error);
      showAlert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      key="notices"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-4xl serif">공지사항 관리</h2>
        <button 
          onClick={() => {
            setEditingNoticeId(null);
            setNewNotice({ title: '', content: '', isPinned: false, showAsPopup: false, imageUrl: '' });
          }}
          className="bg-lime text-forest px-8 py-3 rounded-full font-bold hover:bg-lime/90 transition-all"
        >
          새 공지사항 작성
        </button>
      </div>

      {/* Notice Form */}
      <div className="glass rounded-[40px] p-12 border border-white/10">
        <h3 className="text-xl serif mb-6">{editingNoticeId ? '공지사항 수정' : '새 공지사항 작성'}</h3>
        <div className="space-y-6">
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">제목</label>
            <input 
              type="text"
              value={newNotice.title || ''}
              onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all text-xl serif"
              placeholder="공지사항 제목을 입력하세요"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">내용</label>
            <textarea 
              value={newNotice.content || ''}
              onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-4 w-full focus:border-lime outline-none transition-all min-h-[300px] resize-none"
              placeholder="공지사항 내용을 입력하세요"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3 ml-2">
              <input 
                type="checkbox"
                id="isPinned"
                checked={newNotice.isPinned || false}
                onChange={(e) => setNewNotice({ ...newNotice, isPinned: e.target.checked })}
                className="w-5 h-5 accent-lime"
              />
              <label htmlFor="isPinned" className="text-sm opacity-80 cursor-pointer">상단 고정</label>
            </div>
            <div className="flex items-center gap-3 ml-2">
              <input 
                type="checkbox"
                id="showAsPopup"
                checked={newNotice.showAsPopup || false}
                onChange={(e) => setNewNotice({ ...newNotice, showAsPopup: e.target.checked })}
                className="w-5 h-5 accent-lime"
              />
              <label htmlFor="showAsPopup" className="text-sm opacity-80 cursor-pointer">공지 팝업으로 표시</label>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">
              이미지 첨부 (URL 또는 파일) <span className="text-lime/60 ml-2">(최대 {MAX_FILE_SIZE_MB * 1000}KB, WebP/JPEG)</span>
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text"
                value={newNotice.imageUrl || ''}
                onChange={(e) => setNewNotice({ ...newNotice, imageUrl: e.target.value, url: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-grow focus:border-lime outline-none transition-all text-sm"
                placeholder="이미지 URL을 입력하거나 파일을 선택하세요"
              />
              <div className="relative">
                <input 
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > MAX_FILE_SIZE_BYTES) {
                        showAlert(`이미지 용량이 너무 큽니다. (${MAX_FILE_SIZE_MB * 1000}KB 이하만 가능합니다)`);
                        return;
                      }
                      
                      setIsUploading(true);
                      try {
                        const uniqueFileName = `${Date.now()}_${file.name}`;
                        const storageRef = ref(storage, `notices/${uniqueFileName}`);
                        const snapshot = await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(snapshot.ref);
                        
                        setNewNotice({ ...newNotice, imageUrl: downloadURL, url: downloadURL });
                        showAlert('이미지가 업로드되었습니다.');
                      } catch (error: any) {
                        console.error('Notice image upload error:', error);
                        if (error.code === 'storage/unauthorized') {
                          showAlert('업로드 권한이 없습니다. Firebase Console 설정을 확인해 주세요.');
                        } else {
                          showAlert('이미지 업로드 중 오류가 발생했습니다.');
                        }
                      } finally {
                        setIsUploading(false);
                        e.target.value = '';
                      }
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button 
                  disabled={isUploading}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl transition-all text-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                  {isUploading ? '업로드 중...' : '파일 선택'}
                </button>
              </div>
            </div>
            {newNotice.imageUrl && (
              <div className="mt-4 relative w-32 h-32 rounded-xl overflow-hidden border border-white/10 group">
                <img src={newNotice.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setNewNotice({ ...newNotice, imageUrl: '', url: '' })}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-lime text-forest px-10 py-3 rounded-full font-bold hover:bg-lime/90 transition-all disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : (editingNoticeId ? '수정 완료' : '등록하기')}
            </button>
            {editingNoticeId && (
              <button 
                onClick={() => {
                  setEditingNoticeId(null);
                  setNewNotice({ title: '', content: '', isPinned: false, showAsPopup: false, imageUrl: '' });
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-10 py-3 rounded-full transition-all"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notices List */}
      <div className="glass rounded-[40px] border border-white/10 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40">
              <th className="p-6 font-medium">상태</th>
              <th className="p-6 font-medium">제목</th>
              <th className="p-6 font-medium">작성일</th>
              <th className="p-6 w-32"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {noticesData.map((notice) => (
              <tr key={notice.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="p-6">
                  {notice.isPinned ? (
                    <span className="px-2 py-0.5 bg-lime/20 text-lime text-[10px] font-bold rounded uppercase tracking-widest">Pinned</span>
                  ) : (
                    <span className="opacity-40">-</span>
                  )}
                </td>
                <td className="p-6 font-medium">{notice.title}</td>
                <td className="p-6 opacity-60">
                  {notice.createdAt ? (
                    typeof notice.createdAt === 'string' 
                      ? format(new Date(notice.createdAt), 'yyyy.MM.dd')
                      : format(new Date((notice.createdAt as any).toDate?.() || notice.createdAt), 'yyyy.MM.dd')
                  ) : '-'}
                </td>
                <td className="p-6 text-right flex gap-4 justify-end">
                  <button 
                    onClick={() => {
                      setEditingNoticeId(notice.id);
                      setNewNotice({ 
                        title: notice.title, 
                        content: notice.content, 
                        isPinned: !!notice.isPinned,
                        showAsPopup: !!notice.showAsPopup,
                        imageUrl: notice.imageUrl || '',
                        url: notice.url || notice.imageUrl || ''
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-white/40 hover:text-lime transition-colors"
                  >
                    수정
                  </button>
                  <button 
                    onClick={() => {
                      showConfirm('정말로 이 공지사항을 삭제하시겠습니까?', async () => {
                        try {
                          await deleteDoc(doc(db, 'notices', notice.id));
                          if (editingNoticeId === notice.id) {
                            setEditingNoticeId(null);
                            setNewNotice({ title: '', content: '', isPinned: false, showAsPopup: false, imageUrl: '' });
                          }
                        } catch (error) {
                          console.error("Notice delete error:", error);
                          showAlert('삭제에 실패했습니다.');
                        }
                      });
                    }}
                    className="text-white/20 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
