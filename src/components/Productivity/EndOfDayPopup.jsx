import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * סיכום יומי - מוצג בסוף יום העבודה
 * 
 * מראה:
 * - כמה שעות עבדת
 * - פילוח לפי סוג משימה
 * - כמה הפרעות היו
 * - מה הושלם ומה לא
 * - תובנות והמלצות
 */

function EndOfDayPopup() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  
  const [showSummary, setShowSummary] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // בדיקה אם להציג סיכום (סוף יום עבודה - 17:00)
  useEffect(() => {
    if (!user || dismissed) return;

    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const day = now.getDay();
      
      // ימים א'-ה', בין 17:00-17:15
      const isEndOfWorkDay = day >= 0 && day <= 4 && hour === 17 && minute < 15;
      
      // בדיקה אם כבר הוצג היום
      const today = now.toISOString().split('T')[0];
      const lastShown = localStorage.getItem(`daily_summary_shown_${user.id}`);
      
      if (isEndOfWorkDay && lastShown !== today) {
        setShowSummary(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // בדיקה כל דקה

    return () => clearInterval(interval);
  }, [user, dismissed]);

  // חישוב נתוני היום
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // משימות להיום
    const todayTasks = tasks.filter(t => t.due_date === today);
    const completed = todayTasks.filter(t => t.is_completed);
    const notCompleted = todayTasks.filter(t => !t.is_completed);
    
    // זמן לפי סוג
    const byType = {};
    completed.forEach(task => {
      const type = task.task_type || 'other';
      if (!byType[type]) {
        byType[type] = { estimated: 0, actual: 0, count: 0 };
      }
      byType[type].estimated += task.estimated_duration || 0;
      byType[type].actual += task.time_spent || 0;
      byType[type].count++;
    });

    // סה"כ
    const totalEstimated = completed.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const totalActual = completed.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // הפרעות מ-localStorage
    let interruptions = [];
    try {
      const key = `idle_log_${user?.id}_${today}`;
      interruptions = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {}

    const interruptionTime = interruptions.reduce((sum, i) => sum + (i.duration || 0), 0);
    const distractionCount = interruptions.filter(i => i.reason === 'distracted').length;

    return {
      completed: completed.length,
      notCompleted: notCompleted.length,
      totalEstimated,
      totalActual,
      byType,
      interruptions: interruptions.length,
      interruptionTime,
      distractionCount,
      notCompletedTasks: notCompleted,
      accuracy: totalEstimated > 0 
        ? Math.round((totalActual / totalEstimated) * 100) 
        : 100
    };
  }, [tasks, user?.id]);

  // תובנות
  const insights = useMemo(() => {
    const items = [];

    // דיוק הערכות
    if (todayStats.accuracy > 120) {
      items.push({
        icon: '⏰',
        text: `המשימות לקחו ${todayStats.accuracy - 100}% יותר מהצפוי. נסי להגדיל הערכות.`,
        type: 'warning'
      });
    } else if (todayStats.accuracy < 80 && todayStats.totalActual > 0) {
      items.push({
        icon: '🎯',
        text: `סיימת מהר מהצפוי! אפשר לצפוף יותר משימות.`,
        type: 'success'
      });
    }

    // התפזרויות
    if (todayStats.distractionCount > 3) {
      items.push({
        icon: '🎯',
        text: `${todayStats.distractionCount} התפזרויות היום. נסי טכניקת פומודורו?`,
        type: 'warning'
      });
    }

    // משימות שלא הושלמו
    if (todayStats.notCompleted > 0) {
      items.push({
        icon: '📋',
        text: `${todayStats.notCompleted} משימות לא הושלמו. הן יועברו למחר.`,
        type: 'info'
      });
    }

    // יום מוצלח
    if (todayStats.completed > 0 && todayStats.notCompleted === 0) {
      items.push({
        icon: '🏆',
        text: 'יום מושלם! סיימת את כל המשימות!',
        type: 'success'
      });
    }

    return items;
  }, [todayStats]);

  // סגירה
  const handleClose = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`daily_summary_shown_${user?.id}`, today);
    setShowSummary(false);
    setDismissed(true);
  }, [user?.id]);

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (!minutes) return '0 דק\'';
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {showSummary && (
        <>
          {/* רקע */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleClose}
          />

          {/* חלון הסיכום */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       w-[95%] max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                       max-h-[90vh] overflow-auto"
          >
            {/* כותרת */}
            <div className="bg-gradient-to-l from-indigo-500 to-purple-500 p-4 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>📊</span>
                סיכום היום
              </h2>
              <p className="text-indigo-100 text-sm mt-1">
                {new Date().toLocaleDateString('he-IL', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* סטטיסטיקות ראשיות */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">{todayStats.completed}</div>
                  <div className="text-xs text-green-700 dark:text-green-400">הושלמו ✓</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-blue-600">{formatMinutes(todayStats.totalActual)}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400">זמן עבודה</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-orange-600">{todayStats.interruptions}</div>
                  <div className="text-xs text-orange-700 dark:text-orange-400">הפרעות</div>
                </div>
              </div>

              {/* פילוח לפי סוג */}
              {Object.keys(todayStats.byType).length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">פילוח לפי סוג:</h3>
                  <div className="space-y-2">
                    {Object.entries(todayStats.byType).map(([type, data]) => {
                      const taskType = TASK_TYPES[type] || { icon: '📋', name: type };
                      const ratio = data.estimated > 0 
                        ? Math.round((data.actual / data.estimated) * 100)
                        : 100;
                      return (
                        <div key={type} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                          <span>{taskType.icon}</span>
                          <span className="flex-1 text-sm">{taskType.name}</span>
                          <span className="text-sm text-gray-500">{data.count} משימות</span>
                          <span className={`text-sm font-medium ${
                            ratio > 120 ? 'text-red-500' : 
                            ratio < 80 ? 'text-green-500' : 
                            'text-gray-600'
                          }`}>
                            {formatMinutes(data.actual)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* תובנות */}
              {insights.length > 0 && (
                <div className="space-y-2">
                  {insights.map((insight, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg flex items-start gap-2 ${
                        insight.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                        insight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' :
                        'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      <span>{insight.icon}</span>
                      <span className="text-sm">{insight.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* משימות שלא הושלמו */}
              {todayStats.notCompletedTasks.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    לא הושלמו (יועברו למחר):
                  </h3>
                  <div className="space-y-1">
                    {todayStats.notCompletedTasks.slice(0, 5).map(task => (
                      <div key={task.id} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <span>{TASK_TYPES[task.task_type]?.icon || '📋'}</span>
                        <span>{task.title}</span>
                      </div>
                    ))}
                    {todayStats.notCompletedTasks.length > 5 && (
                      <div className="text-xs text-gray-400">
                        +{todayStats.notCompletedTasks.length - 5} נוספות
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* כפתור סגירה */}
              <button
                onClick={handleClose}
                className="w-full p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium"
              >
                סגור ולילה טוב! 🌙
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default EndOfDayPopup;
