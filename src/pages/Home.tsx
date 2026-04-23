import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { LogIn, Settings, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Design Philosophy: Landing Page
 * - Dark forest green background (#2d4a2d) with lime accents (#39d353)
 * - Clean, professional layout focused on admin access
 * - Minimal but impactful design
 */

export default function Home() {
  const [, navigate] = useLocation();
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'logo'), (snap) => {
      if (snap.exists()) {
        setLogoUrl(snap.data().logoUrl || '');
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-forest text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center p-1 bg-white/5 border border-white/10">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-lime rounded-lg flex items-center justify-center font-bold text-forest text-xl">
                JB
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">JB Golf Admin</h1>
              <p className="text-sm text-white/60">관리 시스템</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center"
        >
          <h2 className="text-5xl font-bold mb-6">
            <span className="text-lime">JB Golf</span> 관리 시스템
          </h2>
          <p className="text-xl text-white/70 mb-12">
            예약 요청, 공지사항, 갤러리 등을 관리하는 전문적인 관리자 대시보드입니다.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass p-6 rounded-2xl border border-white/10 hover:border-lime/30 transition-all"
            >
              <BarChart3 className="w-8 h-8 text-lime mx-auto mb-4" />
              <h3 className="font-bold mb-2">예약 관리</h3>
              <p className="text-sm text-white/60">
                고객 예약 요청을 효율적으로 관리하고 추적합니다.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass p-6 rounded-2xl border border-white/10 hover:border-lime/30 transition-all"
            >
              <Settings className="w-8 h-8 text-lime mx-auto mb-4" />
              <h3 className="font-bold mb-2">콘텐츠 관리</h3>
              <p className="text-sm text-white/60">
                공지사항, 갤러리, 비디오를 쉽게 관리합니다.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass p-6 rounded-2xl border border-white/10 hover:border-lime/30 transition-all"
            >
              <LogIn className="w-8 h-8 text-lime mx-auto mb-4" />
              <h3 className="font-bold mb-2">보안 접근</h3>
              <p className="text-sm text-white/60">
                비밀번호로 보호된 안전한 관리자 영역입니다.
              </p>
            </motion.div>
          </div>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => navigate("/admin")}
            className="bg-lime text-forest px-8 py-4 rounded-xl font-bold text-lg hover:bg-lime/90 transition-all shadow-lg hover:shadow-xl"
          >
            관리자 대시보드 접속
          </motion.button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-white/40 text-sm">
        <p>© 2024 JB Golf Admin. All rights reserved.</p>
      </footer>
    </div>
  );
}
