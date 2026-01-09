import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * דשבורד אנליטיקס - ניתוח זמנים ויעילות
 */
function TimeAnalyticsDashboard() {
  const { tasks } = useTasks();
  const [timeRange, setTimeRange] = useState('week'); // week, month, all

  // חישוב תאריכי הטווח
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate;
    if (timeRange === 'week') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate = new Date(2020, 0, 1); // all time
    }
    
    return { start: startDate, end: today };
  }, [timeRange]);

  // סינון משימות לפי טווח
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.is_completed) return false;
      if (!task.completed_at && !task.due_date) return false;
      
      const taskDate = new Date(task.completed_at || task.due_date);
      return taskDate >= dateRange.start && taskDate <= dateRange.end;
    });
  }, [tasks, dateRange]);

  // סטטיסטיקות כלליות
  const generalStats = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const totalEstimated = filteredTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const totalActual = filteredTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const avgEfficiency = totalEstimated > 0 ? (totalEstimated / totalActual) * 100 : 100;
    
    return {
      totalTasks,
      totalEstimated,
      totalActual,
      avgEfficiency: Math.round(avgEfficiency),
      timeDiff: totalActual - totalEstimated
    };
  }, [filteredTasks]);

  // סטטיסטיקות לפי סוג משימה
  const statsByType = useMemo(() => {
    const stats = {};
    
    Object.keys(TASK_TYPES).forEach(typeId => {
      stats[typeId] = {
        type: TASK_TYPES[typeId],
        count: 0,
        totalEstimated: 0,
        totalActual: 0,
        efficiency: 100
      };
    });

    filteredTasks.forEach(task => {
      const typeId = task.task_type || 'other';
      if (stats[typeId]) {
        stats[typeId].count++;
        stats[typeId].totalEstimated += task.estimated_duration || 0;
        stats[typeId].totalActual += task.time_spent || 0;
      }
    });

    // חישוב יעילות
    Object.keys(stats).forEach(typeId => {
      const s = stats[typeId];
      if (s.totalActual > 0) {
        s.efficiency = Math.round((s.totalEstimated / s.totalActual) * 100);
      }
    });

    return Object.values(stats).filter(s => s.count > 0).sort((a, b) => b.totalActual - a.totalActual);
  }, [filteredTasks]);

  // סטטיסטיקות לפי יום בשבוע
  const statsByDay = useMemo(() => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const stats = days.map((name, index) => ({
      name,
      index,
      count: 0,
      totalMinutes: 0
    }));

    filteredTasks.forEach(task => {
      const date = new Date(task.completed_at || task.due_date);
      const dayIndex = date.getDay();
      stats[dayIndex].count++;
      stats[dayIndex].totalMinutes += task.time_spent || 0;
    });

    // רק ימי עבודה (ראשון-חמישי)
    return stats.slice(0, 5);
  }, [filteredTasks]);

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // פורמט שעות
  const formatHours = (minutes) => {
    return (minutes / 60).toFixed(1);
  };

  // מציאת הערך המקסימלי לגרף
  const maxDayMinutes = Math.max(...statsByDay.map(d => d.totalMinutes), 1);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* כותרת */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>📊</span>
          דוחות ואנליטיקס
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          ניתוח הזמנים והיעילות שלך
        </p>
      </motion.div>

      {/* בחירת טווח זמן */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex gap-2 mb-6"
      >
        {[
          { id: 'week', label: 'שבוע אחרון' },
          { id: 'month', label: 'חודש אחרון' },
          { id: 'all', label: 'הכל' }
        ].map(range => (
          <button
            key={range.id}
            onClick={() => setTimeRange(range.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${timeRange === range.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            {range.label}
          </button>
        ))}
      </motion.div>

      {/* כרטיסי סיכום */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
      >
        {/* משימות שהושלמו */}
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {generalStats.totalTasks}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            משימות הושלמו
          </div>
        </div>

        {/* זמן עבודה בפועל */}
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {formatHours(generalStats.totalActual)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            שעות עבודה
          </div>
        </div>

        {/* יעילות */}
        <div className="card p-4 text-center">
          <div className={`text-3xl font-bold ${
            generalStats.avgEfficiency >= 90 ? 'text-green-600 dark:text-green-400' :
            generalStats.avgEfficiency >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {generalStats.avgEfficiency}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            דיוק הערכה
          </div>
        </div>

        {/* הפרש זמן */}
        <div className="card p-4 text-center">
          <div className={`text-3xl font-bold ${
            generalStats.timeDiff <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {generalStats.timeDiff > 0 ? '+' : ''}{formatMinutes(Math.abs(generalStats.timeDiff))}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {generalStats.timeDiff > 0 ? 'חריגה מהתכנון' : 'חיסכון בזמן'}
          </div>
        </div>
      </motion.div>

      {/* גרף ימים */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-4 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📅 שעות עבודה לפי יום
        </h2>
        
        <div className="flex items-end justify-between gap-2 h-40">
          {statsByDay.map((day, index) => {
            const height = maxDayMinutes > 0 ? (day.totalMinutes / maxDayMinutes) * 100 : 0;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {day.totalMinutes > 0 ? formatHours(day.totalMinutes) + 'ש' : '-'}
                </div>
                <div 
                  className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all duration-500"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">
                  {day.name}
                </div>
                <div className="text-xs text-gray-400">
                  {day.count} משימות
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* יעילות לפי סוג משימה */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-4 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ⏱️ יעילות לפי סוג משימה
        </h2>
        
        {statsByType.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            אין מספיק נתונים להצגה
          </div>
        ) : (
          <div className="space-y-4">
            {statsByType.map((stat, index) => (
              <div key={stat.type.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-sm ${stat.type.color}`}>
                      {stat.type.icon} {stat.type.name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({stat.count} משימות)
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">הערכה: </span>
                    <span className="font-medium">{formatMinutes(stat.totalEstimated)}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className="text-gray-500 dark:text-gray-400">בפועל: </span>
                    <span className="font-medium">{formatMinutes(stat.totalActual)}</span>
                  </div>
                </div>
                
                {/* סרגל יעילות */}
                <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  {/* הערכה (רקע) */}
                  <div 
                    className="absolute inset-y-0 right-0 bg-gray-300 dark:bg-gray-600"
                    style={{ width: '100%' }}
                  />
                  {/* בפועל */}
                  <div 
                    className={`absolute inset-y-0 right-0 transition-all duration-500 ${
                      stat.efficiency >= 90 ? 'bg-green-500' :
                      stat.efficiency >= 70 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, (stat.totalActual / Math.max(stat.totalEstimated, stat.totalActual)) * 100)}%` 
                    }}
                  />
                  {/* אחוז יעילות */}
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                    {stat.efficiency}% דיוק
                  </div>
                </div>
                
                {/* הסבר */}
                {stat.efficiency < 100 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.efficiency < 70 
                      ? `⚠️ את נוטה להעריך פחות מדי זמן למשימות מסוג זה`
                      : stat.efficiency < 90
                        ? `💡 יש מקום לשיפור בהערכת הזמן`
                        : `✨ הערכה מצוינת!`
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* טיפים לשיפור */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card p-4"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          💡 תובנות והמלצות
        </h2>
        
        <div className="space-y-3">
          {generalStats.avgEfficiency < 70 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-800 dark:text-orange-200 text-sm">
              <strong>הערכת זמן:</strong> נראה שאת נוטה להעריך פחות זמן ממה שבפועל לוקח. 
              נסי להוסיף 30-50% לכל הערכה.
            </div>
          )}
          
          {generalStats.avgEfficiency > 120 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-800 dark:text-blue-200 text-sm">
              <strong>יעילות מעולה:</strong> את מסיימת משימות מהר יותר מהצפוי! 
              אפשר להקטין את ההערכות או להוסיף עוד משימות ליום.
            </div>
          )}
          
          {statsByType.length > 0 && statsByType[0].totalActual > generalStats.totalActual * 0.5 && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-800 dark:text-purple-200 text-sm">
              <strong>התמקדות:</strong> יותר מ-50% מהזמן שלך מוקדש ל{statsByType[0].type.name}. 
              {statsByType[0].efficiency < 80 && ' שווה לשפר את הערכת הזמן לסוג זה.'}
            </div>
          )}
          
          {statsByDay.some(d => d.totalMinutes > 480) && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-800 dark:text-red-200 text-sm">
              <strong>שעות נוספות:</strong> יש ימים שבהם עבדת יותר מ-8 שעות. 
              נסי לאזן את העומס בין הימים.
            </div>
          )}

          {generalStats.totalTasks === 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 text-sm">
              <strong>אין נתונים:</strong> אין משימות שהושלמו בטווח הזמן הנבחר. 
              נסי לבחור טווח אחר או סיימי כמה משימות עם הטיימר.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default TimeAnalyticsDashboard;
