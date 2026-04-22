import { motion } from 'framer-motion';
import { Plus, Trash2, ImageIcon, X } from 'lucide-react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';

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
  courseNames?: string;
  courseDesc?: string;
  reservationInfo?: string;
}

interface AdminPricingProps {
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

export default function AdminPricing({ showAlert, showConfirm }: AdminPricingProps) {
  const [pricingData, setPricingData] = useState<CoursePricing[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Firebase pricing 데이터 로드
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'pricing'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as CoursePricing);
      setPricingData(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setLoading(false);
    }, (error) => {
      console.error("Pricing fetch error:", error);
      showAlert('골프장 정보를 불러올 수 없습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showAlert]);

  const currentCourse = selectedCourseId ? pricingData.find(c => c.id === selectedCourseId) : null;

  const updateCourseField = (field: keyof CoursePricing, value: any) => {
    if (!selectedCourseId || !currentCourse) return;
    
    const updatedCourse = { ...currentCourse, [field]: value };
    const newData = pricingData.map(c => c.id === selectedCourseId ? updatedCourse : c);
    setPricingData(newData);
  };

  const handleSaveCourse = async () => {
    if (!selectedCourseId || !currentCourse) return;

    try {
      const { id, ...courseData } = currentCourse;
      await updateDoc(doc(db, 'pricing', selectedCourseId), courseData as any);
      showAlert('골프장 정보가 저장되었습니다.');
    } catch (error) {
      console.error("Save error:", error);
      showAlert('저장에 실패했습니다.');
    }
  };

  const handleDeleteCourse = () => {
    if (!selectedCourseId) return;

    showConfirm('이 골프장 정보를 삭제하시겠습니까?', async () => {
      try {
        await deleteDoc(doc(db, 'pricing', selectedCourseId));
        setSelectedCourseId(null);
        showAlert('골프장 정보가 삭제되었습니다.');
      } catch (error) {
        console.error("Delete error:", error);
        showAlert('삭제에 실패했습니다.');
      }
    });
  };

  const handleAddNewCourse = async () => {
    const newId = prompt('새 골프장 문서 ID (영문)를 입력하세요:');
    if (!newId) return;

    const newCourse: CoursePricing = {
      id: newId,
      courseName: '새 골프장',
      category: '',
      remarks: '',
      adminMemo: '',
      rows: [],
      order: pricingData.length,
      operatingHours: '',
      courseInfo: '',
      caddyInfo: '',
      promotionInfo: '',
      premiumInfo: '',
      photoUrl: '',
      address: '',
      websiteUrl: '',
      courseNames: '',
      courseDesc: '',
      reservationInfo: ''
    };

    try {
      await setDoc(doc(db, 'pricing', newId), newCourse);
      showAlert('새 골프장이 추가되었습니다.');
      setSelectedCourseId(newId);
    } catch (error) {
      console.error("Add error:", error);
      showAlert('추가에 실패했습니다.');
    }
  };

  const addPricingRow = () => {
    if (!currentCourse) return;
    const newRows = [...(currentCourse.rows || []), { item: '', division: '', morning: '', afternoon: '' }];
    updateCourseField('rows', newRows);
  };

  const updatePricingRow = (index: number, field: keyof PricingRow, value: any) => {
    if (!currentCourse) return;
    const rows = [...(currentCourse.rows || [])];
    rows[index] = { ...rows[index], [field]: value };
    updateCourseField('rows', rows);
  };

  const removePricingRow = (index: number) => {
    if (!currentCourse) return;
    const rows = (currentCourse.rows || []).filter((_, i) => i !== index);
    updateCourseField('rows', rows);
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newData = [...pricingData];
    [newData[index], newData[index - 1]] = [newData[index - 1], newData[index]];
    
    // order 필드 업데이트
    const updates = newData.map((course, i) => ({
      ...course,
      order: i
    }));
    
    setPricingData(updates);
    
    // Firebase 업데이트
    try {
      for (const course of updates) {
        await updateDoc(doc(db, 'pricing', course.id), { order: course.order });
      }
      showAlert('순서가 변경되었습니다.');
    } catch (error) {
      console.error("Order update error:", error);
      showAlert('순서 변경에 실패했습니다.');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === pricingData.length - 1) return;
    const newData = [...pricingData];
    [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
    
    // order 필드 업데이트
    const updates = newData.map((course, i) => ({
      ...course,
      order: i
    }));
    
    setPricingData(updates);
    
    // Firebase 업데이트
    try {
      for (const course of updates) {
        await updateDoc(doc(db, 'pricing', course.id), { order: course.order });
      }
      showAlert('순서가 변경되었습니다.');
    } catch (error) {
      console.error("Order update error:", error);
      showAlert('순서 변경에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <motion.div
        key="pricing"
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
      key="pricing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">골프장 정보</h2>
        <button 
          onClick={handleAddNewCourse}
          className="bg-lime text-forest px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
        >
          <Plus size={18} /> 새 골프장 추가
        </button>
      </div>

      {/* Course Selection */}
      <div className="glass p-10 rounded-[40px] border border-white/10">
        <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-3 ml-2">골프장 선택</label>
        <select 
          value={selectedCourseId || ''}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all appearance-none cursor-pointer text-lg"
        >
          <option value="" className="bg-forest">골프장을 선택하세요</option>
          {pricingData.map(course => (
            <option key={course.id} value={course.id} className="bg-forest">
              {course.courseName} ({course.id})
            </option>
          ))}
        </select>
      </div>

      {/* Course Details */}
      {currentCourse && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-12 rounded-[40px] border border-white/10 space-y-8"
        >
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">카테고리</label>
              <select 
                value={currentCourse.category || ''}
                onChange={(e) => updateCourseField('category', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all appearance-none"
              >
                <option value="" className="bg-forest">카테고리 선택</option>
                <option value="프리미엄" className="bg-forest">프리미엄</option>
                <option value="가성비" className="bg-forest">가성비</option>
                <option value="접근성" className="bg-forest">접근성</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">문서 ID (영문)</label>
              <input 
                type="text"
                value={currentCourse.id}
                disabled
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all opacity-60"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장명</label>
              <input 
                type="text"
                value={currentCourse.courseName || ''}
                onChange={(e) => updateCourseField('courseName', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xl serif w-full focus:border-lime outline-none transition-all"
              />
            </div>
          </div>

          {/* 운영 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">운영시간</label>
              <input 
                type="text"
                value={currentCourse.operatingHours || ''}
                onChange={(e) => updateCourseField('operatingHours', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all"
                placeholder="예: 07:00-19:00"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">코스 정보</label>
              <textarea 
                value={currentCourse.courseInfo || ''}
                onChange={(e) => updateCourseField('courseInfo', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all min-h-[80px]"
                placeholder="예: 36홀\nJack Nicklaus Legacy Course\nLGK Classic Course"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">캐디 정보</label>
              <textarea 
                value={currentCourse.caddyInfo || ''}
                onChange={(e) => updateCourseField('caddyInfo', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all min-h-[80px]"
                placeholder="예: 신청중 가능하며, 미리 예약해 주시기 바랍니다."
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">프로모션 정보</label>
              <textarea 
                value={currentCourse.promotionInfo || ''}
                onChange={(e) => updateCourseField('promotionInfo', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all min-h-[80px]"
                placeholder="예: 신청중 가능하며, 미리 예약해 주시기 바랍니다."
              />
            </div>
          </div>

          {/* 상세 정보 */}
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장 설명 (1500자 이내 권장 기준)</label>
            <textarea 
              value={currentCourse.remarks || ''}
              onChange={(e) => updateCourseField('remarks', e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all min-h-[120px]"
              placeholder="01. 예 나라라수스 정보\n레지스 코스 중국의 정보\n중국의 코스 정보\n3도 영은 골프합니다."
            />
          </div>

          {/* 주소 및 웹사이트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장 주소</label>
              <input 
                type="text"
                value={currentCourse.address || ''}
                onChange={(e) => updateCourseField('address', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all"
                placeholder="Jalan Forest City 1, Pulau Satu, 81550 Gelang Patah"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골프장 웹사이트</label>
              <input 
                type="text"
                value={currentCourse.websiteUrl || ''}
                onChange={(e) => updateCourseField('websiteUrl', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all"
                placeholder="https://golfresort.com/"
              />
            </div>
          </div>

          {/* 예약 정보 */}
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">관리자 메모 (비공개)</label>
            <textarea 
              value={currentCourse.adminMemo || ''}
              onChange={(e) => updateCourseField('adminMemo', e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm w-full focus:border-lime outline-none transition-all min-h-[80px] text-lime/80"
              placeholder="관리자만 볼 수 있는 메모를 입력하세요"
            />
          </div>

          {/* 이미지 업로드 */}
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-grow">
              <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">
                골프장 이미지 <span className="text-lime/60 ml-2">(최대 {MAX_FILE_SIZE_MB * 1000}KB)</span>
              </label>
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text"
                  value={currentCourse.photoUrl || ''}
                  onChange={(e) => updateCourseField('photoUrl', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex-grow focus:border-lime outline-none transition-all text-sm"
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
                          updateCourseField('photoUrl', compressed);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button className="bg-white/5 border border-white/10 hover:bg-white/10 px-6 py-2 rounded-xl transition-all text-sm font-bold flex items-center gap-2 whitespace-nowrap">
                    <ImageIcon size={18} />
                    사진 업로드
                  </button>
                </div>
              </div>
            </div>
            {currentCourse.photoUrl && (
              <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-white/10 group flex-shrink-0">
                <img src={currentCourse.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => updateCourseField('photoUrl', '')}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>

          {/* 가격 정보 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40">
                  <th className="py-3 px-4 font-medium">항목</th>
                  <th className="py-3 px-4 font-medium">구분</th>
                  <th className="py-3 px-4 font-medium text-center">오전 (RM)</th>
                  <th className="py-3 px-4 font-medium text-center">오후 (RM)</th>
                  <th className="py-3 px-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(currentCourse.rows || []).map((row, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <input 
                        type="text"
                        value={row.item}
                        onChange={(e) => updatePricingRow(index, 'item', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm w-full focus:border-lime outline-none transition-all"
                        placeholder="그린피"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="text"
                        value={row.division}
                        onChange={(e) => updatePricingRow(index, 'division', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm w-full focus:border-lime outline-none transition-all"
                        placeholder="우중"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="number"
                        value={row.morning}
                        onChange={(e) => updatePricingRow(index, 'morning', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm w-full focus:border-lime outline-none transition-all text-center"
                        placeholder="420"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="number"
                        value={row.afternoon}
                        onChange={(e) => updatePricingRow(index, 'afternoon', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm w-full focus:border-lime outline-none transition-all text-center"
                        placeholder="300"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => removePricingRow(index)}
                        className="text-red-400 hover:bg-red-400/10 p-1 rounded transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <button 
            onClick={addPricingRow}
            className="text-lime hover:text-lime/80 transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <Plus size={16} /> 행 추가
          </button>

          {/* Save/Delete Buttons */}
          <div className="flex gap-4 pt-4">
            <button 
              onClick={handleSaveCourse}
              className="flex-grow bg-lime text-forest py-3 rounded-2xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
            >
              저장하기
            </button>
            <button 
              onClick={handleDeleteCourse}
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 rounded-2xl transition-all text-red-400"
            >
              <Trash2 size={24} />
            </button>
          </div>
        </motion.div>
      )}

      {/* 골프장 리스트 섹션 */}
      <div className="mt-12 space-y-6">
        <h2 className="text-3xl serif italic">등록된 골프장 리스트</h2>
        
        <div className="glass p-6 rounded-[40px] border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/60 font-semibold">순번</th>
                <th className="text-left py-3 px-4 text-white/60 font-semibold">카테고리</th>
                <th className="text-left py-3 px-4 text-white/60 font-semibold">골프장명</th>
                <th className="text-left py-3 px-4 text-white/60 font-semibold">웹사이트</th>
                <th className="text-left py-3 px-4 text-white/60 font-semibold">이미지</th>
                <th className="text-left py-3 px-4 text-white/60 font-semibold">순서 조정</th>
              </tr>
            </thead>
            <tbody>
              {pricingData.map((course, index) => (
                <tr key={course.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4 text-white">{index + 1}</td>
                  <td className="py-4 px-4 text-white">{course.category || '-'}</td>
                  <td className="py-4 px-4 text-white font-medium">{course.courseName}</td>
                  <td className="py-4 px-4">
                    {course.websiteUrl ? (
                      <a 
                        href={course.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-lime hover:underline truncate max-w-xs block"
                      >
                        {course.websiteUrl}
                      </a>
                    ) : (
                      <span className="text-white/40">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {course.photoUrl ? (
                      <img 
                        src={course.photoUrl} 
                        alt={course.courseName}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-white/5 rounded flex items-center justify-center">
                        <ImageIcon size={16} className="text-white/40" />
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 flex gap-2">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1 rounded text-sm transition-all"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === pricingData.length - 1}
                      className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1 rounded text-sm transition-all"
                    >
                      ↓
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
