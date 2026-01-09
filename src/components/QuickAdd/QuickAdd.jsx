import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * הוספה מהירה - לתפוס דברים שצצים
 */
function QuickAdd({ isOpen, onClose, onAdded }) {
  const { addTask } = useTasks();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // פוקוס על הקלט כשנפתח
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // ניתוח הטקסט לזיהוי סוג משימה
  const parseTaskType = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('תמלול') || lower.includes('תמלל')) return 'transcription';
    if (lower.includes('הגהה') || lower.includes('הגה')) return 'proofreading';
    if (lower.includes('מייל') || lower.includes('אימייל')) return 'email';
    if (lower.includes('שיחה') || lower.includes('טלפון') || lower.includes('פגישה')) return 'meeting';
    if (lower.includes('לימוד') || lower.includes('קורס')) return 'learning';
    return 'other';
  };

  // ניתוח זמן מהטקסט
  const parseTime = (text) => {
    // חיפוש דפוסים כמו "שעה", "שעתיים", "3 שעות", "45 דקות"
    const hourMatch = text.match(/(\d+)\s*שעות?/);
    const minuteMatch = text.match(/(\d+)\s*דקות?/);
    const twoHours = text.includes('שעתיים');
    const halfHour = text.includes('חצי שעה');
    
    if (twoHours) return 120;
    if (halfHour) return 30;
    if (hourMatch) return parseInt(hourMatch[1]) * 60;
    if (minuteMatch) return parseInt(minuteMatch[1]);
    return 30; // ברירת מחדל
  };

  // שליחה
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!text.trim()) {
      toast.error('הקלידי מה צץ');
      return;
    }

    setLoading(true);

    try {
      const taskType = parseTaskType(text);
      const duration = parseTime(text);
      
      // ניקוי הטקסט מזמנים
      let cleanTitle = text
        .replace(/\d+\s*שעות?/g, '')
        .replace(/\d+\s*דקות?/g, '')
        .replace(/שעתיים/g, '')
        .replace(/חצי שעה/g, '')
        .trim();

      await addTask({
        title: cleanTitle || text,
        taskType,
        estimatedDuration: duration,
        quadrant: 1,
        // ללא תאריך ושעה - יישאר ברשימת "לשבץ"
        dueDate: null,
        dueTime: null,
        needsScheduling: true // סימון שצריך לשבץ
      });

      toast.success('נתפס! 📝 עכשיו צריך לשבץ');
      setText('');
      
      if (onAdded) onAdded();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error('שגיאה בהוספה');
    } finally {
      setLoading(false);
    }
  };

  // סגירה עם Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">משהו צץ?</span>
              </div>
              
              <div className="p-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="למשל: תמלול דחוף שעתיים, שיחה עם לקוח..."
                  className="w-full px-4 py-3 text-lg border-2 border-gray-200 dark:border-gray-600 rounded-xl 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800
                             transition-all"
                  dir="rtl"
                />
                
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  💡 טיפ: כתבי גם זמן - "תמלול 3 שעות" או "שיחה חצי שעה"
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !text.trim()}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium
                             hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>
                      <span>📝</span>
                      <span>תפוס ושבץ אח"כ</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 
                             rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  ביטול
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QuickAdd;
