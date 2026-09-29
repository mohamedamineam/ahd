import { api, IS_TAURI } from './bridge';

/** Save text through the native "Save as" dialog (browser: download). Returns false if cancelled. */
export async function saveTextFile(defaultName: string, contents: string, ext: 'csv' | 'json'): Promise<boolean> {
  if (IS_TAURI) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path) return false;
    await api.exportFile(path, contents);
    return true;
  }
  const blob = new Blob([contents], { type: ext === 'csv' ? 'text/csv' : 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

/** Pick a file through the native "Open" dialog and read it as text (size-limited in Rust). */
export async function openTextFile(extensions: string[]): Promise<{ name: string; text: string } | null> {
  if (IS_TAURI) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({ multiple: false, directory: false, filters: [{ name: extensions.join(', ').toUpperCase(), extensions }] });
    if (!path || Array.isArray(path)) return null;
    return { name: path.split(/[\\/]/).pop() ?? path, text: await api.readImportFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.map((e) => `.${e}`).join(',');
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    };
    input.click();
  });
}

/** Pick any file and return its path (desktop only) — used for custom adhan import. */
export async function pickFilePath(extensions: string[]): Promise<string | null> {
  if (!IS_TAURI) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const path = await open({ multiple: false, directory: false, filters: [{ name: extensions.join(', ').toUpperCase(), extensions }] });
  return !path || Array.isArray(path) ? null : path;
}
