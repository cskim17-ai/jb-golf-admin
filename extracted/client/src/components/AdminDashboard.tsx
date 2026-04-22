import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QuoteRequest {
  id: string;
  timestamp: any;
  serverTimestamp?: any;
  status?: string;
  from_name: string;
  golf_courses?: string;
  schedule?: any;
}

interface GolfCourseData {
  course: string;
  count: number;
  schedules: string[];
}

interface ScheduleData {
  schedule: string;
  courses: string[];
  count: number;
}

interface AdminDashboardProps {
  showAlert: (message: string) => void;
}

export default function AdminDashboard({ showAlert }: AdminDashboardProps) {
  const [quotesData, setQuotesData] = useState<QuoteRequest[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [statusStats, setStatusStats] = useState<any[]>([]);
  const [golfCourseStats, setGolfCourseStats] = useState<GolfCourseData[]>([]);
  const [scheduleStats, setScheduleStats] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 날짜 설정 (기본값: 최근 30일)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    setEndDate(todayStr);
    setStartDate(thirtyDaysAgoStr);
    setTempEndDate(todayStr);
    setTempStartDate(thirtyDaysAgoStr);
  }, []);

  // Firebase 데이터 로드
  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('serverTimestamp', 'desc'));
    const unsubscribeQuotes = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as QuoteRequest);
      setQuotesData(data);
      setLoading(false);
    }, (error) => {
      console.error("Quotes fetch error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeQuotes();
    };
  }, []);

  // 조회 버튼 클릭 핸들러
  const handleSearch = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  // 기간 내 데이터 필터링
  const getFilteredData = () => {
    if (!startDate || !endDate) return quotesData;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return quotesData.filter(item => {
      try {
        const itemDate = item.serverTimestamp?.toDate?.() || new Date(item.serverTimestamp);
        return itemDate >= start && itemDate <= end;
      } catch (e) {
        return false;
      }
    });
  };

  // 통계 계산
  useEffect(() => {
    const filteredData = getFilteredData();
    
    if (filteredData.length > 0) {
      calculateDailyStats(filteredData);
      calculateStatusStats(filteredData);
      calculateScheduleStats(filteredData);
      calculateGolfCourseStats(filteredData);
    } else {
      setDailyStats([]);
      setStatusStats([]);
      setScheduleStats([]);
      setGolfCourseStats([]);
    }
  }, [quotesData, startDate, endDate]);

  const calculateDailyStats = (data: QuoteRequest[]) => {
    const dailyMap: { [key: string]: number } = {};
    
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 모든 날짜에 대해 0으로 초기화
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dailyMap[dateKey] = 0;
    }

    data.forEach(item => {
      try {
        const itemDate = item.serverTimestamp?.toDate?.() || new Date(item.serverTimestamp);
        const dateKey = itemDate.toISOString().split('T')[0];
        if (dailyMap.hasOwnProperty(dateKey)) {
          dailyMap[dateKey]++;
        }
      } catch (e) {
        console.error('Date parsing error:', e);
      }
    });

    const dailyData = Object.entries(dailyMap).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      count: count
    }));

    setDailyStats(dailyData);
  };

  const calculateStatusStats = (data: QuoteRequest[]) => {
    const statusMap: { [key: string]: number } = {
      '접수확인': 0,
      '답변완료': 0,
      '견적확정': 0,
      '입금완료': 0
    };

    data.forEach(item => {
      const status = item.status || '접수확인';
      if (statusMap.hasOwnProperty(status)) {
        statusMap[status]++;
      }
    });

    const statusData = Object.entries(statusMap).map(([status, count]) => ({
      name: status,
      value: count
    }));

    setStatusStats(statusData);
  };

  const calculateScheduleStats = (data: QuoteRequest[]) => {
    const scheduleMap: { [key: string]: { courses: Set<string>; count: number } } = {};

    data.forEach(item => {
      const golfCoursesStr = item.golf_courses || '';
      
      // golf_courses 필드에서 라운딩 일정별로 골프장 추출
      const courseRegex = /([^/\d]+?)\s+(\d{2}\/\d{2})\s*\/\s*(MORNING|AFTERNOON|오전|오후)?/g;
      let match;
      
      while ((match = courseRegex.exec(golfCoursesStr)) !== null) {
        const courseName = match[1].trim().split('(')[0].trim();
        const dateStr = match[2];
        const timeStr = match[3] || 'MORNING';
        const scheduleKey = `${dateStr} / ${timeStr}`;
        
        if (!scheduleMap[scheduleKey]) {
          scheduleMap[scheduleKey] = { courses: new Set(), count: 0 };
        }
        scheduleMap[scheduleKey].courses.add(courseName);
        scheduleMap[scheduleKey].count++;
      }
    });

    // 라운딩 일정별로 정렬
    const scheduleData = Object.entries(scheduleMap)
      .map(([schedule, stats]) => ({
        schedule: schedule,
        courses: Array.from(stats.courses).sort(),
        count: stats.count
      }))
      .sort((a, b) => {
        // MM/DD 형식으로 정렬
        const dateA = a.schedule.split(' / ')[0];
        const dateB = b.schedule.split(' / ')[0];
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;
        // 같은 날짜면 MORNING이 먼저
        return a.schedule.localeCompare(b.schedule);
      });

    setScheduleStats(scheduleData);
  };

  const calculateGolfCourseStats = (data: QuoteRequest[]) => {
    const courseMap: { [key: string]: { count: number; schedules: string[] } } = {};

    data.forEach(item => {
      const golfCoursesStr = item.golf_courses || '';
      
      // golf_courses 필드에서 골프장명과 일정 추출
      const courseRegex = /([^/\d]+?)\s+(\d{2}\/\d{2})\s*\/\s*(MORNING|AFTERNOON|오전|오후)?/g;
      let match;
      
      while ((match = courseRegex.exec(golfCoursesStr)) !== null) {
        const courseName = match[1].trim().split('(')[0].trim();
        const dateStr = match[2];
        const timeStr = match[3] || 'MORNING';
        
        if (!courseMap[courseName]) {
          courseMap[courseName] = { count: 0, schedules: [] };
        }
        courseMap[courseName].count++;
        
        const scheduleStr = `${dateStr} / ${timeStr}`;
        if (!courseMap[courseName].schedules.includes(scheduleStr)) {
          courseMap[courseName].schedules.push(scheduleStr);
        }
      }
    });

    // 각 골프장별로 일정을 날짜순으로 정렬
    const courseData = Object.entries(courseMap)
      .map(([course, stats]) => ({
        course: course,
        count: stats.count,
        schedules: stats.schedules.sort((a, b) => {
          const dateA = a.split(' / ')[0];
          const dateB = b.split(' / ')[0];
          return dateA.localeCompare(dateB);
        })
      }))
      .sort((a, b) => a.course.localeCompare(b.course));

    setGolfCourseStats(courseData);
  };

  const filteredData = getFilteredData();
  const COLORS = ['#fbbf24', '#3b82f6', '#10b981', '#39d353'];
  
  const totalRequests = filteredData.length;
  const statusCounts = {
    '접수확인': filteredData.filter(q => q.status === '접수확인').length,
    '답변완료': filteredData.filter(q => q.status === '답변완료').length,
    '견적확정': filteredData.filter(q => q.status === '견적확정').length,
    '입금완료': filteredData.filter(q => q.status === '입금완료').length
  };

  if (loading) {
    return (
      <motion.div
        key="dashboard"
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
      key="dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic">대시보드</h2>
      </div>

      {/* 조회 조건 */}
      <div className="glass rounded-[30px] border border-white/10 p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <input
            type="date"
            value={tempStartDate}
            onChange={(e) => setTempStartDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-lime outline-none transition-all text-sm"
          />
          <span className="text-sm opacity-60">~</span>
          <input
            type="date"
            value={tempEndDate}
            onChange={(e) => setTempEndDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-lime outline-none transition-all text-sm"
          />
          <button
            onClick={handleSearch}
            className="bg-lime text-forest px-6 py-2 rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all whitespace-nowrap"
          >
            조회
          </button>
          <span className="text-sm opacity-60 whitespace-nowrap">
            ({filteredData.length}건)
          </span>
        </div>
      </div>

      {/* 문의상태별 진행현황 KPI Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">문의상태별 진행현황</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="glass rounded-[20px] border border-white/10 p-4 space-y-2">
            <p className="text-xs tracking-widest uppercase opacity-40">총 문의건수</p>
            <p className="text-3xl font-bold text-lime">{totalRequests}</p>
            <p className="text-xs opacity-60">건</p>
          </div>
          
          <div className="glass rounded-[20px] border border-white/10 p-4 space-y-2">
            <p className="text-xs tracking-widest uppercase opacity-40">접수확인</p>
            <p className="text-3xl font-bold text-yellow-400">{statusCounts['접수확인']}</p>
            <p className="text-xs opacity-60">건</p>
          </div>

          <div className="glass rounded-[20px] border border-white/10 p-4 space-y-2">
            <p className="text-xs tracking-widest uppercase opacity-40">답변완료</p>
            <p className="text-3xl font-bold text-blue-400">{statusCounts['답변완료']}</p>
            <p className="text-xs opacity-60">건</p>
          </div>

          <div className="glass rounded-[20px] border border-white/10 p-4 space-y-2">
            <p className="text-xs tracking-widest uppercase opacity-40">견적확정</p>
            <p className="text-3xl font-bold text-green-400">{statusCounts['견적확정']}</p>
            <p className="text-xs opacity-60">건</p>
          </div>

          <div className="glass rounded-[20px] border border-white/10 p-4 space-y-2">
            <p className="text-xs tracking-widest uppercase opacity-40">입금완료</p>
            <p className="text-3xl font-bold text-lime">{statusCounts['입금완료']}</p>
            <p className="text-xs opacity-60">건</p>
          </div>
        </div>
      </div>

      {/* 일자별 문의현황 */}
      <div className="glass rounded-[30px] border border-white/10 p-8">
        <h3 className="text-xl font-bold mb-6">일자별 문의현황</h3>
        {dailyStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a3a1a', border: '1px solid rgba(163,230,53,0.3)' }}
                labelStyle={{ color: '#39d353' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#39d353" 
                strokeWidth={3}
                dot={{ fill: '#39d353', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center opacity-40 py-12">조회 기간 내 데이터가 없습니다.</div>
        )}
      </div>

      {/* 상태별 현황 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 상태별 파이 차트 */}
        <div className="glass rounded-[30px] border border-white/10 p-8">
          <h3 className="text-xl font-bold mb-6">상태별 현황 (분포)</h3>
          {statusStats.length > 0 && statusStats.some(s => s.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a3a1a', border: '1px solid rgba(163,230,53,0.3)' }}
                  labelStyle={{ color: '#39d353' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center opacity-40 py-12">조회 기간 내 데이터가 없습니다.</div>
          )}
        </div>

        {/* 상태별 바 차트 */}
        <div className="glass rounded-[30px] border border-white/10 p-8">
          <h3 className="text-xl font-bold mb-6">상태별 현황 (건수)</h3>
          {statusStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a3a1a', border: '1px solid rgba(163,230,53,0.3)' }}
                  labelStyle={{ color: '#39d353' }}
                />
                <Bar dataKey="value" fill="#39d353" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center opacity-40 py-12">조회 기간 내 데이터가 없습니다.</div>
          )}
        </div>
      </div>

      {/* 라운딩 일정별 문의 현황 */}
      <div className="glass rounded-[30px] border border-white/10 p-8">
        <h3 className="text-xl font-bold mb-6">라운딩 일정별 문의 현황</h3>
        {scheduleStats && Array.isArray(scheduleStats) && scheduleStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 opacity-60 font-bold">라운딩 일정</th>
                  <th className="text-left py-3 px-4 opacity-60 font-bold">골프장명</th>
                  <th className="text-center py-3 px-4 opacity-60 font-bold">문의건수</th>
                </tr>
              </thead>
              <tbody>
                {scheduleStats.map((scheduleData, scheduleIndex) => (
                  <tr key={scheduleIndex} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-semibold">{scheduleData.schedule}</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {scheduleData.courses.map((course, courseIndex) => (
                          <div key={courseIndex} className="text-xs opacity-70">
                            {course}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="text-center py-3 px-4 font-bold text-lime">{scheduleData.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center opacity-40 py-12">조회 기간 내 데이터가 없습니다.</div>
        )}
      </div>

      {/* 골프장별 문의 현황 */}
      <div className="glass rounded-[30px] border border-white/10 p-8">
        <h3 className="text-xl font-bold mb-6">골프장별 문의 현황</h3>
        {golfCourseStats && Array.isArray(golfCourseStats) && golfCourseStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 opacity-60 font-bold">골프장명</th>
                  <th className="text-left py-3 px-4 opacity-60 font-bold">라운딩 일정</th>
                  <th className="text-center py-3 px-4 opacity-60 font-bold">문의건수</th>
                </tr>
              </thead>
              <tbody>
                {golfCourseStats.map((courseData: GolfCourseData, courseIndex: number) => (
                  <tr key={courseIndex} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-semibold">{courseData.course}</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {courseData.schedules.map((schedule, scheduleIndex) => (
                          <div key={scheduleIndex} className="text-xs opacity-70">
                            {schedule}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="text-center py-3 px-4 font-bold text-lime">{courseData.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center opacity-40 py-12">조회 기간 내 데이터가 없습니다.</div>
        )}
      </div>
    </motion.div>
  );
}
