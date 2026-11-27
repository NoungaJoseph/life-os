import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import { buildEventReminderSchedule, EventReminderOffset } from './eventRemindersLogic';
import {
  NOTIFICATION_CHANNEL_ID,
  configureNotifications,
  ensureLocalNotificationPermission,
  ensureNotificationChannel,
} from './notificationsSetup';
import { CalendarEvent } from './types';

const NOTIF_IDS_KEY = 'mylifeos:calendar-events:notif-ids';

export interface EventReminderCopy {
  channelName: string;
  format: (title: string, offset: EventReminderOffset) => { title: string; body: string };
}

/** Build translated copy helper for 1w / 2d / 1d local event reminders. */
export function makeEventReminderCopy(t: TFunction): EventReminderCopy {
  return {
    channelName: t('ui.push.channel'),
    format: (title, offset) => {
      if (offset === 7) {
        return {
          title: t('planner.eventReminder.weekTitle'),
          body: t('planner.eventReminder.weekBody', { title }),
        };
      }
      if (offset === 2) {
        return {
          title: t('planner.eventReminder.twoDaysTitle'),
          body: t('planner.eventReminder.twoDaysBody', { title }),
        };
      }
      return {
        title: t('planner.eventReminder.oneDayTitle'),
        body: t('planner.eventReminder.oneDayBody', { title }),
      };
    },
  };
}

/** Sync local 1-week, 2-day, and 1-day notifications for upcoming calendar events. */
export async function syncCalendarEventNotifications(
  events: Pick<CalendarEvent, 'id' | 'title' | 'starts_at' | 'location'>[],
  copy: EventReminderCopy,
  requestIfNeeded = false,
): Promise<'scheduled' | 'denied' | 'web'> {
  if (Platform.OS === 'web') return 'web';
  configureNotifications();
  try {
    const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    if (raw) {
      const oldIds = JSON.parse(raw) as string[];
      if (Array.isArray(oldIds)) {
        await Promise.all(oldIds.map((id) => cancelScheduledNotificationAsync(id).catch(() => undefined)));
      }
      await AsyncStorage.removeItem(NOTIF_IDS_KEY);
    }

    const perm = await ensureLocalNotificationPermission({ requestIfNeeded });
    if (perm !== 'granted') return 'denied';
    await ensureNotificationChannel(copy.channelName);

    const items = buildEventReminderSchedule(events, new Date());
    const scheduledIds: string[] = [];
    for (const item of items) {
      const msg = copy.format(item.eventTitle, item.offsetDays);
      try {
        const id = await scheduleNotificationAsync({
          content: {
            title: msg.title,
            body: msg.body,
            sound: 'default',
            data: {
              route: '/(tabs)/planner',
              date: item.eventDate,
              eventId: item.eventId,
              offsetDays: item.offsetDays,
            },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: item.fireAt,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
        scheduledIds.push(id);
      } catch {
        /* continue scheduling remaining reminders if one trigger fails */
      }
    }

    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(scheduledIds));
    return 'scheduled';
  } catch {
    return 'denied';
  }
}
