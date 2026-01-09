import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import { useNotifications } from '../../hooks/useNotifications';
import toast from 'react-hot-toast';

/**
 * שעות העבודה
 */
const WORK_HOURS = {
  start: 8,
  end: 18
};

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
 * התראות חכמות - מציג התראות בממשק
 * גרסה מתוקנת!
 */
function SmartNotifications({ onTaskClick }) {
  const { tasks } = useTasks();
  const { 
    permission, 
    requestPermission, 
    updateTasks,
    checkTasksAndNotify 
  } = useNotifications();
  const [dismissed, setDismissed] = useState(new Set());

  // עדכון המשימות במערכת ההתראות
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      updateTasks(tasks);
      if (permission === 'granted') {
        checkTasksAndNotify();
      }
    }
  }, [tasks, updateTasks, checkTasksAndNotify, permission]);

  // בקשת הרשאה להתראות
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('🔔 התראות הופעלו!');
    } else {
      toast.error('ההתראות לא אושרו');
    }
  };

  // ✅ חישוב התראות לתצוגה - גרסה מתוקנת!
  const notifications = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const alerts = [];

    // ✅ בדיקה אם יש משימה פעילה עכשיו
    const activeTaskId = getActiveTaskId();

    tasks.forEach(task => {
      if (task.is_completed) return;
      if (dismissed.has(task.id)) return;

      const taskType = TASK_TYPES?.[task.task_type] || { icon: '📌', name: 'אחר' };

      // ✅ אם הטיימר רץ על המשימה הזו - לא מציגים התראות עליה
      if (isTimerRunning(task.id)) {
        return;
      }

      // ✅ אם יש טיימר רץ על משימה אחרת - לא מציגים התראות כלל!
      if (activeTaskId) {
        return;
      }

      // משימה שמתחילה בקרוב (תוך 15 דקות) - לפי due_time המקורי
      if (task.due_date === today && task.due_time) {
        const taskMinutes = timeToMinutes(task.due_time);
        if (taskMinutes === null) return;
        
        const diff = taskMinutes - currentMinutes;

        if (diff > 0 && diff <= 15) {
          alerts.push({
            id: `upcoming-${task.id}`,
            taskId: task.id,
            type: 'upcoming',
            priority: 1,
            icon: '⏰',
            title: 'משימה מתחילה בקרוב',
            message: `${taskType.icon} ${task.title} - בעוד ${diff} דקות`,
            task,
            color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          });
        }

        // משימה באיחור - רק אם לא עבדו עליה!
        if (diff < 0 && !task.time_spent) {
          const overdueMinutes = Math.abs(diff);
          let overdueText;
          if (overdueMinutes >= 60) {
            const hours = Math.floor(overdueMinutes / 60);
            const mins = overdueMinutes % 60;
            overdueText = mins > 0 ? `${hours} שעות ו-${mins} דקות` : `${hours} שעות`;
          } else {
            overdueText = `${overdueMinutes} דקות`;
          }

          alerts.push({
            id: `overdue-${task.id}`,
            taskId: task.id,
            type: 'overdue',
            priority: 0,
            icon: '🔴',
            title: 'משימה באיחור!',
            message: `${taskType.icon} ${task.title} - לפני ${overdueText}`,
            task,
            color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          });
        }
      }

      // משימה ללא תאריך
      if (!task.due_date && !task.due_time) {
        alerts.push({
          id: `unscheduled-${task.id}`,
          taskId: task.id,
          type: 'unscheduled',
          priority: 3,
          icon: '📌',
          title: 'משימה לא משובצת',
          message: `${taskType.icon} ${task.title}`,
          task,
          color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        });
      }
    });

    // בדיקת זמן פנוי
    const todayTasks = tasks.filter(t => t.due_date === today && !t.is_completed);
    const scheduledMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalWorkMinutes = (WORK_HOURS.end - WORK_HOURS.start) * 60;
    const freeMinutes = totalWorkMinutes - scheduledMinutes;
    const unscheduledCount = tasks.filter(t => !t.is_completed && !t.due_date).length;

    if (freeMinutes > 120 && unscheduledCount > 0 && currentHour >= WORK_HOURS.start && currentHour < WORK_HOURS.end && !activeTaskId) {
      alerts.push({
        id: 'free-time',
        type: 'suggestion',
        priority: 4,
        icon: '💡',
        title: 'יש לך זמן פנוי',
        message: `יש לך ${Math.floor(freeMinutes / 60)} שעות פנויות ו-${unscheduledCount} משימות לא משובצות`,
        color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      });
    }

    // התראה על סוף יום העבודה
    const endOfDayMinutes = WORK_HOURS.end * 60;
    const minutesToEnd = endOfDayMinutes - currentMinutes;
    const pendingTodayTasks = todayTasks.filter(t => !t.is_completed).length;

    if (minutesToEnd > 0 && minutesToEnd <= 60 && pendingTodayTasks > 0 && !activeTaskId) {
      alerts.push({
        id: 'end-of-day',
        type: 'warning',
        priority: 2,
        icon: '🌅',
        title: 'יום העבודה מסתיים בקרוב',
        message: `נשארו ${minutesToEnd} דקות ו-${pendingTodayTasks} משימות פתוחות`,
        color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      });
    }

    // מיון לפי עדיפות
    return alerts.sort((a, b) => a.priority - b.priority);
  }, [tasks, dismissed]);

  // סגירת התראה
  const dismissNotification = (id, taskId) => {
    if (taskId) {
      setDismissed(prev => new Set([...prev, taskId]));
    } else {
      setDismissed(prev => new Set([...prev, id]));
    }
  };

  // רענון התראות כל 5 דקות
  useEffect(() => {
    const interval = setInterval(() => {
      setDismissed(new Set());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (notifications.length === 0 && permission === 'granted') {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {/* כותרת */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <span>🔔</span>
          התראות ({notifications.length})
        </h3>
        
        {permission !== 'granted' && (
          <button
            onClick={handleRequestPermission}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700"
          >
            🔔 הפעל התראות
          </button>
        )}
      </div>

      {/* הודעה אם אין הרשאה */}
      {permission !== 'granted' && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ התראות לא מופעלות - לא תקבלי התראות על משימות!
          </p>
        </div>
      )}

      {/* רשימת התראות */}
      <AnimatePresence>
        {notifications.slice(0, 5).map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`
              p-3 rounded-lg border flex items-start gap-3
              ${notification.color}
            `}
          >
            <span className="text-xl">{notification.icon}</span>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {notification.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {notification.message}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {notification.task && onTaskClick && (
                <button
                  onClick={() => onTaskClick(notification.task)}
                  className="p-1.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-gray-500 hover:text-gray-700"
                  title="פתח משימה"
                >
                  ✏️
                </button>
              )}
              <button
                onClick={() => dismissNotification(notification.id, notification.taskId)}
                className="p-1.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-gray-400 hover:text-gray-600"
                title="סגור"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {notifications.length > 5 && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          +{notifications.length - 5} התראות נוספות
        </div>
      )}
    </div>
  );
}

export default SmartNotifications;
