import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import { timeToMinutes, minutesToTime } from '../../utils/timeOverlap';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * ימות השבוע
 */
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * דחיית הכל - כשנופל משהו דחוף
 */
function UrgentReschedule({ onClose, onRescheduled }) {
  const { tasks, addTask, editTask, loadTasks } = useTasks();
  
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'transcription',
    duration: 60,
    insertNow: true // להכניס עכשיו או לבחור זמן
  });
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: פרטים, 2: אישור דחייה

  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date();
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // משימות שיידחו
  const tasksToDelay = useMemo(() => {
    if (!formData.insertNow) return [];
    
    return tasks
      .filter(t => {
        if (t.due_date !== today) return false;
        if (t.is_completed) return false;
        if (!t.due_time) return false;
        
        const taskStart = timeToMinutes(t.due_time);
        return taskStart >= currentMinutes;
      })
      .sort((a, b) => timeToMinutes(a.due_time) - timeToMinutes(b.due_time));
  }, [tasks, today, currentMinutes, formData.insertNow]);

  // עדכון שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // שלב 1 -> שלב 2
  const handlePreview = () => {
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }
    setStep(2);
  };

  // ביצוע הדחייה
  const handleExecute = async () => {
    setLoading(true);

    try {
      // 1. הזמן שהמשימה הדחופה תתחיל
      const urgentStart = currentMinutes + 5; // 5 דקות מעכשיו
      const urgentEnd = urgentStart + parseInt(formData.duration);

      // 2. דחיית כל המשימות
      let delayMinutes = parseInt(formData.duration) + 15; // + בופר
      
      for (const task of tasksToDelay) {
        const oldStart = timeToMinutes(task.due_time);
        const newStart = oldStart + delayMinutes;
        
        // אם נדחה מעבר ליום העבודה (16:00), נעביר למחר
        if (newStart >= 16 * 60) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowISO = tomorrow.toISOString().split('T')[0];
          
          // מציאת שעה ראשונה פנויה מחר
          const tomorrowTasks = tasks.filter(t => t.due_date === tomorrowISO && t.due_time);
          const tomorrowOccupied = tomorrowTasks.map(t => timeToMinutes(t.due_time));
          
          let newTime = 8 * 60; // 08:00
          while (tomorrowOccupied.includes(newTime)) {
            newTime += 30;
          }
          
          await editTask(task.id, {
            dueDate: tomorrowISO,
            dueTime: minutesToTime(newTime),
            wasDelayed: true,
            delayedFrom: task.due_date
          });
        } else {
          await editTask(task.id, {
            dueTime: minutesToTime(newStart),
            wasDelayed: true
          });
        }
      }

      // 3. הוספת המשימה הדחופה
      await addTask({
        title: `🚨 ${formData.title}`,
        taskType: formData.taskType,
        estimatedDuration: parseInt(formData.duration),
        dueDate: today,
        dueTime: minutesToTime(urgentStart),
        quadrant: 1,
        priority: 'urgent',
        isUrgentInsert: true
      });

      await loadTasks();
      
      toast.success(`המשימה הדחופה נכנסה! ${tasksToDelay.length} משימות נדחו`);
      
      if (onRescheduled) onRescheduled();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error('שגיאה בדחיית המשימות');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = TASK_TYPES[formData.taskType];

  return (
    <div className="space-y-4">
      {/* שלב 1: פרטי המשימה הדחופה */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚨</span>
              <div>
                <h3 className="font-bold text-red-800 dark:text-red-200">נפלה עבודה דחופה?</h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  המערכת תכניס אותה עכשיו ותדחה את שאר המשימות
                </p>
              </div>
            </div>
          </div>

          <Input
            label="מה נפל? *"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="למשל: תמלול דחוף לבית משפט"
            autoFocus
          />

          {/* סוג משימה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              סוג
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Object.values(TASK_TYPES).slice(0, 4).map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, taskType: type.id }))}
                  className={`
                    p-2 rounded-lg border-2 text-center transition-all
                    ${formData.taskType === type.id
                      ? `${type.color} border-current ring-2 ring-offset-1`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="text-xl">{type.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* משך */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              כמה זמן זה ייקח?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 90, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, duration: mins }))}
                  className={`
                    py-2 rounded-lg border-2 font-medium transition-all
                    ${formData.duration === mins
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {mins < 60 ? `${mins} דק'` : `${mins / 60} שעות`}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handlePreview} className="w-full py-3">
            המשך →
          </Button>
        </motion.div>
      )}

      {/* שלב 2: אישור הדחייה */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* סיכום המשימה הדחופה */}
          <div className={`p-4 rounded-lg ${selectedType?.color} border-2`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedType?.icon}</span>
              <div>
                <div className="font-bold">🚨 {formData.title}</div>
                <div className="text-sm opacity-75">
                  {formData.duration} דקות • יתחיל עכשיו
                </div>
              </div>
            </div>
          </div>

          {/* משימות שיידחו */}
          {tasksToDelay.length > 0 ? (
            <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                <h4 className="font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
                  <span>⏰</span>
                  {tasksToDelay.length} משימות יידחו:
                </h4>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {tasksToDelay.map(task => {
                  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                  const oldTime = task.due_time;
                  const newMinutes = timeToMinutes(oldTime) + parseInt(formData.duration) + 15;
                  const willMoveTomorrow = newMinutes >= 16 * 60;
                  
                  return (
                    <div 
                      key={task.id}
                      className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3"
                    >
                      <span className={`px-2 py-0.5 rounded ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <span className="line-through">{oldTime}</span>
                          <span>→</span>
                          {willMoveTomorrow ? (
                            <span className="text-orange-600">מחר בבוקר</span>
                          ) : (
                            <span className="text-blue-600">{minutesToTime(newMinutes)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <span className="text-2xl">✅</span>
              <p className="text-green-700 dark:text-green-300 mt-2">
                אין משימות שצריך לדחות - המשימה תיכנס ללוח
              </p>
            </div>
          )}

          {/* כפתורים */}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
              ← חזרה
            </Button>
            <Button 
              onClick={handleExecute} 
              loading={loading}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              🚨 הכנס עכשיו!
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default UrgentReschedule;
