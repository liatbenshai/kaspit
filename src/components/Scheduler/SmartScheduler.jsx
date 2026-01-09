import { useState, useMemo } from 'react';
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
 * יחידת זמן מינימלית (בדקות)
 */
const TIME_SLOT = 15;

/**
 * קבלת תאריך בפורמט ISO
 */
function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * המרת שעה לדקות מתחילת היום
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + (mins || 0);
}

/**
 * המרת דקות לשעה
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * עיגול דקות ל-TIME_SLOT הקרוב (כלפי מעלה)
 */
function roundUpToSlot(minutes) {
  return Math.ceil(minutes / TIME_SLOT) * TIME_SLOT;
}

/**
 * שיבוץ אוטומטי חכם
 */
function SmartScheduler({ selectedDate, onClose, onScheduled }) {
  const { tasks, editTask, loadTasks } = useTasks();
  const [scheduling, setScheduling] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // משימות לא משובצות (ללא תאריך או שעה)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.is_completed) return false;
      // משימה לא משובצת = אין לה תאריך, או אין לה שעה
      if (!task.due_date) return true;
      if (!task.due_time) return true;
      return false;
    });
  }, [tasks]);

  // משימות משובצות ליום הנבחר (עם שעה!)
  const scheduledForDay = useMemo(() => {
    const dateISO = getDateISO(selectedDate);
    return tasks.filter(task => {
      if (task.is_completed) return false;
      return task.due_date === dateISO && task.due_time;
    });
  }, [tasks, selectedDate]);

  // חישוב זמנים תפוסים ביום (כמערך של {start, end} בדקות)
  const occupiedSlots = useMemo(() => {
    return scheduledForDay.map(task => {
      const startMinutes = timeToMinutes(task.due_time);
      const duration = task.estimated_duration || 30;
      return {
        start: startMinutes,
        end: startMinutes + duration,
        task
      };
    }).sort((a, b) => a.start - b.start);
  }, [scheduledForDay]);

  // חישוב זמנים פנויים ביום
  const freeSlots = useMemo(() => {
    const slots = [];
    const dayStart = WORK_HOURS.start * 60;
    const dayEnd = WORK_HOURS.end * 60;
    
    let currentTime = dayStart;
    
    for (const occupied of occupiedSlots) {
      // אם יש רווח לפני המשימה הבאה
      if (currentTime < occupied.start) {
        const gapDuration = occupied.start - currentTime;
        if (gapDuration >= TIME_SLOT) {
          slots.push({
            start: currentTime,
            end: occupied.start,
            duration: gapDuration
          });
        }
      }
      // מעדכנים את הזמן הנוכחי לסוף המשימה
      currentTime = Math.max(currentTime, occupied.end);
    }
    
    // רווח אחרי המשימה האחרונה עד סוף היום
    if (currentTime < dayEnd) {
      const gapDuration = dayEnd - currentTime;
      if (gapDuration >= TIME_SLOT) {
        slots.push({
          start: currentTime,
          end: dayEnd,
          duration: gapDuration
        });
      }
    }
    
    return slots;
  }, [occupiedSlots]);

  // חישוב סה"כ זמן פנוי
  const totalFreeTime = useMemo(() => {
    return freeSlots.reduce((sum, slot) => sum + slot.duration, 0);
  }, [freeSlots]);

  // חישוב סה"כ זמן משימות לא משובצות
  const totalUnscheduledTime = useMemo(() => {
    return unscheduledTasks.reduce((sum, task) => sum + (task.estimated_duration || 30), 0);
  }, [unscheduledTasks]);

  // אלגוריתם שיבוץ משופר
  const calculateSchedule = () => {
    const schedule = [];
    
    // עותק עמוק של החלונות הפנויים
    const availableSlots = freeSlots.map(slot => ({ ...slot }));
    
    // מיון משימות: קצרות קודם (Best Fit)
    const tasksToSchedule = [...unscheduledTasks].sort((a, b) => {
      return (a.estimated_duration || 30) - (b.estimated_duration || 30);
    });

    for (const task of tasksToSchedule) {
      const duration = roundUpToSlot(task.estimated_duration || 30);
      
      // מציאת החלון הקטן ביותר שמתאים (Best Fit)
      let bestSlotIndex = -1;
      let bestSlotSize = Infinity;
      
      for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        if (slot.duration >= duration && slot.duration < bestSlotSize) {
          bestSlotIndex = i;
          bestSlotSize = slot.duration;
        }
      }
      
      if (bestSlotIndex !== -1) {
        const slot = availableSlots[bestSlotIndex];
        
        // שיבוץ המשימה
        schedule.push({
          task,
          time: minutesToTime(slot.start),
          date: getDateISO(selectedDate),
          duration
        });

        // עדכון החלון
        if (slot.duration === duration) {
          // החלון נוצל במלואו - מסירים
          availableSlots.splice(bestSlotIndex, 1);
        } else {
          // מעדכנים את תחילת החלון
          slot.start += duration;
          slot.duration -= duration;
        }
      }
    }

    // מיון לפי שעה
    return schedule.sort((a, b) => a.time.localeCompare(b.time));
  };

  // תצוגה מקדימה
  const handlePreview = () => {
    const schedule = calculateSchedule();
    setScheduledTasks(schedule);
    setShowPreview(true);
  };

  // ביצוע השיבוץ
  const handleSchedule = async () => {
    if (scheduledTasks.length === 0) return;
    
    setScheduling(true);
    try {
      for (const item of scheduledTasks) {
        await editTask(item.task.id, {
          dueDate: item.date,
          dueTime: item.time
        });
      }
      
      await loadTasks();
      toast.success(`${scheduledTasks.length} משימות שובצו בהצלחה!`);
      
      if (onScheduled) onScheduled();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה בשיבוץ:', err);
      toast.error('שגיאה בשיבוץ המשימות');
    } finally {
      setScheduling(false);
    }
  };

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* סיכום מצב */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {unscheduledTasks.length}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            משימות לשיבוץ
          </div>
          <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
            ({formatMinutes(totalUnscheduledTime)})
          </div>
        </div>
        
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatMinutes(totalFreeTime)}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            זמן פנוי היום
          </div>
          <div className="text-xs text-green-500 dark:text-green-400 mt-1">
            ({freeSlots.length} חלונות)
          </div>
        </div>
      </div>

      {/* חלונות זמן פנויים */}
      {freeSlots.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🕐 חלונות זמן פנויים:
          </h4>
          <div className="flex flex-wrap gap-2">
            {freeSlots.map((slot, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600"
              >
                {minutesToTime(slot.start)} - {minutesToTime(slot.end)} ({formatMinutes(slot.duration)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* משימות שכבר משובצות */}
      {scheduledForDay.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📋 כבר משובצות היום ({scheduledForDay.length}):
          </h4>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {scheduledForDay.map(task => {
              const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
              return (
                <div key={task.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{task.due_time}</span>
                  <span>{taskType.icon}</span>
                  <span className="truncate">{task.title}</span>
                  <span className="text-gray-400">({formatMinutes(task.estimated_duration || 30)})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* אזהרות */}
      {totalUnscheduledTime > totalFreeTime && (
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-700 dark:text-orange-300 text-sm">
          ⚠️ יש יותר משימות ({formatMinutes(totalUnscheduledTime)}) מזמן פנוי ({formatMinutes(totalFreeTime)}). חלק מהמשימות לא ישובצו.
        </div>
      )}

      {unscheduledTasks.length === 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 text-sm text-center">
          ✅ כל המשימות כבר משובצות!
        </div>
      )}

      {freeSlots.length === 0 && unscheduledTasks.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm text-center">
          ❌ אין זמן פנוי ביום הזה. נסי יום אחר.
        </div>
      )}

      {/* תצוגה מקדימה */}
      <AnimatePresence>
        {showPreview && scheduledTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white">
                📋 תצוגה מקדימה - {scheduledTasks.length} משימות
              </h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {scheduledTasks.map((item, index) => {
                const taskType = TASK_TYPES[item.task.task_type] || TASK_TYPES.other;
                const endTime = timeToMinutes(item.time) + item.duration;
                return (
                  <div
                    key={index}
                    className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-sm ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {item.task.title}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium">{item.time}</span>
                      <span className="text-gray-400"> - {minutesToTime(endTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* כפתורים */}
      <div className="flex gap-2">
        {!showPreview ? (
          <button
            onClick={handlePreview}
            disabled={unscheduledTasks.length === 0 || freeSlots.length === 0}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔍 תצוגה מקדימה
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowPreview(false)}
              className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← חזרה
            </button>
            <button
              onClick={handleSchedule}
              disabled={scheduling || scheduledTasks.length === 0}
              className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scheduling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  משבץ...
                </span>
              ) : (
                `✅ שבץ ${scheduledTasks.length} משימות`
              )}
            </button>
          </>
        )}
      </div>

      {/* הסבר */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        💡 המערכת משבצת משימות לחלונות הפנויים בלבד, ללא חפיפות
      </div>
    </div>
  );
}

export default SmartScheduler;
