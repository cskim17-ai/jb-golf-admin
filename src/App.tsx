import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

// 1. 리다이렉트 기능을 담당하는 별도의 컴포넌트입니다.
const RedirectToAdmin = () => {
  const [, navigate] = useLocation();
  useEffect(() => {
    // replace: true를 사용해 뒤로가기 시 꼬이지 않게 합니다.
    navigate("/admin", { replace: true });
  }, [navigate]);
  return null;
};

function Router() {
  // Vite의 base 설정값을 동적으로 가져옵니다. 끝의 슬래시는 제거합니다.
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    // basename 대신 base 속성을 동적으로 사용합니다.
    <WouterRouter base={baseUrl}>
      <Switch>
        {/* 기본 경로 접속 시 관리자 페이지로 이동 */}
        <Route path="/" component={RedirectToAdmin} />
        
        {/* 관리자 페이지 주소 설정 */}
        <Route path="/admin" component={Admin} />
        
        {/* 404 및 기타 경로 처리 */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;