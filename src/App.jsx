import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// דפים - 5 עמודים בלבד
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';           // דשבורד - עמוד הבית
import DailyViewPage from './pages/DailyViewPage';   // תצוגה יומית
import WeeklyViewPage from './pages/WeeklyViewPage'; // תצוגה שבועית (חדש)
import TaskInsights from './pages/TaskInsights';     // תובנות ולמידה
import Settings from './pages/Settings';             // הגדרות

// רכיבים
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Header from './components/Layout/Header';
import MobileNav from './components/Layout/MobileNav';
import InstallPrompt from './components/PWA/InstallPrompt';
import IdleDetector from './components/Productivity/IdleDetector';
import UrgentTaskButton from './components/Productivity/UrgentTaskButton';
import EndOfDayPopup from './components/Productivity/EndOfDayPopup';
import NotificationChecker from './components/Notifications/NotificationChecker';
import OverdueTaskManager from './components/Notifications/OverdueTaskManager';
import { DeadlineConflictManager } from './components/Notifications/DeadlineConflictModal';
import EndOfDaySummary from './components/Learning/EndOfDaySummary';
import { useTasks } from './hooks/useTasks';

/**
 * ✅ חדש: Wrapper לפופאפ משימות באיחור
 * נדרש כדי להשתמש ב-useTasks בתוך TaskProvider
 */
function OverdueTaskWrapper() {
  const { tasks } = useTasks();
  return <OverdueTaskManager tasks={tasks} />;
}

/**
 * ✅ חדש: Wrapper לסיכום יומי
 */
function EndOfDaySummaryWrapper() {
  const { tasks } = useTasks();
  return <EndOfDaySummary tasks={tasks} workEndHour={16} />;
}

function App() {
  const { user, loading } = useAuth();


  // מסך טעינה
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* הודעות Toast */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            direction: 'rtl',
            fontFamily: 'Arial, sans-serif'
          }
        }}
      />

      {/* הודעת התקנת PWA */}
      <InstallPrompt />

      {/* זיהוי זמן מת */}
      {user && <IdleDetector />}

      {/* כפתור עבודה דחופה */}
      {user && <UrgentTaskButton />}

      {/* סיכום יומי */}
      {user && <EndOfDayPopup />}

      {/* בודק התראות - חדש! */}
      {user && <NotificationChecker />}
      
      {/* ✅ חדש: פופאפ חוסם למשימות באיחור */}
      {user && <OverdueTaskWrapper />}
      
      {/* ✅ חדש: סיכום יומי אוטומטי בסוף היום */}
      {user && <EndOfDaySummaryWrapper />}
      
      {/* ✅ חדש: מנהל התנגשויות דדליין */}
      {user && <DeadlineConflictManager />}

      {/* כותרת עליונה */}
      {user && <Header />}

      {/* תוכן עם padding לניווט תחתון בנייד */}
      <main className={user ? 'pb-20 md:pb-0' : ''}>
        <Routes>
          {/* דף בית - מפנה לדשבורד */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          
          {/* התחברות והרשמה */}
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
          
          {/* ===== 5 העמודים הראשיים ===== */}
          
          {/* 1. דשבורד - עמוד הבית */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* 2. תצוגה יומית */}
          <Route path="/daily" element={
            <ProtectedRoute>
              <DailyViewPage />
            </ProtectedRoute>
          } />

          {/* 3. תצוגה שבועית */}
          <Route path="/weekly" element={
            <ProtectedRoute>
              <WeeklyViewPage />
            </ProtectedRoute>
          } />
          
          {/* 4. תובנות ולמידה */}
          <Route path="/insights" element={
            <ProtectedRoute>
              <TaskInsights />
            </ProtectedRoute>
          } />

          {/* 5. הגדרות */}
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />

          {/* דף 404 - מפנה לדשבורד */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>

      {/* ניווט תחתון בנייד */}
      {user && <MobileNav />}
    </div>
  );
}

export default App;
