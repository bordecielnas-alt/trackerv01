import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthenticated } from "@/lib/auth-store";
import { useThemeBootstrap } from "@/lib/theme-store";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import TrackingPage from "@/pages/TrackingPage";
import RoutinePage from "@/pages/RoutinePage";
import SettingsPage from "@/pages/SettingsPage";
import StatisticsPage from "@/pages/StatisticsPage";
import EditionPage from "@/pages/EditionPage";
import TodoPage from "@/pages/TodoPage";

import TestPage from "@/pages/TestPage";
import InspirationPage from "@/pages/InspirationPage";
import CalendarPage from "@/pages/CalendarPage";
import HealthPage from "@/pages/HealthPage";
import CorrelationPage from "@/pages/CorrelationPage";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useThemeBootstrap();
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LoginPage onLogin={() => setAuthed(true)} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout onLogout={() => setAuthed(false)}>
            <Routes>
              <Route path="/" element={<TrackingPage />} />
              <Route path="/routine" element={<RoutinePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/edition" element={<EditionPage />} />
              <Route path="/todo" element={<TodoPage />} />
              
              <Route path="/test" element={<TestPage />} />
              <Route path="/inspiration" element={<InspirationPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/correlation" element={<CorrelationPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
