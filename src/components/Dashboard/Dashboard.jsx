import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../../config/taskTypes';
import { timeToMinutes, minutesToTime } from '../../utils/timeOverlap';
import Modal from '../UI/Modal';
import QuickAdd from '../QuickAdd/QuickAdd';
import UrgentReschedule from '../Scheduler/UrgentReschedule';
import WeeklyReview from '../Analytics/WeeklyReview';
import ClientTracker from '../Analytics/ClientTracker';
import DailySummary from '../Analytics/DailySummary';
import TimeGapsReport from '../Analytics/TimeGapsReport';
import WorkPreferences from '../Settings/WorkPreferences';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import InterruptionsTracker from './InterruptionsTracker';

/**
 * שעות העבודה
 */
const WORK_HOURS = { start: 8, end: 16 };

/**
 * צלילי התראה
 */
const SOUNDS = {
  taskStart: '/sounds/task-start.mp3',
  taskWarning: '/sounds/task-warning.mp3',
  taskEnd: '/sounds/task-end.mp3'
};

/**
 * נגן צליל (עם fallback)
 */
function playSound(type) {
  try {
    // יצירת צליל סינתטי אם אין קובץ
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // צלילים שונים לפי סוג
    if (type === 'taskStart') {
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
    } else if (type === 'taskWarning') {
      oscillator.frequency.value = 600;
      oscillator.type = 'triangle';
      gainNode.gain.value = 0.2;
    } else if (type === 'taskEnd') {
      oscillator.frequency.value = 400;
      oscillator.type = 'square';
      gainNode.gain.value = 0.2;
    }
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
  }
}

/**
 * פורמט שעה נוכחית
 */
function getCurrentTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (minutes < 0) return '0 דק\'';
  if (minutes < 60) return `${Math.round(minutes)} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * ברכה לפי שעה
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

/**
 * דשבורד ראשי
 */
function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const { tasks, loading, loadTasks, editTask } = useTasks();
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [lastAlertedTask, setLastAlertedTask] = useState(null);
  const [showTaskAlert, setShowTaskAlert] = useState(false);
  const [alertedWarnings, setAlertedWarnings] = useState(new Set());
  
  // מודלים
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showUrgent, setShowUrgent] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showClientTracker, setShowClientTracker] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showTimeGaps, setShowTimeGaps] = useState(false);
  
  // ✅ חדש: מודל הוספת משימה עם תכנון שבועי
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedTaskDate, setSelectedTaskDate] = useState(null);
  
  // ✅ חדש: מודל ניתוח הפרעות
  const [showInterruptions, setShowInterruptions] = useState(false);
  
  // עדכון שעה כל דקה
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // תאריך היום
  const today = new Date().toISOString().split('T')[0];
  const currentMinutes = timeToMinutes(currentTime);

  // משימות היום (ממוינות לפי שעה)
  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => t.due_date === today && !t.is_completed && t.due_time)
      .sort((a, b) => timeToMinutes(a.due_time) - timeToMinutes(b.due_time));
  }, [tasks, today]);

  // המשימה הנוכחית
  const currentTask = useMemo(() => {
    for (const task of todayTasks) {
      const start = timeToMinutes(task.due_time);
      const end = start + (task.estimated_duration || 30);
      if (currentMinutes >= start && currentMinutes < end) {
        return { ...task, startMinutes: start, endMinutes: end };
      }
    }
    return null;
  }, [todayTasks, currentMinutes]);

  // המשימה הבאה
  const nextTask = useMemo(() => {
    for (const task of todayTasks) {
      const start = timeToMinutes(task.due_time);
      if (start > currentMinutes) {
        return { ...task, startMinutes: start };
      }
    }
    return null;
  }, [todayTasks, currentMinutes]);

  // זמן שנותר במשימה הנוכחית
  const timeRemaining = currentTask 
    ? currentTask.endMinutes - currentMinutes 
    : null;

  // אחוז התקדמות במשימה
  const progressPercent = currentTask
    ? ((currentMinutes - currentTask.startMinutes) / (currentTask.estimated_duration || 30)) * 100
    : 0;

  // זמן עד המשימה הבאה
  const timeUntilNext = nextTask
    ? nextTask.startMinutes - currentMinutes
    : null;

  // התראות צליל
  useEffect(() => {
    // התראה כשמתחילה משימה חדשה
    if (currentTask && lastAlertedTask !== currentTask.id) {
      playSound('taskStart');
      setLastAlertedTask(currentTask.id);
      setShowTaskAlert(true);
      setTimeout(() => setShowTaskAlert(false), 5000);
    }

    // התראה 5 דקות לפני סוף משימה
    if (currentTask && timeRemaining === 5 && !alertedWarnings.has(`${currentTask.id}-5min`)) {
      playSound('taskWarning');
      setAlertedWarnings(prev => new Set([...prev, `${currentTask.id}-5min`]));
    }

    // התראה כשנגמר הזמן
    if (currentTask && timeRemaining === 0 && !alertedWarnings.has(`${currentTask.id}-end`)) {
      playSound('taskEnd');
      setAlertedWarnings(prev => new Set([...prev, `${currentTask.id}-end`]));
    }
  }, [currentTask, timeRemaining, lastAlertedTask, alertedWarnings]);

  // סטטיסטיקות היום
  const todayStats = useMemo(() => {
    const completed = tasks.filter(t => t.due_date === today && t.is_completed);
    const pending = todayTasks.length;
    const totalPlannedMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const completedMinutes = completed.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    
    return {
      completed: completed.length,
      pending,
      totalPlannedMinutes,
      completedMinutes,
      totalTasks: completed.length + pending
    };
  }, [tasks, todayTasks, today]);

  // צבע לפי זמן שנותר
  const getTimeColor = (remaining) => {
    if (remaining <= 0) return 'text-red-500';
    if (remaining <= 5) return 'text-orange-500';
    return 'text-green-500';
  };

  // צבע פס התקדמות
  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const currentTaskType = currentTask ? (TASK_TYPES[currentTask.task_type] || TASK_TYPES.other) : null;
  const nextTaskType = nextTask ? (TASK_TYPES[nextTask.task_type] || TASK_TYPES.other) : null;

  // תאריך עברי
  const hebrewDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
    } catch (e) {
      return '';
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900 p-4">
      {/* התראת משימה חדשה */}
      <AnimatePresence>
        {showTaskAlert && currentTask && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-4 left-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 border-r-4 border-blue-500"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentTaskType?.icon}</span>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">התחילה משימה חדשה!</div>
                <div className="font-bold text-lg text-gray-900 dark:text-white">{currentTask.title}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto space-y-4">
        {/* כותרת וברכה */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {user?.user_metadata?.name?.split(' ')[0] || 'שלום'}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {hebrewDate}
          </p>
          <div className="text-5xl font-light text-gray-800 dark:text-gray-200 mt-2 font-mono">
            {currentTime}
          </div>
        </motion.div>

        {/* כרטיס המשימה הנוכחית */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`
            rounded-2xl p-5 shadow-lg
            ${currentTask 
              ? `${currentTaskType?.color} border-2` 
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }
          `}
        >
          {currentTask ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentTaskType?.icon}</span>
                  <span className="text-xs font-medium opacity-75">עכשיו</span>
                </div>
                <div className={`text-2xl font-bold font-mono ${getTimeColor(timeRemaining)}`}>
                  {timeRemaining > 0 ? formatMinutes(timeRemaining) : '⏰ נגמר הזמן!'}
                </div>
              </div>
              
              <h2 className="text-xl font-bold mb-3">{currentTask.title}</h2>
              
              {/* פס התקדמות */}
              <div className="relative h-3 bg-black/10 rounded-full overflow-hidden mb-2">
                <motion.div
                  className={`absolute top-0 right-0 h-full rounded-full ${getProgressColor(progressPercent)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              <div className="flex justify-between text-sm opacity-75">
                <span>{currentTask.due_time}</span>
                <span>{minutesToTime(currentTask.endMinutes)}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <span className="text-4xl mb-3 block">☕</span>
              <h2 className="text-xl font-medium text-gray-700 dark:text-gray-300">
                אין משימה כרגע
              </h2>
              {nextTask && (
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  הבאה ב-{nextTask.due_time}
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* המשימה הבאה */}
        {nextTask && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${nextTaskType?.color}`}>
                  {nextTaskType?.icon}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">הבא בתור</div>
                  <div className="font-medium text-gray-900 dark:text-white">{nextTask.title}</div>
                </div>
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900 dark:text-white">{nextTask.due_time}</div>
                <div className="text-xs text-gray-500">
                  {timeUntilNext > 0 ? `עוד ${formatMinutes(timeUntilNext)}` : 'עכשיו'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* סטטיסטיקות */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow border border-gray-100 dark:border-gray-700">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {todayStats.pending}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">משימות היום</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow border border-gray-100 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {todayStats.completed}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">הושלמו</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow border border-gray-100 dark:border-gray-700">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {formatMinutes(todayStats.totalPlannedMinutes).replace(" שעות", "h").replace(" דק'", "m")}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">מתוכנן</div>
          </div>
        </motion.div>

        {/* ציר זמן - משימות היום */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700"
        >
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <span>📅</span> היום
          </h3>
          
          {todayTasks.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              אין משימות מתוכננות להיום
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {todayTasks.map((task, index) => {
                const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                const start = timeToMinutes(task.due_time);
                const end = start + (task.estimated_duration || 30);
                const isPast = currentMinutes >= end;
                const isCurrent = currentTask?.id === task.id;
                
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className={`
                      flex items-center gap-3 p-2 rounded-lg transition-all
                      ${isCurrent 
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' 
                        : isPast 
                          ? 'opacity-50' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className="text-sm font-mono text-gray-500 w-12">
                      {task.due_time}
                    </div>
                    <div className={`w-8 h-8 rounded flex items-center justify-center text-sm ${taskType.color}`}>
                      {taskType.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${isPast ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatMinutes(task.estimated_duration || 30)}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full animate-pulse">
                        עכשיו
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* כפתורי ניווט */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => onNavigate?.('day')}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xl">📋</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">תצוגה יומית</span>
          </button>
          
          <button
            onClick={() => onNavigate?.('week')}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xl">📅</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">תצוגת שבוע</span>
          </button>
        </motion.div>

        {/* כפתורים מהירים */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => setShowQuickAdd(true)}
            className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-lg">⚡</span>
            <span className="font-medium text-yellow-700 dark:text-yellow-300 text-sm">משהו צץ</span>
          </button>
          
          <button
            onClick={() => setShowUrgent(true)}
            className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-lg">🚨</span>
            <span className="font-medium text-red-700 dark:text-red-300 text-sm">דחוף!</span>
          </button>
        </motion.div>

        {/* כפתור הוספת עבודה */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => {
            setSelectedTaskDate(today);
            setShowAddTask(true);
          }}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 font-medium"
        >
          <span className="text-xl">📥</span>
          <span>הוסף עבודה חדשה</span>
        </motion.button>

        {/* ✅ תכנון שבועי - בורר ימים מהיר */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700"
        >
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <span>📆</span> הוסף משימה ליום...
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(() => {
              const days = [];
              const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
              for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dateISO = date.toISOString().split('T')[0];
                const dayNum = date.getDay();
                const isWeekend = dayNum === 5 || dayNum === 6;
                const isToday = i === 0;
                
                days.push(
                  <button
                    key={dateISO}
                    onClick={() => {
                      setSelectedTaskDate(dateISO);
                      setShowAddTask(true);
                    }}
                    disabled={isWeekend}
                    className={`
                      flex-shrink-0 w-14 py-2 px-1 rounded-lg text-center transition-all
                      ${isWeekend 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : isToday
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <div className="text-xs opacity-75">{dayNames[dayNum]}</div>
                    <div className="font-bold">{date.getDate()}</div>
                    {isToday && <div className="text-[10px]">היום</div>}
                  </button>
                );
              }
              return days;
            })()}
          </div>
        </motion.div>

        {/* כפתורי דוחות והגדרות */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-2 justify-center flex-wrap"
        >
          <button
            onClick={() => setShowDailySummary(true)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1"
          >
            <span>📊</span> סיכום יומי
          </button>
          <button
            onClick={() => setShowTimeGaps(true)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1"
          >
            <span>📈</span> איפה הזמן הלך?
          </button>
          <button
            onClick={() => setShowInterruptions(true)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1"
          >
            <span>⏸️</span> ניתוח הפרעות
          </button>
          <button
            onClick={() => setShowWeeklyReview(true)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            <span>📋</span> סקירה שבועית
          </button>
          <button
            onClick={() => setShowClientTracker(true)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            <span>👥</span> לקוחות
          </button>
          <button
            onClick={() => setShowPreferences(true)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            <span>⚙️</span> העדפות
          </button>
        </motion.div>
      </div>

      {/* מודלים */}
      <QuickAdd 
        isOpen={showQuickAdd} 
        onClose={() => setShowQuickAdd(false)}
        onAdded={loadTasks}
      />

      <Modal
        isOpen={showUrgent}
        onClose={() => setShowUrgent(false)}
        title="🚨 עבודה דחופה"
      >
        <UrgentReschedule
          onClose={() => setShowUrgent(false)}
          onRescheduled={loadTasks}
        />
      </Modal>

      <Modal
        isOpen={showWeeklyReview}
        onClose={() => setShowWeeklyReview(false)}
        title="📊 סקירה שבועית"
      >
        <WeeklyReview onClose={() => setShowWeeklyReview(false)} />
      </Modal>

      <Modal
        isOpen={showClientTracker}
        onClose={() => setShowClientTracker(false)}
        title="👥 מעקב לקוחות"
      >
        <ClientTracker onClose={() => setShowClientTracker(false)} />
      </Modal>

      <Modal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        title="⚙️ העדפות עבודה"
      >
        <WorkPreferences 
          onClose={() => setShowPreferences(false)}
          onSaved={loadTasks}
        />
      </Modal>

      {/* סיכום יומי */}
      <Modal
        isOpen={showDailySummary}
        onClose={() => setShowDailySummary(false)}
        title=""
      >
        <DailySummary 
          tasks={tasks}
          date={new Date()}
          onClose={() => setShowDailySummary(false)}
          onMoveTasks={async (tasksToMove, newDate) => {
            for (const task of tasksToMove) {
              await editTask(task.id, { ...task, dueDate: newDate });
            }
            loadTasks();
            setShowDailySummary(false);
          }}
        />
      </Modal>

      {/* דוח פערים */}
      <Modal
        isOpen={showTimeGaps}
        onClose={() => setShowTimeGaps(false)}
        title=""
      >
        <TimeGapsReport 
          tasks={tasks}
          onClose={() => setShowTimeGaps(false)}
        />
      </Modal>

      {/* ✅ ניתוח הפרעות */}
      <Modal
        isOpen={showInterruptions}
        onClose={() => setShowInterruptions(false)}
        title="⏸️ ניתוח הפרעות"
      >
        <InterruptionsTracker />
      </Modal>

      {/* ✅ חדש: מודל הוספת משימה */}
      <Modal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        title={`➕ הוסף משימה ${selectedTaskDate === today ? 'להיום' : `ל-${new Date(selectedTaskDate + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}`}`}
      >
        <SimpleTaskForm
          defaultDate={selectedTaskDate}
          onClose={() => {
            setShowAddTask(false);
            loadTasks();
          }}
        />
      </Modal>
    </div>
  );
}

export default Dashboard;
