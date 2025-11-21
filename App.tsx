import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Language, StudySettings, Message, Flashcard, FlashcardSet, QuizQuestion, StudyNote, User, StudySession, Book } from './types';
import { Icons } from './components/Icons';
import { streamChatResponse, generateFlashcards, generateQuiz, summarizeText, generateStudySchedule, findExternalBookResource, generateIllustration, analyzeHandwriting } from './services/geminiService';
import html2canvas from 'html2canvas';

// --- Translation Helper ---

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'Home': { [Language.SPANISH]: 'Inicio', [Language.FRENCH]: 'Accueil', [Language.MANDARIN]: '首页', [Language.ARABIC]: 'الرئيسية', [Language.URDU]: 'گھر', [Language.HINDI]: 'घर' },
  'Planner': { [Language.SPANISH]: 'Planificador', [Language.FRENCH]: 'Planificateur', [Language.MANDARIN]: '规划师', [Language.ARABIC]: 'مخطط', [Language.URDU]: 'منصوبہ ساز', [Language.HINDI]: 'योजना' },
  'Library': { [Language.SPANISH]: 'Biblioteca', [Language.FRENCH]: 'Bibliothèque', [Language.MANDARIN]: '图书馆', [Language.ARABIC]: 'مكتبة', [Language.URDU]: 'لائبریری', [Language.HINDI]: 'पुस्तकालय' },
  'AI Chat': { [Language.SPANISH]: 'Chat IA', [Language.FRENCH]: 'Chat IA', [Language.MANDARIN]: 'AI 聊天', [Language.ARABIC]: 'دردشة AI', [Language.URDU]: 'AI بات چیت', [Language.HINDI]: 'AI चैट' },
  'Cards': { [Language.SPANISH]: 'Tarjetas', [Language.FRENCH]: 'Cartes', [Language.MANDARIN]: '卡片', [Language.ARABIC]: 'بطاقات', [Language.URDU]: 'کارڈز', [Language.HINDI]: 'कार्ड्स' },
  'Quiz': { [Language.SPANISH]: 'Cuestionario', [Language.FRENCH]: 'Quiz', [Language.MANDARIN]: '测验', [Language.ARABIC]: 'اختبار', [Language.URDU]: 'کوئز', [Language.HINDI]: 'प्रश्नोत्तरी' },
  'Notes': { [Language.SPANISH]: 'Notas', [Language.FRENCH]: 'Notes', [Language.MANDARIN]: '笔记', [Language.ARABIC]: 'ملاحظات', [Language.URDU]: 'نوٹس', [Language.HINDI]: 'नोट्स' },
  'Settings': { [Language.SPANISH]: 'Ajustes', [Language.FRENCH]: 'Paramètres', [Language.MANDARIN]: '设置', [Language.ARABIC]: 'إعدادات', [Language.URDU]: 'ترتیبات', [Language.HINDI]: 'सेटिंग्स' },
  'Language': { [Language.SPANISH]: 'Idioma', [Language.FRENCH]: 'Langue', [Language.MANDARIN]: '语言', [Language.ARABIC]: 'لغة', [Language.URDU]: 'زبان', [Language.HINDI]: 'भाषा' },
  'Clear History': { [Language.SPANISH]: 'Borrar Historial', [Language.FRENCH]: 'Effacer l\'historique', [Language.MANDARIN]: '清除历史', [Language.ARABIC]: 'مسح السجل', [Language.URDU]: 'تاریخ صاف کریں', [Language.HINDI]: 'इतिहास मिटाएं' },
  'Summarize': { [Language.SPANISH]: 'Resumir', [Language.FRENCH]: 'Résumer', [Language.MANDARIN]: '总结', [Language.ARABIC]: 'تلخيص', [Language.URDU]: 'خلاصہ', [Language.HINDI]: 'सारांश' },
  'Paste text to summarize': { [Language.SPANISH]: 'Pega texto para resumir', [Language.FRENCH]: 'Collez le texte à résumer', [Language.MANDARIN]: '粘贴文本进行总结', [Language.ARABIC]: 'الصق النص للتلهيص', [Language.URDU]: 'خلاصہ کرنے کے لیے متن چسپاں کریں', [Language.HINDI]: 'सारांश के लिए टेक्स्ट पेस्ट करें' },
  'Whiteboard': { [Language.SPANISH]: 'Pizarra', [Language.FRENCH]: 'Tableau blanc', [Language.MANDARIN]: '白板', [Language.ARABIC]: 'السبورة', [Language.URDU]: 'وائٹ بورڈ', [Language.HINDI]: 'व्हाइटबोर्ड' },
};

const useTranslation = (lang: Language) => {
  return (key: string) => TRANSLATIONS[key]?.[lang] || key;
};

// --- Components ---

const BottomNav: React.FC<{ current: ViewState, onNavigate: (v: ViewState) => void, settings: StudySettings }> = ({ current, onNavigate, settings }) => {
  const t = useTranslation(settings.language);
  const navItems = [
    { view: ViewState.HOME, icon: Icons.Home, label: t('Home') },
    { view: ViewState.PLANNER, icon: Icons.Calendar, label: t('Planner') },
    { view: ViewState.FLASHCARDS, icon: Icons.Flashcards, label: t('Cards') },
    { view: ViewState.QUIZ, icon: Icons.Quiz, label: t('Quiz') },
    { view: ViewState.CONTRIBUTE, icon: Icons.Community, label: t('Notes') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pb-4 pt-2 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = current === item.view;
        return (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`flex flex-col items-center gap-1 transition-colors duration-200 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const Header: React.FC<{ title: string, onSettings: () => void, settings: StudySettings, user: User, onLogout: () => void }> = ({ title, onSettings, settings, user, onLogout }) => {
  const t = useTranslation(settings.language);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 bg-indigo-600 text-white h-16 px-4 flex items-center justify-between z-50 shadow-md">
      <div className="flex items-center gap-2">
        <Icons.Book size={24} />
        <h1 className="text-lg font-bold tracking-tight truncate max-w-[180px]">{t(title)}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
           <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 px-3 py-1.5 rounded-full transition-colors">
             <div className="w-6 h-6 bg-indigo-400 rounded-full flex items-center justify-center text-xs font-bold">
               {user.name.charAt(0).toUpperCase()}
             </div>
           </button>
           {showMenu && (
             <div className="absolute right-0 top-12 bg-white text-gray-800 rounded-xl shadow-xl p-2 w-40 border border-gray-100 animate-fade-in">
               <button onClick={onSettings} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-2 text-sm">
                 <Icons.Settings size={16} /> Settings
               </button>
               <button onClick={onLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                 <Icons.LogOut size={16} /> Logout
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// --- Login Component ---
const LoginView: React.FC<{ onLogin: (name: string, email: string, settings: Partial<StudySettings>) => void }> = ({ onLogin }) => {
  const [step, setStep] = useState(1); // 1: Auth, 2: Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isRegister, setIsRegister] = useState(true);
  
  // Step 2 State
  const [country, setCountry] = useState('');
  const [province, setProvince] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [grade, setGrade] = useState('');

  const handleNext = () => {
    if (name && email) setStep(2);
  };

  const handleFinish = () => {
    if (country && province && syllabus && grade) {
      onLogin(name, email, {
        country,
        province,
        syllabus,
        userLevel: grade
      });
    } else {
      alert("Please fill all fields to continue.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <Icons.Book size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {step === 1 ? (isRegister ? 'Start Learning' : 'Welcome Back') : 'Academic Profile'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1 ? 'Your personal AI study companion' : 'Customize your learning experience'}
          </p>
        </div>
        
        {step === 1 ? (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="john@example.com"
              />
            </div>
            
            <button 
              onClick={handleNext}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              Next Step <Icons.Right size={18} />
            </button>

            <div className="text-center mt-4">
              <button 
                onClick={() => setIsRegister(!isRegister)}
                className="text-indigo-600 text-sm font-medium hover:underline"
              >
                {isRegister ? 'Already have an account? Login' : 'New here? Create account'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
               <input 
                 value={country}
                 onChange={(e) => setCountry(e.target.value)}
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 placeholder="e.g., Pakistan, USA"
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Province / State</label>
               <input 
                 value={province}
                 onChange={(e) => setProvince(e.target.value)}
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 placeholder="e.g., Punjab, California"
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Syllabus / Curriculum</label>
               <input 
                 value={syllabus}
                 onChange={(e) => setSyllabus(e.target.value)}
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 placeholder="e.g., Punjab Textbook Board, SAT"
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grade / Class</label>
               <select
                 value={grade}
                 onChange={(e) => setGrade(e.target.value)}
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
               >
                 <option value="">Select Grade</option>
                 <option value="Class 9">Class 9</option>
                 <option value="Class 10">Class 10</option>
                 <option value="Inter Part 1 (11th)">Inter Part 1 (11th)</option>
                 <option value="Inter Part 2 (12th)">Inter Part 2 (12th)</option>
                 <option value="Undergraduate">Undergraduate</option>
                 <option value="Other">Other</option>
               </select>
             </div>
             
             <div className="flex gap-2">
               <button 
                 onClick={() => setStep(1)}
                 className="px-4 py-4 text-gray-500 font-bold rounded-xl hover:bg-gray-100"
               >
                 Back
               </button>
               <button 
                 onClick={handleFinish}
                 className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-transform active:scale-95"
               >
                 Finish Setup
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Views ---

const SettingsView: React.FC<{ 
  settings: StudySettings, 
  onUpdate: (s: StudySettings) => void,
  onBack: () => void,
  onClearHistory: () => void,
  isAdminMode: boolean,
  onToggleAdmin: () => void,
  user: User
}> = ({ settings, onUpdate, onBack, onClearHistory, isAdminMode, onToggleAdmin, user }) => {
  const t = useTranslation(settings.language);
  
  const handleAdminToggle = () => {
    if (isAdminMode) {
      onToggleAdmin();
    } else {
      const pwd = prompt("Enter Owner Password:");
      if (pwd === 'ag12de34') {
        onToggleAdmin();
      } else {
        alert("Incorrect Password. Access Denied.");
      }
    }
  };

  return (
    <div className="p-6 pb-24 pt-20 min-h-screen bg-gray-50">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 text-gray-600"><Icons.Left /></button>
        <h2 className="text-2xl font-bold text-gray-800">{t('Settings')}</h2>
      </div>

      <div className="space-y-6">
        {/* Language Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('Language')}</label>
          <select 
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={settings.language}
            onChange={(e) => onUpdate({...settings, language: e.target.value as Language})}
          >
            {Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Academic Profile Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800 border-b pb-2">Academic Profile</h3>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
            <input 
              type="text"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={settings.country}
              onChange={(e) => onUpdate({...settings, country: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Province / State</label>
            <input 
              type="text"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={settings.province}
              onChange={(e) => onUpdate({...settings, province: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Syllabus / Board</label>
            <input 
              type="text"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={settings.syllabus}
              onChange={(e) => onUpdate({...settings, syllabus: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Education Level</label>
            <select 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={settings.userLevel}
              onChange={(e) => onUpdate({...settings, userLevel: e.target.value})}
            >
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
              <option value="Inter Part 1 (11th)">Inter Part 1 (11th)</option>
              <option value="Inter Part 2 (12th)">Inter Part 2 (12th)</option>
              <option value="Undergraduate">Undergraduate</option>
              <option value="Postgraduate">Postgraduate / Professional</option>
            </select>
          </div>
        </div>

        {user.email === 'agdealers8@gmail.com' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center justify-between">
               <div>
                 <h3 className="text-sm font-medium text-gray-700">Owner Mode</h3>
                 <p className="text-xs text-gray-500">Enable editing and adding content.</p>
               </div>
               <button 
                 onClick={handleAdminToggle}
                 className={`w-12 h-6 rounded-full transition-colors relative ${isAdminMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
               >
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAdminMode ? 'left-7' : 'left-1'}`} />
               </button>
             </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Data Management</h3>
          <button 
            onClick={onClearHistory}
            className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
          >
            <Icons.Delete size={18} />
            {t('Clear History')}
          </button>
        </div>
      </div>
    </div>
  );
};

const PlannerView: React.FC<{ settings: StudySettings }> = ({ settings }) => {
  const [input, setInput] = useState('');
  const [schedule, setSchedule] = useState<StudySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationSound, setNotificationSound] = useState('beep');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.play();
      alert(timerMode === 'work' ? "Focus session complete! Take a break." : "Break over! Back to work.");
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, timerMode]);

  const startTimer = (minutes: number, mode: 'work' | 'break') => {
    setTimerMode(mode);
    setTimerSeconds(minutes * 60);
    setIsTimerRunning(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const sounds = {
    'beep': 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
    'alarm': 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    'chime': 'https://actions.google.com/sounds/v1/alarms/chime_zest.ogg',
    'bugle': 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg',
    'scifi': 'https://actions.google.com/sounds/v1/alarms/spaceship_alarm.ogg'
  };

  const handleGenerate = async () => {
    if (!input) return;
    setIsLoading(true);
    try {
      const newSchedule = await generateStudySchedule(input, settings);
      setSchedule(newSchedule);
    } catch (e) {
      alert("Could not generate schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  const notify = (session: StudySession) => {
    const audioUrl = sounds[notificationSound as keyof typeof sounds] || sounds['beep'];
    const audio = new Audio(audioUrl);
    audio.play().catch(e => console.log("Audio play failed interact first"));
    alert(`Time for: ${session.activity}`);
  };

  return (
    <div className="h-screen pt-20 pb-24 px-4 bg-gray-50 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Smart Planner</h2>
        <p className="text-gray-500 text-sm">Let AI organize your day.</p>
      </div>

      <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden mb-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Timer className="text-indigo-200" />
            <h3 className="font-bold text-lg">Focus Timer</h3>
          </div>
          <div className="text-4xl font-mono font-bold mb-6 text-center tracking-wider">
            {formatTime(timerSeconds)}
          </div>
          <div className="flex gap-2 justify-center">
            {!isTimerRunning ? (
              <>
                <button onClick={() => startTimer(25, 'work')} className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50">
                  Start Focus (25m)
                </button>
                <button onClick={() => startTimer(5, 'break')} className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-400">
                  Break (5m)
                </button>
              </>
            ) : (
              <button onClick={() => setIsTimerRunning(false)} className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-bold">
                Stop
              </button>
            )}
          </div>
        </div>
        <Icons.Clock className="absolute -bottom-4 -right-4 text-indigo-500 w-32 h-32 opacity-20" />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notification Sound</label>
        <select 
          value={notificationSound} 
          onChange={(e) => setNotificationSound(e.target.value)}
          className="w-full p-3 bg-white border border-gray-200 rounded-xl"
        >
          {Object.keys(sounds).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Add Study Session</label>
        <div className="flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-3 bg-white border border-gray-200 rounded-xl"
            placeholder="e.g., I have 2 hours for Math today"
          />
          <button 
            onClick={handleGenerate} 
            disabled={isLoading}
            className="bg-indigo-600 text-white p-3 rounded-xl disabled:opacity-50"
          >
            {isLoading ? <Icons.Sparkles className="animate-spin" /> : <Icons.Plus />}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {schedule.map((session, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border-l-4 border-indigo-500 shadow-sm flex justify-between items-center">
            <div>
              <div className="font-bold text-gray-800">{session.time} - {session.activity}</div>
              <div className="text-xs text-gray-500">{session.duration} • {session.notes}</div>
            </div>
            <button onClick={() => notify(session)} className="text-indigo-600"><Icons.Bell size={18} /></button>
          </div>
        ))}
        {schedule.length === 0 && !isLoading && (
          <div className="text-center text-gray-400 mt-10">
            <Icons.Calendar size={48} className="mx-auto mb-2 opacity-20" />
            <p>No schedule yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const FlashcardView: React.FC<{ settings: StudySettings }> = ({ settings }) => {
  const [topic, setTopic] = useState('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic) return;
    setIsLoading(true);
    try {
      const newCards = await generateFlashcards(topic, settings);
      setCards(newCards);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (e) {
      alert("Failed to generate cards.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlip = () => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10); 
    }
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(20);
    }
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `flashcards-${topic}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  useEffect(() => {
    const loadImg = async () => {
      const card = cards[currentIndex];
      if (card && !card.generatedImage && card.imageKeyword) {
         const imgData = await generateIllustration(card.imageKeyword);
         if (imgData) {
            const updatedCards = [...cards];
            updatedCards[currentIndex].generatedImage = imgData;
            setCards(updatedCards);
         }
      }
    };
    if(cards.length > 0) loadImg();
  }, [currentIndex, cards]);

  return (
    <div className="h-screen pt-20 pb-24 px-4 bg-gray-50 flex flex-col">
      <div className="flex gap-2 mb-6">
        <input 
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="flex-1 p-3 bg-white border border-gray-200 rounded-xl shadow-sm"
          placeholder="Topic (e.g., Photosynthesis)"
        />
        <button 
          onClick={handleGenerate} 
          disabled={isLoading}
          className="bg-indigo-600 text-white px-4 rounded-xl shadow-sm disabled:opacity-50"
        >
          {isLoading ? <Icons.Sparkles className="animate-spin" /> : <Icons.Plus />}
        </button>
      </div>

      {cards.length > 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center relative">
           <div className="perspective-1000 w-full max-w-sm aspect-[3/4] relative">
             <div 
                onClick={handleFlip}
                className={`w-full h-full relative transform-style-3d transition-transform duration-500 cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
              >
                {/* Front */}
                <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col items-center justify-center text-center">
                   {cards[currentIndex].generatedImage ? (
                     <img src={cards[currentIndex].generatedImage} alt="Visual" className="w-32 h-32 object-contain mb-6" />
                   ) : (
                     <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                       <Icons.Image className="text-indigo-300" size={32} />
                     </div>
                   )}
                   <h3 className="text-xl font-bold text-gray-800">{cards[currentIndex].front}</h3>
                   <p className="text-xs text-gray-400 mt-4">Tap to flip</p>
                </div>

                {/* Back */}
                <div className="absolute w-full h-full backface-hidden bg-indigo-600 text-white rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center text-center rotate-y-180">
                   <p className="text-lg font-medium leading-relaxed">{cards[currentIndex].back}</p>
                </div>
             </div>
           </div>

           {/* Controls */}
           <div className="w-full max-w-sm mt-8">
              <button 
                onClick={handleNext}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 mb-4 flex items-center justify-center gap-2"
              >
                Next Flashcard <Icons.Right size={20} />
              </button>
              
              <div className="flex justify-between items-center">
                 <button onClick={handlePrev} className="p-2 text-gray-400 hover:text-gray-600"><Icons.Left /></button>
                 <span className="text-sm font-mono text-gray-400">{currentIndex + 1} / {cards.length}</span>
                 <button onClick={downloadJSON} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Icons.Download size={20} /></button>
              </div>
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-50">
          <Icons.Flashcards size={64} className="mb-4" />
          <p>Enter a topic to start</p>
        </div>
      )}
    </div>
  );
};

const QuizView: React.FC<{ settings: StudySettings }> = ({ settings }) => {
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    if (!topic) return;
    setIsLoading(true);
    try {
      const qs = await generateQuiz(topic, requirements, settings);
      setQuestions(qs);
      setCurrentIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setShowResult(false);
    } catch(e) {
      alert("Quiz generation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    if (index === questions[currentIndex].correctAnswerIndex) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  return (
    <div className="h-screen pt-20 pb-24 px-4 bg-gray-50 overflow-y-auto">
      {!questions.length || showResult ? (
        <div className="max-w-md mx-auto">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
             {showResult ? (
               <>
                 <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                   <Icons.Sparkles size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
                 <p className="text-4xl font-black text-indigo-600 mb-6">{score} / {questions.length}</p>
                 <button onClick={() => setQuestions([])} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Try Another</button>
               </>
             ) : (
               <>
                 <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                   <Icons.Quiz size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-gray-800 mb-4">AI Quiz Generator</h2>
                 <input 
                   value={topic}
                   onChange={(e) => setTopic(e.target.value)}
                   className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl mb-3"
                   placeholder="Topic (e.g. Calculus)"
                 />
                 <input 
                   value={requirements}
                   onChange={(e) => setRequirements(e.target.value)}
                   className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 text-sm"
                   placeholder="Requirements (e.g. Hard, Conceptual)"
                 />
                 <button 
                   onClick={handleStart}
                   disabled={isLoading}
                   className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md disabled:opacity-70"
                 >
                   {isLoading ? 'Generating...' : 'Start Quiz'}
                 </button>
               </>
             )}
           </div>
        </div>
      ) : (
        <div className="pb-20">
          <div className="flex justify-between text-sm font-medium text-gray-500 mb-4">
             <span>Question {currentIndex + 1} of {questions.length}</span>
             <span>Score: {score}</span>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-bold text-gray-800 leading-snug">{questions[currentIndex].question}</h3>
          </div>

          <div className="space-y-3">
            {questions[currentIndex].options.map((opt, idx) => {
              let stateClass = "bg-white border-gray-200 hover:border-indigo-300";
              if (selectedAnswer !== null) {
                 if (idx === questions[currentIndex].correctAnswerIndex) stateClass = "bg-green-50 border-green-500 text-green-700";
                 else if (idx === selectedAnswer) stateClass = "bg-red-50 border-red-500 text-red-700";
                 else stateClass = "bg-gray-50 border-gray-100 text-gray-400";
              }
              
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={selectedAnswer !== null}
                  className={`w-full p-4 text-left rounded-xl border-2 transition-all ${stateClass}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {selectedAnswer !== null && (
            <div className="mt-6 animate-fade-in">
               <div className="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-800 mb-4">
                 <strong>Explanation:</strong> {questions[currentIndex].explanation}
               </div>
               <button onClick={nextQuestion} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">
                 {currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'}
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ContributeView: React.FC<{ settings: StudySettings, isAdminMode: boolean }> = ({ settings, isAdminMode }) => {
  const t = useTranslation(settings.language);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summarizeInput, setSummarizeInput] = useState('');
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const handleAdd = () => {
    if (!title || !content) return;
    const newNote: StudyNote = {
      id: Date.now().toString(),
      title,
      content,
      author: 'You',
      verified: false,
      category: 'General',
      date: new Date().toLocaleDateString()
    };
    setNotes([newNote, ...notes]);
    setTitle('');
    setContent('');
    setIsEditing(null);
  };

  const handleSummarize = async () => {
    if (!summarizeInput) return;
    setIsSummarizing(true);
    try {
      const result = await summarizeText(summarizeInput, settings);
      setSummary(result);
    } catch (e) {
      setSummary("Error summarizing text.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDelete = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const handleEdit = (note: StudyNote) => {
    setTitle(note.title);
    setContent(note.content);
    setIsEditing(note.id);
    // Remove old version, to be re-added on save
    setNotes(notes.filter(n => n.id !== note.id));
  };

  return (
    <div className="h-screen pt-20 pb-24 px-4 bg-gray-50 overflow-y-auto">
      
      {/* Summarizer Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Icons.Sparkles className="text-indigo-500" size={18} /> 
          {t('Summarize')}
        </h3>
        <textarea 
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm min-h-[100px] mb-3"
          placeholder={t('Paste text to summarize')}
          value={summarizeInput}
          onChange={(e) => setSummarizeInput(e.target.value)}
        />
        <button 
          onClick={handleSummarize}
          disabled={isSummarizing}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {isSummarizing ? 'Thinking...' : 'Summarize'}
        </button>
        {summary && (
          <div className="mt-4 p-4 bg-indigo-50 text-indigo-900 rounded-xl text-sm leading-relaxed">
            {summary}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{t('Notes')}</h2>
        {isAdminMode && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Admin</span>}
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <input 
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl mb-3"
          placeholder="Note Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea 
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl min-h-[100px] mb-3"
          placeholder="Write your notes here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button onClick={handleAdd} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md">
          {isEditing ? 'Update Note' : 'Save Note'}
        </button>
      </div>

      <div className="space-y-4">
        {notes.map(note => (
          <div key={note.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-800">{note.title}</h3>
              <div className="flex gap-2">
                 {isAdminMode && (
                   <button onClick={() => handleEdit(note)} className="text-indigo-500 p-1 hover:bg-indigo-50 rounded"><Icons.Edit size={16} /></button>
                 )}
                 <button onClick={() => handleDelete(note.id)} className="text-gray-400 p-1 hover:text-red-500"><Icons.Delete size={16} /></button>
              </div>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">{note.content}</p>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{note.date}</span>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Icons.FileText size={48} className="mx-auto mb-2 opacity-20" />
            <p>No notes yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const LibraryView: React.FC<{ settings: StudySettings, isAdminMode: boolean }> = ({ settings, isAdminMode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([
    { id: '1', title: 'Physics I', author: 'OpenStax', coverColor: 'bg-blue-500', summary: 'Mechanics, Waves, and Thermodynamics.', content: 'Sample content...' },
    { id: '2', title: 'World History', author: 'CrashCourse', coverColor: 'bg-amber-600', summary: 'From ancient civilizations to modern times.', content: 'Sample content...' }
  ]);
  const [searching, setSearching] = useState(false);
  const [externalLink, setExternalLink] = useState<{title?: string, link?: string, description?: string} | null>(null);

  const handleSearch = async () => {
    setExternalLink(null);
    const localResults = books.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (localResults.length === 0 && searchQuery.length > 3) {
       setSearching(true);
       try {
         const res = await findExternalBookResource(searchQuery, settings);
         if (res.found) {
            setExternalLink({ title: res.title, link: res.link, description: res.description });
         }
       } catch(e) {} finally {
         setSearching(false);
       }
    }
  };

  const handleAddBook = () => {
    if (!isAdminMode) return;
    const title = prompt("Book Title:");
    if (title) {
      setBooks([...books, { id: Date.now().toString(), title, author: 'Unknown', coverColor: 'bg-gray-500', summary: 'Added manually', content: '' }]);
    }
  };

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-screen pt-20 pb-24 px-4 bg-gray-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-bold text-gray-800">Library</h2>
         {isAdminMode && <button onClick={handleAddBook} className="text-indigo-600"><Icons.PlusCircle /></button>}
      </div>

      <div className="relative mb-8">
        <input 
          className="w-full p-4 pl-12 bg-white border-none rounded-2xl shadow-sm text-gray-800 placeholder-gray-400"
          placeholder="Search for books..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Icons.Search className="absolute left-4 top-4 text-gray-400" size={20} />
      </div>

      {externalLink && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6 animate-fade-in">
          <h4 className="font-bold text-indigo-900 flex items-center gap-2"><Icons.Globe size={16}/> Online Resource Found</h4>
          <p className="text-sm font-bold mt-1">{externalLink.title}</p>
          <p className="text-xs text-indigo-700 mt-1 mb-3">{externalLink.description}</p>
          <a href={externalLink.link} target="_blank" rel="noreferrer" className="text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg inline-flex items-center gap-1">
            Open Resource <Icons.ExternalLink size={12} />
          </a>
        </div>
      )}

      {searching && <div className="text-center py-4 text-gray-400">Searching global database...</div>}

      <div className="grid grid-cols-2 gap-4">
        {filteredBooks.map(book => (
           <div key={book.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
             <div className={`h-32 ${book.coverColor} rounded-lg mb-4 shadow-inner w-full`}></div>
             <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1">{book.title}</h3>
             <p className="text-xs text-gray-500 mb-2">{book.author}</p>
             <button className="mt-auto text-xs font-bold text-indigo-600 bg-indigo-50 py-2 rounded-lg">Read Now</button>
           </div>
        ))}
      </div>
    </div>
  );
};

const WhiteboardView: React.FC<{ settings: StudySettings }> = ({ settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    
    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if(!isDrawing) return;
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    if ('touches' in e) {
       const rect = canvas.getBoundingClientRect();
       return {
         offsetX: e.touches[0].clientX - rect.left,
         offsetY: e.touches[0].clientY - rect.top
       };
    } else {
       return {
         offsetX: (e as React.MouseEvent).nativeEvent.offsetX,
         offsetY: (e as React.MouseEvent).nativeEvent.offsetY
       };
    }
  };

  const handleAnalyze = async () => {
     if(!canvasRef.current) return;
     setIsAnalyzing(true);
     const image = canvasRef.current.toDataURL("image/png");
     try {
       const result = await analyzeHandwriting(image, settings);
       setAnalysis(result);
     } catch(e) {
       setAnalysis("Failed to analyze.");
     } finally {
       setIsAnalyzing(false);
     }
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    if(canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setAnalysis('');
  };

  return (
    <div className="h-screen pt-20 pb-24 px-4 bg-gray-50 flex flex-col">
       <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Icons.Pen size={20}/> AI Whiteboard</h2>
          <button onClick={clearBoard} className="text-red-500 text-sm">Clear</button>
       </div>
       
       <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden touch-none">
          <canvas 
            ref={canvasRef}
            width={window.innerWidth - 32}
            height={400}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full"
          />
       </div>

       <div className="mt-4">
         <button 
           onClick={handleAnalyze}
           disabled={isAnalyzing}
           className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg"
         >
           {isAnalyzing ? 'Analyzing...' : 'Solve / Explain'}
         </button>
       </div>
       
       {analysis && (
         <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-900 max-h-40 overflow-y-auto">
           {analysis}
         </div>
       )}
    </div>
  );
};

const ChatView: React.FC<{ settings: StudySettings }> = ({ settings }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: `Hi! I'm Learn and Conquer. I can help you with ${settings.syllabus || 'your studies'}. What's on your mind?`, timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Create placeholder for AI response
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '', timestamp: Date.now() }]);

    try {
      let fullText = "";
      await streamChatResponse(messages, userMsg.text, settings, (chunk) => {
        fullText += chunk;
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m));
      });
      
      if (isVoiceMode && 'speechSynthesis' in window) {
         const utterance = new SpeechSynthesisUtterance(fullText);
         // Simple language mapping
         const langMap: Record<string, string> = { 
           [Language.SPANISH]: 'es-ES', 
           [Language.FRENCH]: 'fr-FR',
           [Language.MANDARIN]: 'zh-CN',
           [Language.HINDI]: 'hi-IN'
         };
         utterance.lang = langMap[settings.language] || 'en-US';
         window.speechSynthesis.speak(utterance);
      }

    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: "I'm having trouble connecting. Please try again." } : m));
    } finally {
      setIsTyping(false);
    }
  };

  // Simple voice input simulation using Web Speech API if available
  const toggleVoice = () => {
     if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
       alert("Voice input not supported in this browser.");
       return;
     }
     const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
     const recognition = new SpeechRecognition();
     
     recognition.onstart = () => setIsVoiceMode(true);
     recognition.onend = () => setIsVoiceMode(false);
     recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        // Auto send could be added here
     };
     
     if(!isVoiceMode) recognition.start();
     else setIsVoiceMode(false); // Logic simplified
  };

  return (
    <div className="h-screen pt-20 pb-24 bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                {msg.text}
             </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-gray-100 flex gap-1">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-2">
        <div className="bg-white p-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
           <button 
             onClick={toggleVoice}
             className={`p-3 rounded-full transition-colors ${isVoiceMode ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}
           >
             {isVoiceMode ? <Icons.MicOff size={20} /> : <Icons.Mic size={20} />}
           </button>
           <input 
             className="flex-1 bg-transparent outline-none text-sm text-gray-700 ml-2"
             placeholder="Ask anything..."
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSend()}
           />
           <button 
             onClick={handleSend}
             disabled={!input.trim() || isTyping}
             className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-transform active:scale-95"
           >
             <Icons.Send size={18} />
           </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User>({ name: '', email: '', isLoggedIn: false });
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [settings, setSettings] = useState<StudySettings>({
    language: Language.ENGLISH,
    syllabus: '',
    userLevel: 'High School',
    country: '',
    province: ''
  });
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleLogin = (name: string, email: string, profileUpdates: Partial<StudySettings>) => {
    setUser({ name, email, isLoggedIn: true });
    setSettings(prev => ({ ...prev, ...profileUpdates }));
  };

  const handleLogout = () => {
    setUser({ name: '', email: '', isLoggedIn: false });
    setIsAdminMode(false);
  };

  if (!user.isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (currentView === ViewState.SETTINGS) {
    return (
      <SettingsView 
        settings={settings} 
        onUpdate={setSettings} 
        onBack={() => setCurrentView(ViewState.HOME)} 
        onClearHistory={() => alert("History Cleared")}
        isAdminMode={isAdminMode}
        onToggleAdmin={() => setIsAdminMode(!isAdminMode)}
        user={user}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header 
        title={currentView === ViewState.HOME ? 'Learn and Conquer' : currentView} 
        onSettings={() => setCurrentView(ViewState.SETTINGS)}
        settings={settings}
        user={user}
        onLogout={handleLogout}
      />
      
      <main>
        {currentView === ViewState.HOME && (
           <div className="pt-24 pb-24 px-6 flex flex-col items-center justify-center min-h-[80vh] text-center">
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-8 animate-fade-in">
                 <Icons.Book size={48} className="text-indigo-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome, {user.name.split(' ')[0]}</h2>
              <p className="text-gray-500 max-w-xs mx-auto mb-12 leading-relaxed">
                Ready to learn? Choose a mode below to get started with your AI companion.
              </p>
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                 <button onClick={() => setCurrentView(ViewState.CHAT)} className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-indigo-200 transition-colors">
                    <Icons.Chat className="text-indigo-500" />
                    <span className="font-bold text-sm text-gray-700">AI Chat</span>
                 </button>
                 <button onClick={() => setCurrentView(ViewState.PLANNER)} className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-indigo-200 transition-colors">
                    <Icons.Calendar className="text-purple-500" />
                    <span className="font-bold text-sm text-gray-700">Planner</span>
                 </button>
                 <button onClick={() => setCurrentView(ViewState.LIBRARY)} className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-indigo-200 transition-colors">
                    <Icons.Library className="text-amber-500" />
                    <span className="font-bold text-sm text-gray-700">Library</span>
                 </button>
                 <button onClick={() => setCurrentView(ViewState.WHITEBOARD)} className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-indigo-200 transition-colors">
                    <Icons.Pen className="text-emerald-500" />
                    <span className="font-bold text-sm text-gray-700">Whiteboard</span>
                 </button>
              </div>
           </div>
        )}
        {currentView === ViewState.PLANNER && <PlannerView settings={settings} />}
        {currentView === ViewState.FLASHCARDS && <FlashcardView settings={settings} />}
        {currentView === ViewState.QUIZ && <QuizView settings={settings} />}
        {currentView === ViewState.CONTRIBUTE && <ContributeView settings={settings} isAdminMode={isAdminMode} />}
        {currentView === ViewState.LIBRARY && <LibraryView settings={settings} isAdminMode={isAdminMode} />}
        {currentView === ViewState.WHITEBOARD && <WhiteboardView settings={settings} />}
        {currentView === ViewState.CHAT && <ChatView settings={settings} />}
      </main>

      <BottomNav 
        current={currentView} 
        onNavigate={setCurrentView} 
        settings={settings}
      />
    </div>
  );
}