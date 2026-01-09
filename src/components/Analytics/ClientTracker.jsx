import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';
import Button from '../UI/Button';
import Input from '../UI/Input';

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (minutes < 60) return `${Math.round(minutes)} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * מעקב לקוחות לחיוב
 */
function ClientTracker({ onClose }) {
  const { tasks } = useTasks();
  const { user } = useAuth();
  
  const [clients, setClients] = useState([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientRate, setNewClientRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // טעינת לקוחות
  useEffect(() => {
    if (user?.id) {
      loadClients();
    }
  }, [user?.id]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('שגיאה בטעינת לקוחות:', err);
    }
  };

  // הוספת לקוח
  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      toast.error('נא להזין שם לקוח');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          name: newClientName.trim(),
          hourly_rate: parseFloat(newClientRate) || 0
        });

      if (error) throw error;

      toast.success('לקוח נוסף!');
      setNewClientName('');
      setNewClientRate('');
      setShowAddClient(false);
      await loadClients();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error('שגיאה בהוספת לקוח');
    } finally {
      setLoading(false);
    }
  };

  // סטטיסטיקות לפי חודש
  const monthStats = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // מיפוי משימות לפי לקוח (לפי שם בכותרת)
    const clientStats = {};
    
    // אתחול לקוחות קיימים
    clients.forEach(client => {
      clientStats[client.name.toLowerCase()] = {
        client,
        tasks: [],
        totalMinutes: 0,
        billableAmount: 0
      };
    });

    // חישוב משימות
    tasks.forEach(task => {
      if (task.due_date < startDate || task.due_date > endDate) return;
      if (!task.is_completed) return;

      const title = task.title?.toLowerCase() || '';
      const duration = task.time_spent || task.estimated_duration || 30;

      // חיפוש לקוח בכותרת
      for (const clientName of Object.keys(clientStats)) {
        if (title.includes(clientName)) {
          clientStats[clientName].tasks.push(task);
          clientStats[clientName].totalMinutes += duration;
          
          const hourlyRate = clientStats[clientName].client.hourly_rate || 0;
          clientStats[clientName].billableAmount += (duration / 60) * hourlyRate;
          break;
        }
      }
    });

    // המרה למערך וסינון לקוחות ללא משימות
    const statsArray = Object.values(clientStats)
      .filter(s => s.tasks.length > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    // סה"כ
    const totalMinutes = statsArray.reduce((sum, s) => sum + s.totalMinutes, 0);
    const totalBillable = statsArray.reduce((sum, s) => sum + s.billableAmount, 0);

    return {
      clients: statsArray,
      totalMinutes,
      totalBillable
    };
  }, [tasks, clients, selectedMonth]);

  // רשימת חודשים
  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        value: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        label: date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
      });
    }
    return months;
  }, []);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* כותרת */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>👥</span> מעקב לקוחות
        </h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          {availableMonths.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* סיכום */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatMinutes(monthStats.totalMinutes)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">סה"כ שעות</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            ₪{monthStats.totalBillable.toLocaleString()}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">לחיוב</div>
        </motion.div>
      </div>

      {/* רשימת לקוחות */}
      <div className="space-y-2">
        {monthStats.clients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl block mb-2">📋</span>
            אין משימות עם לקוחות מוגדרים החודש
          </div>
        ) : (
          monthStats.clients.map((stat, index) => (
            <motion.div
              key={stat.client.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * index }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {stat.client.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {stat.tasks.length} משימות • {formatMinutes(stat.totalMinutes)}
                  </p>
                </div>
                <div className="text-left">
                  {stat.client.hourly_rate > 0 && (
                    <>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        ₪{stat.billableAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        ₪{stat.client.hourly_rate}/שעה
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* רשימת לקוחות קיימים */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-700 dark:text-gray-300">לקוחות מוגדרים</h3>
          <button
            onClick={() => setShowAddClient(!showAddClient)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAddClient ? 'ביטול' : '+ הוסף לקוח'}
          </button>
        </div>

        {showAddClient && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3 space-y-2"
          >
            <Input
              label="שם לקוח"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="למשל: משרד כהן"
            />
            <Input
              label="תעריף לשעה (₪)"
              type="number"
              value={newClientRate}
              onChange={(e) => setNewClientRate(e.target.value)}
              placeholder="למשל: 300"
            />
            <Button onClick={handleAddClient} loading={loading} className="w-full">
              הוסף לקוח
            </Button>
          </motion.div>
        )}

        <div className="flex flex-wrap gap-2">
          {clients.map(client => (
            <span
              key={client.id}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300"
            >
              {client.name}
              {client.hourly_rate > 0 && (
                <span className="text-gray-500 mr-1">₪{client.hourly_rate}/h</span>
              )}
            </span>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-2">
          💡 הוסיפי את שם הלקוח לכותרת המשימה כדי שתיספר אוטומטית
        </p>
      </div>

      {/* כפתור סגירה */}
      <button
        onClick={onClose}
        className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        סגור
      </button>
    </div>
  );
}

export default ClientTracker;
