export function saveJSON(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export function loadJSON<T = any>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    if (!s) return null;
    return JSON.parse(s) as T;
  } catch { return null; }
}
export function removeItem(key: string) {
  try { localStorage.removeItem(key); } catch {}
}