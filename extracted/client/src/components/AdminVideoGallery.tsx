import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

  const moveTopicOrder = async (topicId: string, direction: 'up' | 'down') => {
    const idx = videoTopics.findIndex(t => t.id === topicId);
    if (idx === -1 || (direction === 'up' && idx === 0) || (direction === 'down' && idx === videoTopics.length - 1)) return;

    const newTopics = [...videoTopics];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newTopics[idx].order, newTopics[swapIdx].order] = [newTopics[swapIdx].order, newTopics[idx].order];

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'videoGallery', newTopics[idx].id), { order: newTopics[idx].order });
      batch.update(doc(db, 'videoGallery', newTopics[swapIdx].id), { order: newTopics[swapIdx].order });
      await batch.commit();
    } catch (error) {
      console.error('Move topic error:', error);
      showAlert('주제 순서 변경 중 오류가 발생했습니다.');
    }
  };

  const moveVideoOrder = async (topicId: string, videoId: string, direction: 'up' | 'down') => {
    const videos = videosByTopic[topicId] || [];
    const videoIdx = videos.findIndex(v => v.id === videoId);
    if (videoIdx === -1) return;

    if ((direction === 'up' && videoIdx === 0) || (direction === 'down' && videoIdx === videos.length - 1)) {
      return;
    }

    const swapIdx = direction === 'up' ? videoIdx - 1 : videoIdx + 1;
    
    // 배열에서 두 항목을 교환
    const newVideos = [...videos];
    [newVideos[videoIdx], newVideos[swapIdx]] = [newVideos[swapIdx], newVideos[videoIdx]];
    
    // 새로운 order 값 할당 (0부터 시작)
    newVideos.forEach((video, idx) => {
      video.order = idx;
    });

    const newVideosByTopic = { ...videosByTopic };
    newVideosByTopic[topicId] = newVideos;
    setVideosByTopic(newVideosByTopic);

    try {
      const batch = writeBatch(db);
      // 모든 동영상의 새로운 order 값을 업데이트
      newVideos.forEach((video) => {
        batch.update(doc(db, 'videoGallery', topicId, 'videos', video.id), { order: video.order });
      });
      await batch.commit();
      showAlert('동영상 순서가 변경되었습니다.');
    } catch (error) {
      console.error('Move video error:', error);
      showAlert('동영상 순서 변경 중 오류가 발생했습니다.');
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
      } catch (error) {
        console.error('Delete video error:', error);
        showAlert('동영상 삭제 중 오류가 발생했습니다.');
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
              <option value="all" className="bg-forest">전체</option>
              {videoTopics.map(topic => (
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
          const videos = videosByTopic[topic.id] || [];
          const isTopicExpanded = expandedTopics.has(topic.id);
          const isVideoListExpanded = expandedVideoLists.has(topic.id);
          const originalIdx = videoTopics.findIndex(t => t.id === topic.id);

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
                  disabled={originalIdx === videoTopics.length - 1}
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

                {/* Add Video Form */}
                <div className="p-6 rounded-[30px] border-2 border-white/20 bg-white/5 space-y-4">
                  <h4 className="font-bold text-sm">동영상 추가</h4>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      value={newVideo.url}
                      onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })}
                      placeholder="유튜브 URL"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm"
                    />
                    <input 
                      type="text"
                      value={newVideo.title}
                      onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                      placeholder="제목"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm"
                    />
                    <textarea 
                      value={newVideo.description}
                      onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                      placeholder="설명"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all text-sm min-h-[60px] resize-none"
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
                  <h4 className="font-bold text-sm">동영상 목록 ({videos.length})</h4>
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
                  <div className="space-y-2">
                    {videos.length > 0 ? (
                      videos.map((video, videoIdx) => (
                        <div key={video.id} className="flex gap-3 items-start p-3 rounded-[20px] border border-white/20 bg-white/5 hover:bg-white/10 transition-all">
                          {/* Video Order Controls */}
                          <div className="flex flex-col gap-1 mt-1 flex-shrink-0">
                            <button 
                              disabled={videoIdx === 0}
                              onClick={() => moveVideoOrder(topic.id, video.id, 'up')}
                              className="p-1 bg-white/10 border border-white/20 rounded-lg hover:bg-lime hover:text-forest disabled:opacity-20 transition-all text-white"
                              title="위로 이동"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button 
                              disabled={videoIdx === videos.length - 1}
                              onClick={() => moveVideoOrder(topic.id, video.id, 'down')}
                              className="p-1 bg-white/10 border border-white/20 rounded-lg hover:bg-lime hover:text-forest disabled:opacity-20 transition-all text-white"
                              title="아래로 이동"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          {/* Video Info */}
                          <div className="flex-grow min-w-0">
                            <p className="font-bold text-sm truncate">{video.title}</p>
                            <p className="text-xs opacity-60 truncate">{video.url}</p>
                            {video.description && <p className="text-xs opacity-40 truncate mt-1">{video.description}</p>}
                          </div>

                          {/* Delete Button */}
                          <button 
                            onClick={() => deleteVideo(topic.id, video.id)}
                            className="p-1 text-white/40 hover:text-red-400 transition-colors flex-shrink-0"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs opacity-40 text-center py-4">동영상이 없습니다.</p>
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
