import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * שעות העבודה
 */
const WORK_HOURS = {
  start: 8,
  end: 16
};

/**
 * קבלת תאריך בפורמט ISO - תיקון timezone
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
 * המרה לתאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'short'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * תצוגת שבוע כיומן
 */
function WeeklyCalendarView({ tasks, selectedDate, onSelectDate, onEditTask }) {
  // ימות השבוע (ראשון עד חמישי - ימי עבודה)
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // חזרה ליום ראשון
    
    // רק ימי עבודה: ראשון עד חמישי (0-4)
    for (let i = 0; i <= 4; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // שעות העבודה
  const hours = useMemo(() => {
    const hoursArray = [];
    for (let h = WORK_HOURS.start; h < WORK_HOURS.end; h++) {
      hoursArray.push(h);
    }
    return hoursArray;
  }, []);

  // מיפוי משימות לפי יום ושעה
  const tasksByDayAndHour = useMemo(() => {
    const map = {};
    
    weekDays.forEach(day => {
      const dateISO = getDateISO(day);
      map[dateISO] = {};
      
      // אתחול כל השעות
      hours.forEach(hour => {
        map[dateISO][hour] = [];
      });
    });

    // מיון משימות - רק פעילות (לא הושלמו ולא נמחקו)
    const activeTasks = tasks.filter(t => !t.is_completed && !t.deleted_at);
    
    activeTasks.forEach(task => {
      const taskDate = task.due_date;
      if (!taskDate || !map[taskDate]) return;
      
      // אם יש שעה - נשים בשעה הנכונה
      if (task.due_time) {
        const hour = parseInt(task.due_time.split(':')[0]);
        if (hour >= WORK_HOURS.start && hour < WORK_HOURS.end) {
          map[taskDate][hour].push(task);
          return;
        }
      }
      
      // אם אין שעה - נשים בתחילת היום
      map[taskDate][WORK_HOURS.start].push(task);
    });

    return map;
  }, [tasks, weekDays, hours]);

  // חישוב כמה שורות תופסת משימה (לפי משך)
  const getTaskRowSpan = (task) => {
    const duration = task.estimated_duration || 30;
    return Math.max(1, Math.ceil(duration / 60));
  };

  // שמות הימים בעברית
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* כותרת עם ימים */}
        <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-gray-200 dark:border-gray-700">
          {/* פינה ריקה */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800"></div>
          
          {/* כותרות ימים */}
          {weekDays.map((day, index) => {
            const isTodayDay = isToday(day);
            const isSelected = getDateISO(day) === getDateISO(selectedDate);
            
            return (
              <button
                key={index}
                onClick={() => onSelectDate(day)}
                className={`
                  p-2 text-center border-r border-gray-200 dark:border-gray-700
                  transition-colors cursor-pointer
                  ${isTodayDay ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                  hover:bg-blue-100 dark:hover:bg-blue-900/30
                `}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {dayNames[index]}
                </div>
                <div className={`text-lg font-bold ${isTodayDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {day.getDate()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {getHebrewDate(day)}
                </div>
                {isTodayDay && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    היום
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* שורות שעות */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-gray-100 dark:border-gray-800 min-h-[60px]"
          >
            {/* עמודת שעות */}
            <div className="p-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex items-start justify-center">
              {hour.toString().padStart(2, '0')}:00
            </div>
            
            {/* תאי ימים */}
            {weekDays.map((day, dayIndex) => {
              const dateISO = getDateISO(day);
              const tasksInSlot = tasksByDayAndHour[dateISO]?.[hour] || [];
              const isTodayDay = isToday(day);
              
              return (
                <div
                  key={dayIndex}
                  className={`
                    p-1 border-r border-gray-100 dark:border-gray-800 relative
                    ${isTodayDay ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                  `}
                >
                  {tasksInSlot.map((task) => {
                    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                    const rowSpan = getTaskRowSpan(task);
                    
                    return (
                      <motion.button
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => onEditTask(task)}
                        className="w-full text-right p-1.5 rounded text-xs mb-1
                          transition-all hover:shadow-md cursor-pointer
                          bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        style={{
                          minHeight: `${rowSpan * 50}px`
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span>{taskType.icon}</span>
                          <span className="font-medium truncate">{task.title}</span>
                        </div>
                        {task.estimated_duration && (
                          <div className="text-[10px] opacity-75 mt-0.5">
                            {task.estimated_duration} דק'
                            {task.time_spent > 0 && (
                              <span className="mr-1">• {task.time_spent} בפועל</span>
                            )}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeeklyCalendarView;
