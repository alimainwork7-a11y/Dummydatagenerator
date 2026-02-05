
import React, { useState, useCallback, useMemo } from 'react';
import { DataField, FieldType, GenerationProgress } from './types';
import { suggestSchema } from './services/geminiService';
import { bulkGenerate } from './services/dataGenerator';

const MAX_ROWS = 5000000;
const EXCEL_LIMIT = 1048576;

const App: React.FC = () => {
  const [fields, setFields] = useState<DataField[]>([
    { id: '1', name: 'ID', type: FieldType.UUID },
    { id: '2', name: 'Full Name', type: FieldType.NAME },
    { id: '3', name: 'Email', type: FieldType.EMAIL },
    { id: '4', name: 'Created At', type: FieldType.DATE },
  ]);
  const [rowCount, setRowCount] = useState<number>(100000);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [progress, setProgress] = useState<GenerationProgress>({
    current: 0,
    total: rowCount,
    status: 'idle'
  });

  const handleAddField = () => {
    const newField: DataField = {
      id: Date.now().toString(),
      name: `Field ${fields.length + 1}`,
      type: FieldType.CATEGORY
    };
    setFields([...fields, newField]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: Partial<DataField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const suggested = await suggestSchema(aiPrompt);
      if (suggested.length > 0) {
        setFields(suggested);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
      setAiPrompt('');
    }
  };

  const startGeneration = async () => {
    if (rowCount > EXCEL_LIMIT && format === 'xlsx') {
      alert(`Excel (.xlsx) has a limit of ${EXCEL_LIMIT.toLocaleString()} rows. Please use CSV for higher counts.`);
      return;
    }

    setProgress({
      current: 0,
      total: rowCount,
      status: 'generating'
    });

    try {
      const blob = await bulkGenerate(fields, rowCount, (current) => {
        setProgress(prev => ({ ...prev, current }));
      });

      setProgress(prev => ({ ...prev, status: 'downloading' }));

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data_export_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(prev => ({ ...prev, status: 'completed' }));
    } catch (err) {
      console.error(err);
      setProgress(prev => ({ 
        ...prev, 
        status: 'error', 
        errorMessage: 'Generation failed. The row count might be too large for your browser memory.' 
      }));
    }
  };

  const isGenerating = progress.status === 'generating' || progress.status === 'downloading';
  const percentage = Math.round((progress.current / rowCount) * 100);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-file-excel text-emerald-500"></i>
            BigDataGen Pro
          </h1>
          <p className="text-slate-400 mt-2">Generate massive datasets up to 5,000,000 rows in seconds.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button 
                onClick={() => setFormat('csv')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${format === 'csv' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
               CSV
             </button>
             <button 
                onClick={() => setFormat('xlsx')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${format === 'xlsx' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
               Excel
             </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Config */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-purple-400"></i>
                AI Schema Assistant
              </h2>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Describe your data (e.g., 'E-commerce orders with shipping info')..."
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={isAiLoading || isGenerating}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSuggest()}
              />
              <button 
                onClick={handleAiSuggest}
                disabled={isAiLoading || !aiPrompt.trim() || isGenerating}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                {isAiLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                Generate
              </button>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-table-columns text-emerald-400"></i>
                Dataset Fields
              </h2>
              <button 
                onClick={handleAddField}
                disabled={isGenerating}
                className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 text-sm"
              >
                <i className="fa-solid fa-plus"></i> Add Field
              </button>
            </div>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {fields.map((field) => (
                <div key={field.id} className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-900/40 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group">
                  <input 
                    type="text"
                    value={field.name}
                    onChange={(e) => handleUpdateField(field.id, { name: e.target.value })}
                    className="flex-1 bg-transparent border-none text-white font-medium focus:ring-0 placeholder:text-slate-600"
                    placeholder="Field Name"
                    disabled={isGenerating}
                  />
                  <div className="flex gap-2">
                    <select
                      value={field.type}
                      onChange={(e) => handleUpdateField(field.id, { type: e.target.value as FieldType })}
                      className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 w-32"
                      disabled={isGenerating}
                    >
                      {Object.values(FieldType).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => handleRemoveField(field.id)}
                      className="text-slate-500 hover:text-red-400 px-2 transition-colors"
                      disabled={isGenerating}
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-10 text-slate-500 italic">
                  No fields defined. Start with AI or add one manually.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Execution */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 shadow-xl sticky top-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <i className="fa-solid fa-gears text-blue-400"></i>
              Execution
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Number of Rows</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="1"
                    max={MAX_ROWS}
                    value={rowCount}
                    onChange={(e) => setRowCount(Number(e.target.value))}
                    disabled={isGenerating}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg font-bold focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                    <button onClick={() => setRowCount(100000)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 transition-colors">100k</button>
                    <button onClick={() => setRowCount(1000000)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 transition-colors">1M</button>
                    <button onClick={() => setRowCount(5000000)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 transition-colors">5M</button>
                  </div>
                </div>
                {rowCount > EXCEL_LIMIT && format === 'xlsx' && (
                  <p className="mt-2 text-amber-400 text-xs flex items-start gap-1">
                    <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                    Excel format limited to 1,048,576 rows. Switch to CSV.
                  </p>
                )}
                <p className="mt-2 text-slate-500 text-xs italic">Max capacity: 5M rows</p>
              </div>

              <div className="pt-4 space-y-4">
                {isGenerating ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-emerald-400 font-semibold uppercase tracking-wider text-xs">
                        {progress.status === 'downloading' ? 'Finalizing...' : 'Generating...'}
                      </span>
                      <span className="text-white font-mono">{percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-center text-xs text-slate-400">
                      {progress.current.toLocaleString()} / {rowCount.toLocaleString()} rows
                    </p>
                  </div>
                ) : (
                  <button 
                    onClick={startGeneration}
                    className="w-full bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    <i className="fa-solid fa-download"></i>
                    Generate & Download
                  </button>
                )}
                
                {progress.status === 'completed' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-center text-sm flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-check"></i>
                    Download complete!
                  </div>
                )}
                
                {progress.status === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-center text-sm">
                    {progress.errorMessage}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Stats Preview</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                       <span className="text-slate-400 text-[10px]">TOTAL CELLS</span>
                       <span className="text-white text-sm font-mono">{(rowCount * fields.length).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-slate-400 text-[10px]">EST. FILE SIZE</span>
                       <span className="text-white text-sm font-mono">~{(rowCount * fields.length * 15 / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto py-10 text-slate-600 text-sm flex items-center gap-4">
        <span>&copy; 2024 BigDataGen Pro</span>
        <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
        <span>Powered by Gemini AI</span>
      </footer>
    </div>
  );
};

export default App;
