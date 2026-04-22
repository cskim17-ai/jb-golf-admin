import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  showAsPopup?: boolean;
  imageUrl?: string;
  author?: string;
}

interface AdminAnnouncementsProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

const MAX_FILE_SIZE_MB = 0.8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      try {
        const webpData = canvas.toDataURL('image/webp', 0.8);
        resolve(webpData);
      } catch (e) {
        const jpegData = canvas.toDataURL('image/jpeg', 0.8);
        resolve(jpegData);
      }
    };
    img.src = dataUrl;
  });
};

export default function AdminAnnouncements({ showAlert, showConfirm }: AdminAnnouncementsProps) {
  const [announcementsData, setAnnouncementsData] = useState<Announcement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    isPinned: false,
    showAsPopup: false,
    imageUrl: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Firebase 공지사항 데이터 로드
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Announcement);
      setAnnouncementsData(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (error) => {
      console.error("Announcements fetch error:", error);
      showAlert('공지사항을 불러올 수 없습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showAlert]);

  const handleSave = async () => {
    if (!newAnnouncement.title?.trim()) {
      showAlert('제목을 입력해주세요.');
      return;
    }

    if (!newAnnouncement.content?.trim()) {
      showAlert('내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'announcements', editingId), {
          ...newAnnouncement,
          createdAt: new Date().toISOString()
        });
        showAlert('공지사항이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'announcements'), {
          ...newAnnouncement,
          createdAt: new Date().toISOString()
        });
        showAlert('공지사항이 등록되었습니다.');
      }
      setNewAnnouncement({
        title: '',
        content: '',
        isPinned: false,
        showAsPopup: false,
        imageUrl: ''
      });
      setEditingId(null);
    } catch (error) {
      console.error("Announcement save error:", error);
      showAlert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setNewAnnouncement({
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.isPinned,
      showAsPopup: announcement.showAsPopup,
      imageUrl: announcement.imageUrl
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    showConfirm('정말로 이 공지사항을 삭제하시겠습니까?', async () => {
      try {
        await deleteDoc(doc(db, 'announcements', id));
        if (editingId === id) {
          setEditingId(null);
          setNewAnnouncement({
            title: '',
            content: '',
            isPinned: false,
            showAsPopup: false,
            imageUrl: ''
          });
        }
        showAlert('공지사항이 삭제되었습니다.');
      } catch (error) {
        console.error("Announcement delete error:", error);
        showAlert('삭제에 실패했습니다.');
      }
    });
  };

  if (loading) {
    return (
      <motion.div
        key="announcements"
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
      key="announcements"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-4xl serif">공지사항 관리</h2>
        <button 
          onClick={() => {
            setEditingId(null);
            setNewAnnouncement({
              title: '',
              content: '',
              isPinned: false,
              showAsPopup: false,
              imageUrl: ''
            });
          }}
          className="bg-lime text-forest px-8 py-3 rounded-full font-bold hover:bg-lime/90 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> 새 공지사항 작성
        </button>
      </div>

      {/* Announcement Form */}
      <div className="glass rounded-[40px] p-12 border border-white/10">
        <h3 className="text-xl serif mb-6">{editingId ? '공지사항 수정' : '새 공지사항 작성'}</h3>
        <div className="space-y-6">
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">제목</label>
            <input 
              type="text"
              value={newAnnouncement.title || ''}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all text-xl serif"
              placeholder="공지사항 제목을 입력하세요"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">내용</label>
            <textarea 
              value={newAnnouncement.content || ''}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-4 w-full focus:border-lime outline-none transition-all min-h-[300px] resize-none"
              placeholder="공지사항 내용을 입력하세요"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3 ml-2">
              <input 
                type="checkbox"
                id="isPinned"
                checked={newAnnouncement.isPinned || false}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, isPinned: e.target.checked })}
                className="w-5 h-5 accent-lime cursor-pointer"
              />
              <label htmlFor="isPinned" className="text-sm opacity-80 cursor-pointer">상단 고정</label>
            </div>
            <div className="flex items-center gap-3 ml-2">
              <input 
                type="checkbox"
                id="showAsPopup"
                checked={newAnnouncement.showAsPopup || false}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, showAsPopup: e.target.checked })}
                className="w-5 h-5 accent-lime cursor-pointer"
              />
              <label htmlFor="showAsPopup" className="text-sm opacity-80 cursor-pointer">공지 팝업으로 표시</label>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2">
              이미지 첨부 (URL 또는 파일) <span className="text-lime/60 ml-2">(최대 {MAX_FILE_SIZE_MB * 1000}KB)</span>
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text"
                value={newAnnouncement.imageUrl || ''}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, imageUrl: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-grow focus:border-lime outline-none transition-all text-sm"
                placeholder="이미지 URL을 입력하거나 파일을 선택하세요"
              />
              <div className="relative">
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > MAX_FILE_SIZE_BYTES) {
                        showAlert(`이미지 용량이 너무 큽니다. (${MAX_FILE_SIZE_MB * 1000}KB 이하만 가능합니다)`);
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const compressed = await compressImage(reader.result as string);
                        setNewAnnouncement({ ...newAnnouncement, imageUrl: compressed });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="bg-white/5 border border-white/10 hover:bg-white/10 px-6 py-3 rounded-xl transition-all text-sm font-bold">
                  파일 선택
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-lime text-forest px-10 py-3 rounded-full font-bold hover:bg-lime/90 transition-all disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : (editingId ? '수정 완료' : '등록하기')}
            </button>
            {editingId && (
              <button 
                onClick={() => {
                  setEditingId(null);
                  setNewAnnouncement({
                    title: '',
                    content: '',
                    isPinned: false,
                    showAsPopup: false,
                    imageUrl: ''
                  });
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-10 py-3 rounded-full transition-all"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Announcements List */}
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
            {announcementsData.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center opacity-40 italic">
                  등록된 공지사항이 없습니다.
                </td>
              </tr>
            ) : (
              announcementsData.map((announcement) => (
                <tr key={announcement.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    {announcement.isPinned ? (
                      <span className="px-2 py-0.5 bg-lime/20 text-lime text-[10px] font-bold rounded uppercase tracking-widest">Pinned</span>
                    ) : (
                      <span className="opacity-40">-</span>
                    )}
                  </td>
                  <td className="p-6 font-medium">{announcement.title}</td>
                  <td className="p-6 opacity-60">{format(new Date(announcement.createdAt), 'yyyy.MM.dd')}</td>
                  <td className="p-6 text-right flex gap-4 justify-end">
                    <button 
                      onClick={() => handleEdit(announcement)}
                      className="text-white/40 hover:text-lime transition-colors"
                    >
                      수정
                    </button>
                    <button 
                      onClick={() => handleDelete(announcement.id)}
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
