import { Plus, Trash2, GripVertical } from 'lucide-react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';

interface VideoItem {
  id: string;
  url: string;
  title: string;
  description: string;
  order?: number;
}

interface VideoTopic {
  id: string;
  title: string;
  order: number;
}

interface AdminVideoGalleryProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

export default function AdminVideoGallery({ showAlert, showConfirm }: AdminVideoGalleryProps) {
  const [videoTopics, setVideoTopics] = useState<VideoTopic[]>([]);
  const [videosByTopic, setVideosByTopic] = useState<{ [key: string]: VideoItem[] }>({});
  const [videoTopicFilter, setVideoTopicFilter] = useState('all');
  const [newVideo, setNewVideo] = useState({ url: '', title: '', description: '' });
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedVideoLists, setExpandedVideoLists] = useState<Set<string>>(new Set());
  const [selectedVideos, setSelectedVideos] = useState<{ [key: string]: Set<string> }>({});
  const [loading, setLoading] = useState(true);

  // 주제 목록 로드 및 각 주제의 동영상 로드
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'videoGallery'), async (snapshot) => {
      const topics: VideoTopic[] = [];
      const topicsData: { [key: string]: VideoItem[] } = {};

      // 각 주제 문서에 대해 서브컬렉션의 동영상 로드
      for (const topicDoc of snapshot.docs) {
        const data = topicDoc.data();
        topics.push({
          id: topicDoc.id,
          title: data.title || '새 주제',
          order: data.order || 0
        });

        // 서브컬렉션에서 동영상 로드
        try {
          const videosSnapshot = await getDocs(collection(db, 'videoGallery', topicDoc.id, 'videos'));
          const videos: VideoItem[] = videosSnapshot.docs.map(videoDoc => ({
            id: videoDoc.id,
            url: videoDoc.data().url || '',
            title: videoDoc.data().title || '',
            description: videoDoc.data().description || '',
            order: videoDoc.data().order || 0
          })).sort((a, b) => (a.order || 0) - (b.order || 0));
          
          topicsData[topicDoc.id] = videos;
        } catch (error) {
          console.error('Error loading videos for topic:', topicDoc.id, error);
          topicsData[topicDoc.id] = [];
        }
      }

      setVideoTopics(topics.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setVideosByTopic(topicsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const toggleVideoList = (topicId: string) => {
    const newExpanded = new Set(expandedVideoLists);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedVideoLists(newExpanded);
  };

  const handleTopicsReorder = async (newTopics: VideoTopic[]) => {
    setVideoTopics(newTopics);
    
    try {
      const batch = writeBatch(db);
      newTopics.forEach((topic, idx) => {
        batch.update(doc(db, 'videoGallery', topic.id), { order: idx });
      });
      await batch.commit();
    } catch (error) {
      console.error('Topics reorder error:', error);
      showAlert('주제 순서 변경 중 오류가 발생했습니다.');
    }
  };

  const handleVideosReorder = async (topicId: string, newVideos: VideoItem[]) => {
    const newVideosByTopic = { ...videosByTopic, [topicId]: newVideos };
    setVideosByTopic(newVideosByTopic);

    try {
      const batch = writeBatch(db);
      newVideos.forEach((video, idx) => {
        batch.update(doc(db, 'videoGallery', topicId, 'videos', video.id), { order: idx });
      });
      await batch.commit();
    } catch (error) {
      console.error('Videos reorder error:', error);
      showAlert('동영상 순서 변경 중 오류가 발생했습니다.');
    }
  };

  const updateVideoOrderManually = async (topicId: string, videoId: string, newOrderStr: string) => {
    const newOrder = parseInt(newOrderStr);
    if (isNaN(newOrder)) return;

    const videos = [...(videosByTopic[topicId] || [])];
    const videoIdx = videos.findIndex(v => v.id === videoId);
    if (videoIdx === -1) return;

    const videoToMove = videos.splice(videoIdx, 1)[0];
    const targetIdx = Math.max(0, Math.min(newOrder - 1, videos.length));
    
    videos.splice(targetIdx, 0, videoToMove);
    
    const updatedVideos = videos.map((v, idx) => ({ ...v, order: idx }));
    setVideosByTopic(prev => ({ ...prev, [topicId]: updatedVideos }));

    try {
      const batch = writeBatch(db);
      updatedVideos.forEach((v) => {
        batch.update(doc(db, 'videoGallery', topicId, 'videos', v.id), { order: v.order });
      });
      await batch.commit();
      showAlert('동영상 순서가 저장되었습니다.');
    } catch (error) {
      console.error('Manual reorder error:', error);
      showAlert('순서 변경 중 오류가 발생했습니다.');
    }
  };

  const addVideo = async (topicId: string) => {
    if (!newVideo.url.trim() || !newVideo.title.trim()) {
      showAlert('URL과 제목을 입력해주세요.');
      return;
    }

    try {
      const videos = videosByTopic[topicId] || [];
      const videoId = `video_${Date.now()}`;
      const maxOrder = Math.max(...videos.map(v => v.order || 0), -1);
      
      await setDoc(doc(db, 'videoGallery', topicId, 'videos', videoId), {
        url: newVideo.url,
        title: newVideo.title,
        description: newVideo.description,
        order: maxOrder + 1,
        createdAt: serverTimestamp()
      });
      showAlert('동영상이 추가되었습니다.');
      setNewVideo({ url: '', title: '', description: '' });
    } catch (error) {
      console.error('Add video error:', error);
      showAlert('동영상 추가 중 오류가 발생했습니다.');
    }
  };

  const deleteVideo = async (topicId: string, videoId: string) => {
    showConfirm('이 동영상을 삭제하시겠습니까?', async () => {
      try {
        await deleteDoc(doc(db, 'videoGallery', topicId, 'videos', videoId));
        showAlert('동영상이 삭제되었습니다.');

        // Clear selection if deleted
        if (selectedVideos[topicId]?.has(videoId)) {
          const newSelected = new Set(selectedVideos[topicId]);
          newSelected.delete(videoId);
          setSelectedVideos({ ...selectedVideos, [topicId]: newSelected });
        }
      } catch (error) {
        console.error('Delete video error:', error);
        showAlert('동영상 삭제 중 오류가 발생했습니다.');
      }
    });
  };

  const toggleSelectVideo = (topicId: string, videoId: string) => {
    const topicSelected = new Set(selectedVideos[topicId] || []);
    if (topicSelected.has(videoId)) {
      topicSelected.delete(videoId);
    } else {
      topicSelected.add(videoId);
    }
    setSelectedVideos({ ...selectedVideos, [topicId]: topicSelected });
  };

  const toggleSelectAll = (topicId: string, videos: VideoItem[]) => {
    const topicSelected = selectedVideos[topicId] || new Set();
    if (topicSelected.size === videos.length) {
      setSelectedVideos({ ...selectedVideos, [topicId]: new Set() });
    } else {
      setSelectedVideos({ ...selectedVideos, [topicId]: new Set(videos.map(v => v.id)) });
    }
  };

  const deleteSelectedVideos = async (topicId: string) => {
    const topicSelected = selectedVideos[topicId];
    if (!topicSelected || topicSelected.size === 0) return;

    showConfirm(`${topicSelected.size}개의 동영상을 삭제하시겠습니까?`, async () => {
      try {
        const batch = writeBatch(db);
        topicSelected.forEach(videoId => {
          batch.delete(doc(db, 'videoGallery', topicId, 'videos', videoId));
        });
        await batch.commit();
        
        showAlert(`${topicSelected.size}개의 동영상이 삭제되었습니다.`);
        setSelectedVideos({ ...selectedVideos, [topicId]: new Set() });
      } catch (error) {
        console.error('Bulk delete error:', error);
        showAlert('동영상 일괄 삭제 중 오류가 발생했습니다.');
      }
    });
  };

  const addTopic = async () => {
    try {
      const topicId = `vtopic_${Date.now()}`;
      await setDoc(doc(db, 'videoGallery', topicId), {
        title: '새 주제',
        order: videoTopics.length,
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
      await updateDoc(doc(db, 'videoGallery', topicId), { title });
      showAlert('주제가 저장되었습니다.');
    } catch (error) {
      console.error('Update topic error:', error);
      showAlert('주제 저장 중 오류가 발생했습니다.');
    }
  };

  const deleteTopic = async (topicId: string) => {
    showConfirm('이 주제와 포함된 모든 동영상을 삭제하시겠습니까?', async () => {
      try {
        // 서브컬렉션의 모든 동영상 삭제
        const videosSnapshot = await getDocs(collection(db, 'videoGallery', topicId, 'videos'));
        const batch = writeBatch(db);
        videosSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        // 주제 삭제
        batch.delete(doc(db, 'videoGallery', topicId));
        await batch.commit();
        showAlert('주제가 삭제되었습니다.');
      } catch (error) {
        console.error('Delete topic error:', error);
        showAlert('주제 삭제 중 오류가 발생했습니다.');
      }
    });
  };

  const filteredTopics = videoTopicFilter === 'all' 
    ? videoTopics 
    : videoTopics.filter(t => t.id === videoTopicFilter);

  if (loading) {
    return (
      <motion.div
        key="videoGallery"
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
      key="videoGallery"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-8">
          <h2 className="text-3xl serif italic whitespace-nowrap">동영상 관리</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs tracking-widest uppercase opacity-40 font-bold whitespace-nowrap">주제 필터</label>
            <select 
              value={videoTopicFilter}
              onChange={(e) => setVideoTopicFilter(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:border-lime outline-none transition-all text-white min-w-[200px]"
            >
              <option value="all" className="bg-forest">
                전체 ({Object.values(videosByTopic).reduce((acc, curr) => acc + curr.length, 0)})
              </option>
              {videoTopics.map(topic => (
                <option key={topic.id} value={topic.id} className="bg-forest">
                  {topic.title} ({videosByTopic[topic.id]?.length || 0})
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
          const videos = videosByTopic[topic.id] || [];
          const isVideoListExpanded = expandedVideoLists.has(topic.id);

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

                {/* Add Video Form */}
                <div className="p-6 rounded-[30px] border-2 border-white/20 bg-white/5 space-y-4">
                  <h4 className="font-bold text-sm text-white/80">동영상 추가</h4>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      value={newVideo.url}
                      onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })}
                      placeholder="유튜브 URL"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm text-white"
                    />
                    <input 
                      type="text"
                      value={newVideo.title}
                      onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                      placeholder="제목"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm text-white"
                    />
                    <textarea 
                      value={newVideo.description}
                      onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                      placeholder="설명"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm min-h-[60px] resize-none text-white"
                    />
                    <button 
                      onClick={() => addVideo(topic.id)}
                      className="bg-lime/20 text-lime px-4 py-2 rounded-full font-bold hover:bg-lime hover:text-forest transition-all text-sm w-full"
                    >
                      <Plus size={16} className="inline mr-2" />
                      동영상 추가
                    </button>
                  </div>
                </div>

                {/* Videos List Header with Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h4 className="font-bold text-sm text-white/80">동영상 목록 ({videos.length})</h4>
                    {videos.length > 0 && (
                      <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedVideos[topic.id]?.size === videos.length ? 'bg-lime border-lime' : 'border-white/30 group-hover:border-white/50'}`}>
                            {selectedVideos[topic.id]?.size === videos.length && <div className="w-2 h-2 bg-forest rounded-sm" />}
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={selectedVideos[topic.id]?.size === videos.length && videos.length > 0}
                            onChange={() => toggleSelectAll(topic.id, videos)}
                          />
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest group-hover:opacity-60">전체선택</span>
                        </label>
                        
                        {(selectedVideos[topic.id]?.size || 0) > 0 && (
                          <button 
                            onClick={() => deleteSelectedVideos(topic.id)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-400/10 text-red-400 hover:bg-red-400 hover:text-white transition-all text-[10px] font-bold"
                          >
                            <Trash2 size={12} />
                            {selectedVideos[topic.id]?.size}개 삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {videos.length > 0 && (
                    <button 
                      onClick={() => toggleVideoList(topic.id)}
                      className="bg-lime/20 text-lime px-4 py-2 rounded-full font-bold hover:bg-lime hover:text-forest transition-all text-sm"
                    >
                      {isVideoListExpanded ? '접기' : '펼치기'}
                    </button>
                  )}
                </div>

                {/* Videos List */}
                {isVideoListExpanded && (
                  <Reorder.Group 
                    axis="y" 
                    values={videos} 
                    onReorder={(newVideos) => handleVideosReorder(topic.id, newVideos)}
                    className="space-y-2"
                  >
                    {videos.length > 0 ? (
                      videos.map((video) => (
                        <Reorder.Item 
                          key={video.id} 
                          value={video}
                          className={`flex gap-3 items-start p-3 rounded-[20px] border transition-all cursor-default ${selectedVideos[topic.id]?.has(video.id) ? 'border-lime/50 bg-lime/5' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}
                        >
                          {/* Selection & Drag Handle */}
                          <div className="flex flex-col gap-3 mt-2 items-center flex-shrink-0">
                            <label className="cursor-pointer group">
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${selectedVideos[topic.id]?.has(video.id) ? 'bg-lime border-lime shadow-[0_0_10px_rgba(163,230,53,0.3)]' : 'border-white/20 group-hover:border-white/40'}`}>
                                {selectedVideos[topic.id]?.has(video.id) && <div className="w-2.5 h-2.5 bg-forest rounded-sm" />}
                              </div>
                              <input 
                                type="checkbox"
                                className="hidden"
                                checked={selectedVideos[topic.id]?.has(video.id)}
                                onChange={() => toggleSelectVideo(topic.id, video.id)}
                              />
                            </label>
                            <div className="cursor-grab active:cursor-grabbing p-1.5 text-white/20 hover:text-white/60 transition-colors">
                              <GripVertical size={20} />
                            </div>
                          </div>

                          {/* Video Info */}
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                                <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">ORDER</span>
                                <input 
                                  key={`vorder-${video.id}-${video.order}`}
                                  type="number"
                                  defaultValue={(video.order || 0) + 1}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== String((video.order || 0) + 1)) {
                                      updateVideoOrderManually(topic.id, video.id, val);
                                    }
                                  }}
                                  className="bg-white/10 border border-white/20 rounded px-1 w-10 text-center text-[11px] focus:border-lime outline-none text-lime font-bold h-5"
                                />
                              </div>
                              <p className="font-bold text-sm truncate text-white">{video.title}</p>
                            </div>
                            <p className="text-xs opacity-60 truncate text-white">{video.url}</p>
                            {video.description && <p className="text-xs opacity-40 truncate mt-1 text-white">{video.description}</p>}
                          </div>

                          {/* Delete Button */}
                          <button 
                            onClick={() => deleteVideo(topic.id, video.id)}
                            className="p-1 text-white/40 hover:text-red-400 transition-colors flex-shrink-0"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Reorder.Item>
                      ))
                    ) : (
                      <p className="text-xs opacity-40 text-center py-4">동영상이 없습니다.</p>
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
    </motion.div>
  );
}
