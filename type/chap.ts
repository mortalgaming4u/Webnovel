export type Chap = {
  idx?: number;
  url?: string;
  title?: string;
  content?: string;
  text?: string; // ← resolves your Reader.tsx error
};
