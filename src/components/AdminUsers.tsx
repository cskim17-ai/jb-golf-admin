import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Search, Mail, Calendar, 
  Clock, Globe, FileText, Download,
  User, RefreshCcw
} from 'lucide-react';
import { collection, onSnapshot, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface UserData {
  id: string;
  displayName?: string;
  email?: string;
  createdAt?: any;
  lastLogin?: any;
  provider?: string;
  quoteCount: number;
}

interface QuoteData {
  userId?: string;
  uid?: string;
}

const safeFormat = (date: any, formatStr: string, fallback: string = '-') => {
  try {
    if (!date) return fallback;
    const d = date?.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
};

export default function AdminUsers({ 
  showAlert, 
  onViewQuotes 
}: { 
  showAlert: (msg: string) => void,
  onViewQuotes?: (uid: string, name?: string) => void
}) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch all quotes to count them in memory (more efficient for smaller to medium datasets)
    const quoteRef = collection(db, 'quotes');
    
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), async (userSnapshot) => {
      try {
        const quoteSnapshot = await getDocs(quoteRef);
        
        // Create a count map for quotes by userId or uid
        const quoteCounts: Record<string, number> = {};
        quoteSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const uid = data.userId || data.uid;
          if (uid) {
            quoteCounts[uid] = (quoteCounts[uid] || 0) + 1;
          }
        });

        const usersList: UserData[] = userSnapshot.docs.map(doc => {
          const data = doc.data();
          const userId = doc.id;
          return {
            id: userId,
            displayName: data.displayName || '이름 없음',
            email: data.email || '-',
            createdAt: data.createdAt,
            lastLogin: data.lastLogin,
            provider: data.provider || data.providerId || 'Email',
            quoteCount: quoteCounts[userId] || 0
          };
        });

        // Sort by createdAt desc by default
        usersList.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });

        setUsers(usersList);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching users or quotes:", error);
        showAlert('회원 정보를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    }, (error) => {
      console.error("Users subscribe error:", error);
      showAlert('회원 정보 구독 오류가 발생했습니다.');
      setLoading(false);
    });

    return () => unsubscribeUsers();
  }, [showAlert]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const lowerQuery = searchQuery.toLowerCase();
    return users.filter(u => 
      u.displayName?.toLowerCase().includes(lowerQuery) || 
      u.email?.toLowerCase().includes(lowerQuery)
    );
  }, [users, searchQuery]);

  const exportToExcel = () => {
    const exportData = filteredUsers.map(user => ({
      '회원명': user.displayName,
      '이메일주소': user.email,
      '가입일자': safeFormat(user.createdAt, 'yyyy-MM-dd HH:mm'),
      '마지막접속일시': safeFormat(user.lastLogin, 'yyyy-MM-dd HH:mm'),
      '가입경로': user.provider,
      '문의건수': user.quoteCount
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '회원목록');
    XLSX.writeFile(wb, `members_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic flex items-center gap-3">
          <Users className="text-lime" />
          회원 정보 관리
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCcw size={16} />
            새로고침
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-lime text-forest rounded-xl text-sm font-bold hover:shadow-[0_0_15px_rgba(163,230,53,0.3)] transition-all"
          >
            <Download size={16} />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass p-6 rounded-[30px] border border-white/10 shadow-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:border-lime outline-none transition-all text-white text-lg"
            placeholder="회원 이름 또는 이메일 검색..."
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="glass rounded-[30px] border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] tracking-widest uppercase opacity-40 bg-white/5">
                <th className="px-6 py-4 font-bold">회원명</th>
                <th className="px-6 py-4 font-bold">이메일주소</th>
                <th className="px-6 py-4 font-bold">가입일자</th>
                <th className="px-6 py-4 font-bold">마지막접속</th>
                <th className="px-6 py-4 font-bold text-center">경로</th>
                <th className="px-6 py-4 font-bold text-center">문의건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
                      <p className="text-sm opacity-40">회원 데이터를 불러오는 중...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center opacity-40 italic">
                    등록된 회원이 없거나 검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-lime font-bold text-xs border border-white/10">
                          {user.displayName?.charAt(0) || <User size={14} />}
                        </div>
                        <span className="font-bold text-white group-hover:text-lime transition-colors">
                          {user.displayName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white/60">
                        <Mail size={14} className="opacity-40" />
                        <span className="text-sm">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white/60">
                        <Calendar size={14} className="opacity-40" />
                        <span className="text-sm">{safeFormat(user.createdAt, 'yyyy-MM-dd HH:mm')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white/60">
                        <Clock size={14} className="opacity-40" />
                        <span className="text-sm">{safeFormat(user.lastLogin, 'yyyy-MM-dd HH:mm')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 uppercase">
                        {user.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onViewQuotes?.(user.id, user.displayName)}
                        disabled={user.quoteCount === 0}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold border transition-all ${
                          user.quoteCount > 0 
                            ? 'bg-lime/10 text-lime border-lime/20 hover:bg-lime hover:text-forest cursor-pointer' 
                            : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'
                        }`}
                        title={user.quoteCount > 0 ? "문의 내역 보기" : "문의 내역 없음"}
                      >
                        {user.quoteCount}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
