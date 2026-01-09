import { useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * סוגי חזרה
 */
const RECURRENCE_TYPES = {
  daily: { id: 'daily', name: 'כל יום', icon: '📅' },
  weekly: { id: 'weekly', name: 'כל שבוע', icon: '🗓️' },
  workdays: { id: 'workdays', name: 'ימי עבודה (א-ה)', icon: '💼' },
  custom: { id: 'custom', name: 'ימים מסוימים', icon: '⚙️' }
};

/**
 * ימות השבוע
 */
const WEEKDAYS = [
  { id: 0, name: 'ראשון', short: 'א' },
  { id: 1, name: 'שני', short: 'ב' },
  { id: 2, name: 'שלישי', short: 'ג' },
  { id: 3, name: 'רביעי', short: 'ד' },
  { id: 4, name: 'חמישי', short: 'ה' },
  { id: 5, name: 'שישי', short: 'ו' },
  { id: 6, name: 'שבת', short: 'ש' }
];

/**
 * טופס משימה חוזרת
 */
function RecurringTaskForm({ onClose, onCreated }) {
  const { addTask } = useTasks();
  
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'other',
    estimatedDuration: '30',
    dueTime: '09:00',
    description: '',
    recurrenceType: 'workdays',
    customDays: [0, 1, 2, 3, 4], // ברירת מחדל: ימי עבודה
    startDate: new Date().toISOString().split('T')[0],
    endDate: '', // ריק = ללא סוף
    weeksAhead: 4 // כמה שבועות קדימה ליצור
  });

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  // עדכון שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setPreview(null); // מנקה תצוגה מקדימה
  };

  // בחירת סוג משימה
  const handleTypeSelect = (typeId) => {
    const type = TASK_TYPES[typeId];
    setFormData(prev => ({
      ...prev,
      taskType: typeId,
      estimatedDuration: prev.estimatedDuration || type.defaultDuration?.toString() || '30'
    }));
    setPreview(null);
  };

  // בחירת סוג חזרה
  const handleRecurrenceSelect = (recurrenceId) => {
    let customDays = formData.customDays;
    
    if (recurrenceId === 'workdays') {
      customDays = [0, 1, 2, 3, 4];
    } else if (recurrenceId === 'daily') {
      customDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (recurrenceId === 'weekly') {
      // היום הנוכחי בשבוע
      customDays = [new Date().getDay()];
    }
    
    setFormData(prev => ({
      ...prev,
      recurrenceType: recurrenceId,
      customDays
    }));
    setPreview(null);
  };

  // הוספה/הסרה של יום מותאם
  const toggleCustomDay = (dayId) => {
    setFormData(prev => {
      const days = prev.customDays.includes(dayId)
        ? prev.customDays.filter(d => d !== dayId)
        : [...prev.customDays, dayId].sort((a, b) => a - b);
      return { ...prev, customDays: days };
    });
    setPreview(null);
  };

  // חישוב התאריכים שייווצרו
  const calculateDates = () => {
    const dates = [];
    const startDate = new Date(formData.startDate);
    const endDate = formData.endDate 
      ? new Date(formData.endDate)
      : new Date(startDate.getTime() + (formData.weeksAhead * 7 * 24 * 60 * 60 * 1000));
    
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      if (formData.customDays.includes(dayOfWeek)) {
        dates.push(new Date(currentDate));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  // תצוגה מקדימה
  const handlePreview = () => {
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }
    
    const dates = calculateDates();
    setPreview(dates);
  };

  // יצירת המשימות
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }

    if (!formData.estimatedDuration || parseInt(formData.estimatedDuration) <= 0) {
      toast.error('נא להזין זמן משוער');
      return;
    }

    if (formData.customDays.length === 0) {
      toast.error('נא לבחור לפחות יום אחד');
      return;
    }

    const dates = calculateDates();
    
    if (dates.length === 0) {
      toast.error('לא נמצאו תאריכים מתאימים');
      return;
    }

    if (dates.length > 100) {
      toast.error('לא ניתן ליצור יותר מ-100 משימות בבת אחת');
      return;
    }

    setLoading(true);

    try {
      let created = 0;
      
      for (const date of dates) {
        const taskData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          taskType: formData.taskType,
          estimatedDuration: parseInt(formData.estimatedDuration),
          dueDate: date.toISOString().split('T')[0],
          dueTime: formData.dueTime || null,
          quadrant: 1,
          isRecurring: true,
          recurrenceGroup: `recurring_${Date.now()}` // מזהה קבוצה
        };

        await addTask(taskData);
        created++;
      }
      
      toast.success(`נוצרו ${created} משימות חוזרות!`);
      
      if (onCreated) onCreated();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error(err.message || 'שגיאה ביצירת המשימות');
    } finally {
      setLoading(false);
    }
  };

  // פורמט תאריך
  const formatDate = (date) => {
    const dayName = WEEKDAYS[date.getDay()].name;
    return `${dayName}, ${date.toLocaleDateString('he-IL')}`;
  };

  const selectedType = TASK_TYPES[formData.taskType];

  return (
    <div className="space-y-4">
      {/* שם המשימה */}
      <Input
        label="שם המשימה *"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="למשל: מענה למיילים, תמלול יומי..."
        autoFocus
      />

      {/* סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג משימה
        </label>
        <div className="grid grid-cols-4 gap-2">
          {Object.values(TASK_TYPES).map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => handleTypeSelect(type.id)}
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

      {/* זמן ושעה */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="משך זמן (דקות) *"
          type="number"
          name="estimatedDuration"
          value={formData.estimatedDuration}
          onChange={handleChange}
          min="1"
        />
        <Input
          label="שעה"
          type="time"
          name="dueTime"
          value={formData.dueTime}
          onChange={handleChange}
        />
      </div>

      {/* סוג חזרה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          תדירות חזרה
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(RECURRENCE_TYPES).map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => handleRecurrenceSelect(type.id)}
              className={`
                p-3 rounded-lg border-2 text-right transition-all flex items-center gap-2
                ${formData.recurrenceType === type.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="text-xl">{type.icon}</span>
              <span className="font-medium">{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ימים מותאמים */}
      {formData.recurrenceType === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            בחר ימים
          </label>
          <div className="flex gap-2 justify-center">
            {WEEKDAYS.map(day => (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleCustomDay(day.id)}
                className={`
                  w-10 h-10 rounded-full font-bold transition-all
                  ${formData.customDays.includes(day.id)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }
                `}
                title={day.name}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* טווח תאריכים */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="מתאריך"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            עד תאריך (אופציונלי)
          </label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* כמה שבועות (אם אין תאריך סיום) */}
      {!formData.endDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ליצור ל-{formData.weeksAhead} שבועות קדימה
          </label>
          <input
            type="range"
            min="1"
            max="12"
            value={formData.weeksAhead}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, weeksAhead: parseInt(e.target.value) }));
              setPreview(null);
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>שבוע</span>
            <span>3 חודשים</span>
          </div>
        </div>
      )}

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
          placeholder="פרטים נוספים..."
        />
      </div>

      {/* תצוגה מקדימה */}
      {preview && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <span>📋</span>
            ייווצרו {preview.length} משימות:
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {preview.slice(0, 10).map((date, index) => (
              <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className={selectedType?.color + ' px-1.5 py-0.5 rounded text-xs'}>
                  {selectedType?.icon}
                </span>
                <span>{formatDate(date)}</span>
                <span className="text-gray-400">{formData.dueTime}</span>
              </div>
            ))}
            {preview.length > 10 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                ...ועוד {preview.length - 10} משימות
              </div>
            )}
          </div>
        </div>
      )}

      {/* כפתורים */}
      <div className="flex gap-3 pt-2">
        {!preview ? (
          <Button type="button" onClick={handlePreview} className="flex-1">
            🔍 תצוגה מקדימה
          </Button>
        ) : (
          <Button 
            type="button" 
            onClick={handleSubmit} 
            loading={loading} 
            className="flex-1"
          >
            ✅ צור {preview.length} משימות
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

export default RecurringTaskForm;
