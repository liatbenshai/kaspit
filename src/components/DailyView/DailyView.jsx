import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import { TASK_TYPES } from '../../config/taskTypes';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import RescheduleModal from './RescheduleModal';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { sortTasksByOrder, saveTaskOrder } from '../../utils/taskOrder';
import { calculateAutoReschedule, executeAutoReschedule } from '../../utils/autoRescheduleDaily';
import toast from 'react-hot-toast';

// ===============================
// Drag & Drop State
// ===============================
let draggedTaskData = null;

/**
 * סוגי משימות - מיובאים עכשיו מ-config/taskTypes.js
 * הקוד הישן הוסר למניעת כפילות
 */

/**
 * שעות עבודה קבועות
 */
const WORK_HOURS = {
  start: 8.5, // 08:30
  end: 16.25,  // 16:15
  totalMinutes: 7.75 * 60 // 465 דקות
};

/**
 * שעות בית/משפחה
 */
const HOME_HOURS = {
  start: 17, // 17:00
  end: 21,   // 21:00
  totalMinutes: 4 * 60 // 240 דקות
};

/**
 * שעות בית בסופ"ש (גמיש)
 */
const WEEKEND_HOME_HOURS = {
  start: 8,  // 08:00
  end: 22,   // 22:00
  totalMinutes: 14 * 60 // 840 דקות
};

/**
 * קבלת שעות היום לפי תאריך
 */
function getDaySchedule(date) {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // שישי או שבת
  
  if (isWeekend) {
    return {
      type: 'home',
      label: 'שעות בית',
      hours: WEEKEND_HOME_HOURS,
      startStr: '08:00',
      endStr: '22:00',
      isWorkDay: false,
      isHomeDay: true
    };
  }
  
  // ימים א'-ה' - יש גם עבודה וגם בית
  return {
    type: 'work',
    label: 'שעות עבודה',
    hours: WORK_HOURS,
    startStr: '08:30',
    endStr: '16:15',
    isWorkDay: true,
    isHomeDay: true,
    homeHours: HOME_HOURS
  };
}

/**
 * המרה לתאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * קבלת התאריך בפורמט ישראלי
 */
function getDateHebrew(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return {
    full: `יום ${dayName}, ${day} ב${month} ${year}`,
    short: `${day}/${date.getMonth() + 1}`,
    dayName
  };
}

/**
 * ✅ תיקון: קבלת תאריך בפורמט ISO מקומי (לא UTC!)
 */
function getDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * בדיקה אם התאריך הוא היום
 */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * חישוב תחילת השבוע (יום ראשון)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * פורמט דקות לשעות:דקות
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דק\'';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} דק'`;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${String(mins).padStart(2, '0')} שעות`;
}

// =====================================
// Google Icon Component
// =====================================
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/**
 * תצוגת יום עבודה - מסך ראשי חדש
 * ✅ כולל גרירה לשינוי סדר משימות
 * ✅ כולל סנכרון יומן גוגל
 */
function DailyView() {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks, editTask } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [dragOverTime, setDragOverTime] = useState(null);
  const [taskOrder, setTaskOrder] = useState([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null); // ✅ משימה מודגשת
  const timelineRef = useRef(null);
  
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  const { 
    isConnected: isGoogleConnected, 
    isLoading: isGoogleLoading,
    isSyncing: isGoogleSyncing,
    syncGoogleEvents,
    exportTasks: exportToGoogle,
  } = useGoogleCalendar();
  
  const [showGoogleMenu, setShowGoogleMenu] = useState(false);
  
  // ✅ בדיקה אם יש משימה להפעלה מהתראה
  useEffect(() => {
    const startTaskId = localStorage.getItem('start_task_id');
    if (startTaskId) {
      setHighlightedTaskId(startTaskId);
      localStorage.removeItem('start_task_id');
      toast.success('🎯 משימה נבחרה - לחצי על ▶️ להתחיל!');
      
      // גלילה למשימה אחרי טעינה
      setTimeout(() => {
        const taskElement = document.getElementById(`task-${startTaskId}`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      // הסרת ההדגשה אחרי 5 שניות
      setTimeout(() => setHighlightedTaskId(null), 5000);
    }
  }, []);
  
  useEffect(() => {
    const syncGoogleForDate = async () => {
      if (!isGoogleConnected || isGoogleLoading || !user?.id) return;
      
      try {
        const result = await syncGoogleEvents(selectedDate, user.id, null, tasks);
        if (result.imported > 0 || result.updated > 0) {
          await loadTasks();
        }
      } catch (err) {
        console.error('שגיאה בסנכרון גוגל:', err);
      }
    };
    
    syncGoogleForDate();
  }, [selectedDate, isGoogleConnected, isGoogleLoading, user?.id]);
  
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return {
      minutes: now.getHours() * 60 + now.getMinutes(),
      dateISO: getDateISO(now)
    };
  });
  
  const [rescheduleInfo, setRescheduleInfo] = useState(null);
  const [isAutoRescheduling, setIsAutoRescheduling] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        minutes: now.getHours() * 60 + now.getMinutes(),
        dateISO: getDateISO(now)
      });
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      setRescheduleInfo(null);
      return;
    }
    
    const todayISO = getDateISO(new Date());
    if (getDateISO(selectedDate) !== todayISO) {
      setRescheduleInfo(null);
      return;
    }
    
    const info = calculateAutoReschedule(tasks, editTask);
    setRescheduleInfo(info);
  }, [tasks, selectedDate, currentTime.minutes]);

  const handleAutoReschedule = async () => {
    if (!rescheduleInfo) return;
    
    setIsAutoRescheduling(true);
    
    try {
      const result = await executeAutoReschedule(editTask, rescheduleInfo);
      
      if (result.movedToTomorrow > 0) {
        toast.success(`📅 ${result.movedToTomorrow} משימות הועברו למחר`);
      }
      if (result.movedToToday > 0) {
        toast.success(`✨ ${result.movedToToday} משימות נמשכו להיום`);
      }
      
      loadTasks();
    } catch (err) {
      console.error('Error in auto-reschedule:', err);
      toast.error('שגיאה בדחיית משימות');
    } finally {
      setIsAutoRescheduling(false);
    }
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // ✅ כאן השינוי העיקרי - משתמש ב-smartScheduleWeekV4!
  const weekPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const weekStart = getWeekStart(selectedDate);
    
    const intervals = tasks.filter(t => t.parent_task_id && !t.is_completed);
    if (intervals.length > 0) {
      intervals.forEach(t => {
      });
    }
    
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, selectedDate]);

  const selectedDayData = useMemo(() => {
    if (!weekPlan) return { blocks: [], tasks: [] };
    
    const dateISO = getDateISO(selectedDate);
    const dayPlan = weekPlan.days.find(d => d.date === dateISO);
    
    if (!dayPlan) {
      return { blocks: [], tasks: [] };
    }
    
    return {
      blocks: dayPlan.blocks || [],
      usagePercent: dayPlan.usagePercent || 0,
      plannedMinutes: dayPlan.plannedMinutes || 0,
      completedMinutes: dayPlan.completedMinutes || 0
    };
  }, [weekPlan, selectedDate]);

  const isViewingToday = getDateISO(selectedDate) === currentTime.dateISO;
  
  const timeStats = useMemo(() => {
    const blocks = selectedDayData.blocks || [];
    
    const checkTimerRunning = (block) => {
      const taskId = block.taskId || block.task?.id || block.id;
      if (!taskId) return false;
      try {
        const timerData = localStorage.getItem(`timer_v2_${taskId}`);
        if (timerData) {
          const parsed = JSON.parse(timerData);
          return parsed.isRunning && !parsed.isInterrupted;
        }
      } catch (e) {}
      return false;
    };
    
    const blockHasPassed = (block) => {
      if (!isViewingToday) return false;
      if (!block.endTime) return false;
      if (checkTimerRunning(block)) return false;
      const [hour, min] = block.endTime.split(':').map(Number);
      return (hour * 60 + (min || 0)) < currentTime.minutes;
    };
    
    const completedMinutes = blocks
      .filter(b => b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    // ✅ תיקון: חישוב הזמן שנותר (duration - time_spent) ולא הזמן המוערך המקורי
    const pendingMinutes = blocks
      .filter(b => !b.isCompleted)
      .reduce((sum, b) => {
        const estimated = b.duration || 0;
        const spent = b.task?.time_spent || b.timeSpent || 0;
        const remaining = Math.max(0, estimated - spent);
        return sum + remaining;
      }, 0);
    
    // ✅ תיקון: חישוב הזמן שנותר גם למשימות באיחור
    const overdueMinutes = blocks
      .filter(b => !b.isCompleted && blockHasPassed(b))
      .reduce((sum, b) => {
        const estimated = b.duration || 0;
        const spent = b.task?.time_spent || b.timeSpent || 0;
        const remaining = Math.max(0, estimated - spent);
        return sum + remaining;
      }, 0);
    
    // ✅ תיקון: גישה נכונה ל-time_spent דרך המשימה
    const inProgressMinutes = blocks
      .filter(b => !b.isCompleted && (b.task?.time_spent || b.timeSpent || 0) > 0)
      .reduce((sum, b) => sum + (b.task?.time_spent || b.timeSpent || 0), 0);
    
    // ✅ תיקון: שימוש בשעות דינמיות לפי היום
    const daySchedule = getDaySchedule(selectedDate);
    const dayHours = daySchedule.hours;
    
    const endOfDayMinutes = dayHours.end * 60;
    const minutesLeftInDay = isViewingToday 
      ? Math.max(0, endOfDayMinutes - currentTime.minutes)
      : dayHours.totalMinutes;
    
    // ✅ תיקון: אחרי שתיקנו את pendingMinutes לחשב זמן שנותר, החישוב פשוט יותר
    // pendingMinutes כבר מכיל את הזמן שנותר (estimated - spent), לא צריך להוסיף inProgressMinutes
    const freeMinutes = Math.max(0, minutesLeftInDay - pendingMinutes);
    
    return {
      completed: completedMinutes,
      pending: pendingMinutes,
      overdue: overdueMinutes,
      inProgress: inProgressMinutes,
      remaining: freeMinutes,
      minutesLeftInDay: minutesLeftInDay,
      total: dayHours.totalMinutes,
      usedPercent: Math.round((completedMinutes / dayHours.totalMinutes) * 100),
      canFitAll: pendingMinutes <= minutesLeftInDay
    };
  }, [selectedDayData, isViewingToday, currentTime.minutes, selectedDate]);

  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    const originalTask = tasks.find(t => t.id === task.taskId || t.id === task.id);
    setEditingTask(originalTask || task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    loadTasks();
  };

  const handleSyncWithGoogle = async () => {
    if (!isGoogleConnected || !user?.id) return;
    
    try {
      const result = await syncGoogleEvents(selectedDate, user.id, null, tasks);
      if (result.imported > 0 || result.updated > 0) {
        await loadTasks();
      }
    } catch (err) {
      console.error('שגיאה בסנכרון:', err);
    }
  };

  const handleDragStart = (task, e) => {
    draggedTaskData = task;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragEnd = () => {
    draggedTaskData = null;
    setDragOverTime(null);
  };

  const handleDragOverTimeline = (e) => {
    e.preventDefault();
    if (!timelineRef.current || !draggedTaskData) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    
    const totalMinutes = 8 * 60;
    const minutesFromStart = Math.round(percentage * totalMinutes);
    const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
    
    const hour = 8 + Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    setDragOverTime(timeStr);
  };

  const handleDropOnTimeline = async (e) => {
    e.preventDefault();
    
    if (!draggedTaskData || !dragOverTime) {
      handleDragEnd();
      return;
    }

    try {
      await editTask(draggedTaskData.id, {
        due_time: dragOverTime,
        due_date: getDateISO(selectedDate)
      });
      
      toast.success(`המשימה הועברה לשעה ${dragOverTime}`);
      loadTasks();
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      handleDragEnd();
    }
  };

  const handleReorderDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.target.style.opacity = '0.5';
  };

  const handleReorderDragEnd = (e) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (e.target) {
      e.target.style.opacity = '1';
    }
  };

  const handleReorderDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  // ✅ תיקון: עדכון due_time בדאטאבייס אחרי שינוי סדר - כדי שההתראות יעבדו נכון!
  const handleReorderDrop = async (e, toIndex, blocksArray) => {
    e.preventDefault();
    e.stopPropagation();
    
    const fromIndex = draggedIndex;
    
    if (fromIndex === null || fromIndex === toIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // יצירת סדר חדש
    const currentOrder = blocksArray.map(b => b.taskId || b.id);
    const newOrder = [...currentOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    
    const dateISO = getDateISO(selectedDate);
    saveTaskOrder(dateISO, newOrder);
    setTaskOrder(newOrder);
    
    // ✅ חדש: עדכון due_time בדאטאבייס לכל משימה לפי הסדר החדש
    try {
      // חישוב זמנים חסומים מאירועי גוגל (כדי לדלג עליהם)
      const googleBlocks = blocksArray.filter(b => 
        b.isFromGoogle || b.is_from_google || b.isGoogleEvent
      );
      const blockedTimes = googleBlocks.map(block => {
        const startTime = (block.startTime || '00:00').split(':').map(Number);
        const endTime = (block.endTime || '00:00').split(':').map(Number);
        return {
          start: startTime[0] * 60 + (startTime[1] || 0),
          end: endTime[0] * 60 + (endTime[1] || 0)
        };
      }).sort((a, b) => a.start - b.start);
      
      // פונקציה למציאת סלוט פנוי (דילוג על אירועי גוגל)
      const findFreeSlot = (startFrom, duration) => {
        let proposedStart = startFrom;
        for (const blocked of blockedTimes) {
          const proposedEnd = proposedStart + duration;
          if (proposedStart < blocked.end && proposedEnd > blocked.start) {
            proposedStart = blocked.end + 5; // 5 דקות אחרי אירוע גוגל
          }
        }
        return proposedStart;
      };
      
      // סינון רק משימות רגילות (לא גוגל) בסדר החדש
      const regularBlocksInNewOrder = newOrder
        .map(id => blocksArray.find(b => (b.taskId || b.id) === id))
        .filter(block => block && !block.isFromGoogle && !block.is_from_google && !block.isGoogleEvent);
      
      // חישוב זמנים חדשים
      const daySchedule = getDaySchedule(selectedDate);
      let nextStartMinutes = isViewingToday 
        ? currentTime.minutes 
        : daySchedule.hours.start * 60;
      
      // עדכון כל משימה עם הזמן החדש שלה
      for (const block of regularBlocksInNewOrder) {
        const duration = block.duration || block.estimated_duration || 30;
        const startMinutes = findFreeSlot(nextStartMinutes, duration);
        const hours = Math.floor(startMinutes / 60);
        const mins = startMinutes % 60;
        const newDueTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        const taskId = block.taskId || block.id;
        await editTask(taskId, { due_time: newDueTime });
        
        nextStartMinutes = startMinutes + duration + 5; // 5 דקות הפסקה
      }
      
      toast.success('🔄 הסדר והזמנים עודכנו');
      await loadTasks(); // רענון הנתונים
    } catch (err) {
      console.error('שגיאה בעדכון זמנים:', err);
      toast.error('שגיאה בעדכון הזמנים');
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-red-600">
        <p>שגיאה בטעינת משימות: {error}</p>
        <button onClick={loadTasks} className="mt-4 btn btn-primary">
          נסי שוב
        </button>
      </div>
    );
  }

  const isTimerRunning = (taskId) => {
    if (!taskId) return false;
    try {
      const timerData = localStorage.getItem(`timer_v2_${taskId}`);
      if (timerData) {
        const parsed = JSON.parse(timerData);
        return parsed.isRunning && !parsed.isInterrupted;
      }
    } catch (e) {}
    return false;
  };
  
  const isBlockPast = (block) => {
    if (!isViewingToday) return false;
    
    const taskId = block.taskId || block.task?.id || block.id;
    if (isTimerRunning(taskId)) return false;
    
    const task = block.task;
    if (!task?.due_time) return false;
    
    const [hour, min] = task.due_time.split(':').map(Number);
    const taskDueMinutes = hour * 60 + (min || 0);
    return taskDueMinutes < currentTime.minutes;
  };
  
  const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  
  const allBlocks = [...(selectedDayData.blocks || [])].sort((a, b) => {
    if (a.startTime && b.startTime) {
      const aTime = a.startTime.split(':').map(Number);
      const bTime = b.startTime.split(':').map(Number);
      const aMinutes = aTime[0] * 60 + (aTime[1] || 0);
      const bMinutes = bTime[0] * 60 + (bTime[1] || 0);
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    }
    if (a.blockIndex && b.blockIndex) {
      return a.blockIndex - b.blockIndex;
    }
    return 0;
  });
  
  const completedBlocks = allBlocks.filter(b => b.isCompleted);
  let activeBlocks = allBlocks.filter(b => !b.isCompleted);
  
  const getRunningTaskId = () => {
    for (const block of activeBlocks) {
      const taskId = block.taskId || block.task?.id;
      if (taskId) {
        try {
          const timerData = localStorage.getItem(`timer_v2_${taskId}`);
          if (timerData) {
            const parsed = JSON.parse(timerData);
            if (parsed.isRunning && !parsed.isInterrupted) {
              return taskId;
            }
          }
        } catch (e) {}
      }
    }
    return null;
  };
  
  const runningTaskId = getRunningTaskId();
  
  if (runningTaskId) {
    const runningIndex = activeBlocks.findIndex(b => 
      (b.taskId || b.task?.id) === runningTaskId
    );
    if (runningIndex > 0) {
      const [runningBlock] = activeBlocks.splice(runningIndex, 1);
      activeBlocks.unshift(runningBlock);
    }
  }
  
  const dateISO = getDateISO(selectedDate);
  
  const googleTasks = activeBlocks.filter(b => b.is_from_google || b.task?.is_from_google || b.isGoogleEvent);
  const regularBlocks = activeBlocks.filter(b => !b.is_from_google && !b.task?.is_from_google && !b.isGoogleEvent);
  
  let sortedRegularBlocks = sortTasksByOrder(regularBlocks.map(b => ({
    ...b,
    id: b.taskId || b.id,
    parentId: b.parentId || b.task?.parent_task_id,
    blockIndex: b.blockIndex,
    isRunning: isTimerRunning(b.taskId || b.task?.id || b.id)
  })), dateISO);
  
  // ✅ יצירת רשימת זמנים חסומים מאירועי גוגל
  const googleBlockedTimes = googleTasks.map(block => {
    const startTime = block.startTime?.split(':').map(Number) || [0, 0];
    const endTime = block.endTime?.split(':').map(Number) || [0, 0];
    return {
      start: startTime[0] * 60 + startTime[1],
      end: endTime[0] * 60 + endTime[1]
    };
  }).sort((a, b) => a.start - b.start);
  
  // ✅ פונקציה שמוצאת את הזמן הפנוי הבא (דילוג על אירועי גוגל)
  const findNextFreeSlot = (startFrom, duration) => {
    let proposedStart = startFrom;
    
    for (const blocked of googleBlockedTimes) {
      const proposedEnd = proposedStart + duration;
      
      // בדיקת חפיפה - אם המשימה המוצעת חופפת לאירוע גוגל
      if (proposedStart < blocked.end && proposedEnd > blocked.start) {
        // יש חפיפה - נתחיל אחרי האירוע הזה
        proposedStart = blocked.end + 5; // 5 דקות הפסקה אחרי אירוע גוגל
      }
    }
    
    return proposedStart;
  };
  
  // ✅ תיקון: שימוש בשעות דינמיות לפי היום
  const currentDaySchedule = getDaySchedule(selectedDate);
  let nextStartMinutes = isViewingToday ? currentTime.minutes : currentDaySchedule.hours.start * 60;
  
  const rescheduledRegularBlocks = sortedRegularBlocks.map(block => {
    const duration = block.duration || 30;
    // ✅ מציאת סלוט פנוי שלא חופף לאירועי גוגל
    const startMinutes = findNextFreeSlot(nextStartMinutes, duration);
    const endMinutes = startMinutes + duration;
    const wasPostponed = isBlockPast(block);
    nextStartMinutes = endMinutes + 5;
    
    return {
      ...block,
      originalStartTime: block.startTime,
      originalEndTime: block.endTime,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      isPostponed: wasPostponed,
      isRescheduled: wasPostponed
    };
  });
  
  const googleTasksWithTimes = googleTasks.map(block => ({
    ...block,
    isPostponed: false,
    isRescheduled: false,
    isFromGoogle: true
  }));
  
  const rescheduledBlocks = [...rescheduledRegularBlocks, ...googleTasksWithTimes].sort((a, b) => {
    const aTime = a.startTime?.split(':').map(Number) || [0, 0];
    const bTime = b.startTime?.split(':').map(Number) || [0, 0];
    return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
  });
  
  const overdueBlocks = rescheduledBlocks.filter(b => b.isPostponed);
  const upcomingBlocks = rescheduledBlocks.filter(b => !b.isPostponed);

  const renderDraggableCard = (block, index, blocksArray) => {
    const isFromGoogle = block.isFromGoogle || block.is_from_google || block.task?.is_from_google || block.isGoogleEvent;
    
    return (
    <motion.div
      key={block.id || block.taskId || `block-${index}`}
      id={`task-${block.taskId || block.id}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: draggedIndex === index ? 0.5 : 1, 
        y: 0,
        scale: dragOverIndex === index ? 1.02 : 1
      }}
      className={`
        relative
        ${dragOverIndex === index ? 'ring-2 ring-blue-500 ring-dashed rounded-xl' : ''}
        ${isFromGoogle ? 'ring-1 ring-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''}
        ${highlightedTaskId === (block.taskId || block.id) ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 animate-pulse' : ''}
      `}
      draggable={!isFromGoogle}
      onDragStart={(e) => !isFromGoogle && handleReorderDragStart(e, index)}
      onDragEnd={handleReorderDragEnd}
      onDragOver={(e) => handleReorderDragOver(e, index)}
      onDrop={(e) => handleReorderDrop(e, index, blocksArray)}
    >
      {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}
      {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}

      {isFromGoogle && (
        <div className="absolute left-2 top-2 z-20">
          <span className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 px-1.5 py-0.5 rounded-full font-medium">
            📅 גוגל (קבוע)
          </span>
        </div>
      )}

      {!isFromGoogle && (
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 opacity-30 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1">
        <div className="flex flex-col gap-0.5">
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
        </div>
      </div>
      )}

      <DailyTaskCard 
        task={{
          id: block.taskId || block.id,
          title: block.title,
          estimated_duration: block.duration,
          time_spent: block.timeSpent || 0,
          is_completed: block.isCompleted,
          task_type: block.taskType,
          due_time: block.startTime,
          priority: block.priority || 'normal',
          blockIndex: block.blockIndex,
          totalBlocks: block.totalBlocks,
          startTime: block.startTime,
          endTime: block.endTime,
          originalStartTime: block.originalStartTime,
          originalEndTime: block.originalEndTime,
          isPostponed: block.isPostponed,
          isRescheduled: block.isRescheduled,
          isRunning: block.isRunning
        }} 
        onEdit={() => handleEditTask(block)}
        onUpdate={loadTasks}
        showTime={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        draggable={false}
      />
    </motion.div>
  );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          {isGoogleConnected && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>יומן מסונכרן</span>
              {isGoogleSyncing && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600" />
              )}
            </div>
          )}
          
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              חזרה להיום
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
            title="היום הקודם"
          >
            ▶
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getDateHebrew(selectedDate).full}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {getHebrewDate(selectedDate)}
            </p>
            {isToday(selectedDate) && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                היום
              </span>
            )}
          </div>
          
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
            title="היום הבא"
          >
            ◀
          </button>
        </div>
        
        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-sm">
          {(() => {
            const schedule = getDaySchedule(selectedDate);
            return `${schedule.label}: ${schedule.startStr} - ${schedule.endStr}`;
          })()}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {isToday(selectedDate) ? 'זמן פנוי' : 'זמן מתוכנן'}: {formatMinutes(timeStats.remaining)}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isViewingToday && `נותרו ${formatMinutes(timeStats.minutesLeftInDay)} עד סוף היום`}
          </span>
        </div>
        
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(timeStats.completed / timeStats.total) * 100}%` }}
              title={`הושלם: ${formatMinutes(timeStats.completed)}`}
            />
            <div 
              className="bg-orange-500 transition-all duration-500"
              style={{ width: `${(timeStats.pending / timeStats.total) * 100}%` }}
              title={`ממתין: ${formatMinutes(timeStats.pending)}`}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>הושלם ({formatMinutes(timeStats.completed)})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>ממתין ({formatMinutes(timeStats.pending)})</span>
          </div>
          {timeStats.overdue > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <span>🔄 נדחה: {formatMinutes(timeStats.overdue)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span>פנוי ({formatMinutes(timeStats.remaining)})</span>
          </div>
        </div>

        {rescheduleInfo && rescheduleInfo.tasksToMoveToTomorrow.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-red-700 dark:text-red-400 text-sm font-medium mb-2">
              ⚠️ לא יספיק! צריך {formatMinutes(rescheduleInfo.timeNeededToday + rescheduleInfo.tasksToMoveToTomorrow.reduce((sum, t) => sum + (t.estimated_duration || 30), 0))} אבל נשארו רק {formatMinutes(rescheduleInfo.remainingWorkToday)} ב{getDaySchedule(selectedDate).label}
            </div>
            
            <div className="text-xs text-red-600 dark:text-red-300 mb-2">
              <p className="font-medium mb-1">📋 משימות שיועברו למחר:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                {rescheduleInfo.tasksToMoveToTomorrow.slice(0, 3).map(task => (
                  <li key={task.id}>{task.title} ({task.estimated_duration || 30} דק')</li>
                ))}
                {rescheduleInfo.tasksToMoveToTomorrow.length > 3 && (
                  <li>ועוד {rescheduleInfo.tasksToMoveToTomorrow.length - 3} משימות...</li>
                )}
              </ul>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAutoReschedule}
                disabled={isAutoRescheduling}
                className="flex-1 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAutoRescheduling ? (
                  <>⏳ מעביר...</>
                ) : (
                  <>🚀 העבר אוטומטית למחר ({rescheduleInfo.tasksToMoveToTomorrow.length})</>
                )}
              </button>
              <button
                onClick={() => setShowRescheduleModal(true)}
                className="px-3 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                בחירה ידנית
              </button>
            </div>
          </div>
        )}
        
        {/* ✅ חדש: התראה על משימות שחורגות מסוף היום */}
        {rescheduleInfo && rescheduleInfo.tasksOverflowingEndOfDay && rescheduleInfo.tasksOverflowingEndOfDay.length > 0 && (
          <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
            <div className="text-orange-700 dark:text-orange-400 text-sm font-medium mb-2">
              ⏰ {rescheduleInfo.tasksOverflowingEndOfDay.length} משימות חורגות מ-{getDaySchedule(selectedDate).endStr}!
            </div>
            
            <div className="text-xs text-orange-600 dark:text-orange-300 mb-2">
              <ul className="space-y-1">
                {rescheduleInfo.tasksOverflowingEndOfDay.map(task => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {task.priority === 'urgent' ? 'דחוף' : 'רגיל'}
                    </span>
                    <span>{task.title}</span>
                    <span className="text-orange-500">
                      (+{task.overflowMinutes} דק' אחרי {getDaySchedule(selectedDate).endStr})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="text-xs text-orange-500 dark:text-orange-400 mt-2">
              💡 אפשרויות: לעבוד שעות נוספות, להעביר למחר, או לבטל משימה
            </div>
          </div>
        )}

        {rescheduleInfo && rescheduleInfo.tasksToMoveToToday.length > 0 && rescheduleInfo.tasksToMoveToTomorrow.length === 0 && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-green-700 dark:text-green-400 text-sm font-medium mb-2">
              ✨ יש מקום! {formatMinutes(rescheduleInfo.freeTimeToday)} פנויות - אפשר למשוך משימות ממחר
            </div>
            
            <div className="text-xs text-green-600 dark:text-green-300 mb-2">
              <p className="font-medium mb-1">📋 משימות שאפשר להקדים:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                {rescheduleInfo.tasksToMoveToToday.slice(0, 3).map(task => (
                  <li key={task.id}>{task.title} ({task.estimated_duration || 30} דק')</li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={handleAutoReschedule}
              disabled={isAutoRescheduling}
              className="w-full py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAutoRescheduling ? (
                <>⏳ מושך...</>
              ) : (
                <>📥 משוך להיום ({rescheduleInfo.tasksToMoveToToday.length})</>
              )}
            </button>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <Button onClick={handleAddTask} className="w-full py-3 text-lg">
          + משימה חדשה
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-4"
      >
        {allBlocks.length > 0 && (
          <div 
            ref={timelineRef}
            className={`
              w-16 flex-shrink-0 rounded-lg border-2 border-dashed transition-all
              ${dragOverTime 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
              }
            `}
            onDragOver={handleDragOverTimeline}
            onDragLeave={() => setDragOverTime(null)}
            onDrop={handleDropOnTimeline}
          >
            <div className="h-full flex flex-col justify-between py-2 text-xs text-gray-500 dark:text-gray-400">
              {(() => {
                const schedule = getDaySchedule(selectedDate);
                const startHour = schedule.hours.start;
                const endHour = schedule.hours.end;
                const totalHours = endHour - startHour;
                const step = totalHours / 4; // 4 נקודות ביניים
                const times = [];
                for (let i = 0; i <= 4; i++) {
                  const hour = startHour + (step * i);
                  const h = Math.floor(hour);
                  const m = Math.round((hour - h) * 60);
                  times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }
                return times.map((time, i) => (
                  <span key={i} className="text-center">{time}</span>
                ));
              })()}
            </div>
            
            {dragOverTime && (
              <div className="absolute left-0 right-0 bg-blue-500 text-white text-xs py-1 px-2 rounded text-center font-medium">
                {dragOverTime}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 space-y-3">
        {allBlocks.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl mb-4 block">📝</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              אין משימות ל{isToday(selectedDate) ? 'היום' : 'תאריך זה'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              הוסיפי משימה חדשה להתחיל
            </p>
          </div>
        ) : (
          <>
            {overdueBlocks.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-2">
                  🔄 נדחו ({overdueBlocks.length}) - זמנים מעודכנים
                </h3>
                <div className="space-y-2 border-r-4 border-orange-400 pr-2">
                  {overdueBlocks.map((block, index) => renderDraggableCard(block, index, overdueBlocks))}
                </div>
              </div>
            )}

            {upcomingBlocks.length > 0 && (
              <div className="mb-4">
                {overdueBlocks.length > 0 && (
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    📋 ממתינות ({upcomingBlocks.length})
                  </h3>
                )}
                <div className="space-y-2">
                  {upcomingBlocks.map((block, index) => renderDraggableCard(block, index, upcomingBlocks))}
                </div>
                
                {upcomingBlocks.length > 1 && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    💡 גררי משימה כדי לשנות את הסדר
                  </p>
                )}
              </div>
            )}
            
            {completedBlocks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ✅ הושלמו ({completedBlocks.length})
                </h3>
                <div className="space-y-2 opacity-60">
                  {completedBlocks.map((block, index) => (
                    <DailyTaskCard 
                      key={block.id || `completed-${index}`} 
                      task={{
                        id: block.taskId || block.id,
                        title: block.title,
                        estimated_duration: block.duration,
                        time_spent: block.timeSpent || 0,
                        is_completed: true,
                        task_type: block.taskType,
                        due_time: block.startTime,
                        startTime: block.startTime,
                        endTime: block.endTime
                      }} 
                      onEdit={() => handleEditTask(block)}
                      onUpdate={loadTasks}
                      showTime={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </motion.div>

      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          key={editingTask?.id || 'new-task'}
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={getDateISO(selectedDate)}
        />
      </Modal>
      
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          loadTasks();
        }}
        overdueBlocks={overdueBlocks}
        allBlocks={rescheduledBlocks}
        selectedDate={selectedDate}
      />
      
      {showGoogleMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowGoogleMenu(false)}
        />
      )}
    </div>
  );
}

export default DailyView;
