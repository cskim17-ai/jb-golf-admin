import { motion, AnimatePresence } from 'framer-motion';
import { Download, Search, Trash2, Edit2 } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

interface NFCTag {
  id: string;
  nfc_id: string;
  authorized_mac: string;
  pc_name: string;
  status: 'active' | 'inactive' | 'maintenance';
  last_login: string;
  po_number: string;
  department: string;
  assigned_user: string;
  updated_at: string;
}

interface AdminNFCTagsProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

export default function AdminNFCTags({ showAlert, showConfirm }: AdminNFCTagsProps) {
  const [nfcTagsData, setNFCTagsData] = useState<NFCTag[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('전체');
  const [selectedTag, setSelectedTag] = useState<NFCTag | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState({
    nfc_id: '',
    authorized_mac: '',
    pc_name: '',
    status: 'active' as const,
    last_login: '',
    po_number: '',
    department: '',
    assigned_user: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'config_desks'), (snapshot) => {
      const tags: NFCTag[] = [];
      snapshot.forEach((doc) => {
        tags.push({ id: doc.id, ...doc.data() } as NFCTag);
      });
      setNFCTagsData(tags.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
    });
    return () => unsubscribe();
  }, []);

  const filteredTags = useMemo(() => {
    return nfcTagsData.filter(tag => {
      const searchMatch = 
        tag.nfc_id.toLowerCase().includes(filterSearch.toLowerCase()) ||
        tag.pc_name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        tag.authorized_mac.toLowerCase().includes(filterSearch.toLowerCase()) ||
        tag.assigned_user.toLowerCase().includes(filterSearch.toLowerCase());
      const statusMatch = filterStatus === '전체' || tag.status === filterStatus;
      return searchMatch && statusMatch;
    });
  }, [nfcTagsData, filterSearch, filterStatus]);

  const getMACAddress = async () => {
    try {
      // 현재 PC의 로컬 네트워크 정보를 가져오기 위해 WebRTC 사용
      const pc = new (window as any).RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then((offer: any) => pc.setLocalDescription(offer)).catch(() => {});

      let macFound = false;
      pc.onicecandidate = (ice: any) => {
        if (!ice || !ice.candidate || macFound) return;
        
        const candidate = ice.candidate.candidate;
        // srflx 타입의 후보에서 IP 주소 추출
        const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
        const ipMatch = ipRegex.exec(candidate);
        
        if (ipMatch) {
          const localIP = ipMatch[1];
          // 로컬 IP를 기반으로 MAC 주소 형식 생성 (실제 MAC은 브라우저에서 보안상 접근 불가)
          // 사용자에게 안내 메시지 표시
          showAlert('브라우저 보안상 MAC 주소를 자동으로 가져올 수 없습니다.\n\nWindows: 명령 프롬프트에서 "ipconfig /all" 실행\nMac: 시스템 설정 > 네트워크\nLinux: "ifconfig" 또는 "ip addr" 명령 실행\n\n로컬 IP: ' + localIP);
          macFound = true;
        }
      };

      setTimeout(() => {
        pc.close();
        if (!macFound) {
          showAlert('MAC 주소를 가져올 수 없습니다. 수동으로 입력해주세요.');
        }
      }, 2000);
    } catch (error) {
      showAlert('MAC 주소를 가져올 수 없습니다. 수동으로 입력해주세요.');
    }
  };

  const handleAddTag = async () => {
    if (!newTag.nfc_id || !newTag.authorized_mac || !newTag.pc_name) {
      showAlert('필수 항목을 모두 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'config_desks'), {
        ...newTag,
        updated_at: new Date().toISOString()
      });
      setNewTag({
        nfc_id: '',
        authorized_mac: '',
        pc_name: '',
        status: 'active',
        last_login: '',
        po_number: '',
        department: '',
        assigned_user: ''
      });
      setIsAddingTag(false);
      showAlert('NFC 태그가 추가되었습니다.');
    } catch (error) {
      showAlert('NFC 태그 추가에 실패했습니다.');
    }
  };

  const handleDeleteTag = (tag: NFCTag) => {
    showConfirm(`"${tag.pc_name}" 태그를 삭제하시겠습니까?`, async () => {
      try {
        await deleteDoc(doc(db, 'config_desks', tag.id));
        showAlert('NFC 태그가 삭제되었습니다.');
      } catch (error) {
        showAlert('NFC 태그 삭제에 실패했습니다.');
      }
    });
  };

  const exportToExcel = () => {
    const data = filteredTags.map((tag, index) => ({
      '순번': index + 1,
      'NFC ID': tag.nfc_id,
      '인증된 PC MAC 주소': tag.authorized_mac,
      'PC 관리명': tag.pc_name,
      '상태': tag.status,
      '마지막 접속': tag.last_login,
      'PO 번호': tag.po_number,
      '부서': tag.department,
      '담당자': tag.assigned_user,
      '최종 수정 시간': tag.updated_at
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NFC Tags');
    XLSX.writeFile(wb, `NFC태그_${new Date().toISOString().split('T')[0]}.xlsx`);
    showAlert('엑셀 파일이 다운로드되었습니다.');
  };

  return (
    <motion.div
      key="nfcTags"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">NFC 태그 관리</h2>
        <button 
          onClick={exportToExcel}
          className="bg-lime text-forest px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
        >
          <Download size={18} /> 엑셀 내보내기
        </button>
      </div>

      {/* 필터 및 검색 */}
      <div className="glass rounded-[40px] border border-white/10 p-8 space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs tracking-widest uppercase opacity-40 block mb-3">검색</label>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="text"
                placeholder="NFC ID, PC명, MAC 주소, 담당자 검색..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-lime/50 focus:bg-white/10 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-xs tracking-widest uppercase opacity-40 block mb-3">상태</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-lime/50 focus:bg-white/10 transition-all"
            >
              <option>전체</option>
              <option>active</option>
              <option>inactive</option>
              <option>maintenance</option>
            </select>
          </div>
        </div>

        {/* 추가 버튼 */}
        <button
          onClick={() => setIsAddingTag(!isAddingTag)}
          className="bg-lime text-forest px-6 py-2 rounded-full font-bold text-sm hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
        >
          {isAddingTag ? '취소' : '+ NFC 태그 추가'}
        </button>

        {/* 추가 폼 */}
        {isAddingTag && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-4 border-t border-white/10"
          >
            <div className="flex gap-2 mb-4">
              <button
                onClick={getMACAddress}
                className="bg-blue-500/30 text-blue-200 hover:bg-blue-500/50 border border-blue-500/50 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
              >
                MAC주소 가져오기
              </button>
              <p className="text-xs opacity-60 flex items-center">현재 PC의 로컬 IP를 확인합니다</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="NFC ID"
                value={newTag.nfc_id}
                onChange={(e) => setNewTag({ ...newTag, nfc_id: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <input
                type="text"
                placeholder="인증된 PC MAC 주소"
                value={newTag.authorized_mac}
                onChange={(e) => setNewTag({ ...newTag, authorized_mac: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <input
                type="text"
                placeholder="PC 관리명"
                value={newTag.pc_name}
                onChange={(e) => setNewTag({ ...newTag, pc_name: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <select
                value={newTag.status}
                onChange={(e) => setNewTag({ ...newTag, status: e.target.value as any })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="maintenance">maintenance</option>
              </select>
              <input
                type="text"
                placeholder="마지막 접속"
                value={newTag.last_login}
                onChange={(e) => setNewTag({ ...newTag, last_login: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <input
                type="text"
                placeholder="PO 번호"
                value={newTag.po_number}
                onChange={(e) => setNewTag({ ...newTag, po_number: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <input
                type="text"
                placeholder="부서"
                value={newTag.department}
                onChange={(e) => setNewTag({ ...newTag, department: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <input
                type="text"
                placeholder="담당자"
                value={newTag.assigned_user}
                onChange={(e) => setNewTag({ ...newTag, assigned_user: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
            </div>
            <button
              onClick={handleAddTag}
              className="w-full bg-lime text-forest px-4 py-2 rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
            >
              저장
            </button>
          </motion.div>
        )}
      </div>

      {/* 테이블 */}
      <div className="glass rounded-[40px] border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40">
                <th className="p-4 font-medium w-12">순번</th>
                <th className="p-4 font-medium">NFC ID</th>
                <th className="p-4 font-medium">인증된 PC MAC</th>
                <th className="p-4 font-medium">PC 관리명</th>
                <th className="p-4 font-medium w-20">상태</th>
                <th className="p-4 font-medium">마지막 접속</th>
                <th className="p-4 font-medium">PO 번호</th>
                <th className="p-4 font-medium">부서</th>
                <th className="p-4 font-medium">담당자</th>
                <th className="p-4 font-medium w-20">작업</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {filteredTags.map((tag, index) => (
                <tr 
                  key={tag.id}
                  onClick={() => setSelectedTag(tag)}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="p-4 opacity-40">{index + 1}</td>
                  <td className="p-4 font-medium truncate max-w-xs">{tag.nfc_id}</td>
                  <td className="p-4 opacity-60 truncate max-w-xs">{tag.authorized_mac}</td>
                  <td className="p-4 font-medium">{tag.pc_name}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      tag.status === 'active' ? 'bg-lime text-forest' :
                      tag.status === 'inactive' ? 'bg-white/20 text-white' :
                      'bg-yellow-500/30 text-yellow-200'
                    }`}>
                      {tag.status}
                    </span>
                  </td>
                  <td className="p-4 opacity-60">{tag.last_login}</td>
                  <td className="p-4 opacity-60">{tag.po_number}</td>
                  <td className="p-4 opacity-60">{tag.department}</td>
                  <td className="p-4 opacity-60">{tag.assigned_user}</td>
                  <td className="p-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTag(tag);
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTags.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-20 text-center opacity-40 serif italic">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 팝업 */}
      <AnimatePresence>
        {selectedTag && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedTag(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass rounded-[40px] border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-3xl serif italic mb-8">NFC 태그 상세</h2>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">NFC ID</label>
                    <p className="text-lg font-bold">{selectedTag.nfc_id}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">PC 관리명</label>
                    <p className="text-lg">{selectedTag.pc_name}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">인증된 PC MAC</label>
                    <p className="text-sm opacity-80 break-all">{selectedTag.authorized_mac}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">상태</label>
                    <p className="text-lg">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        selectedTag.status === 'active' ? 'bg-lime text-forest' :
                        selectedTag.status === 'inactive' ? 'bg-white/20 text-white' :
                        'bg-yellow-500/30 text-yellow-200'
                      }`}>
                        {selectedTag.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">마지막 접속</label>
                    <p className="text-base opacity-80">{selectedTag.last_login}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">PO 번호</label>
                    <p className="text-base opacity-80">{selectedTag.po_number}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">부서</label>
                    <p className="text-base opacity-80">{selectedTag.department}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">담당자</label>
                    <p className="text-base opacity-80">{selectedTag.assigned_user}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">최종 수정 시간</label>
                  <p className="text-sm opacity-60">{selectedTag.updated_at}</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-4">
                <button
                  onClick={() => setSelectedTag(null)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-full transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
