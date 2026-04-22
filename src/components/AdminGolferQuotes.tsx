import { motion, AnimatePresence } from 'framer-motion';
import { Download, Search } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

interface GolferQuote {
  id: string;
  name: string;
  nationality: string;
  birthYear: string;
  gender: string;
  photoUrl: string;
  quote: string;
  source: string;
  stats: string;
}

interface AdminGolferQuotesProps {
  showAlert: (message: string) => void;
}

export default function AdminGolferQuotes({ showAlert }: AdminGolferQuotesProps) {
  const [golferQuotesData, setGolferQuotesData] = useState<GolferQuote[]>([]);
  const [golferFilterName, setGolferFilterName] = useState('');
  const [golferFilterNationality, setGolferFilterNationality] = useState('전체');
  const [golferFilterGender, setGolferFilterGender] = useState('전체');
  const [selectedQuote, setSelectedQuote] = useState<GolferQuote | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'golferQuotes'), (snapshot) => {
      const quotes: GolferQuote[] = [];
      snapshot.forEach((doc) => {
        quotes.push({ id: doc.id, ...doc.data() } as GolferQuote);
      });
      setGolferQuotesData(quotes);
    });
    return () => unsubscribe();
  }, []);

  const nationalitiesOptions = useMemo(() => {
    const nationalities = new Map<string, number>();
    golferQuotesData.forEach(q => {
      nationalities.set(q.nationality, (nationalities.get(q.nationality) || 0) + 1);
    });
    const options = [{ name: '전체', count: golferQuotesData.length }];
    nationalities.forEach((count, name) => {
      options.push({ name, count });
    });
    return options;
  }, [golferQuotesData]);

  const filteredGolferQuotes = useMemo(() => {
    return golferQuotesData.filter(quote => {
      const nameMatch = quote.name.toLowerCase().includes(golferFilterName.toLowerCase());
      const nationalityMatch = golferFilterNationality === '전체' || quote.nationality === golferFilterNationality;
      const genderMatch = golferFilterGender === '전체' || quote.gender === golferFilterGender;
      return nameMatch && nationalityMatch && genderMatch;
    });
  }, [golferQuotesData, golferFilterName, golferFilterNationality, golferFilterGender]);

  const exportGolferQuotesToExcel = () => {
    const data = filteredGolferQuotes.map((quote, index) => ({
      '순번': index + 1,
      '골퍼명': quote.name,
      '국적': quote.nationality,
      '생년': quote.birthYear,
      '성별': quote.gender,
      '대표사진URL': quote.photoUrl,
      '명언': quote.quote,
      '출처': quote.source,
      '통산성적': quote.stats
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Golfer Quotes');
    XLSX.writeFile(wb, `골퍼명언_${new Date().toISOString().split('T')[0]}.xlsx`);
    showAlert('엑셀 파일이 다운로드되었습니다.');
  };

  return (
    <motion.div
      key="golferQuotes"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">골퍼 명언 모음</h2>
        <button 
          onClick={exportGolferQuotesToExcel}
          className="bg-lime text-forest px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
        >
          <Download size={18} /> 엑셀 내보내기
        </button>
      </div>

      {/* Filters */}
      <div className="glass p-6 rounded-3xl border border-white/10 flex flex-wrap gap-8 items-end">
        {/* Golfer Name Search */}
        <div className="flex-grow min-w-[200px]">
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">골퍼명 (LIKE 검색)</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
            <input 
              type="text"
              value={golferFilterName}
              onChange={(e) => setGolferFilterName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 w-full focus:border-lime outline-none transition-all"
              placeholder="골퍼명 검색..."
            />
          </div>
        </div>

        {/* Nationality Filter */}
        <div className="w-48">
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-2 ml-2 font-bold">국적 선택</label>
          <select 
            value={golferFilterNationality}
            onChange={(e) => setGolferFilterNationality(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full focus:border-lime outline-none transition-all appearance-none cursor-pointer"
          >
            {nationalitiesOptions.map(nat => (
              <option key={nat.name} value={nat.name} className="bg-forest text-white">
                {nat.name === '전체' ? '전체' : `${nat.name}(${nat.count})`}
              </option>
            ))}
          </select>
        </div>

        {/* Gender Filter */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] tracking-widest uppercase opacity-40 block mb-1 ml-2 font-bold">성별 선택</label>
          <div className="flex gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            {['전체', '남', '여'].map((gender) => (
              <label key={gender} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio"
                  name="golferGender"
                  value={gender}
                  checked={golferFilterGender === gender}
                  onChange={(e) => setGolferFilterGender(e.target.value)}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  golferFilterGender === gender ? "border-lime bg-lime/20" : "border-white/20 group-hover:border-white/40"
                }`}>
                  {golferFilterGender === gender && <div className="w-1.5 h-1.5 rounded-full bg-lime" />}
                </div>
                <span className={`text-sm transition-all ${
                  golferFilterGender === gender ? "text-lime font-bold" : "text-white/40 group-hover:text-white/60"
                }`}>{gender}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reset Button */}
        <button 
          onClick={() => {
            setGolferFilterName('');
            setGolferFilterNationality('전체');
            setGolferFilterGender('전체');
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-xl transition-all text-sm opacity-60"
        >
          초기화
        </button>
      </div>

      <div className="glass rounded-[40px] border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="border-b border-white/10 text-[10px] tracking-widest uppercase opacity-40">
                <th className="p-6 font-medium w-16">순번</th>
                <th className="p-6 font-medium w-40">골퍼명</th>
                <th className="p-6 font-medium w-48">국적 / 생년 / 성별</th>
                <th className="p-6 font-medium w-64">대표사진 URL 주소</th>
                <th className="p-6 font-medium">명언 (원문 포함)</th>
                <th className="p-6 font-medium w-48">출처</th>
                <th className="p-6 font-medium w-48">통산 성적</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredGolferQuotes.map((quote, index) => (
                <tr 
                  key={quote.id} 
                  onClick={() => setSelectedQuote(quote)}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <td className="p-6 opacity-40">{index + 1}</td>
                  <td className="p-6 font-medium">{quote.name}</td>
                  <td className="p-6 opacity-60">{quote.nationality} / {quote.birthYear} / {quote.gender}</td>
                  <td className="p-6 opacity-60">
                    <div className="truncate max-w-[400px]" title={quote.photoUrl}>
                      {quote.photoUrl}
                    </div>
                  </td>
                  <td className="p-6 opacity-80 truncate max-w-[800px]" title={quote.quote}>{quote.quote}</td>
                  <td className="p-6 opacity-60 truncate max-w-[400px]" title={quote.source}>{quote.source}</td>
                  <td className="p-6 opacity-60 truncate max-w-[400px]" title={quote.stats}>{quote.stats}</td>
                </tr>
              ))}
              {filteredGolferQuotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-20 text-center opacity-40 serif italic">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Detail Modal */}
      <AnimatePresence>
        {selectedQuote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedQuote(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass rounded-[40px] border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl serif italic mb-4 flex-shrink-0">골퍼 명언 상세</h2>

              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                {/* 골퍼 정보 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">골퍼명</label>
                    <p className="text-lg font-bold">{selectedQuote.name}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">국적</label>
                    <p className="text-base">{selectedQuote.nationality}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">생년</label>
                    <p className="text-base">{selectedQuote.birthYear}</p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">성별</label>
                    <p className="text-base">{selectedQuote.gender}</p>
                  </div>
                </div>

                {/* 명언 */}
                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-2">명언</label>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-sm leading-relaxed italic">\"{ selectedQuote.quote }\"</p>
                  </div>
                </div>

                {/* 출처 */}
                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">출처</label>
                  <p className="text-sm opacity-80">{selectedQuote.source}</p>
                </div>

                {/* 통산 성적 */}
                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">통산 성적</label>
                  <p className="text-sm opacity-80">{selectedQuote.stats}</p>
                </div>

                {/* 사진 URL */}
                <div>
                  <label className="text-xs tracking-widest uppercase opacity-40 block mb-1">사진 URL</label>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-2 break-all text-xs opacity-60">
                    {selectedQuote.photoUrl}
                  </div>
                </div>
              </div>

              {/* 닫기 버튼 */}
              <div className="mt-4 flex justify-end flex-shrink-0">
                <button
                  onClick={() => setSelectedQuote(null)}
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
