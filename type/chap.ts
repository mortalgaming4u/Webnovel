export type Chap = {
  idx?: number;
  url?: string;
  title?: string;
  content?: string;
  text?: string; // fallback field for older/local chapter formats
};