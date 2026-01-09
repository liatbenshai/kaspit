/**
 * useGoogleCalendar Hook - V2 עם סנכרון אמיתי
 * =============================================
 * מייבא אירועים מגוגל כמשימות אמיתיות בדאטהבייס
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

// =====================================
// קונפיגורציה
// =====================================

const GOOGLE_CLIENT_ID = '817535440248-c3bfvtta658ogdjdk473brbecumhs182.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const TOKEN_KEY = 'zmanit_google_token';
const CALENDAR_ID_KEY = 'zmanit_selected_calendar_id';

// =====================================
// Hook
// =====================================

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [calendars, setCalendars] = useState([]);
  // ✅ טעינת היומן השמור או 'primary' כברירת מחדל
  const [selectedCalendarId, setSelectedCalendarIdState] = useState(() => {
    return localStorage.getItem(CALENDAR_ID_KEY) || 'primary';
  });
  const [googleEmail, setGoogleEmail] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  // ✅ פונקציה לשמירת בחירת היומן
  const setSelectedCalendarId = useCallback((calendarId) => {
    setSelectedCalendarIdState(calendarId);
    localStorage.setItem(CALENDAR_ID_KEY, calendarId);
  }, []);

  // =====================================
  // אתחול Google API
  // =====================================

  useEffect(() => {
    loadGoogleScripts();
  }, []);

  const loadGoogleScripts = async () => {
    try {
      await waitForGapi();
      await waitForGis();

      await new Promise((resolve, reject) => {
        window.gapi.load('client', { callback: resolve, onerror: reject });
      });

      await window.gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      });

      setGapiReady(true);

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => handleTokenResponse(response),
      });
      setTokenClient(client);

      // בדיקה אם יש טוקן שמור
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        try {
          const token = JSON.parse(savedToken);
          if (token.expires_at > Date.now()) {
            window.gapi.client.setToken(token);
            setIsConnected(true);
            loadCalendars();
            loadUserEmail();
          } else {
            localStorage.removeItem(TOKEN_KEY);
          }
        } catch (e) {
          localStorage.removeItem(TOKEN_KEY);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('שגיאה בטעינת Google API:', err);
      setIsLoading(false);
    }
  };

  // המתנה ל-GAPI
  const waitForGapi = () => {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  // המתנה ל-GIS
  const waitForGis = () => {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        const checkGis = setInterval(() => {
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkGis);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkGis);
          reject(new Error('Timeout waiting for GIS'));
        }, 5000);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  // טיפול בתגובת הטוקן
  const handleTokenResponse = (response) => {
    if (response.error) {
      console.error('Error getting token:', response.error);
      toast.error('שגיאה בהתחברות ליומן גוגל');
      return;
    }

    const token = {
      access_token: response.access_token,
      expires_at: Date.now() + (response.expires_in * 1000),
    };

    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    window.gapi.client.setToken(token);
    setIsConnected(true);
    loadCalendars();
    loadUserEmail();
    toast.success('התחברת ליומן גוגל! 🎉');
  };

  // טעינת יומנים
  const loadCalendars = async () => {
    try {
      const response = await window.gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items || []);
    } catch (err) {
      console.error('שגיאה בטעינת יומנים:', err);
    }
  };

  // טעינת אימייל
  const loadUserEmail = async () => {
    try {
      const response = await window.gapi.client.calendar.calendars.get({
        calendarId: 'primary'
      });
      setGoogleEmail(response.result.id);
    } catch (err) {
      // ignore
    }
  };

  // =====================================
  // התחברות והתנתקות
  // =====================================

  const connect = useCallback(() => {
    if (!tokenClient) {
      toast.error('ממתין לטעינת Google API...');
      return;
    }
    tokenClient.requestAccessToken();
  }, [tokenClient]);

  const disconnect = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken(null);
    }
    localStorage.removeItem(TOKEN_KEY);
    setIsConnected(false);
    setCalendars([]);
    setGoogleEmail(null);
    toast.success('התנתקת מיומן גוגל');
  }, []);

  // =====================================
  // 🔄 סנכרון אמיתי - ייבוא כמשימות
  // =====================================

  /**
   * סנכרון אירועים מגוגל ויצירת משימות אמיתיות בדאטהבייס
   */
  const syncGoogleEvents = useCallback(async (date, userId, addTaskFn, existingTasks = []) => {
    if (!isConnected || !userId) {
      return { imported: 0, updated: 0 };
    }

    setIsSyncing(true);

    try {
      // 1. קבלת אירועים מגוגל
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const response = await window.gapi.client.calendar.events.list({
        calendarId: selectedCalendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.result.items || [];
      const dateStr = start.toISOString().split('T')[0];

      let imported = 0;
      let updated = 0;

      // 2. לכל אירוע - בדיקה אם כבר קיים
      for (const event of events) {
        // דילוג על אירועי יום שלם
        if (!event.start?.dateTime) continue;

        // דילוג על אירועים שיוצאו מזמנית
        if (event.extendedProperties?.private?.zmanitTaskId) continue;

        const googleEventId = event.id;
        
        // בדיקה אם כבר יש משימה עם אותו google_event_id
        const existingTask = existingTasks.find(t => t.google_event_id === googleEventId);

        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
        const timeStr = startTime.toTimeString().slice(0, 5);

        if (existingTask) {
          // עדכון אם השתנה משהו
          const needsUpdate = 
            existingTask.title !== (event.summary || 'אירוע מיומן גוגל') ||
            existingTask.due_time !== timeStr ||
            existingTask.estimated_duration !== durationMinutes;

          if (needsUpdate) {
            await supabase
              .from('tasks')
              .update({
                title: event.summary || 'אירוע מיומן גוגל',
                due_time: timeStr,
                estimated_duration: durationMinutes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingTask.id);
            updated++;
          }
        } else {
          // יצירת משימה חדשה
          const { error } = await supabase
            .from('tasks')
            .insert({
              user_id: userId,
              title: event.summary || 'אירוע מיומן גוגל',
              description: event.description || null,
              quadrant: 1,
              start_date: dateStr,
              due_date: dateStr,
              due_time: timeStr,
              estimated_duration: durationMinutes,
              task_type: 'meeting',
              priority: 'normal',
              google_event_id: googleEventId,
              is_from_google: true,
              is_completed: false,
            });

          if (!error) {
            imported++;
          }
        }
      }

      setLastSyncAt(new Date().toISOString());
      setIsSyncing(false);

      if (imported > 0 || updated > 0) {
        toast.success(`📅 סונכרנו ${imported} אירועים חדשים${updated > 0 ? `, ${updated} עודכנו` : ''}`);
      }

      return { imported, updated };

    } catch (err) {
      console.error('שגיאה בסנכרון:', err);
      setIsSyncing(false);
      return { imported: 0, updated: 0 };
    }
  }, [isConnected, selectedCalendarId]);

  // =====================================
  // ייצוא משימה ליומן
  // =====================================

  const exportTaskToGoogle = useCallback(async (task, scheduledBlock) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return null;
    }

    // אם כבר יש google_event_id - לא מייצאים שוב
    if (task.google_event_id) {
      return task.google_event_id;
    }

    try {
      const startDateTime = new Date(`${scheduledBlock.date}T${scheduledBlock.startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + (scheduledBlock.duration || 30) * 60000);

      const event = {
        summary: `${getTaskIcon(task.task_type)} ${task.title}`,
        description: task.notes || task.description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        extendedProperties: {
          private: {
            zmanitTaskId: task.id,
            zmanitExport: 'true',
          },
        },
      };

      const response = await window.gapi.client.calendar.events.insert({
        calendarId: selectedCalendarId,
        resource: event,
      });

      const eventId = response.result.id;

      // עדכון המשימה עם google_event_id
      await supabase
        .from('tasks')
        .update({ google_event_id: eventId })
        .eq('id', task.id);

      return eventId;

    } catch (err) {
      console.error('שגיאה בייצוא ליומן:', err);
      toast.error('שגיאה בייצוא ליומן גוגל');
      return null;
    }
  }, [isConnected, selectedCalendarId]);

  // ייצוא מרובה
  const exportTasks = useCallback(async (tasks) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return;
    }

    setIsSyncing(true);
    let exported = 0;

    for (const task of tasks) {
      if (task.google_event_id) continue; // כבר יוצא

      const block = {
        date: task.start_date || task.due_date,
        startTime: task.due_time || '09:00',
        duration: task.estimated_duration || 30,
      };

      const eventId = await exportTaskToGoogle(task, block);
      if (eventId) exported++;
    }

    setIsSyncing(false);

    if (exported > 0) {
      toast.success(`📤 יוצאו ${exported} משימות ליומן גוגל`);
    }
  }, [isConnected, exportTaskToGoogle]);

  // =====================================
  // פונקציות עזר
  // =====================================

  const getTaskIcon = (type) => {
    const icons = {
      transcription: '🎙️',
      proofreading: '📝',
      translation: '🌍',
      admin: '📋',
      email: '📧',
      course: '📚',
      meeting: '👔',
      client_communication: '💬',
      management: '💼',
      family: '👨‍👩‍👧‍👦',
      kids: '🧒',
      personal: '🧘',
      other: '📌',
    };
    return icons[type] || '📌';
  };

  // =====================================
  // Return
  // =====================================

  return {
    isConnected,
    isLoading,
    isSyncing,
    googleEmail,
    lastSyncAt,
    calendars,
    selectedCalendarId,
    setSelectedCalendarId,
    connect,
    disconnect,
    syncGoogleEvents,
    exportTaskToGoogle,
    exportTasks,
  };
}

export default useGoogleCalendar;
