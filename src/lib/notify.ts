import { IS_TAURI } from './bridge';

/** Native notification (tauri-plugin-notification) with a browser fallback for development. */
export async function sendNotification(title: string, body: string): Promise<boolean> {
  if (IS_TAURI) {
    const n = await import('@tauri-apps/plugin-notification');
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === 'granted';
    if (!granted) return false;
    n.sendNotification({ title, body });
    return true;
  }
  if (!('Notification' in window)) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  new Notification(title, { body });
  return true;
}
