import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../../config/taskTypes';
import { timeToMinutes, minutesToTime } from '../../utils/timeOverlap';
import { getTaskTypeLearning, calculateSuggestedTime } from '../../services/supabase';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * שעות העבודה
 */
const WORK_HOURS = {
  start: 8,
  end: 16
};

/**
 * ימי עבודה (0 = ראשון)
 */
const WORK_DAYS = [0, 1, 2, 3, 4];

/**
 * גודל בלוק מקסימלי (בדקות)
 */
const MAX_BLOCK_SIZE = 60; // שעה - לא יותר ברצף

/**
 * גודל בלוק מינימלי (בדקות)
 */
const MIN_BLOCK_SIZE = 30;

/**
 * קבלת תאריך בפורמט ISO
 */
function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * שמות ימים בעברית
 */
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * פורמט דקות לתצוגה
 */
function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * מערכת קליטת עבודה חכמה
 */
function SmartWorkIntake({ onClose, onCreated }) {
  const { tasks, addTask, editTask, loadTasks } = useTasks();
  const { user } = useAuth();
  
  // שלב בתהליך
  const [step, setStep] = useState(1); // 1: פרטים, 2: ניתוח, 3: שיבוץ
  
  // פרטי העבודה
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'transcription',
    totalHours: '',
    deadline: '',
    blockSize: 45, // גודל בלוק ברירת מחדל
    priority: 'normal', // normal, high, urgent
    description: ''
  });

  // נתוני למידה
  const [learningData, setLearningData] = useState(null);
  const [adjustedHours, setAdjustedHours] = useState(null);

  // תוצאות הניתוח
  const [analysis, setAnalysis] = useState(null);
  
  // משימות שאפשר להזיז
  const [tasksToMove, setTasksToMove] = useState([]);
  
  // שיבוץ מוצע
  const [proposedSchedule, setProposedSchedule] = useState([]);
  
  const [loading, setLoading] = useState(false);

  // טעינת נתוני למידה כשמשתנה סוג המשימה
  useEffect(() => {
    if (user?.id && formData.taskType) {
      getTaskTypeLearning(user.id, formData.taskType)
        .then(data => {
          setLearningData(data);
          // חישוב זמן מותאם אם יש מספיק נתונים
          if (data && data.total_tasks >= 3 && formData.totalHours) {
            const baseMinutes = parseFloat(formData.totalHours) * 60;
            const adjusted = calculateSuggestedTime(data, baseMinutes);
            setAdjustedHours(adjusted / 60);
          } else {
            setAdjustedHours(null);
          }
        })
        .catch(err => {
          console.error('שגיאה בטעינת נתוני למידה:', err);
          setLearningData(null);
        });
    }
  }, [user?.id, formData.taskType, formData.totalHours]);

  // עדכון שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // חישוב קיבולת לימים הבאים
  const capacityByDay = useMemo(() => {
    const days = [];
    const today = new Date();
    const deadlineDate = formData.deadline ? new Date(formData.deadline) : null;
    
    // חישוב ל-14 ימים קדימה או עד הדדליין
    const daysToCheck = deadlineDate 
      ? Math.min(Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24)) + 1, 30)
      : 14;
    
    for (let i = 0; i < daysToCheck; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      // רק ימי עבודה
      if (!WORK_DAYS.includes(date.getDay())) continue;
      
      const dateISO = getDateISO(date);
      const dayTasks = tasks.filter(t => 
        t.due_date === dateISO && 
        t.due_time && 
        !t.is_completed
      );
      
      // חישוב זמן תפוס
      let occupiedMinutes = 0;
      const occupiedSlots = [];
      
      dayTasks.forEach(task => {
        const start = timeToMinutes(task.due_time);
        const duration = task.estimated_duration || 30;
        occupiedMinutes += duration;
        occupiedSlots.push({
          start,
          end: start + duration,
          task
        });
      });
      
      // זמן פנוי
      const totalWorkMinutes = (WORK_HOURS.end - WORK_HOURS.start) * 60;
      const freeMinutes = totalWorkMinutes - occupiedMinutes;
      
      // מציאת חלונות פנויים
      const freeSlots = findFreeSlots(occupiedSlots);
      
      days.push({
        date,
        dateISO,
        dayName: DAY_NAMES[date.getDay()],
        occupiedMinutes,
        freeMinutes,
        totalMinutes: totalWorkMinutes,
        occupiedSlots,
        freeSlots,
        tasks: dayTasks,
        isToday: i === 0
      });
    }
    
    return days;
  }, [tasks, formData.deadline]);

  // מציאת חלונות פנויים ביום
  function findFreeSlots(occupiedSlots) {
    const slots = [];
    const sorted = [...occupiedSlots].sort((a, b) => a.start - b.start);
    
    let currentTime = WORK_HOURS.start * 60;
    const dayEnd = WORK_HOURS.end * 60;
    
    for (const occupied of sorted) {
      if (currentTime < occupied.start) {
        const duration = occupied.start - currentTime;
        if (duration >= MIN_BLOCK_SIZE) {
          slots.push({
            start: currentTime,
            end: occupied.start,
            duration
          });
        }
      }
      currentTime = Math.max(currentTime, occupied.end);
    }
    
    // חלון אחרון
    if (currentTime < dayEnd) {
      const duration = dayEnd - currentTime;
      if (duration >= MIN_BLOCK_SIZE) {
        slots.push({
          start: currentTime,
          end: dayEnd,
          duration
        });
      }
    }
    
    return slots;
  }

  // ניתוח והצעת שיבוץ
  const analyzeAndPropose = () => {
    if (!formData.title.trim()) {
      toast.error('נא להזין שם עבודה');
      return;
    }
    
    if (!formData.totalHours || parseFloat(formData.totalHours) <= 0) {
      toast.error('נא להזין מספר שעות');
      return;
    }

    const totalMinutes = parseFloat(formData.totalHours) * 60;
    const blockSize = Math.min(formData.blockSize, MAX_BLOCK_SIZE);
    const deadlineDate = formData.deadline ? new Date(formData.deadline) : null;
    
    // חישוב כמה בלוקים צריך
    const numBlocks = Math.ceil(totalMinutes / blockSize);
    
    // סה"כ זמן פנוי עד הדדליין
    const relevantDays = deadlineDate 
      ? capacityByDay.filter(d => d.date <= deadlineDate)
      : capacityByDay;
    
    const totalFreeTime = relevantDays.reduce((sum, d) => sum + d.freeMinutes, 0);
    
    // האם יש מספיק זמן?
    const hasEnoughTime = totalFreeTime >= totalMinutes;
    
    // ניסיון שיבוץ
    const schedule = [];
    let remainingMinutes = totalMinutes;
    let blockIndex = 1;
    
    // עותק של החלונות הפנויים
    const availableDays = relevantDays.map(d => ({
      ...d,
      freeSlots: d.freeSlots.map(s => ({ ...s }))
    }));
    
    for (const day of availableDays) {
      if (remainingMinutes <= 0) break;
      
      for (const slot of day.freeSlots) {
        if (remainingMinutes <= 0) break;
        if (slot.duration < MIN_BLOCK_SIZE) continue;
        
        // כמה אפשר לקחת מהחלון הזה
        const maxFromSlot = Math.min(slot.duration, remainingMinutes);
        
        // פירוק לבלוקים
        let slotRemaining = maxFromSlot;
        let slotStart = slot.start;
        
        while (slotRemaining >= MIN_BLOCK_SIZE && remainingMinutes > 0) {
          const thisBlockSize = Math.min(blockSize, slotRemaining, remainingMinutes);
          
          if (thisBlockSize >= MIN_BLOCK_SIZE) {
            schedule.push({
              blockIndex,
              date: day.date,
              dateISO: day.dateISO,
              dayName: day.dayName,
              startTime: minutesToTime(slotStart),
              endTime: minutesToTime(slotStart + thisBlockSize),
              duration: thisBlockSize
            });
            
            blockIndex++;
            remainingMinutes -= thisBlockSize;
            slotRemaining -= thisBlockSize;
            slotStart += thisBlockSize;
          } else {
            break;
          }
        }
      }
    }
    
    // אם לא הצלחנו לשבץ הכל - מציאת משימות להזזה
    const movableTasks = [];
    if (remainingMinutes > 0 && deadlineDate) {
      // מציאת משימות פחות דחופות שאפשר להזיז
      for (const day of relevantDays) {
        for (const task of day.tasks) {
          // לא להזיז משימות דחופות
          if (task.priority === 'urgent') continue;
          
          // בדיקה אם הדדליין של המשימה הזו גמיש
          const taskDeadline = task.deadline ? new Date(task.deadline) : null;
          const canMove = !taskDeadline || taskDeadline > deadlineDate;
          
          if (canMove) {
            movableTasks.push({
              ...task,
              dayName: day.dayName,
              potentialFreeTime: task.estimated_duration || 30
            });
          }
        }
      }
    }
    
    setAnalysis({
      totalMinutes,
      numBlocks,
      blockSize,
      totalFreeTime,
      hasEnoughTime,
      remainingMinutes: Math.max(0, remainingMinutes),
      deadline: deadlineDate,
      relevantDays
    });
    
    setProposedSchedule(schedule);
    setTasksToMove(movableTasks);
    setStep(2);
  };

  // ביצוע השיבוץ
  const executeSchedule = async () => {
    if (proposedSchedule.length === 0) {
      toast.error('אין שיבוץ לביצוע');
      return;
    }
    
    setLoading(true);
    
    try {
      // יצירת הבלוקים כמשימות
      for (const block of proposedSchedule) {
        const blockTitle = (proposedSchedule.length > 1 && !formData.title.includes('/'))
          ? `${formData.title} (${block.blockIndex}/${proposedSchedule.length})`
          : formData.title;
        await addTask({
          title: blockTitle,
          description: formData.description || null,
          taskType: formData.taskType,
          estimatedDuration: block.duration,
          dueDate: block.dateISO,
          dueTime: block.startTime,
          quadrant: 1,
          priority: formData.priority,
          parentJob: formData.title, // קישור לעבודה המקורית
          blockIndex: block.blockIndex,
          totalBlocks: proposedSchedule.length
        });
      }
      
      await loadTasks();
      toast.success(`נוצרו ${proposedSchedule.length} בלוקים של "${formData.title}"`);
      
      if (onCreated) onCreated();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error('שגיאה ביצירת המשימות');
    } finally {
      setLoading(false);
    }
  };

  // הזזת משימות נבחרות
  const [selectedToMove, setSelectedToMove] = useState([]);
  
  const toggleTaskToMove = (taskId) => {
    setSelectedToMove(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  // חישוב מחדש אחרי בחירת משימות להזזה
  const recalculateWithMovedTasks = async () => {
    if (selectedToMove.length === 0) {
      toast.error('בחרי משימות להזזה');
      return;
    }
    
    // ✅ מחשב את התאריך אחרי הדדליין של המשימה החדשה
    const deadline = formData.dueDate || new Date().toISOString().split('T')[0];
    const dayAfterDeadline = new Date(deadline);
    dayAfterDeadline.setDate(dayAfterDeadline.getDate() + 1);
    const newDate = dayAfterDeadline.toISOString().split('T')[0];
    
    // ✅ מזיז את כל המשימות הנבחרות
    try {
      setLoading(true);
      for (const taskId of selectedToMove) {
        const task = tasksToMove.find(t => t.id === taskId);
        if (task) {
          await editTask(taskId, { 
            due_date: newDate,
            was_deferred: true 
          });
        }
      }
      
      // ✅ מחשב כמה זמן התפנה
      const freedTime = selectedToMove.reduce((sum, taskId) => {
        const task = tasksToMove.find(t => t.id === taskId);
        return sum + (task?.estimated_duration || 30);
      }, 0);
      
      // ✅ מעדכן את הניתוח
      setAnalysis(prev => ({
        ...prev,
        totalFreeTime: prev.totalFreeTime + freedTime,
        hasEnoughTime: prev.totalFreeTime + freedTime >= prev.totalMinutes
      }));
      
      await loadTasks();
      toast.success(`${selectedToMove.length} משימות הועברו ל-${newDate}`);
      setSelectedToMove([]);
    } catch (err) {
      console.error('שגיאה בהזזת משימות:', err);
      toast.error('שגיאה בהזזת משימות');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = TASK_TYPES[formData.taskType];

  return (
    <div className="space-y-4">
      {/* שלב 1: פרטי העבודה */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <Input
            label="שם העבודה *"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="למשל: תמלול ישיבת דירקטוריון"
            autoFocus
          />

          {/* סוג משימה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              סוג עבודה
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
                  <div className="text-xs mt-1">{type.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* שעות ודדליין */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                סה"כ שעות עבודה *
              </label>
              <input
                type="number"
                name="totalHours"
                value={formData.totalHours}
                onChange={handleChange}
                step="0.5"
                min="0.5"
                placeholder="למשל: 3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                דדליין *
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* המלצת למידה */}
          {learningData && learningData.total_tasks >= 3 && formData.totalHours && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-2">
                <span className="text-xl">🧠</span>
                <div className="flex-1">
                  <div className="font-medium text-purple-800 dark:text-purple-200 text-sm">
                    המערכת למדה מ-{learningData.total_tasks} משימות קודמות:
                  </div>
                  <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    {learningData.average_ratio > 1.1 ? (
                      <>
                        {TASK_TYPES[formData.taskType]?.name} בד"כ לוקח לך <strong>{Math.round((learningData.average_ratio - 1) * 100)}% יותר</strong> מההערכה.
                        <br />
                        💡 מומלץ לתכנן <strong>{adjustedHours?.toFixed(1)} שעות</strong> במקום {formData.totalHours}.
                      </>
                    ) : learningData.average_ratio < 0.9 ? (
                      <>
                        {TASK_TYPES[formData.taskType]?.name} בד"כ לוקח לך <strong>{Math.round((1 - learningData.average_ratio) * 100)}% פחות</strong> מההערכה.
                        <br />
                        💡 את יעילה! אפשר לתכנן <strong>{adjustedHours?.toFixed(1)} שעות</strong>.
                      </>
                    ) : (
                      <>
                        ההערכות שלך מדויקות! 🎯
                      </>
                    )}
                  </div>
                  {adjustedHours && Math.abs(adjustedHours - parseFloat(formData.totalHours)) > 0.25 && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, totalHours: adjustedHours.toFixed(1) }))}
                      className="mt-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      עדכן ל-{adjustedHours.toFixed(1)} שעות
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* גודל בלוק */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              גודל בלוק עבודה: {formData.blockSize} דקות
            </label>
            <input
              type="range"
              min="30"
              max="90"
              step="15"
              value={formData.blockSize}
              onChange={(e) => setFormData(prev => ({ ...prev, blockSize: parseInt(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>30 דק' (קצר)</span>
              <span>60 דק'</span>
              <span>90 דק' (ארוך)</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              💡 עבודה של {formData.totalHours || '?'} שעות תפורק ל-
              {formData.totalHours ? Math.ceil((parseFloat(formData.totalHours) * 60) / formData.blockSize) : '?'} בלוקים
            </p>
          </div>

          {/* עדיפות */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              עדיפות
            </label>
            <div className="flex gap-2">
              {[
                { id: 'normal', name: 'רגילה', color: 'bg-gray-100 dark:bg-gray-700' },
                { id: 'high', name: 'גבוהה', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
                { id: 'urgent', name: 'דחופה!', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: p.id }))}
                  className={`
                    flex-1 py-2 rounded-lg border-2 font-medium transition-all
                    ${formData.priority === p.id
                      ? `${p.color} border-current ring-2 ring-offset-1`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* הערות */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              הערות (אופציונלי)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="פרטים על הלקוח, דגשים מיוחדים..."
            />
          </div>

          {/* תצוגה מקדימה של קיבולת */}
          {capacityByDay.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📊 הקיבולת שלך לימים הקרובים:
              </h4>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {capacityByDay.slice(0, 7).map(day => {
                  const pct = Math.round((day.occupiedMinutes / day.totalMinutes) * 100);
                  const isFull = pct >= 80;
                  return (
                    <div 
                      key={day.dateISO}
                      className={`
                        flex-shrink-0 w-16 p-2 rounded text-center text-xs
                        ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                        ${isFull ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}
                      `}
                    >
                      <div className="font-medium">{day.dayName}</div>
                      <div className={`text-lg ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.round(day.freeMinutes / 60)}h
                      </div>
                      <div className="text-gray-500">פנוי</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={analyzeAndPropose} className="w-full py-3">
            📊 נתח ושבץ
          </Button>
        </motion.div>
      )}

      {/* שלב 2: ניתוח ושיבוץ */}
      {step === 2 && analysis && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* סיכום */}
          <div className={`p-4 rounded-lg ${analysis.hasEnoughTime 
            ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800' 
            : 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{analysis.hasEnoughTime ? '✅' : '⚠️'}</span>
              <div>
                <h3 className="font-bold text-lg">
                  {analysis.hasEnoughTime ? 'אפשר לעמוד בדדליין!' : 'צריך לפנות זמן'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.title} • {formData.totalHours} שעות • {proposedSchedule.length} בלוקים
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center mt-3">
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-xl font-bold text-blue-600">{formatMinutes(analysis.totalMinutes)}</div>
                <div className="text-xs text-gray-500">נדרש</div>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-xl font-bold text-green-600">{formatMinutes(analysis.totalFreeTime)}</div>
                <div className="text-xs text-gray-500">פנוי</div>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className={`text-xl font-bold ${analysis.remainingMinutes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {analysis.remainingMinutes > 0 ? `-${formatMinutes(analysis.remainingMinutes)}` : '✓'}
                </div>
                <div className="text-xs text-gray-500">{analysis.remainingMinutes > 0 ? 'חסר' : 'מספיק'}</div>
              </div>
            </div>
          </div>

          {/* שיבוץ מוצע */}
          {proposedSchedule.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-medium flex items-center gap-2">
                  <span className={selectedType?.color + ' px-2 py-0.5 rounded'}>
                    {selectedType?.icon}
                  </span>
                  שיבוץ מוצע - {proposedSchedule.length} בלוקים
                </h4>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {proposedSchedule.map((block, index) => (
                  <div 
                    key={index}
                    className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">
                        {block.blockIndex}
                      </span>
                      <div>
                        <div className="font-medium">{block.dayName}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(block.date).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{block.startTime} - {block.endTime}</div>
                      <div className="text-sm text-gray-500">{formatMinutes(block.duration)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* משימות שאפשר להזיז */}
          {!analysis.hasEnoughTime && tasksToMove.length > 0 && (
            <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                <h4 className="font-medium text-orange-800 dark:text-orange-200">
                  🔀 משימות שאפשר להזיז (בחרי כדי לפנות זמן):
                </h4>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {tasksToMove.map(task => {
                  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                  const isSelected = selectedToMove.includes(task.id);
                  return (
                    <label 
                      key={task.id}
                      className={`
                        p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 cursor-pointer
                        ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTaskToMove(task.id)}
                        className="w-5 h-5 rounded"
                      />
                      <span className={`px-2 py-0.5 rounded ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-500">
                          {task.dayName} {task.due_time} • {formatMinutes(task.estimated_duration || 30)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {selectedToMove.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800">
                  <Button onClick={recalculateWithMovedTasks} variant="secondary" className="w-full">
                    🔄 חשב מחדש עם הזזת {selectedToMove.length} משימות
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* כפתורים */}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
              ← חזרה
            </Button>
            <Button 
              onClick={executeSchedule} 
              loading={loading}
              disabled={proposedSchedule.length === 0}
              className="flex-1"
            >
              ✅ צור {proposedSchedule.length} בלוקים
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default SmartWorkIntake;
