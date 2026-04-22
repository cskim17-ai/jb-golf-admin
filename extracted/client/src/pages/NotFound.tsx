import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-forest text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <AlertCircle className="w-16 h-16 text-lime mx-auto mb-6" />
        <h1 className="text-5xl font-bold mb-4">404</h1>
        <p className="text-xl text-white/70 mb-8">
          페이지를 찾을 수 없습니다.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-lime text-forest px-8 py-3 rounded-lg font-bold hover:bg-lime/90 transition-all flex items-center gap-2 mx-auto"
        >
          <Home size={18} />
          홈으로 돌아가기
        </button>
      </motion.div>
    </div>
  );
}
