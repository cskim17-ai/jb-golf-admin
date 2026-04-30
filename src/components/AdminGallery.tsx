import { Plus, Trash2, Upload, ImageIcon, Download, GripVertical, X, Loader2 } from 'lucide-react';
import { useRef } from 'react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useState, useEffect } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';

interface GalleryPhoto {
  id: string;
  url: string;
  thumb_url?: string;
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
  const [selectedPhotos, setSelectedPhotos] = useState<{ [key: string]: Set<string> }>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { current: number; total: number } }>({});
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Firebase 갤러리 데이터 로드 - 서브컬렉션 구조
  useEffect(() => {
    const loadGalleryData = () => {
      try {
        // Only set loading true if it's the very first time
        const unsubscribe = onSnapshot(collection(db, 'gallery'), async (topicsSnapshot) => {
          if (topicsSnapshot.empty) {
            setGalleryTopics([]);
            setPhotosByTopic({});
            setLoading(false);
            return;
          }
          const topics: GalleryTopic[] = [];
          const topicsData: { [key: string]: GalleryPhoto[] } = {};

          try {
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
                  thumb_url: photoDoc.data().thumb_url || '',
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
          } catch (error) {
            console.error('Snapshot processing error:', error);
            setLoading(false);
          }
        }, (error) => {
          console.error('onSnapshot gallery error:', error);
          showAlert('갤러리 데이터를 실시간으로 불러오는데 실패했습니다.');
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

  const handleTopicsReorder = async (newTopics: GalleryTopic[]) => {
    setGalleryTopics(newTopics);
    
    try {
      const batch = writeBatch(db);
      newTopics.forEach((topic, idx) => {
        batch.update(doc(db, 'gallery', topic.id), { order: idx });
      });
      await batch.commit();
    } catch (error) {
      console.error('Topics reorder error:', error);
      showAlert('주제 순서 변경 중 오류가 발생했습니다.');
    }
  };

  const handlePhotosReorder = async (topicId: string, newPhotos: GalleryPhoto[]) => {
    const newPhotosByTopic = { ...photosByTopic, [topicId]: newPhotos };
    setPhotosByTopic(newPhotosByTopic);

    try {
      const batch = writeBatch(db);
      newPhotos.forEach((photo, idx) => {
        batch.update(doc(db, 'gallery', topicId, 'photos', photo.id), { order: idx });
      });
      await batch.commit();
    } catch (error) {
      console.error('Photos reorder error:', error);
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

  const updatePhotoOrderManually = async (topicId: string, photoId: string, newOrderStr: string) => {
    const newOrder = parseInt(newOrderStr);
    if (isNaN(newOrder)) return;

    const photos = [...(photosByTopic[topicId] || [])];
    const photoIdx = photos.findIndex(p => p.id === photoId);
    if (photoIdx === -1) return;

    const photoToMove = photos.splice(photoIdx, 1)[0];
    
    // UI order (1-based) to index (0-based)
    // Clamp target index between 0 and photos.length
    const targetIdx = Math.max(0, Math.min(newOrder - 1, photos.length));
    
    photos.splice(targetIdx, 0, photoToMove);
    
    // Re-assign order numbers
    const updatedPhotos = photos.map((p, idx) => ({ ...p, order: idx }));
    
    // Update local state
    setPhotosByTopic(prev => ({ ...prev, [topicId]: updatedPhotos }));

    try {
      const batch = writeBatch(db);
      updatedPhotos.forEach((p) => {
        batch.update(doc(db, 'gallery', topicId, 'photos', p.id), { order: p.order });
      });
      await batch.commit();
      showAlert('사진 순서가 저장되었습니다.');
    } catch (error) {
      console.error('Manual reorder error:', error);
      showAlert('순서 변경 중 오류가 발생했습니다.');
    }
  };

  const addPhoto = async (topicId: string, file?: File) => {
    if (!file && !newPhotoUrl.trim()) {
      showAlert('이미지 URL을 입력하거나 파일을 선택해주세요.');
      return;
    }

    setUploadProgress(prev => ({ ...prev, [topicId]: { current: 0, total: 1 } }));

    try {
      const photos = photosByTopic[topicId] || [];
      let url = newPhotoUrl;
      let thumb_url = '';
      let fileName = file ? file.name : (newPhotoUrl.split('/').pop() || `photo_${Date.now()}`);
      
      if (file) {
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `gallery/${uniqueFileName}`);
        const snapshot = await uploadBytes(storageRef, file);
        url = await getDownloadURL(snapshot.ref);
      }

      const isThumb = fileName.startsWith('thumb_');
      const baseName = isThumb ? fileName.substring(6) : fileName;
      const photoId = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const maxOrder = Math.max(...photos.map(p => p.order || 0), -1);
      
      const photoDocRef = doc(db, 'gallery', topicId, 'photos', photoId);
      const photoDocSnap = await getDocs(collection(db, 'gallery', topicId, 'photos'));
      const existingPhoto = photoDocSnap.docs.find(d => d.id === photoId);

      if (existingPhoto) {
        await updateDoc(photoDocRef, {
          [isThumb ? 'thumb_url' : 'url']: url,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(photoDocRef, {
          url: isThumb ? '' : url,
          thumb_url: isThumb ? url : '',
          caption: newPhotoCaption,
          order: maxOrder + 1,
          createdAt: serverTimestamp()
        });
      }

      showAlert('사진 정보가 업데이트되었습니다.');
      setNewPhotoUrl('');
      setNewPhotoCaption('');
    } catch (error: any) {
      console.error('Add photo error:', error);
      if (error.code === 'storage/unauthorized') {
        showAlert('사진 업로드 권한이 없습니다. Firebase Console에서 Storage 보안 규칙을 확인하거나, 구글 로그인을 시도해 주세요.');
      } else {
        showAlert('사진 추가 중 오류가 발생했습니다.');
      }
    } finally {
      setUploadProgress(prev => ({ ...prev, [topicId]: { current: 0, total: 0 } }));
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
        
        // Clear selection if deleted
        if (selectedPhotos[topicId]?.has(photoId)) {
          const newSelected = new Set(selectedPhotos[topicId]);
          newSelected.delete(photoId);
          setSelectedPhotos({ ...selectedPhotos, [topicId]: newSelected });
        }
      } catch (error) {
        console.error('Delete photo error:', error);
        showAlert('사진 삭제 중 오류가 발생했습니다.');
      }
    });
  };

  const toggleSelectPhoto = (topicId: string, photoId: string) => {
    const topicSelected = new Set(selectedPhotos[topicId] || []);
    if (topicSelected.has(photoId)) {
      topicSelected.delete(photoId);
    } else {
      topicSelected.add(photoId);
    }
    setSelectedPhotos({ ...selectedPhotos, [topicId]: topicSelected });
  };

  const toggleSelectAll = (topicId: string, photos: GalleryPhoto[]) => {
    const topicSelected = selectedPhotos[topicId] || new Set();
    if (topicSelected.size === photos.length) {
      setSelectedPhotos({ ...selectedPhotos, [topicId]: new Set() });
    } else {
      setSelectedPhotos({ ...selectedPhotos, [topicId]: new Set(photos.map(p => p.id)) });
    }
  };

  const deleteSelectedPhotos = async (topicId: string) => {
    const topicSelected = selectedPhotos[topicId];
    if (!topicSelected || topicSelected.size === 0) return;

    showConfirm(`${topicSelected.size}개의 사진을 삭제하시겠습니까?`, async () => {
      try {
        const batch = writeBatch(db);
        topicSelected.forEach(photoId => {
          batch.delete(doc(db, 'gallery', topicId, 'photos', photoId));
        });
        await batch.commit();
        
        showAlert(`${topicSelected.size}개의 사진이 삭제되었습니다.`);
        setSelectedPhotos({ ...selectedPhotos, [topicId]: new Set() });
      } catch (error) {
        console.error('Bulk delete error:', error);
        showAlert('사진 일괄 삭제 중 오류가 발생했습니다.');
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
      const maxOrderStart = Math.max(...photos.map(p => p.order || 0), -1);
      
      // 업로드 진행 상태 초기화
      setUploadProgress({ ...uploadProgress, [topicId]: { current: 0, total: files.length } });

      // 파일을 베이스 파일명으로 그룹화
      const fileGroups: { [key: string]: { original?: File; thumb?: File } } = {};
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const isThumb = fileName.startsWith('thumb_');
        const baseName = isThumb ? fileName.substring(6) : fileName;
        
        if (!fileGroups[baseName]) fileGroups[baseName] = {};
        if (isThumb) {
          fileGroups[baseName].thumb = file;
        } else {
          fileGroups[baseName].original = file;
        }
      }

      const baseNames = Object.keys(fileGroups);
      let processedFilesCount = 0;
      let currentMaxOrder = maxOrderStart;

      for (let i = 0; i < baseNames.length; i++) {
        const baseName = baseNames[i];
        const group = fileGroups[baseName];
        const photoId = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        let url = '';
        let thumb_url = '';

        // 기존 문서가 있으면 데이터 가져오기
        const existingPhoto = photos.find(p => p.id === photoId);
        if (existingPhoto) {
          url = existingPhoto.url;
          thumb_url = existingPhoto.thumb_url || '';
        }

        if (group.original) {
          const fileName = `${Date.now()}_${group.original.name}`;
          const storageRef = ref(storage, `gallery/${fileName}`);
          const snapshot = await uploadBytes(storageRef, group.original);
          url = await getDownloadURL(snapshot.ref);
          processedFilesCount++;
        }

        if (group.thumb) {
          const fileName = `${Date.now()}_${group.thumb.name}`;
          const storageRef = ref(storage, `gallery/${fileName}`);
          const snapshot = await uploadBytes(storageRef, group.thumb);
          thumb_url = await getDownloadURL(snapshot.ref);
          processedFilesCount++;
        }
        
        setUploadProgress(prev => ({ ...prev, [topicId]: { current: processedFilesCount, total: files.length } }));

        if (existingPhoto) {
          await updateDoc(doc(db, 'gallery', topicId, 'photos', photoId), {
            url: url,
            thumb_url: thumb_url,
            updatedAt: serverTimestamp()
          });
        } else {
          currentMaxOrder++;
          await setDoc(doc(db, 'gallery', topicId, 'photos', photoId), {
            url: url,
            thumb_url: thumb_url,
            caption: '',
            order: currentMaxOrder,
            createdAt: serverTimestamp()
          });
        }

        // 과부하 방지
        if (i < baseNames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      showAlert(`${baseNames.length} 그룹의 사진 정보가 업로드되고 업데이트되었습니다.`);
      if (fileInputRefs.current[topicId]) {
        fileInputRefs.current[topicId]!.value = '';
      }
      setUploadProgress(prev => ({ ...prev, [topicId]: { current: 0, total: 0 } }));
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      if (error.code === 'storage/unauthorized') {
        showAlert('사진 업로드 권한이 없습니다. Firebase Console에서 Storage 보안 규칙을 확인하거나, 구글 로그인을 시도해 주세요.');
      } else {
        showAlert('사진 업로드 중 오류가 발생했습니다.');
      }
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
              <option value="all" className="bg-forest">
                전체 ({Object.values(photosByTopic).reduce((acc: number, curr: GalleryPhoto[]) => acc + (curr?.length || 0), 0)})
              </option>
              {galleryTopics.map(topic => (
                <option key={topic.id} value={topic.id} className="bg-forest">
                  {topic.title} ({photosByTopic[topic.id]?.length || 0})
                </option>
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

      <Reorder.Group 
        axis="y" 
        values={filteredTopics} 
        onReorder={handleTopicsReorder}
        className="grid grid-cols-1 gap-6"
      >
        {filteredTopics.map((topic) => {
          const photos = photosByTopic[topic.id] || [];
          const isPhotoListExpanded = expandedPhotoLists.has(topic.id);

          return (
            <Reorder.Item 
              key={topic.id} 
              value={topic}
              className="flex gap-4 items-start"
            >
              {/* Topic Drag Handle */}
              <div className="flex flex-col gap-2 mt-4 cursor-grab active:cursor-grabbing p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-lime/20 hover:text-lime transition-all text-white/40">
                <GripVertical size={24} />
              </div>

              <div className="flex-grow p-8 rounded-[40px] border-2 border-white space-y-6 bg-forest/50">
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
                  <h4 className="font-bold text-sm text-white/80">사진 추가</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <input 
                        type="text"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        placeholder="이미지 URL"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 flex-grow focus:border-lime outline-none transition-all text-sm text-white"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) addPhoto(topic.id, file);
                        }}
                        className="hidden"
                        id={`single-upload-${topic.id}`}
                      />
                      <button 
                        onClick={() => document.getElementById(`single-upload-${topic.id}`)?.click()}
                        disabled={uploadProgress[topic.id]?.total > 0}
                        className="bg-white/10 text-white px-4 py-2 rounded-full font-bold hover:bg-white/20 transition-all text-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                      >
                        {uploadProgress[topic.id]?.total > 0 ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        선택 업로드
                      </button>
                      <button 
                        onClick={() => addPhoto(topic.id)}
                        className="bg-lime/20 text-lime px-4 py-2 rounded-full font-bold hover:bg-lime hover:text-forest transition-all text-sm whitespace-nowrap"
                      >
                        <Download size={16} className="inline mr-2" />
                        URL로 추가
                      </button>
                    </div>
                    <textarea 
                      value={newPhotoCaption}
                      onChange={(e) => setNewPhotoCaption(e.target.value)}
                      placeholder="사진 설명"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm min-h-[60px] resize-none text-white"
                    />
                  </div>
                </div>

                {/* Photos List Header with Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h4 className="font-bold text-sm text-white/80">사진 목록 ({photos.length})</h4>
                    {photos.length > 0 && (
                      <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedPhotos[topic.id]?.size === photos.length ? 'bg-lime border-lime' : 'border-white/30 group-hover:border-white/50'}`}>
                            {selectedPhotos[topic.id]?.size === photos.length && <div className="w-2 h-2 bg-forest rounded-sm" />}
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={selectedPhotos[topic.id]?.size === photos.length && photos.length > 0}
                            onChange={() => toggleSelectAll(topic.id, photos)}
                          />
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest group-hover:opacity-60">전체선택</span>
                        </label>
                        
                        {(selectedPhotos[topic.id]?.size || 0) > 0 && (
                          <button 
                            onClick={() => deleteSelectedPhotos(topic.id)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-400/10 text-red-400 hover:bg-red-400 hover:text-white transition-all text-[10px] font-bold"
                          >
                            <Trash2 size={12} />
                            {selectedPhotos[topic.id]?.size}개 삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
                  <Reorder.Group 
                    axis="y" 
                    values={photos} 
                    onReorder={(newPhotos) => handlePhotosReorder(topic.id, newPhotos)}
                    className="space-y-2"
                  >
                    {photos.length > 0 ? (
                      photos.map((photo) => (
                        <Reorder.Item 
                          key={photo.id} 
                          value={photo}
                          className={`flex gap-3 items-start p-3 rounded-[20px] border transition-all cursor-default ${selectedPhotos[topic.id]?.has(photo.id) ? 'border-lime/50 bg-lime/5' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}
                        >
                          {/* Selection & Drag Handle */}
                          <div className="flex flex-col gap-3 mt-2 items-center flex-shrink-0">
                            <label className="cursor-pointer group">
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${selectedPhotos[topic.id]?.has(photo.id) ? 'bg-lime border-lime shadow-[0_0_10px_rgba(163,230,53,0.3)]' : 'border-white/20 group-hover:border-white/40'}`}>
                                {selectedPhotos[topic.id]?.has(photo.id) && <div className="w-2.5 h-2.5 bg-forest rounded-sm" />}
                              </div>
                              <input 
                                type="checkbox"
                                className="hidden"
                                checked={selectedPhotos[topic.id]?.has(photo.id)}
                                onChange={() => toggleSelectPhoto(topic.id, photo.id)}
                              />
                            </label>
                            <div className="cursor-grab active:cursor-grabbing p-1.5 text-white/20 hover:text-white/60 transition-colors">
                              <GripVertical size={20} />
                            </div>
                          </div>

                          {/* Photo URL */}
                          <div className="flex-grow min-w-0">
                            <div className="flex gap-2 items-center mb-2">
                              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                                <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">ORDER</span>
                                <input 
                                  key={`order-${photo.id}-${photo.order}`}
                                  type="number"
                                  defaultValue={(photo.order || 0) + 1}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== String((photo.order || 0) + 1)) {
                                      updatePhotoOrderManually(topic.id, photo.id, val);
                                    }
                                  }}
                                  className="bg-white/10 border border-white/20 rounded px-1 w-10 text-center text-[11px] focus:border-lime outline-none text-lime font-bold h-5"
                                />
                              </div>
                              <ImageIcon size={16} className="text-white/40 flex-shrink-0" />
                              <input 
                                type="text"
                                value={photo.url}
                                readOnly
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 flex-grow text-[10px] opacity-60 truncate text-white"
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
                              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 w-full focus:border-lime outline-none transition-all text-xs min-h-[50px] resize-none text-white"
                            />
                          </div>

                          {/* Photo Preview */}
                          <div className="flex-shrink-0 cursor-pointer group/img" onClick={() => setPreviewImage(photo.url || photo.thumb_url || '')}>
                            <img 
                              src={photo.thumb_url || photo.url} 
                              alt={photo.caption || '사진'} 
                              className="w-24 h-24 object-cover rounded-lg border border-white/20 group-hover/img:border-lime group-hover/img:scale-[1.02] transition-all"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"%3E%3Crect fill="%23333" width="96" height="96"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23666" font-size="12"%3EError%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>
                        </Reorder.Item>
                      ))
                    ) : (
                      <p className="text-xs opacity-40 text-center py-4">사진이 없습니다.</p>
                    )}
                  </Reorder.Group>
                )}
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {/* Add Topic Button */}
      <div className="flex justify-center">
        <button 
          onClick={addTopic}
          className="text-lime/60 hover:text-lime px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all border border-lime/20 hover:border-lime"
        >
          <Plus size={18} /> 주제 추가
        </button>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-forest/95 backdrop-blur-xl p-4 md:p-12 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
              <img 
                src={previewImage} 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(163,230,53,0.1)] border-2 border-white/10"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
