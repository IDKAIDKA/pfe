
export type Theme = 'light' | 'dark' | 'ocean' | 'forest' | 'sepia' | 'cyber';
export type ViewMode = 'list' | 'slide';

export interface Prompt {
  id: string;
  name: string;
  text: string;
}

export interface TextVersion {
  text: string;
  humanScore: number;
  timestamp: number;
  promptName?: string;
}

export interface Paragraph {
  id: string;
  original: string;
  versions: TextVersion[];
  activeVersionIdx: number;
  lastEdit: number;
  isTitle?: boolean;
}

export interface ArticleSnapshot {
  id: string;
  name: string;
  paragraphs: Paragraph[];
  timestamp: number;
}

export interface Session {
  id: string;
  fileName: string;
  paragraphs: Paragraph[];
  snapshots: ArticleSnapshot[];
  timestamp: number;
}
