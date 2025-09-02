export function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem("urlHistory") || "[]");
}

export function addHistory(url: string) {
  if (typeof window === "undefined") return;
  let history = loadHistory();
  if (!history.includes(url)) {
    history.unshift(url);
    if (history.length > 10) history.pop();
    localStorage.setItem("urlHistory", JSON.stringify(history));
  }
}
