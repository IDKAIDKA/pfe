
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, Minus, Palette, Edit3, X, Copy, Settings2, Loader2, Folder, Trash, 
  ClipboardList, History, ChevronRight, ChevronLeft, Layout,
  Presentation, List, Globe, CheckCircle2, Eye, Combine, Check,
  Undo2, Redo2, Save, PlusCircle, Pencil, Sparkles, BookOpen,
  Layers, BookmarkPlus, ToggleLeft, ToggleRight, Scissors, ArrowLeftRight, Wand2,
  Type, Monitor
} from 'lucide-react';
import { Theme, Paragraph, Session, Prompt, TextVersion, ViewMode, ArticleSnapshot } from './types';
import { THEMES, DEFAULT_PROMPTS } from './constants';
import { humanizeText, suggestPromptStyles } from './services/geminiService';
import { HumanMeter } from './components/HumanMeter';

const App: React.FC = () => {
  const [themeIdx, setThemeIdx] = useState(0);
  const [fontSize, setFontSize] = useState(22);
  const [editorFontSize, setEditorFontSize] = useState(22);
  const [uiScale, setUiScale] = useState(1);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>(DEFAULT_PROMPTS);
  
  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArticleViewOpen, setIsArticleViewOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  
  // States
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editingParagraph, setEditingParagraph] = useState<Paragraph | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [previewParagraphs, setPreviewParagraphs] = useState<string[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [lang, setLang] = useState<'AR' | 'FR'>('AR');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trackChanges, setTrackChanges] = useState(false);

  // AI Style Suggestions
  const [suggestedStyles, setSuggestedStyles] = useState<{ name: string; text: string }[]>([]);
  const [activeSugIdx, setActiveSugIdx] = useState(0);

  // Undo/Redo State
  const [undoStack, setUndoStack] = useState<Paragraph[][]>([]);
  const [redoStack, setRedoStack] = useState<Paragraph[][]>([]);

  const theme = THEMES[themeIdx];

  // Persistence
  useEffect(() => {
    const savedSessions = localStorage.getItem('nossos_pfe_final_v5');
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    const savedPrompts = localStorage.getItem('nossos_pfe_prompts_v2');
    if (savedPrompts) setPrompts(JSON.parse(savedPrompts));
    const savedUI = localStorage.getItem('nossos_ui_config_v3');
    if (savedUI) {
      const config = JSON.parse(savedUI);
      setFontSize(config.fontSize || 22);
      setEditorFontSize(config.editorFontSize || 22);
      setUiScale(config.uiScale || 1);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nossos_pfe_final_v5', JSON.stringify(sessions));
    localStorage.setItem('nossos_pfe_prompts_v2', JSON.stringify(prompts));
    localStorage.setItem('nossos_ui_config_v3', JSON.stringify({ fontSize, editorFontSize, uiScale }));
  }, [sessions, prompts, fontSize, editorFontSize, uiScale]);

  // Undo/Redo Logic
  const saveToUndo = useCallback((paragraphs: Paragraph[]) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(paragraphs))].slice(-50));
    setRedoStack([]);
  }, []);

  const handleUndo = () => {
    if (undoStack.length === 0 || !currentSession) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(currentSession.paragraphs))]);
    setUndoStack(prev => prev.slice(0, -1));
    silentUpdateParagraphs(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !currentSession) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(currentSession.paragraphs))]);
    setRedoStack(prev => prev.slice(0, -1));
    silentUpdateParagraphs(next);
  };

  const silentUpdateParagraphs = (paragraphs: Paragraph[]) => {
    if (!currentSession) return;
    const updated = { ...currentSession, paragraphs, timestamp: Date.now() };
    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const commitParagraphsChange = (paragraphs: Paragraph[]) => {
    if (!currentSession) return;
    saveToUndo(currentSession.paragraphs);
    silentUpdateParagraphs(paragraphs);
  };

  // Actions

  // Fix: Implemented the missing savePreviewAsSession function
  const savePreviewAsSession = () => {
    if (!previewParagraphs) return;
    
    const newParagraphs: Paragraph[] = previewParagraphs.map((txt, idx) => ({
      id: `p-${Date.now()}-${idx}`,
      original: txt,
      versions: [{
        text: txt,
        humanScore: 0,
        timestamp: Date.now(),
        promptName: lang === 'AR' ? 'أصلي' : 'Original'
      }],
      activeVersionIdx: 0,
      lastEdit: Date.now()
    }));

    const newSession: Session = {
      id: `session-${Date.now()}`,
      fileName: pastedText.trim().split('\n')[0].slice(0, 30) || 'Untitled Document',
      paragraphs: newParagraphs,
      snapshots: [],
      timestamp: Date.now()
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
    setPreviewParagraphs(null);
    setPastedText("");
    setUndoStack([]);
    setRedoStack([]);
  };

  const handleMerge = () => {
    if (!currentSession || selectedIds.size < 2) return;
    const sortedSelected = currentSession.paragraphs.filter(p => selectedIds.has(p.id));
    const mergedText = sortedSelected.map(p => p.versions[p.activeVersionIdx].text).join('\n\n');
    const firstPara = sortedSelected[0];
    const newPara: Paragraph = {
      ...firstPara,
      id: `merged-${Date.now()}`,
      original: sortedSelected.map(p => p.original).join('\n\n'),
      versions: [{
        text: mergedText,
        humanScore: Math.round(sortedSelected.reduce((acc, p) => acc + p.versions[p.activeVersionIdx].humanScore, 0) / sortedSelected.length),
        timestamp: Date.now(),
        promptName: lang === 'AR' ? 'دمج' : 'Fusion'
      }],
      activeVersionIdx: 0,
      lastEdit: Date.now()
    };
    const updated = currentSession.paragraphs.filter(p => !selectedIds.has(p.id));
    const insertIdx = currentSession.paragraphs.findIndex(p => p.id === firstPara.id);
    updated.splice(insertIdx, 0, newPara);
    commitParagraphsChange(updated);
    setSelectedIds(new Set());
  };

  const handleSplit = () => {
    if (!currentSession || selectedIds.size === 0) return;
    const updated: Paragraph[] = [];
    currentSession.paragraphs.forEach(p => {
      if (selectedIds.has(p.id)) {
        const text = p.versions[p.activeVersionIdx].text;
        const subBlocks = text.split(/\n+/).filter(b => b.trim().length > 0);
        if (subBlocks.length > 1) {
          subBlocks.forEach((txt, i) => {
            updated.push({
              id: `${p.id}-split-${i}-${Date.now()}`,
              original: txt,
              versions: [{ text: txt, humanScore: p.versions[p.activeVersionIdx].humanScore, timestamp: Date.now(), promptName: lang === 'AR' ? 'تقسيم' : 'Split' }],
              activeVersionIdx: 0,
              lastEdit: Date.now()
            });
          });
        } else updated.push(p);
      } else updated.push(p);
    });
    commitParagraphsChange(updated);
    setSelectedIds(new Set());
  };

  const handleApplyPrompt = async (pId: string, prompt: Prompt) => {
    if (!currentSession) return;
    const pIdx = currentSession.paragraphs.findIndex(p => p.id === pId);
    const para = currentSession.paragraphs[pIdx];

    setIsLoading(true);
    try {
      const res = await humanizeText(para.versions[para.activeVersionIdx].text, prompt.text);
      const newVersion: TextVersion = { 
        text: res.text, 
        humanScore: res.humanScore, 
        timestamp: Date.now(),
        promptName: prompt.name
      };
      const updatedParas = [...currentSession.paragraphs];
      const newVersions = [...para.versions, newVersion];
      updatedParas[pIdx] = { 
        ...para, 
        versions: newVersions, 
        activeVersionIdx: newVersions.length - 1,
        lastEdit: Date.now() 
      };
      commitParagraphsChange(updatedParas);
      if (editingParagraph?.id === pId) setEditingParagraph(updatedParas[pIdx]);
    } catch (err) {
      alert("Error processing AI request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAISuggestStyles = async () => {
    setIsLoading(true);
    try {
      const suggestions = await suggestPromptStyles();
      setSuggestedStyles(suggestions);
      setActiveSugIdx(0);
    } catch (err) {
      alert("Error generating styles");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeepSuggestion = () => {
    if (suggestedStyles[activeSugIdx]) {
      setEditingPrompt({
        id: 'new-' + Date.now(),
        name: suggestedStyles[activeSugIdx].name,
        text: suggestedStyles[activeSugIdx].text
      });
      setSuggestedStyles([]);
    }
  };

  const renderDiff = (original: string, modified: string) => {
    const originalWords = original.split(/\s+/);
    const modifiedWords = modified.split(/\s+/);
    return modifiedWords.map((word, idx) => {
      const isNew = !originalWords.includes(word);
      return (
        <span key={idx} className={`${isNew ? 'bg-indigo-100 text-indigo-800 px-0.5 rounded-sm' : ''}`}>
          {word}{' '}
        </span>
      );
    });
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} theme-transition flex flex-col font-main overflow-x-hidden`} dir={lang === 'AR' ? 'rtl' : 'ltr'}>
      {/* Dynamic Header */}
      <header className={`sticky top-0 z-[70] ${theme.secondary} ${theme.border} border-b px-4 py-3 flex items-center justify-between shadow-lg backdrop-blur-xl bg-opacity-95`}>
        <div className="flex items-center gap-4">
          <div className={`${theme.accent} p-2 rounded-xl text-white shadow-lg flex items-center justify-center`}>
            <Layers size={20} />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-base font-black tracking-tight leading-none italic">Nossos Pro Dial PFE</h1>
          </div>
          
          <div className="flex items-center gap-4 bg-black/5 p-1 rounded-xl border border-black/10 ml-2">
            <div className="flex items-center gap-1 border-r border-black/10 pr-2">
              <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} className="p-1 hover:bg-white rounded shadow-sm" title="Font -"><Minus size={14}/></button>
              <Type size={14} className="opacity-40" />
              <button onClick={() => setFontSize(prev => Math.min(60, prev + 2))} className="p-1 hover:bg-white rounded shadow-sm" title="Font +"><Plus size={14}/></button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setUiScale(prev => Math.max(0.7, prev - 0.05))} className="p-1 hover:bg-white rounded shadow-sm" title="UI -"><Minus size={14}/></button>
              <Monitor size={14} className="opacity-40" />
              <button onClick={() => setUiScale(prev => Math.min(1.3, prev + 0.05))} className="p-1 hover:bg-white rounded shadow-sm" title="UI +"><Plus size={14}/></button>
            </div>
          </div>

          {currentSession && (
            <div className="flex items-center gap-1 bg-black/5 p-1 rounded-xl border border-black/10 shadow-inner">
              <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-2 hover:bg-white rounded-lg disabled:opacity-10 transition-all"><Undo2 size={16}/></button>
              <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-2 hover:bg-white rounded-lg disabled:opacity-10 transition-all"><Redo2 size={16}/></button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setTrackChanges(!trackChanges)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-[9px] transition-all border ${trackChanges ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-black/5 opacity-50 border-transparent'}`}>
            {trackChanges ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>} {lang === 'AR' ? 'تتبع' : 'TRACK'}
          </button>
          <button onClick={() => setIsPromptLibraryOpen(true)} className="p-2 rounded-lg bg-black/5 border border-black/10 hover:bg-indigo-600 hover:text-white transition-all"><Settings2 size={16}/></button>
          <button onClick={() => setThemeIdx(p => (p + 1) % THEMES.length)} className="p-2 rounded-lg bg-black/5 border border-black/10 hover:bg-black/10 transition-all"><Palette size={16}/></button>
          <button onClick={() => setIsHistoryOpen(true)} className="p-2 rounded-lg bg-black/5 border border-black/10 hover:bg-black/10 transition-all"><Folder size={16}/></button>
          <button onClick={() => setLang(l => l === 'AR' ? 'FR' : 'AR')} className="px-2.5 py-1.5 rounded-lg bg-black/5 font-black text-[10px] border border-black/10 shadow-sm">{lang}</button>
        </div>
      </header>

      {/* Main Container Scaling Wrapper */}
      <div className="flex-1 flex flex-col transition-transform duration-300 origin-top" style={{ transform: `scale(${uiScale})` }}>
        <main className="flex-1 flex flex-col p-6 sm:p-10 max-w-7xl mx-auto w-full">
          {!currentSession && !previewParagraphs && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-slide-up py-10">
              <div className="text-center space-y-4 max-w-4xl relative">
                <h2 className="text-6xl sm:text-7xl font-black tracking-tighter leading-tight italic">
                  <span className="text-slate-400">Nossos</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Pro Dial PFE</span>
                </h2>
                <p className="text-lg opacity-40 font-medium leading-relaxed max-w-xl mx-auto">
                  {lang === 'AR' ? 'الأداة الأكاديمية الاحترافية لإعادة صياغة الأبحاث بأسلوب بشري فصيح.' : 'L\'excellence académique pour humaniser vos recherches.'}
                </p>
              </div>
              
              <div className="w-full max-w-4xl relative group">
                <textarea 
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder={lang === 'AR' ? "ألصق المقال هنا..." : "Collez votre article ici..."}
                  className="w-full h-[350px] sm:h-[450px] p-10 rounded-[3rem] bg-white border-2 border-slate-100 focus:border-indigo-400 outline-none resize-none leading-relaxed text-xl arabic-content shadow-2xl focus:bg-white relative z-10"
                />
                <button 
                  onClick={() => {
                    if (!pastedText.trim()) return;
                    const paragraphs = pastedText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
                    setPreviewParagraphs(paragraphs);
                  }}
                  disabled={!pastedText.trim()}
                  className="absolute bottom-8 right-8 px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 flex items-center gap-4 z-20"
                >
                  <ClipboardList size={24} />
                  <span>{lang === 'AR' ? 'معالجة' : 'Traiter'}</span>
                </button>
              </div>
            </div>
          )}

          {previewParagraphs && (
            <div className="flex-1 flex flex-col space-y-8 animate-slide-up">
              <div className="flex items-center justify-between border-b border-black/5 pb-8">
                <h2 className="text-3xl font-black italic">{lang === 'AR' ? 'معاينة التقسيم' : 'Aperçu'}</h2>
                <div className="flex gap-4">
                    <button onClick={() => setPreviewParagraphs(null)} className="px-8 py-3 rounded-xl bg-black/5 font-black">{lang === 'AR' ? 'رجوع' : 'Retour'}</button>
                    <button onClick={savePreviewAsSession} className="px-10 py-3 rounded-xl bg-indigo-600 text-white font-black text-lg shadow-lg flex items-center gap-3">
                      <CheckCircle2 size={20}/> {lang === 'AR' ? 'ابدأ' : 'Démarrer'}
                    </button>
                </div>
              </div>
              <div className="grid gap-4">
                {previewParagraphs.map((txt, i) => (
                  <div key={i} className="p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <p className="text-lg opacity-70 arabic-content">{txt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentSession && (
            <div className="space-y-8 animate-slide-up pb-40">
              <div className="flex flex-col md:flex-row items-center justify-between border-b border-black/5 pb-8 gap-6">
                <div className="flex items-center gap-6">
                    <h2 className="text-3xl font-black italic">{currentSession.fileName}</h2>
                    <div className="flex items-center gap-1 bg-black/5 p-1 rounded-xl border border-black/5">
                      <button onClick={() => setViewMode('list')} className={`p-1.5 px-4 rounded-lg flex items-center gap-2 font-black text-[9px] transition-all uppercase ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'opacity-40'}`}><List size={12}/> {lang === 'AR' ? 'قائمة' : 'List'}</button>
                      <button onClick={() => setViewMode('slide')} className={`p-1.5 px-4 rounded-lg flex items-center gap-2 font-black text-[9px] transition-all uppercase ${viewMode === 'slide' ? 'bg-white shadow text-indigo-600' : 'opacity-40'}`}><Presentation size={12}/> {lang === 'AR' ? 'عرض' : 'Slide'}</button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsArticleViewOpen(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg flex items-center gap-2 hover:scale-105"><Eye size={16}/> {lang === 'AR' ? 'تصدير' : 'Exporter'}</button>
                    <button onClick={() => setCurrentSession(null)} className="px-5 py-3 rounded-xl bg-red-500/10 text-red-600 font-black text-[9px] uppercase tracking-wider shadow-sm">Exit</button>
                </div>
              </div>

              {viewMode === 'list' ? (
                <div className="grid gap-8">
                  {currentSession.paragraphs.map((p, idx) => (
                    <div 
                      key={p.id} 
                      onClick={() => {
                        const next = new Set(selectedIds);
                        if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                        setSelectedIds(next);
                      }}
                      className={`group relative p-10 rounded-[3rem] bg-white border-2 transition-all cursor-pointer shadow-lg ${selectedIds.has(p.id) ? 'border-indigo-500 bg-indigo-50/5' : 'border-transparent hover:border-slate-100 hover:shadow-xl'}`}
                    >
                      {/* Repositioned header within card to avoid overlaps */}
                      <div className="flex items-center justify-between mb-6 w-full">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center font-black opacity-10 text-[10px]">{idx + 1}</div>
                            <HumanMeter score={p.versions[p.activeVersionIdx].humanScore} label="Quality" />
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {p.versions.length > 1 && <span className="text-[7px] font-black bg-indigo-600 text-white px-2 py-1 rounded-full shadow-sm mr-2">V{p.activeVersionIdx+1}/{p.versions.length}</span>}
                            <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.has(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-black/10 bg-black/5 group-hover:border-indigo-300'}`}>
                              {selectedIds.has(p.id) && <Check size={14} />}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setEditingParagraph(p); setIsEditModalOpen(true); }} className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-md hover:scale-110 active:scale-95 transition-all"><Edit3 size={16}/></button>
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.versions[p.activeVersionIdx].text); }} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-all"><Copy size={16}/></button>
                        </div>
                      </div>
                      
                      <div className={`leading-relaxed arabic-content whitespace-pre-wrap ${p.isTitle ? 'font-black text-2xl mb-4 text-indigo-900' : 'font-medium'}`} style={{ fontSize: `${fontSize}px` }}>
                          {trackChanges ? renderDiff(p.original, p.versions[p.activeVersionIdx].text) : p.versions[p.activeVersionIdx].text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 gap-6 min-h-[400px]">
                  <div className="w-full flex items-center gap-6">
                      <button onClick={() => setActiveSlideIdx(Math.max(0, activeSlideIdx-1))} disabled={activeSlideIdx===0} className="p-6 rounded-full bg-white shadow-xl hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-5 active:scale-90"><ChevronRight size={32}/></button>
                      <div className="flex-1 p-12 rounded-[3rem] bg-white shadow-2xl border border-black/5 relative flex flex-col justify-center animate-in zoom-in duration-300 min-h-[350px]">
                        <div className="leading-relaxed arabic-content font-bold" style={{ fontSize: `${fontSize + 4}px` }}>
                            {trackChanges ? renderDiff(currentSession.paragraphs[activeSlideIdx].original, currentSession.paragraphs[activeSlideIdx].versions[currentSession.paragraphs[activeSlideIdx].activeVersionIdx].text) : currentSession.paragraphs[activeSlideIdx].versions[currentSession.paragraphs[activeSlideIdx].activeVersionIdx].text}
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button onClick={() => { setEditingParagraph(currentSession!.paragraphs[activeSlideIdx]); setIsEditModalOpen(true); }} className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 hover:scale-105"><Edit3 size={18}/> {lang === 'AR' ? 'تعديل' : 'Modifier'}</button>
                        </div>
                      </div>
                      <button onClick={() => setActiveSlideIdx(Math.min(currentSession.paragraphs.length-1, activeSlideIdx+1))} disabled={activeSlideIdx===currentSession.paragraphs.length-1} className="p-6 rounded-full bg-white shadow-xl hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-5 active:scale-90"><ChevronLeft size={32}/></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Bar - Fixed layout and Z-index */}
      {selectedIds.size > 0 && currentSession && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white border-2 border-indigo-500 p-5 rounded-[2.5rem] shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-20">
            <div className="flex flex-col border-l-2 border-indigo-500/10 pl-6 pr-2 text-center">
                <span className="text-2xl font-black text-indigo-600 leading-none">{selectedIds.size}</span>
                <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{lang === 'AR' ? 'محدد' : 'Selected'}</span>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleMerge} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all"><Combine size={16}/> {lang === 'AR' ? 'دمج' : 'Merge'}</button>
                <button onClick={handleSplit} className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs shadow-lg hover:bg-amber-600 transition-all"><Scissors size={16}/> {lang === 'AR' ? 'تقسيم' : 'Split'}</button>
                <button onClick={() => setSelectedIds(new Set())} className="p-2.5 rounded-xl bg-black/5 hover:bg-red-500 hover:text-white transition-all"><X size={18}/></button>
            </div>
        </div>
      )}

      {/* Style Library Modal - Refined for Smaller UI */}
      {isPromptLibraryOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className={`w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] bg-white shadow-3xl flex flex-col overflow-hidden border border-black/5`}>
              <div className="p-6 border-b border-black/5 flex items-center justify-between bg-slate-50">
                 <div className="flex items-center gap-3">
                    <Sparkles className="text-indigo-500" size={20} />
                    <h3 className="text-xl font-black italic tracking-tighter">{lang === 'AR' ? 'مكتبة الأساليب الجامعية' : 'Academic Library'}</h3>
                 </div>
                 <button onClick={() => { setIsPromptLibraryOpen(false); setSuggestedStyles([]); setEditingPrompt(null); }} className="p-2.5 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm bg-white border border-slate-100"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {editingPrompt ? (
                  <div className="space-y-6 max-w-xl mx-auto animate-in slide-in-from-bottom-5">
                    {/* AI Suggestion Carousel Section */}
                    <div className="bg-indigo-50/50 p-5 rounded-[2rem] border border-indigo-100 shadow-inner">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">{lang === 'AR' ? 'اقتراحات الذكاء الاصطناعي الأكاديمية' : 'AI Academic Suggestions'}</span>
                        <button type="button" onClick={handleAISuggestStyles} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[9px] shadow-md flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                          <Wand2 size={12}/> {lang === 'AR' ? 'توليد 7 مقترحات' : 'Generate 7 Suggestions'}
                        </button>
                      </div>

                      {suggestedStyles.length > 0 && (
                        <div className="space-y-4 animate-in zoom-in-95">
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setActiveSugIdx(Math.max(0, activeSugIdx - 1))} className="p-2 bg-white border border-indigo-200 rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><ChevronRight size={20}/></button>
                            <div className="flex-1 p-5 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm min-h-[120px] flex flex-col justify-center">
                               <div className="font-black text-indigo-900 text-sm mb-1 flex items-center gap-2"><Sparkles size={14} className="text-indigo-400" /> {suggestedStyles[activeSugIdx].name}</div>
                               <p className="text-xs italic opacity-60 leading-relaxed font-serif line-clamp-3">{suggestedStyles[activeSugIdx].text}</p>
                            </div>
                            <button type="button" onClick={() => setActiveSugIdx(Math.min(suggestedStyles.length - 1, activeSugIdx + 1))} className="p-2 bg-white border border-indigo-200 rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><ChevronLeft size={20}/></button>
                          </div>
                          <div className="flex justify-center">
                             <button type="button" onClick={handleKeepSuggestion} className="px-8 py-2 bg-green-500 text-white rounded-xl font-black text-[10px] shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                               <Check size={14}/> {lang === 'AR' ? 'استخدام هذا القالب' : 'Use This Template'}
                             </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={(e) => {
                      e.preventDefault(); if(!editingPrompt) return;
                      if(prompts.find(p => p.id === editingPrompt.id)) setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? editingPrompt : p));
                      else setPrompts(prev => [...prev, {...editingPrompt, id: Date.now().toString()}]);
                      setEditingPrompt(null);
                      setSuggestedStyles([]);
                    }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase opacity-30 tracking-widest">{lang === 'AR' ? 'اسم الأسلوب' : 'Style Name'}</label>
                        <input required value={editingPrompt.name} onChange={e => setEditingPrompt({...editingPrompt, name: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-400 outline-none text-base font-black shadow-inner"/>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase opacity-30 tracking-widest">{lang === 'AR' ? 'التعليمات' : 'Prompt Instructions'}</label>
                        <textarea required value={editingPrompt.text} onChange={e => setEditingPrompt({...editingPrompt, text: e.target.value})} className="w-full h-32 p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-400 outline-none text-sm font-medium leading-relaxed font-serif shadow-inner"/>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-base shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"><Save size={20}/> {lang === 'AR' ? 'حفظ الأسلوب' : 'Save Style'}</button>
                        <button type="button" onClick={() => { setEditingPrompt(null); setSuggestedStyles([]); }} className="px-6 py-3 bg-slate-100 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">{lang === 'AR' ? 'إلغاء' : 'Cancel'}</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    <button onClick={() => setEditingPrompt({id: '', name: '', text: ''})} className="group p-8 rounded-[2rem] border-4 border-dashed border-indigo-500/10 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-3">
                      <PlusCircle size={32} className="text-indigo-500 group-hover:scale-125 transition-all"/>
                      <span className="font-black text-base tracking-tighter uppercase">{lang === 'AR' ? 'إضافة أسلوب' : 'New Style'}</span>
                    </button>
                    {prompts.map(p => (
                      <div key={p.id} className="p-6 rounded-[2rem] bg-slate-50 border-2 border-transparent group hover:bg-white hover:shadow-xl transition-all relative">
                         <div className="font-black text-base mb-2 flex items-center gap-2 text-slate-800"><BookOpen size={16} className="text-indigo-500 opacity-70"/> {p.name}</div>
                         <p className="text-xs opacity-40 leading-relaxed line-clamp-3 italic font-medium font-serif">{p.text}</p>
                         <div className="absolute bottom-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                            <button onClick={() => setEditingPrompt(p)} className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-md"><Pencil size={14}/></button>
                            <button onClick={() => setPrompts(prev => prev.filter(x => x.id !== p.id))} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-md"><Trash size={14}/></button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Article Export View - Wider and Cleaned UI */}
      {isArticleViewOpen && currentSession && (
        <div className="fixed inset-0 z-[400] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
             <div className="w-full h-full max-w-[98vw] rounded-[3rem] bg-white flex flex-col overflow-hidden shadow-4xl">
                 <div className="p-6 border-b border-black/5 flex items-center justify-between bg-slate-50/80 px-10">
                    <div>
                        <h3 className="text-3xl font-black tracking-tighter uppercase italic text-indigo-900 leading-none">Nossos Final Export</h3>
                        <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.4em] mt-2">Academic Scholarly View</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => { navigator.clipboard.writeText(currentSession.paragraphs.map(p => p.versions[p.activeVersionIdx].text).join('\n\n')); alert('تم النسخ بنجاح!'); }} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black text-base shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"><Copy size={20}/> {lang === 'AR' ? 'نسخ المقال بالكامل' : 'Copy All'}</button>
                        <button onClick={() => setIsArticleViewOpen(false)} className="p-3 bg-white border border-slate-100 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-90"><X size={24}/></button>
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-12 sm:p-20 md:p-28 custom-scrollbar bg-slate-50/10">
                    <div className="max-w-5xl mx-auto space-y-10 arabic-content leading-loose text-slate-900" style={{ fontSize: `${fontSize}px` }}>
                        {currentSession.paragraphs.map((p, i) => (
                            <p key={i} className={p.isTitle ? 'font-black text-4xl mb-12 text-indigo-950 leading-tight border-b-4 border-indigo-50 pb-6' : 'mb-8 font-serif'}>
                                {p.versions[p.activeVersionIdx].text}
                            </p>
                        ))}
                    </div>
                 </div>
             </div>
        </div>
      )}

      {/* Rich Editor Modal - With Font Controls */}
      {isEditModalOpen && editingParagraph && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className={`w-full h-full rounded-[3.5rem] bg-white shadow-3xl flex flex-col overflow-hidden border-2 border-white/5`}>
              <div className="p-6 border-b border-black/5 flex items-center justify-between bg-slate-50/80 backdrop-blur-md px-10">
                <div className="flex items-center gap-8">
                   <h3 className="text-xl font-black italic tracking-tighter text-slate-900">Paragraph Editor</h3>
                   <div className="flex gap-1.5 bg-black/5 p-1 rounded-xl border border-black/5 overflow-x-auto max-w-sm scrollbar-hide">
                      {editingParagraph.versions.map((v, i) => (
                        <button key={i} onClick={() => setEditingParagraph({...editingParagraph, activeVersionIdx: i})} className={`px-3 py-1.5 rounded-lg font-black text-[8px] transition-all whitespace-nowrap uppercase ${editingParagraph.activeVersionIdx === i ? 'bg-indigo-600 text-white shadow-md' : 'opacity-30 hover:opacity-100'}`}>
                          V{i+1}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex items-center gap-6">
                   {/* Editor Font Controls */}
                   <div className="flex items-center bg-white rounded-xl p-1 px-4 gap-4 border border-slate-200 shadow-sm">
                      <button onClick={() => setEditorFontSize(prev => Math.max(12, prev - 2))} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all" title="A-"><Minus size={16}/></button>
                      <div className="flex flex-col items-center">
                         <span className="text-[9px] font-black opacity-40 leading-none">A</span>
                         <span className="text-xs font-black text-slate-600">{editorFontSize}</span>
                      </div>
                      <button onClick={() => setEditorFontSize(prev => Math.min(80, prev + 2))} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all" title="A+"><Plus size={16}/></button>
                   </div>
                   
                   <button onClick={() => {
                     const updated = currentSession!.paragraphs.map(p => p.id === editingParagraph.id ? editingParagraph : p);
                     commitParagraphsChange(updated);
                     setIsEditModalOpen(false);
                   }} className="px-8 py-3 bg-indigo-600 text-white rounded-[1.5rem] font-black text-base shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase">Finish</button>
                </div>
              </div>

              <div className="flex-1 flex flex-row overflow-hidden bg-white">
                <div className="w-1/2 p-12 border-l border-slate-100 bg-slate-50/30 overflow-y-auto custom-scrollbar relative">
                   <div className="sticky top-0 right-0 flex justify-end pb-6">
                      <span className="text-[9px] font-black opacity-20 uppercase tracking-[0.3em] bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">Original Reference</span>
                   </div>
                   <p className="leading-loose opacity-20 italic arabic-content font-medium font-serif" style={{ fontSize: `${editorFontSize}px` }}>{editingParagraph.original}</p>
                </div>
                <div className="w-1/2 flex flex-col relative bg-white shadow-inner">
                   <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                      <textarea 
                        value={editingParagraph.versions[editingParagraph.activeVersionIdx].text}
                        onChange={(e) => {
                          const vNext = [...editingParagraph.versions];
                          vNext[editingParagraph.activeVersionIdx] = {...vNext[editingParagraph.activeVersionIdx], text: e.target.value};
                          setEditingParagraph({...editingParagraph, versions: vNext});
                        }}
                        className="w-full h-full bg-transparent leading-loose arabic-content outline-none resize-none font-bold text-slate-800 font-serif"
                        style={{ fontSize: `${editorFontSize}px` }}
                      />
                   </div>
                   <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3 overflow-x-auto scrollbar-hide items-center">
                      <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest whitespace-nowrap bg-indigo-50 px-4 py-2 rounded-lg mr-1 shadow-sm border border-indigo-100">Academic Styles:</span>
                      {prompts.map(pr => (
                        <button key={pr.id} onClick={() => handleApplyPrompt(editingParagraph.id, pr)} className={`px-6 py-2.5 rounded-[1.5rem] bg-white shadow-md border-2 border-transparent hover:border-indigo-500 transition-all text-[10px] font-black whitespace-nowrap ${isLoading ? 'opacity-20 pointer-events-none' : ''}`}>
                          {pr.name}
                        </button>
                      ))}
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* History Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[500] flex animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsHistoryOpen(false)} />
          <div className="relative bg-white w-full max-w-sm shadow-4xl flex flex-col h-full animate-in slide-in-from-right-full">
             <div className="p-8 border-b border-black/5 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-black italic flex items-center gap-3 tracking-tighter"><Folder className="text-indigo-600" size={24} /> Archive</h3>
                <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-all bg-white border border-slate-100 shadow-sm"><X size={18}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
                {sessions.map(s => (
                  <div key={s.id} onClick={() => { setCurrentSession(s); setUndoStack([]); setRedoStack([]); setIsHistoryOpen(false); }} className={`group p-8 rounded-[2rem] bg-slate-50 border-2 border-transparent hover:border-indigo-500 transition-all cursor-pointer relative shadow-md ${currentSession?.id === s.id ? 'border-indigo-500 bg-white ring-2 ring-indigo-50' : ''}`}>
                     <div className="font-black text-lg mb-1.5 truncate text-slate-900">{s.fileName}</div>
                     <div className="flex items-center justify-between text-[9px] opacity-40 font-black tracking-widest uppercase">
                        <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                        <span>{s.paragraphs.length} blocks</span>
                     </div>
                     <button onClick={(e) => { e.stopPropagation(); if(confirm('حذف المشروع؟')) setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="absolute top-3 left-3 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-lg active:scale-90"><Trash size={14}/></button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Loader */}
      {isLoading && (
        <div className="fixed bottom-10 right-10 z-[600] bg-white/95 backdrop-blur-md p-8 rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.4)] border-4 border-indigo-500 flex items-center gap-8 animate-in slide-in-from-right-20">
           <div className="relative">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-indigo-400 opacity-30"><Wand2 size={18}/></div>
           </div>
           <div className="flex flex-col">
              <span className="text-xl font-black italic tracking-tighter text-slate-900">{lang === 'AR' ? 'جاري التحسين...' : 'Refining...'}</span>
              <span className="text-[8px] opacity-40 font-black tracking-[0.4em] uppercase mt-1">Nossos AI Engine</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
