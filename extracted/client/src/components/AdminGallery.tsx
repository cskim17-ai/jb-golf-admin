import { Plus, Trash2, Upload, ImageIcon, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string;
  order?: number;
  createdAt?: any;
}

interface GalleryTopic {
  id: string;
  title: string;
  order: number;
}

interface AdminGalleryProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

export default function AdminGallery({ showAlert, showConfirm }: AdminGalleryProps) {
  const [galleryTopics, setGalleryTopics] = useState<GalleryTopic[]>([]);
  const [photosByTopic, setPhotosByTopic] = useState<{ [key: string]: GalleryPhoto[] }>({});
  const [galleryTopicFilter, setGalleryTopicFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [pendingCaptions, setPendingCaptions] = useState<{ [key: string]: string }>({});
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [expandedPhotoLists, setExpandedPhotoLists] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { current: number; total: number } }>({});
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Firebase 갤러리 데이터 로드 - 서브컬렉션 구조
  useEffect(() => {
    const loadGalleryData = async () => {
      try {
        setLoading(true);
        const unsubscribe = onSnapshot(collection(db, 'gallery'), async (topicsSnapshot) => {
          const topics: GalleryTopic[] = [];
          const topicsData: { [key: string]: GalleryPhoto[] } = {};

          // 각 주제 문서에 대해 서브컬렉션의 사진 로드
          for (const topicDoc of topicsSnapshot.docs) {
            const data = topicDoc.data();
            topics.push({
              id: topicDoc.id,
              title: data.title || '새 주제',
              order: data.order || 0
            });

            // 서브컬렉션에서 사진 로드
            try {
              const photosSnapshot = await getDocs(collection(db, 'gallery', topicDoc.id, 'photos'));
              const photos: GalleryPhoto[] = photosSnapshot.docs.map(photoDoc => ({
                id: photoDoc.id,
                url: photoDoc.data().url || '',
                caption: photoDoc.data().caption || '',
                order: photoDoc.data().order || 0,
                createdAt: photoDoc.data().createdAt
              })).sort((a, b) => (a.order || 0) - (b.order || 0));
              
              topicsData[topicDoc.id] = photos;
            } catch (error) {
              console.error('Error loading photos for topic:', topicDoc.id, error);
              topicsData[topicDoc.id] = [];
            }
          }

          setGalleryTopics(topics.sort((a, b) => (a.order || 0) - (b.order || 0)));
          setPhotosByTopic(topicsData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('갤러리 데이터 로드 오류:', error);
        showAlert('갤러리 데이터를 불러올 수 없습니다.');
        setLoading(false);
      }
    };

    loadGalleryData();
  }, [showAlert]);

  const moveTopicOrder = async (topicId: string, direction: 'up' | 'down') => {
    const topicIdx = galleryTopics.findIndex(t => t.id === topicId);
    if (topicIdx === -1) return;

    if ((direction === 'up' && topicIdx === 0) || (direction === 'down' && topicIdx === galleryTopics.length - 1)) {
      return;
    }

    const newTopics = [...galleryTopics];
    const swapIdx = direction === 'up' ? topicIdx - 1 : topicIdx + 1;
    [newTopics[topicIdx].order, newTopics[swapIdx].order] = [newTopics[swapIdx].order, newTopics[topicIdx].order];

    setGalleryTopics(newTopics);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'gallery', newTopics[topicIdx].id), { order: newTopics[topicIdx].order });
      batch.update(doc(db, 'gallery', newTopics[swapIdx].id), { order: newTopics[swapIdx].order });
      await batch.commit();
    } catch (error) {
      console.error('Move topic error:', error);
      showAlert('주제 순서 변경 중 오류가 발생했습니다.');
    }
  };

  const movePhotoOrder = async (topicId: string, photoId: string, direction: 'up' | 'down') => {
    const photos = photosByTopic[topicId] || [];
    const photoIdx = photos.findIndex(p => p.id === photoId);
    if (photoIdx === -1) return;

    if ((direction === 'up' && photoIdx === 0) || (direction === 'down' && photoIdx === photos.length - 1)) {
      return;
    }

    const swapIdx = direction === 'up' ? photoIdx - 1 : photoIdx + 1;
    
    // 배열에서 두 항목을 교환
    const newPhotos = [...photos];
    [newPhotos[photoIdx], newPhotos[swapIdx]] = [newPhotos[swapIdx], newPhotos[photoIdx]];
    
    // 새로운 order 값 할당 (0부터 시작)
    newPhotos.forEach((photo, idx) => {
      photo.order = idx;
    });

    const newPhotosByTopic = { ...photosByTopic };
    newPhotosByTopic[topicId] = newPhotos;
    setPhotosByTopic(newPhotosByTopic);

    try {
      const batch = writeBatch(db);
      // 모든 사진의 새로운 order 값을 업데이트
      newPhotos.forEach((photo) => {
        batch.update(doc(db, 'gallery', topicId, 'photos', photo.id), { order: photo.order });
      });
      await batch.commit();
      showAlert('사진 순서가 변경되었습니다.');
    } catch (error) {
      console.error('Move photo error:', error);
      showAlert('사진 순서 변경 중 오류가 발생했습니다.');
    }
  };

  const togglePhotoList = (topicId: string) => {
    const newExpanded = new Set(expandedPhotoLists);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedPhotoLists(newExpanded);
  };

  const addPhoto = async (topicId: string) => {
    if (!newPhotoUrl.trim()) {
      showAlert('이미지 URL을 입력해주세요.');
      return;
    }

    try {
      const photos = photosByTopic[topicId] || [];
      const photoId = `photo_${Date.now()}`;
      const maxOrder = Math.max(...photos.map(p => p.order || 0), -1);
      
      // 서브컬렉션에 사진 추가
      await setDoc(doc(db, 'gallery', topicId, 'photos', photoId), {
        url: newPhotoUrl,
        caption: newPhotoCaption,
        order: maxOrder + 1,
        createdAt: serverTimestamp()
      });

      showAlert('사진이 추가되었습니다.');
      setNewPhotoUrl('');
      setNewPhotoCaption('');
    } catch (error) {
      console.error('Add photo error:', error);
      showAlert('사진 추가 중 오류가 발생했습니다.');
    }
  };

  const updatePhotoCaption = async (topicId: string, photoId: string, caption: string) => {
    try {
      await updateDoc(doc(db, 'gallery', topicId, 'photos', photoId), {
        caption: caption,
        updatedAt: serverTimestamp()
      });
      showAlert('설명이 저장되었습니다.');
    } catch (error) {
      console.error('Update caption error:', error);
      showAlert('설명 저장 중 오류가 발생했습니다.');
    }
  };

  const deletePhoto = async (topicId: string, photoId: string) => {
    showConfirm('이 사진을 삭제하시겠습니까?', async () => {
      try {
        await deleteDoc(doc(db, 'gallery', topicId, 'photos', photoId));
        showAlert('사진이 삭제되었습니다.');
      } catch (error) {
        console.error('Delete photo error:', error);
        showAlert('사진 삭제 중 오류가 발생했습니다.');
      }
    });
  };

  const handleBulkPhotoUpload = async (topicId: string, files: FileList) => {
    if (!files || files.length === 0) {
      showAlert('사진을 선택해주세요.');
      return;
    }

    try {
      const photos = photosByTopic[topicId] || [];
      let maxOrder = Math.max(...photos.map(p => p.order || 0), -1);
      let uploadedCount = 0;

      // 업로드 진행 상태 초기화
      setUploadProgress({ ...uploadProgress, [topicId]: { current: 0, total: files.length } });

      // 파일을 순차적으로 처리
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // FileReader를 Promise로 변환
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const photoId = `photo_${Date.now()}_${i}`;
        maxOrder++;
        
        // 각 파일을 개별적으로 저장 (배치 대신 개별 저장)
        await setDoc(doc(db, 'gallery', topicId, 'photos', photoId), {
          url: base64String,
          caption: '',
          order: maxOrder,
          createdAt: serverTimestamp()
        });

        uploadedCount++;
        
        // 진행 상태 업데이트
        setUploadProgress(prev => ({ ...prev, [topicId]: { current: uploadedCount, total: files.length } }));
        
        // 과부하 방지를 위해 100ms 지연
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      showAlert(`${uploadedCount}개의 사진이 추가되었습니다.`);
      // 파일 입력 초기화
      if (fileInputRefs.current[topicId]) {
        fileInputRefs.current[topicId]!.value = '';
      }
      // 진행 상태 초기화
      setUploadProgress(prev => ({ ...prev, [topicId]: { current: 0, total: 0 } }));
    } catch (error) {
      console.error('Bulk upload error:', error);
      showAlert('사진 업로드 중 오류가 발생했습니다.');
      // 오류 발생 시 진행 상태 초기화
      setUploadProgress(prev => ({ ...prev, [topicId]: { current: 0, total: 0 } }));
    }
  };

  const addTopic = async () => {
    try {
      const topicId = `topic_${Date.now()}`;
      await setDoc(doc(db, 'gallery', topicId), {
        title: '새 주제',
        order: galleryTopics.length,
        createdAt: new Date().toISOString()
      });
      showAlert('새 주제가 추가되었습니다.');
    } catch (error) {
      console.error('Add topic error:', error);
      showAlert('주제 추가 중 오류가 발생했습니다.');
    }
  };

  const updateTopic = async (topicId: string, title: string) => {
    try {
      await updateDoc(doc(db, 'gallery', topicId), { title });
      showAlert('주제가 저장되었습니다.');
    } catch (error) {
      console.error('Update topic error:', error);
      showAlert('주제 저장 중 오류가 발생했습니다.');
    }
  };

  const deleteTopic = async (topicId: string) => {
    showConfirm('이 주제와 포함된 모든 사진을 삭제하시겠습니까?', async () => {
      try {
        // 서브컬렉션의 모든 사진 삭제
        const photosSnapshot = await getDocs(collection(db, 'gallery', topicId, 'photos'));
        const batch = writeBatch(db);
        photosSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        // 주제 삭제
        batch.delete(doc(db, 'gallery', topicId));
        await batch.commit();
        showAlert('주제가 삭제되었습니다.');
      } catch (error) {
        console.error('Delete topic error:', error);
        showAlert('주제 삭제 중 오류가 발생했습니다.');
      }
    });
  };

  const filteredTopics = galleryTopicFilter === 'all' 
    ? galleryTopics 
    : galleryTopics.filter(t => t.id === galleryTopicFilter);

  if (loading) {
    return (
      <motion.div
        key="gallery"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
      >
        <div className="text-center opacity-40 py-12">로딩 중...</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="gallery"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-8">
          <h2 className="text-3xl serif italic whitespace-nowrap">갤러리 관리</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs tracking-widest uppercase opacity-40 font-bold whitespace-nowrap">주제 필터</label>
            <select 
              value={galleryTopicFilter}
              onChange={(e) => setGalleryTopicFilter(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:border-lime outline-none transition-all text-white min-w-[200px]"
            >
              <option value="all" className="bg-forest">전체</option>
              {galleryTopics.map(topic => (
                <option key={topic.id} value={topic.id} className="bg-forest">{topic.title}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={addTopic}
          className="bg-lime text-forest px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
        >
          <Plus size={18} /> 주제 추가하기
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredTopics.map((topic, idx) => {
          const photos = photosByTopic[topic.id] || [];
          const isPhotoListExpanded = expandedPhotoLists.has(topic.id);
          const originalIdx = galleryTopics.findIndex(t => t.id === topic.id);

          return (
            <div key={topic.id} className="flex gap-4 items-start">
              {/* Topic Order Controls */}
              <div className="flex flex-col gap-2 mt-2">
                <button 
                  disabled={originalIdx === 0}
                  onClick={() => moveTopicOrder(topic.id, 'up')}
                  className="p-2 bg-white/10 border border-white/20 rounded-xl hover:bg-lime hover:text-forest disabled:opacity-20 transition-all text-white"
                  title="위로 이동"
                >
                  <ChevronUp size={20} />
                </button>
                <button 
                  disabled={originalIdx === galleryTopics.length - 1}
                  onClick={() => moveTopicOrder(topic.id, 'down')}
                  className="p-2 bg-white/10 border border-white/20 rounded-xl hover:bg-lime hover:text-forest disabled:opacity-20 transition-all text-white"
                  title="아래로 이동"
                >
                  <ChevronDown size={20} />
                </button>
              </div>

              <div className="flex-grow p-8 rounded-[40px] border-2 border-white space-y-6">
                {/* Topic Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-grow w-full">
                    <label className="text-[10px] tracking-widest uppercase opacity-60 block mb-2 ml-2 font-bold text-white">주제 타이틀명</label>
                    <input 
                      type="text"
                      defaultValue={topic.title}
                      onBlur={(e) => updateTopic(topic.id, e.target.value)}
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all text-xl font-bold text-white"
                    />
                  </div>
                  <div className="flex gap-4 items-center">
                    <button 
                      onClick={() => deleteTopic(topic.id)}
                      className="text-white/40 hover:text-red-400 transition-colors p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {/* Bulk Photo Upload Button */}
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => fileInputRefs.current[topic.id]?.click()}
                      disabled={uploadProgress[topic.id]?.total > 0 && uploadProgress[topic.id]?.current < uploadProgress[topic.id]?.total}
                      className="bg-lime/20 text-lime px-4 py-2 rounded-full font-bold hover:bg-lime hover:text-forest transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} />
                      일괄 사진업로드
                    </button>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current[topic.id] = el;
                      }}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleBulkPhotoUpload(topic.id, e.target.files!)}
                      className="hidden"
                    />
                  </div>
                  
                  {uploadProgress[topic.id]?.total > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="opacity-60">업로드 진행 중...</span>
                        <span className="font-bold text-lime">{uploadProgress[topic.id]?.current} / {uploadProgress[topic.id]?.total}</span>
                      </div>
                      <div className="w-full bg-white/10 border border-white/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-lime h-full transition-all duration-300 ease-out"
                          style={{
                            width: `${(uploadProgress[topic.id]?.current / uploadProgress[topic.id]?.total) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Photo Form */}
                <div className="p-6 rounded-[30px] border-2 border-white/20 bg-white/5 space-y-4">
                  <h4 className="font-bold text-sm">사진 추가</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <input 
                        type="text"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        placeholder="이미지 URL"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 flex-grow focus:border-lime outline-none transition-all text-sm"
                      />
                      <button 
                        onClick={() => addPhoto(topic.id)}
                        className="bg-lime/20 text-lime px-4 py-2 rounded-full font-bold hover:bg-lime hover:text-forest transition-all text-sm whitespace-nowrap"
                      >
                        <Download size={16} className="inline mr-2" />
                        업로드
                      </button>
                    </div>
                    <textarea 
                      value={newPhotoCaption}
                      onChange={(e) => setNewPhotoCaption(e.target.value)}
                      placeholder="사진 설명"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm min-h-[60px] resize-none"
                    />
                  </div>
                </div>

                {/* Photos List Header with Toggle */}
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">사진 목록 ({photos.length})</h4>
                  {photos.length > 0 && (
                    <button 
                      onClick={() => togglePhotoList(topic.id)}
                      className="bg-lime/20 text-lime px-4 py-2 rounded-full font-bold hover:bg-lime hover:text-forest transition-all text-sm"
                    >
                      {isPhotoListExpanded ? '접기' : '펼치기'}
                    </button>
                  )}
                </div>

                {/* Photos List */}
                {isPhotoListExpanded && (
                  <div className="space-y-2">
                    {photos.length > 0 ? (
                      photos.map((photo, photoIdx) => (
                        <div key={photo.id} className="flex gap-3 items-start p-3 rounded-[20px] border border-white/20 bg-white/5 hover:bg-white/10 transition-all">
                          {/* Photo Order Controls */}
                          <div className="flex flex-col gap-1 mt-1 flex-shrink-0">
                            <button 
                              disabled={photoIdx === 0}
                              onClick={() => movePhotoOrder(topic.id, photo.id, 'up')}
                              className="p-1 bg-white/10 border border-white/20 rounded-lg hover:bg-lime hover:text-forest disabled:opacity-20 transition-all text-white"
                              title="위로 이동"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button 
                              disabled={photoIdx === photos.length - 1}
                              onClick={() => movePhotoOrder(topic.id, photo.id, 'down')}
                              className="p-1 bg-white/10 border border-white/20 rounded-lg hover:bg-lime hover:text-forest disabled:opacity-20 transition-all text-white"
                              title="아래로 이동"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          {/* Photo URL */}
                          <div className="flex-grow min-w-0">
                            <div className="flex gap-2 items-center mb-2">
                              <ImageIcon size={16} className="text-white/40 flex-shrink-0" />
                              <input 
                                type="text"
                                value={photo.url}
                                readOnly
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 flex-grow text-xs opacity-60 truncate"
                              />
                              <button 
                                onClick={() => deletePhoto(topic.id, photo.id)}
                                className="text-white/40 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                                title="삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            {/* Caption Input */}
                            <textarea 
                              value={pendingCaptions[photo.id] || photo.caption || ''}
                              onChange={(e) => setPendingCaptions({ ...pendingCaptions, [photo.id]: e.target.value })}
                              onBlur={(e) => {
                                if (e.target.value !== (photo.caption || '')) {
                                  updatePhotoCaption(topic.id, photo.id, e.target.value);
                                }
                              }}
                              placeholder="사진 설명"
                              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 w-full focus:border-lime outline-none transition-all text-xs min-h-[50px] resize-none"
                            />
                          </div>

                          {/* Photo Preview */}
                          <div className="flex-shrink-0">
                            <img 
                              src={photo.url} 
                              alt={photo.caption || '사진'} 
                              className="w-24 h-24 object-cover rounded-lg border border-white/20"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"%3E%3Crect fill="%23333" width="96" height="96"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23666" font-size="12"%3EError%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs opacity-40 text-center py-4">사진이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Topic Button */}
      <div className="flex justify-center">
        <button 
          onClick={addTopic}
          className="text-lime/60 hover:text-lime px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all border border-lime/20 hover:border-lime"
        >
          <Plus size={18} /> 주제 추가
        </button>
      </div>
    </motion.div>
  );
}
