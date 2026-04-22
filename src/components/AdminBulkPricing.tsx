import { motion } from 'framer-motion';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { collection, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
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

interface AdminBulkPricingProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

interface BulkUpdateData {
  item: string;
  division: string;
  morningChange: number;
  afternoonChange: number;
  changeType: 'add' | 'subtract' | 'percentage' | 'set';
}

export default function AdminBulkPricing({ showAlert, showConfirm }: AdminBulkPricingProps) {
  const [pricingData, setPricingData] = useState<CoursePricing[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [bulkUpdateData, setBulkUpdateData] = useState<BulkUpdateData>({
    item: '',
    division: '',
    morningChange: 0,
    afternoonChange: 0,
    changeType: 'add'
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

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

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCourses.length === pricingData.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(pricingData.map(c => c.id));
    }
  };

  const generatePreview = () => {
    const preview = selectedCourses.map(courseId => {
      const course = pricingData.find(c => c.id === courseId);
      if (!course) return null;

      const updatedRows = course.rows.map(row => {
        if (row.item === bulkUpdateData.item && row.division === bulkUpdateData.division) {
          let newMorning = row.morning as number;
          let newAfternoon = row.afternoon as number;

          if (bulkUpdateData.changeType === 'add') {
            newMorning = (row.morning as number) + bulkUpdateData.morningChange;
            newAfternoon = (row.afternoon as number) + bulkUpdateData.afternoonChange;
          } else if (bulkUpdateData.changeType === 'subtract') {
            newMorning = (row.morning as number) - bulkUpdateData.morningChange;
            newAfternoon = (row.afternoon as number) - bulkUpdateData.afternoonChange;
          } else if (bulkUpdateData.changeType === 'percentage') {
            newMorning = Math.round((row.morning as number) * (1 + bulkUpdateData.morningChange / 100));
            newAfternoon = Math.round((row.afternoon as number) * (1 + bulkUpdateData.afternoonChange / 100));
          } else if (bulkUpdateData.changeType === 'set') {
            newMorning = bulkUpdateData.morningChange;
            newAfternoon = bulkUpdateData.afternoonChange;
          }

          return {
            ...row,
            morning: newMorning,
            afternoon: newAfternoon,
            isUpdated: true
          };
        }
        return row;
      });

      return {
        id: courseId,
        courseName: course.courseName,
        rows: updatedRows
      };
    }).filter(Boolean);

    setPreviewData(preview);
  };

  const handleApplyBulkUpdate = () => {
    if (selectedCourses.length === 0) {
      showAlert('수정할 골프장을 선택해주세요.');
      return;
    }

    if (!bulkUpdateData.item || !bulkUpdateData.division) {
      showAlert('항목과 구분을 선택해주세요.');
      return;
    }

    showConfirm(
      `${selectedCourses.length}개 골프장의 가격을 수정하시겠습니까?\n\n항목: ${bulkUpdateData.item} (${bulkUpdateData.division})\n변경 방식: ${
        bulkUpdateData.changeType === 'add' ? '더하기' :
        bulkUpdateData.changeType === 'subtract' ? '빼기' :
        bulkUpdateData.changeType === 'percentage' ? '퍼센트' : '설정'
      }`,
      async () => {
        setIsSaving(true);
        try {
          const batch = writeBatch(db);

          selectedCourses.forEach(courseId => {
            const course = pricingData.find(c => c.id === courseId);
            if (!course) return;

            const updatedRows = course.rows.map(row => {
              if (row.item === bulkUpdateData.item && row.division === bulkUpdateData.division) {
                let newMorning = row.morning as number;
                let newAfternoon = row.afternoon as number;

                if (bulkUpdateData.changeType === 'add') {
                  newMorning = (row.morning as number) + bulkUpdateData.morningChange;
                  newAfternoon = (row.afternoon as number) + bulkUpdateData.afternoonChange;
                } else if (bulkUpdateData.changeType === 'subtract') {
                  newMorning = (row.morning as number) - bulkUpdateData.morningChange;
                  newAfternoon = (row.afternoon as number) - bulkUpdateData.afternoonChange;
                } else if (bulkUpdateData.changeType === 'percentage') {
                  newMorning = Math.round((row.morning as number) * (1 + bulkUpdateData.morningChange / 100));
                  newAfternoon = Math.round((row.afternoon as number) * (1 + bulkUpdateData.afternoonChange / 100));
                } else if (bulkUpdateData.changeType === 'set') {
                  newMorning = bulkUpdateData.morningChange;
                  newAfternoon = bulkUpdateData.afternoonChange;
                }

                return {
                  ...row,
                  morning: newMorning,
                  afternoon: newAfternoon
                };
              }
              return row;
            });

            batch.update(doc(db, 'pricing', courseId), { rows: updatedRows });
          });

          await batch.commit();
          showAlert(`${selectedCourses.length}개 골프장의 가격이 수정되었습니다.`);
          setSelectedCourses([]);
          setBulkUpdateData({
            item: '',
            division: '',
            morningChange: 0,
            afternoonChange: 0,
            changeType: 'add'
          });
          setPreviewData([]);
        } catch (error) {
          console.error("Bulk update error:", error);
          showAlert('일괄 수정에 실패했습니다.');
        } finally {
          setIsSaving(false);
        }
      }
    );
  };

  // 고유한 항목과 구분 추출
  const uniqueItems = Array.from(new Set(
    pricingData.flatMap(c => c.rows.map(r => r.item))
  )).filter(Boolean);

  const uniqueDivisions = Array.from(new Set(
    pricingData.flatMap(c => c.rows.map(r => r.division))
  )).filter(Boolean);

  if (loading) {
    return (
      <motion.div
        key="bulk-pricing"
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
      key="bulk-pricing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">일괄 가격 수정</h2>
      </div>

      {/* Bulk Update Settings */}
      <div className="glass p-12 rounded-[40px] border border-white/10 space-y-8">
        <h3 className="text-xl serif mb-6">수정 설정</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">항목 선택</label>
            <select 
              value={bulkUpdateData.item}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, item: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-forest">항목을 선택하세요</option>
              {uniqueItems.map(item => (
                <option key={item} value={item} className="bg-forest">{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">구분 선택</label>
            <select 
              value={bulkUpdateData.division}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, division: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-forest">구분을 선택하세요</option>
              {uniqueDivisions.map(division => (
                <option key={division} value={division} className="bg-forest">{division}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">변경 방식</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 'add', label: '더하기' },
              { value: 'subtract', label: '빼기' },
              { value: 'percentage', label: '퍼센트' },
              { value: 'set', label: '설정' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setBulkUpdateData({ ...bulkUpdateData, changeType: option.value as any })}
                className={`py-2 px-4 rounded-lg font-bold transition-all ${
                  bulkUpdateData.changeType === option.value
                    ? 'bg-lime text-forest'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">
              오전 {bulkUpdateData.changeType === 'percentage' ? '(%):' : '(RM):'}
            </label>
            <input 
              type="number"
              value={bulkUpdateData.morningChange}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, morningChange: parseFloat(e.target.value) || 0 })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">
              오후 {bulkUpdateData.changeType === 'percentage' ? '(%):' : '(RM):'}
            </label>
            <input 
              type="number"
              value={bulkUpdateData.afternoonChange}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, afternoonChange: parseFloat(e.target.value) || 0 })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full focus:border-lime outline-none transition-all"
              placeholder="0"
            />
          </div>
        </div>

        <button 
          onClick={generatePreview}
          className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-3 rounded-full font-bold transition-all"
        >
          미리보기
        </button>
      </div>

      {/* Course Selection */}
      <div className="glass p-12 rounded-[40px] border border-white/10 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl serif">골프장 선택</h3>
          <button 
            onClick={handleSelectAll}
            className="text-lime hover:text-lime/80 transition-colors text-sm font-bold"
          >
            {selectedCourses.length === pricingData.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pricingData.map(course => (
            <div
              key={course.id}
              onClick={() => handleSelectCourse(course.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedCourses.includes(course.id)
                  ? 'bg-lime/20 border-lime'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox"
                  checked={selectedCourses.includes(course.id)}
                  onChange={() => {}}
                  className="w-5 h-5 accent-lime cursor-pointer"
                />
                <div>
                  <div className="font-bold">{course.courseName}</div>
                  <div className="text-xs opacity-60">{course.id}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-sm opacity-60 ml-2">
          {selectedCourses.length}개 골프장 선택됨
        </div>
      </div>

      {/* Preview */}
      {previewData.length > 0 && (
        <div className="glass p-12 rounded-[40px] border border-white/10 space-y-6">
          <h3 className="text-xl serif">수정 미리보기</h3>

          <div className="space-y-6">
            {previewData.map(preview => (
              <div key={preview.id} className="border border-white/10 rounded-lg p-6">
                <h4 className="font-bold mb-4">{preview.courseName}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40">
                        <th className="py-2 px-3">항목</th>
                        <th className="py-2 px-3">구분</th>
                        <th className="py-2 px-3 text-center">오전 (RM)</th>
                        <th className="py-2 px-3 text-center">오후 (RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row: any, idx: number) => (
                        row.isUpdated && (
                          <tr key={idx} className="border-b border-white/5 bg-lime/10">
                            <td className="py-2 px-3">{row.item}</td>
                            <td className="py-2 px-3">{row.division}</td>
                            <td className="py-2 px-3 text-center text-lime font-bold">{row.morning}</td>
                            <td className="py-2 px-3 text-center text-lime font-bold">{row.afternoon}</td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button 
          onClick={handleApplyBulkUpdate}
          disabled={isSaving || selectedCourses.length === 0}
          className="flex-grow bg-lime text-forest py-4 rounded-2xl font-bold hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {isSaving ? '적용 중...' : '일괄 수정 적용'}
        </button>
        <button 
          onClick={() => {
            setSelectedCourses([]);
            setBulkUpdateData({
              item: '',
              division: '',
              morningChange: 0,
              afternoonChange: 0,
              changeType: 'add'
            });
            setPreviewData([]);
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-4 rounded-2xl transition-all"
        >
          <X size={20} />
        </button>
      </div>
    </motion.div>
  );
}
