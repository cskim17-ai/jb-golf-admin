import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { setDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';

interface AdminLabProps {
  showAlert: (message: string) => void;
  showConfirm?: (message: string, callback: () => void) => void;
}

export default function AdminLab({ showAlert }: AdminLabProps) {
  const [labProductCode, setLabProductCode] = useState('');
  const [labOutputUrl, setLabOutputUrl] = useState('');
  const [labQrResult, setLabQrResult] = useState('');
  const [labTransferResult, setLabTransferResult] = useState('');
  const [activeNfcIds, setActiveNfcIds] = useState<string[]>([]);
  const [selectedNfcId, setSelectedNfcId] = useState('');
  const [nfcTaggingUrl, setNfcTaggingUrl] = useState('');

  // config_desks에서 status가 'active'인 nfc_id 조회
  useEffect(() => {
    const fetchActiveNfcIds = async () => {
      try {
        const q = query(collection(db, 'config_desks'), where('status', '==', 'active'));
        const querySnapshot = await getDocs(q);
        const nfcIds = querySnapshot.docs.map(doc => doc.data().nfc_id).filter(Boolean);
        setActiveNfcIds(nfcIds);
        if (nfcIds.length > 0) {
          setSelectedNfcId(nfcIds[0]);
        }
      } catch (error) {
        console.error('Error fetching active NFC IDs:', error);
      }
    };
    fetchActiveNfcIds();
  }, []);

  // selectedNfcId 변경 시 NFC 태깅 URL 업데이트
  useEffect(() => {
    if (selectedNfcId) {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/scrch-view.html?desk_id=${selectedNfcId}`;
      setNfcTaggingUrl(url);
    }
  }, [selectedNfcId]);

  const handleSearch = () => {
    if (labProductCode) {
      setLabOutputUrl(`https://kiosk.kyobobook.co.kr/bookInfoInk?site=001&barcode=${labProductCode}&ejkGb=KOR`);
      setLabQrResult('');
      setLabTransferResult('');
    } else {
      showAlert('상품코드를 입력해주세요.');
    }
  };

  const handleQrTransfer = () => {
    if (labOutputUrl) {
      setLabQrResult('QR 전송이 완료되었습니다.');
    } else {
      showAlert('먼저 조회를 실행해주세요.');
    }
  };

  const handleScreenTransfer = async () => {
    if (!labOutputUrl) {
      showAlert('먼저 조회를 실행해주세요.');
      return;
    }
    if (!selectedNfcId) {
      showAlert('NFC ID를 선택해주세요.');
      return;
    }
    
    try {
      // active_sessions에 nfc_id를 문서 ID로 사용하여 생성/업데이트
      await setDoc(doc(db, 'active_sessions', selectedNfcId), {
        desk_id: selectedNfcId,
        content: `<iframe src="${labOutputUrl}" style="width:100%; height:100%; border:none;"></iframe>`,
        url: labOutputUrl,
        updatedAt: new Date().toISOString()
      });
      
      const transferMessage = `화면 전송이 완료되었습니다!\n\n전송 정보:\n- URL: ${labOutputUrl}\n- NFC ID: ${selectedNfcId}\n- 전송시간: ${new Date().toLocaleTimeString()}`;
      showAlert(transferMessage);
    } catch (error) {
      console.error("Screen transfer error:", error);
      showAlert('화면 전송 중 오류가 발생했습니다.');
    }
  };

  const handleNfcTransfer = async () => {
    if (!labOutputUrl) {
      showAlert('먼저 조회를 실행해주세요.');
      return;
    }
    if (!selectedNfcId) {
      showAlert('NFC ID를 선택해주세요.');
      return;
    }
    
    try {
      // active_sessions에 nfc_id를 문서 ID로 사용하여 생성/업데이트
      await setDoc(doc(db, 'active_sessions', selectedNfcId), {
        desk_id: selectedNfcId,
        content: `<iframe src="${labOutputUrl}" style="width:100%; height:100%; border:none;"></iframe>`,
        url: labOutputUrl,
        updatedAt: new Date().toISOString()
      });
      
      const nfcMessage = `NFC 전송이 성공적으로 완료되었습니다!\n\n전송 정보:\n- URL: ${labOutputUrl}\n- NFC ID: ${selectedNfcId}\n- 전송시간: ${new Date().toLocaleTimeString()}`;
      setLabTransferResult('NFC 전송이 성공적으로 완료되었습니다!');
      showAlert(nfcMessage);
    } catch (error) {
      console.error("NFC transfer error:", error);
      setLabTransferResult('NFC 전송 실패: ' + (error as Error).message);
      showAlert('NFC 전송 중 오류가 발생했습니다.');
    }
  };

  return (
    <motion.div
      key="lab"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">실험실</h2>
      </div>

      <div className="glass p-8 rounded-[40px] border border-white/10 space-y-8">
        {/* Row 1: Input and Buttons */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <label className="text-lg font-bold whitespace-nowrap min-w-[120px]">상품코드 입력</label>
          <input 
            type="text"
            value={labProductCode}
            onChange={(e) => setLabProductCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-grow focus:border-lime outline-none transition-all"
            placeholder="상품코드를 입력하세요"
          />
          <div className="flex gap-2 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button 
              onClick={handleSearch}
              className="bg-lime text-forest px-6 py-3 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all flex-1 md:flex-none"
            >
              조회
            </button>
            <button 
              onClick={handleQrTransfer}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold border border-white/20 transition-all flex-1 md:flex-none"
            >
              URL QR전송
            </button>
            <button 
              onClick={handleScreenTransfer}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold border border-white/20 transition-all flex-1 md:flex-none"
            >
              화면 전송
            </button>
            <button 
              onClick={handleNfcTransfer}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold border border-white/20 transition-all flex-1 md:flex-none"
            >
              NFC
            </button>
          </div>
        </div>

        {/* NFC ID 선택 드롭다운 */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <label className="text-lg font-bold whitespace-nowrap min-w-[120px]">NFC ID 선택</label>
          <select
            value={selectedNfcId}
            onChange={(e) => setSelectedNfcId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-grow focus:border-lime outline-none transition-all text-white"
          >
            <option value="">-- NFC ID를 선택하세요 --</option>
            {activeNfcIds.map((nfcId) => (
              <option key={nfcId} value={nfcId}>
                {nfcId}
              </option>
            ))}
          </select>
          <span className="text-xs opacity-60 whitespace-nowrap">
            {activeNfcIds.length > 0 ? `(${activeNfcIds.length}개 활성)` : '활성 NFC ID 없음'}
          </span>
        </div>

        {/* Row 2: Output URL */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <label className="text-lg font-bold whitespace-nowrap min-w-[120px]">출력 URL</label>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-grow w-full min-h-[50px] break-all text-white/60 text-sm">
            {labOutputUrl || '조회 후 URL이 표시됩니다'}
          </div>
        </div>

        {/* NFC 태깅 URL */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <label className="text-lg font-bold whitespace-nowrap min-w-[120px]">NFC 태깅 URL</label>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-grow w-full min-h-[50px] break-all text-white/60 text-sm">
            {nfcTaggingUrl || 'NFC ID를 선택하면 URL이 표시됩니다'}
          </div>
        </div>

        {/* Row 3: Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* URL Result */}
          <div className="space-y-4">
            <h3 className="text-center text-lg font-bold">URL 설정결과</h3>
            <div className="border border-white/20 rounded-xl overflow-hidden bg-white aspect-[3/4] relative">
              {labOutputUrl ? (
                <iframe 
                  src={labOutputUrl} 
                  className="w-full h-full border-0"
                  title="URL Result"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-black/40">
                  결과가 여기에 표시됩니다
                </div>
              )}
            </div>
          </div>

          {/* QR Result */}
          <div className="space-y-4">
            <h3 className="text-center text-lg font-bold">QR전송 설정결과</h3>
            <div className="border border-white/20 rounded-xl overflow-hidden bg-white aspect-[3/4] relative p-4 flex flex-col items-center justify-center">
              {labQrResult ? (
                <div className="text-center">
                  <div className="w-48 h-48 bg-black/5 rounded-xl mb-4 flex items-center justify-center mx-auto">
                    {labOutputUrl && (
                      <QRCodeSVG value={labOutputUrl} size={160} level="H" />
                    )}
                  </div>
                  <p className="text-black font-medium">{labQrResult}</p>
                </div>
              ) : (
                <div className="text-black/40">
                  결과가 여기에 표시됩니다
                </div>
              )}
            </div>
          </div>

          {/* NFC Result */}
          <div className="space-y-4">
            <h3 className="text-center text-lg font-bold">NFC전송 설정결과</h3>
            <div className="border border-white/20 rounded-xl overflow-hidden bg-white aspect-[3/4] relative p-4 flex flex-col items-center justify-center">
              {labTransferResult ? (
                <div className="text-center">
                  <div className="w-24 h-24 bg-lime/20 text-forest rounded-full mb-4 flex items-center justify-center mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                  </div>
                  <p className="text-black font-medium">{labTransferResult}</p>
                </div>
              ) : (
                <div className="text-black/40">
                  결과가 여기에 표시됩니다
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
