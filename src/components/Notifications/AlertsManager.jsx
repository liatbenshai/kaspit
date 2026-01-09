import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * הגדרות
 */
const CONFIG = {
  WORK_START_HOUR: 8,
  WORK_END_HOUR: 16,
  BREAK_INTERVAL_MINUTES: 45,
  BREAK_DURATION_MINUTES: 15,
  DEADLINE_WARNING_DAYS: 1,
};

const STORAGE_KEY = 'eisenhower_alerts_state';

/**
 * טעינת מצב מ-localStorage
 */
function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      Object.keys(parsed).forEach(key => {
        if (parsed[key].timestamp && now - parsed[key].timestamp > oneDay) {
          delete parsed[key];
        }
      });
      return parsed;
    }
  } catch {}
  return {};
}

/**
 * שמירת מצב ל-localStorage
 */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * ✅ בדיקה אם יש טיימר רץ על משימה ספציפית
 */
function isTimerRunning(taskId) {
  if (!taskId) return false;
  try {
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      return data.isRunning === true && data.isInterrupted !== true;
    }
  } catch (e) {}
  return false;
}

/**
 * ✅ בדיקה אם יש טיימר רץ על משימה כלשהי
 */
function getActiveTaskId() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('timer_v2_')) {
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.isRunning === true && data.isInterrupted !== true) {
            return key.replace('timer_v2_', '');
          }
        }
      }
    }
  } catch (e) {}
  return null;
}

/**
 * ✅ חישוב כמה זמן עבד על המשימה (בדקות)
 */
function getElapsedMinutes(taskId, baseTimeSpent = 0) {
  if (!taskId) return baseTimeSpent;
  try {
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.isRunning && data.startTime && !data.isInterrupted) {
        const startTime = new Date(data.startTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000) - (data.totalInterruptionSeconds || 0);
        const elapsedMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
        return baseTimeSpent + elapsedMinutes;
      }
    }
  } catch (e) {}
  return baseTimeSpent;
}

/**
 * ✅ המרת שעה מפורמט "HH:MM" לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(mins)) return null;
  return hours * 60 + mins;
}

/**
 * מנהל התראות מתקדם - גרסה מתוקנת!
 */
function AlertsManager({ onTaskClick }) {
  const { tasks, editTask } = useTasks();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alertsState, setAlertsState] = useState(loadState);
  const [showMorningSummary, setShowMorningSummary] = useState(false);
  const [showEveningSummary, setShowEveningSummary] = useState(false);
  const [lastBreakTime, setLastBreakTime] = useState(Date.now());
  // ✅ חדש: מודל "מה עושים?"
  const [showTimeUpModal, setShowTimeUpModal] = useState(null);

  // רענון כל 30 שניות
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // שמירת מצב
  useEffect(() => {
    saveState(alertsState);
  }, [alertsState]);

  // בדיקת סיכום בוקר/ערב
  useEffect(() => {
    const hour = currentTime.getHours();
    const today = currentTime.toISOString().split('T')[0];
    
    if (hour >= CONFIG.WORK_START_HOUR && hour < CONFIG.WORK_START_HOUR + 1) {
      const morningKey = `morning_${today}`;
      if (!alertsState[morningKey]) {
        setShowMorningSummary(true);
      }
    }
    
    if (hour >= CONFIG.WORK_END_HOUR && hour < CONFIG.WORK_END_HOUR + 1) {
      const eveningKey = `evening_${today}`;
      if (!alertsState[eveningKey]) {
        setShowEveningSummary(true);
      }
    }
  }, [currentTime, alertsState]);

  // חישוב נתוני היום
  const todayStats = useMemo(() => {
    const today = currentTime.toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.due_date === today);
    const completed = todayTasks.filter(t => t.is_completed);
    const pending = todayTasks.filter(t => !t.is_completed);
    const totalMinutes = pending.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const completedMinutes = completed.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    
    return {
      total: todayTasks.length,
      completed: completed.length,
      pending: pending.length,
      totalMinutes,
      completedMinutes,
      hours: Math.floor(totalMinutes / 60),
      mins: totalMinutes % 60
    };
  }, [tasks, currentTime]);

  // חישוב דדליינים מחר
  const tomorrowDeadlines = useMemo(() => {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];
    
    return tasks.filter(t => 
      !t.is_completed && 
      t.due_date === tomorrowISO
    );
  }, [tasks, currentTime]);

  // ✅ חישוב התראות - גרסה מתוקנת!
  const alerts = useMemo(() => {
    const now = currentTime;
    const today = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const alertsList = [];

    // ✅ בדיקה אם יש משימה פעילה עכשיו
    const activeTaskId = getActiveTaskId();

    // --- התראות דדליין מחר ---
    if (tomorrowDeadlines.length > 0) {
      const deadlineKey = `tomorrow_${today}`;
      if (!alertsState[deadlineKey]) {
        alertsList.push({
          id: 'tomorrow-deadlines',
          type: 'deadline-warning',
          priority: 1,
          icon: '📅',
          title: `מחר יש ${tomorrowDeadlines.length} דדליינים!`,
          message: tomorrowDeadlines.slice(0, 3).map(t => t.title).join(', ') + 
                   (tomorrowDeadlines.length > 3 ? ` ועוד ${tomorrowDeadlines.length - 3}...` : ''),
          color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700',
          dismissKey: deadlineKey,
          tasks: tomorrowDeadlines
        });
      }
    }

    // --- תזכורת הפסקה ---
    const currentHour = now.getHours();
    if (currentHour >= CONFIG.WORK_START_HOUR && currentHour < CONFIG.WORK_END_HOUR) {
      const minutesSinceBreak = Math.floor((Date.now() - lastBreakTime) / 60000);
      
      if (minutesSinceBreak >= CONFIG.BREAK_INTERVAL_MINUTES) {
        alertsList.push({
          id: 'break-reminder',
          type: 'break',
          priority: 0,
          icon: '☕',
          title: `עברו ${minutesSinceBreak} דקות!`,
          message: `הגיע הזמן להפסקה קצרה של ${CONFIG.BREAK_DURATION_MINUTES} דקות`,
          color: 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 animate-pulse',
          action: {
            label: '☕ לוקחת הפסקה',
            onClick: () => {
              setLastBreakTime(Date.now());
              toast.success('מעולה! הפסקה של 15 דקות 🧘‍♀️');
            }
          }
        });
      }
    }

    // --- התראות על משימות ---
    tasks.forEach(task => {
      if (task.is_completed) return;
      if (task.due_date !== today) return;

      const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
      const alertKey = `task_${task.id}_${today}`;
      
      // ✅ אם הטיימר רץ על המשימה הזו - בדיקת חריגה מזמן
      if (isTimerRunning(task.id)) {
        const estimated = task.estimated_duration || 0;
        if (estimated > 0) {
          const elapsed = getElapsedMinutes(task.id, task.time_spent || 0);
          const remaining = estimated - elapsed;
          
          // ✅ הזמן נגמר! - התראה מיוחדת עם אפשרויות
          if (remaining <= 0 && remaining > -5) {
            const timeUpKey = `timeup_${task.id}_${today}`;
            if (!alertsState[timeUpKey]) {
              alertsList.push({
                id: `timeup-${task.id}`,
                type: 'timeup',
                priority: -2, // הכי דחוף!
                icon: '🔔',
                title: 'הזמן נגמר!',
                message: `${taskType.icon} ${task.title}`,
                task,
                color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-600 animate-pulse',
                dismissKey: timeUpKey,
                showTimeUpActions: true
              });
            }
          }
          
          // חריגה מהזמן
          if (remaining < -5) {
            const overtimeKey = `overtime_${task.id}_${today}`;
            if (!alertsState[overtimeKey]) {
              alertsList.push({
                id: `overtime-${task.id}`,
                type: 'overtime',
                priority: -1,
                icon: '⚠️',
                title: `חריגה של ${Math.abs(Math.round(remaining))} דקות`,
                message: `${taskType.icon} ${task.title}`,
                task,
                color: 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600',
                dismissKey: overtimeKey
              });
            }
          }
        }
        
        return; // אם עובדים על המשימה - לא צריך התראות נוספות עליה
      }
      
      // ✅ אם יש טיימר רץ על משימה אחרת - לא מציגים התראות כלל!
      if (activeTaskId) {
        return;
      }
      
      // --- בדיקת זמן לפי due_time המקורי ---
      if (!task.due_time) return;
      
      const taskMinutes = timeToMinutes(task.due_time);
      if (taskMinutes === null) return;
      
      const diff = taskMinutes - currentMinutes;

      // משימה עכשיו!
      if (diff <= 0 && diff >= -2 && !alertsState[alertKey]) {
        alertsList.push({
          id: `now-${task.id}`,
          type: 'now',
          priority: -1,
          icon: '🚨',
          title: '🔔 הגיע הזמן להתחיל!',
          message: `${taskType.icon} ${task.title}`,
          task,
          color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-600 animate-pulse',
          dismissKey: alertKey
        });
      }
      
      // משימה בקרוב (15 דקות)
      else if (diff > 0 && diff <= 15) {
        alertsList.push({
          id: `upcoming-${task.id}`,
          type: 'upcoming',
          priority: 2,
          icon: '⏰',
          title: 'משימה מתחילה בקרוב',
          message: `${taskType.icon} ${task.title} - בעוד ${diff} דקות`,
          task,
          color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        });
      }

      // משימה באיחור - רק אם לא עבדו עליה!
      else if (diff < -2 && diff > -60 && !task.time_spent) {
        alertsList.push({
          id: `overdue-${task.id}`,
          type: 'overdue',
          priority: 1,
          icon: '🔴',
          title: 'משימה באיחור',
          message: `${taskType.icon} ${task.title} - לפני ${Math.abs(diff)} דקות`,
          task,
          color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        });
      }
    });

    // --- התראת סוף יום ---
    const endOfDayMinutes = CONFIG.WORK_END_HOUR * 60;
    const minutesToEnd = endOfDayMinutes - currentMinutes;
    
    if (minutesToEnd > 0 && minutesToEnd <= 60 && todayStats.pending > 0) {
      alertsList.push({
        id: 'end-of-day',
        type: 'warning',
        priority: 3,
        icon: '🌅',
        title: 'יום העבודה מסתיים בקרוב',
        message: `נשארו ${minutesToEnd} דקות ו-${todayStats.pending} משימות`,
        color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      });
    }

    return alertsList.sort((a, b) => a.priority - b.priority);
  }, [tasks, currentTime, alertsState, lastBreakTime, todayStats, tomorrowDeadlines]);

  // סגירת התראה
  const dismissAlert = useCallback((dismissKey) => {
    if (dismissKey) {
      setAlertsState(prev => ({
        ...prev,
        [dismissKey]: { timestamp: Date.now() }
      }));
    }
  }, []);

  // סגירת סיכום בוקר
  const dismissMorningSummary = () => {
    const today = currentTime.toISOString().split('T')[0];
    setAlertsState(prev => ({
      ...prev,
      [`morning_${today}`]: { timestamp: Date.now() }
    }));
    setShowMorningSummary(false);
  };

  // סגירת סיכום ערב
  const dismissEveningSummary = () => {
    const today = currentTime.toISOString().split('T')[0];
    setAlertsState(prev => ({
      ...prev,
      [`evening_${today}`]: { timestamp: Date.now() }
    }));
    setShowEveningSummary(false);
  };

  // ✅ פעולות "מה עושים?" כשהזמן נגמר
  const handleContinueWorking = (alert) => {
    dismissAlert(alert.dismissKey);
    toast.success('ממשיכה לעבוד! 💪');
  };

  const handleMoveNextTask = async (alert) => {
    // מוצאים את המשימה הבאה ומעבירים אותה למחר
    const today = currentTime.toISOString().split('T')[0];
    const nextTasks = tasks.filter(t => 
      !t.is_completed && 
      t.due_date === today && 
      t.id !== alert.task?.id
    ).sort((a, b) => {
      const aTime = timeToMinutes(a.due_time) || 999;
      const bTime = timeToMinutes(b.due_time) || 999;
      return aTime - bTime;
    });
    
    if (nextTasks.length > 0 && editTask) {
      const taskToMove = nextTasks[nextTasks.length - 1]; // המשימה האחרונה
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0];
      
      try {
        await editTask(taskToMove.id, { due_date: tomorrowISO, due_time: null });
        toast.success(`📅 "${taskToMove.title}" הועברה למחר`);
      } catch (e) {
        toast.error('שגיאה בהעברת המשימה');
      }
    }
    
    dismissAlert(alert.dismissKey);
  };

  // צליל התראה
  const playSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  // אפקט להתראות צליל
  useEffect(() => {
    const nowAlerts = alerts.filter(a => a.type === 'now' || a.type === 'timeup');
    if (nowAlerts.length > 0) {
      playSound();
    }
  }, [alerts, playSound]);

  return (
    <div className="space-y-3">
      {/* סיכום בוקר */}
      <AnimatePresence>
        {showMorningSummary && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-300 dark:border-amber-700"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌅</span>
                <h3 className="font-bold text-amber-900 dark:text-amber-100">בוקר טוב!</h3>
              </div>
              <button
                onClick={dismissMorningSummary}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {todayStats.total}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400">משימות</div>
              </div>
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {todayStats.hours > 0 ? `${todayStats.hours}:${todayStats.mins.toString().padStart(2,'0')}` : `${todayStats.mins}ד'`}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400">שעות עבודה</div>
              </div>
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {tomorrowDeadlines.length}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400">דדליינים מחר</div>
              </div>
            </div>

            {tomorrowDeadlines.length > 0 && (
              <div className="text-sm text-amber-800 dark:text-amber-200 bg-white/30 dark:bg-black/10 rounded p-2">
                ⚠️ <strong>שימי לב:</strong> מחר יש {tomorrowDeadlines.length} דדליינים
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* סיכום ערב */}
      <AnimatePresence>
        {showEveningSummary && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-300 dark:border-indigo-700"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌙</span>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-100">סיכום היום</h3>
              </div>
              <button
                onClick={dismissEveningSummary}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-center mb-3">
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {todayStats.completed}
                </div>
                <div className="text-sm text-indigo-600 dark:text-indigo-400">הושלמו ✓</div>
              </div>
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {todayStats.pending}
                </div>
                <div className="text-sm text-indigo-600 dark:text-indigo-400">נותרו למחר</div>
              </div>
            </div>

            {todayStats.completed > 0 && (
              <div className="text-center text-indigo-800 dark:text-indigo-200">
                {todayStats.completed >= todayStats.total ? (
                  <span>🎉 כל הכבוד! סיימת את כל המשימות!</span>
                ) : todayStats.completed >= todayStats.total * 0.7 ? (
                  <span>👏 יום פרודוקטיבי! סיימת {Math.round(todayStats.completed / todayStats.total * 100)}%</span>
                ) : (
                  <span>💪 עבודה טובה! מחר יום חדש</span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* התראות רגילות */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span>🔔</span>
              התראות
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          </div>

          <AnimatePresence>
            {alerts.slice(0, 5).map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`p-3 rounded-lg border flex flex-col gap-2 ${alert.color}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{alert.icon}</span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {alert.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {alert.message}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {alert.task && onTaskClick && (
                      <button
                        onClick={() => onTaskClick(alert.task)}
                        className="p-1.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-gray-500"
                        title="פתח משימה"
                      >
                        ✏️
                      </button>
                    )}
                    {alert.dismissKey && !alert.showTimeUpActions && (
                      <button
                        onClick={() => dismissAlert(alert.dismissKey)}
                        className="p-1.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-gray-400"
                        title="סגור"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                
                {/* ✅ כפתורי פעולה מיוחדים ל"הזמן נגמר" */}
                {alert.showTimeUpActions && (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleContinueWorking(alert)}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      ממשיכה לעבוד 💪
                    </button>
                    <button
                      onClick={() => handleMoveNextTask(alert)}
                      className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      העבר משימה למחר 📅
                    </button>
                  </div>
                )}
                
                {/* כפתור פעולה רגיל */}
                {alert.action && !alert.showTimeUpActions && (
                  <button
                    onClick={() => {
                      alert.action.onClick();
                      if (alert.dismissKey) dismissAlert(alert.dismissKey);
                    }}
                    className="mt-1 px-3 py-1.5 bg-teal-500 text-white text-sm rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    {alert.action.label}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default AlertsManager;
