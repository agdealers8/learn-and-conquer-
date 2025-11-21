
export enum ViewState {
  HOME = 'HOME',
  CHAT = 'CHAT',
  FLASHCARDS = 'FLASHCARDS',
  QUIZ = 'QUIZ',
  CONTRIBUTE = 'CONTRIBUTE',
  SETTINGS = 'SETTINGS',
  PLANNER = 'PLANNER',
  LIBRARY = 'LIBRARY',
  WHITEBOARD = 'WHITEBOARD'
}

export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  MANDARIN = 'Chinese (Mandarin)',
  ARABIC = 'Arabic',
  URDU = 'Urdu',
  HINDI = 'Hindi'
}

export interface User {
  name: string;
  email: string;
  isLoggedIn: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Flashcard {
  front: string;
  back: string;
  imageKeyword?: string; // For generating a related image
  generatedImage?: string; // Base64 string of the generated image
}

export interface FlashcardSet {
  id: string;
  topic: string;
  date: number;
  cards: Flashcard[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface StudySettings {
  language: Language;
  syllabus: string; 
  userLevel: string; // Class/Grade
  country: string;
  province: string;
}

export interface StudyNote {
  id: string;
  title: string;
  author: string;
  verified: boolean;
  content: string;
  category: string;
  date: string;
}

export interface StudySession {
  id: string;
  time: string;
  activity: string;
  duration: string;
  notes?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  summary: string;
  content: string; // Simplified for demo
}
