import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * שעות העבודה
 */
const WORK_HOURS = {
  start: 8,
  end: 16
};

/**
 * קבלת תאריך בפורמט ISO
 */
function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * קבלת תאריך אתמול
 */
function getYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}

/**
 * קבלת תאריך מחר
 */
function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * טיפול במשימות שלא הושלמו
 */
function UnfinishedTasksHandler({ onClose, onTasksMoved }) {
  const { tasks, editTask, loadTasks } = useTasks();
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [targetDate, setTargetDate] = useState('today');
  const [moving, setMoving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // משימות שלא הושלמו מימים קודמים
  const unfinishedTasks = useMemo(() => {
    const today = getDateISO(new Date());
    
    return tasks.filter(task => {
      if (task.is_completed) return false;
      if (!task.due_date) return false;
      
      // משימה מיום קודם
      return task.due_date < today;
    }).sort((a, b) => {
      // מיון לפי תאריך (ישנות קודם)
      return a.due_date.localeCompare(b.due_date);
    });
  }, [tasks]);

  // חישוב זמן פנוי היום
  const todayFreeTime = useMemo(() => {
    const today = getDateISO(new Date());
    const todayTasks = tasks.filter(t => 
      t.due_date === today && !t.is_completed
    );
    const scheduledMinutes = todayTasks.reduce((sum, t) => 
      sum + (t.estimated_duration || 30), 0
    );
    const totalMinutes = (WORK_HOURS.end - WORK_HOURS.start) * 60;
    return Math.max(0, totalMinutes - scheduledMinutes);
  }, [tasks]);

  // חישוב זמן פנוי מחר
  const tomorrowFreeTime = useMemo(() => {
    const tomorrow = getDateISO(getTomorrow());
    const tomorrowTasks = tasks.filter(t => 
      t.due_date === tomorrow && !t.is_completed
    );
    const scheduledMinutes = tomorrowTasks.reduce((sum, t) => 
      sum + (t.estimated_duration || 30), 0
    );
    const totalMinutes = (WORK_HOURS.end - WORK_HOURS.start) * 60;
    return Math.max(0, totalMinutes - scheduledMinutes);
  }, [tasks]);

  // סה"כ זמן משימות נבחרות
  const selectedTasksTime = useMemo(() => {
    return unfinishedTasks
      .filter(t => selectedTasks.has(t.id))
      .reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
  }, [unfinishedTasks, selectedTasks]);

  // בחירת/ביטול בחירת משימה
  const toggleTask = (taskId) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // בחירת הכל
  const selectAll = () => {
    setSelectedTasks(new Set(unfinishedTasks.map(t => t.id)));
  };

  // ביטול הכל
  const deselectAll = () => {
    setSelectedTasks(new Set());
  };

  // העברת משימות
  const handleMove = async () => {
    if (selectedTasks.size === 0) return;
    
    setMoving(true);
    
    const newDate = targetDate === 'today' 
      ? getDateISO(new Date())
      : targetDate === 'tomorrow'
        ? getDateISO(getTomorrow())
        : targetDate;

    try {
      const tasksToMove = unfinishedTasks.filter(t => selectedTasks.has(t.id));
      
      for (const task of tasksToMove) {
        await editTask(task.id, {
          dueDate: newDate,
          dueTime: null // מאפס את השעה - ישובץ מחדש
        });
      }
      
      await loadTasks();
      toast.success(`${tasksToMove.length} משימות הועברו בהצלחה!`);
      
      if (onTasksMoved) onTasksMoved();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה בהעברה:', err);
      toast.error('שגיאה בהעברת המשימות');
    } finally {
      setMoving(false);
    }
  };

  // מחיקת משימות ישנות
  const handleDismiss = () => {
    setDismissed(true);
    if (onClose) onClose();
  };

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // פורמט תאריך
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = getYesterday();
    
    if (dateStr === getDateISO(yesterday)) {
      return 'אתמול';
    }
    
    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      return `לפני ${diffDays} ימים`;
    }
    
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  // אם אין משימות או כבר נסגר
  if (unfinishedTasks.length === 0 || dismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-4 mb-4 border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
    >
      {/* כותרת */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
          <span>🔄</span>
          משימות שלא הושלמו ({unfinishedTasks.length})
        </h3>
        <button
          onClick={handleDismiss}
          className="text-orange-400 hover:text-orange-600 p-1"
          title="סגור"
        >
          ✕
        </button>
      </div>

      {/* רשימת משימות */}
      <div className="max-h-48 overflow-y-auto mb-3 space-y-2">
        {unfinishedTasks.map(task => {
          const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
          const isSelected = selectedTasks.has(task.id);
          
          return (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`
                p-2 rounded-lg cursor-pointer transition-all flex items-center gap-3
                ${isSelected 
                  ? 'bg-orange-200 dark:bg-orange-800/50 ring-2 ring-orange-400' 
                  : 'bg-white dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                }
              `}
            >
              {/* צ'קבוקס */}
              <div className={`
                w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                ${isSelected 
                  ? 'bg-orange-500 border-orange-500 text-white' 
                  : 'border-gray-300 dark:border-gray-600'
                }
              `}>
                {isSelected && <span className="text-xs">✓</span>}
              </div>

              {/* פרטי משימה */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${taskType.color}`}>
                    {taskType.icon}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {task.title}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatDate(task.due_date)} • {formatMinutes(task.estimated_duration || 30)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* כפתורי בחירה */}
      <div className="flex gap-2 mb-3 text-sm">
        <button
          onClick={selectAll}
          className="text-orange-600 dark:text-orange-400 hover:underline"
        >
          בחר הכל
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={deselectAll}
          className="text-orange-600 dark:text-orange-400 hover:underline"
        >
          נקה בחירה
        </button>
        {selectedTasks.size > 0 && (
          <span className="text-gray-500 dark:text-gray-400 mr-auto">
            נבחרו: {selectedTasks.size} ({formatMinutes(selectedTasksTime)})
          </span>
        )}
      </div>

      {/* בחירת יעד */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          להעביר ל:
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTargetDate('today')}
            className={`
              p-2 rounded-lg border-2 text-sm transition-all
              ${targetDate === 'today'
                ? 'border-orange-500 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
              }
            `}
          >
            <div className="font-medium">היום</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatMinutes(todayFreeTime)} פנוי
            </div>
          </button>
          
          <button
            onClick={() => setTargetDate('tomorrow')}
            className={`
              p-2 rounded-lg border-2 text-sm transition-all
              ${targetDate === 'tomorrow'
                ? 'border-orange-500 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
              }
            `}
          >
            <div className="font-medium">מחר</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatMinutes(tomorrowFreeTime)} פנוי
            </div>
          </button>
        </div>
      </div>

      {/* אזהרה אם אין מספיק זמן */}
      {selectedTasksTime > 0 && (
        (targetDate === 'today' && selectedTasksTime > todayFreeTime) ||
        (targetDate === 'tomorrow' && selectedTasksTime > tomorrowFreeTime)
      ) && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          ⚠️ המשימות הנבחרות ({formatMinutes(selectedTasksTime)}) חורגות מהזמן הפנוי
        </div>
      )}

      {/* כפתורי פעולה */}
      <div className="flex gap-2">
        <button
          onClick={handleMove}
          disabled={selectedTasks.size === 0 || moving}
          className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {moving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              מעביר...
            </span>
          ) : (
            `העבר ${selectedTasks.size > 0 ? selectedTasks.size + ' משימות' : ''}`
          )}
        </button>
        
        <button
          onClick={handleDismiss}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          אח"כ
        </button>
      </div>

      {/* הסבר */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
        💡 המשימות יועברו ללא שעה מוגדרת - תוכלי לשבץ אותן עם השיבוץ האוטומטי
      </p>
    </motion.div>
  );
}

export default UnfinishedTasksHandler;
