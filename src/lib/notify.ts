import { api, IS_TAURI } from './bridge';

/** A test notification, sent by the Rust side the way reminders are (src-tauri/src/notify.rs), with a browser
 *  fallback for development. */
export async function sendNotification(title: string, body: string): Promise<boolean> {
  if (IS_TAURI) {
    await api.testNotification(title, body);
    return true;
  }
  if (!('Notification' in window)) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  new Notification(title, { body });
  return true;
}
