
import React, { useState, useEffect } from 'react';
import { BrainCircuit, RefreshCw, Link, Link2Off, LayoutGrid, Layers, BarChart3, History as HistoryIcon } from 'lucide-react';
import { DashboardData, DataRow, ViewMode, HistoryEntry } from './types';
import Dashboard from './components/Dashboard';
import { analyzeDataWithGemini } from './services/geminiService';

const Logo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers2-icon lucide-layers-2">
    <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/>
    <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/>
  </svg>
);

const TabButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`}
  >
    {icon} 
    <span className="hidden lg:inline ml-2">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('central');
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('utmdash_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [linkedFilters, setLinkedFilters] = useState<boolean>(() => {
    const saved = localStorage.getItem('utmdash_linked_filters');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('utmdash_linked_filters', linkedFilters.toString());
  }, [linkedFilters]);

  useEffect(() => {
    localStorage.setItem('utmdash_history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (newData: DashboardData, sourceName: string) => {
    const faturamentoHeader = newData.headers.find(h => h.toLowerCase().includes('valor') || h.toLowerCase().includes('faturamento')) || '';
    const totalFat = newData.rows.reduce((acc, row) => acc + (Number(row[faturamentoHeader]) || 0), 0);
    
    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      name: sourceName,
      timestamp: Date.now(),
      data: newData,
      stats: {
        vendas: newData.rows.length,
        faturamento: totalFat
      }
    };
    setHistory(prev => [newEntry, ...prev].slice(0, 10)); // Mantém os últimos 10
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setData(entry.data);
    setInsights(null);
    setViewMode('central');
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return null;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const cleanAndParse = (val: string) => {
      if (val === undefined || val === null || val.trim() === '') return '';
      
      let cleaned = val.trim().replace(/^"|"$/g, '');
      
      if (cleaned.includes('R$') || cleaned.includes('%') || /^-?[\d\.]+,[\d]+$/.test(cleaned)) {
        cleaned = cleaned
          .replace('R$', '')
          .replace('%', '')
          .replace(/\s/g, '');
        
        if (cleaned.includes(',') && cleaned.includes('.')) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (cleaned.includes(',')) {
          cleaned = cleaned.replace(',', '.');
        }
      }
      
      const num = Number(cleaned);
      return !isNaN(num) && cleaned !== '' ? num : cleaned;
    };

    const rows = lines.slice(1).map(line => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
      const row: DataRow = {};
      headers.forEach((header, index) => {
        row[header] = cleanAndParse(values[index] || '');
      });
      return row;
    });

    const types: Record<string, 'number' | 'string'> = {};
    headers.forEach(header => {
      const firstVal = rows.find(r => r[header] !== undefined && r[header] !== '' && typeof r[header] === 'number')?.[header];
      types[header] = typeof firstVal === 'number' ? 'number' : 'string';
    });

    return { headers, rows, types };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed) {
        setData(parsed);
        addToHistory(parsed, file.name);
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const loadFromUrl = async () => {
    if (!sheetUrl) return;
    setLoading(true);
    try {
      let targetUrl = sheetUrl;
      if (sheetUrl.includes('/edit')) {
        targetUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
      }
      const response = await fetch(targetUrl);
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      if (parsed) {
        setData(parsed);
        addToHistory(parsed, "Planilha via Link");
      }
    } catch (error) {
      alert("Erro ao carregar link. Certifique-se de que a planilha está 'Publicada na Web' como CSV.");
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    if (!data) return;
    setAnalyzing(true);
    const result = await analyzeDataWithGemini(data);
    setInsights(result);
    setAnalyzing(false);
  };

  const handleLogoClick = () => {
    setViewMode('central');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 sm:px-6">
        <header className="max-w-full mx-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[24px] h-16 flex items-center justify-between px-6 transition-all">
          <div 
            className="flex items-center space-x-3 cursor-pointer group transition-all shrink-0"
            onClick={handleLogoClick}
          >
            <div className="p-2 bg-indigo-600 rounded-xl shadow-indigo-200 shadow-lg text-white group-hover:scale-110 transition-transform">
              <Logo />
            </div>
            <h1 className="text-lg font-black text-slate-800 tracking-tighter uppercase hidden sm:block">utmdash</h1>
          </div>

          {data && (
            <div className="flex bg-slate-100/50 p-1 rounded-2xl items-center mx-4 overflow-hidden">
              <TabButton active={viewMode === 'central'} onClick={() => setViewMode('central')} label="Análise Central" icon={<LayoutGrid className="w-4 h-4" />} />
              <TabButton active={viewMode === 'utmdash'} onClick={() => setViewMode('utmdash')} label="UTM DASH" icon={<Layers className="w-4 h-4" />} />
              <TabButton active={viewMode === 'graphs'} onClick={() => setViewMode('graphs')} label="Gráficos" icon={<BarChart3 className="w-4 h-4" />} />
              <TabButton active={viewMode === 'history'} onClick={() => setViewMode('history')} label="Histórico" icon={<HistoryIcon className="w-4 h-4" />} />
            </div>
          )}

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            <div className="hidden md:flex items-center space-x-2">
              <button 
                onClick={() => setLinkedFilters(!linkedFilters)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${linkedFilters ? 'bg-emerald-500' : 'bg-rose-500'}`}
                title={linkedFilters ? 'Filtros Vinculados' : 'Filtros Desvinculados'}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${linkedFilters ? 'translate-x-6' : 'translate-x-0'}`}>
                  {linkedFilters ? <Link className="w-2.5 h-2.5 text-emerald-600" /> : <Link2Off className="w-2.5 h-2.5 text-rose-600" />}
                </div>
              </button>
            </div>

            <div className="flex space-x-2">
              {data && (
                <button
                  onClick={generateAIInsights}
                  disabled={analyzing}
                  className="inline-flex items-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-100"
                >
                  <BrainCircuit className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{analyzing ? 'Analisando...' : 'Insights'}</span>
                </button>
              )}
              <button onClick={() => { setData(null); setInsights(null); setViewMode('central'); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-100 rounded-xl">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      </div>

      <main className="max-w-full mx-auto px-2 pt-24 pb-12 sm:px-4 lg:px-6">
        {!data ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-slate-200 shadow-sm mx-auto max-w-4xl">
            <h2 className="text-3xl font-black mb-2 text-slate-800 tracking-tighter">utmdash & Perfect Pay</h2>
            <p className="text-slate-500 mb-10 max-w-sm text-center font-medium">Análise de ROI e Gestão de Tráfego nativa para relatórios Perfect Pay.</p>
            <div className="w-full max-w-md space-y-4 px-6">
              <input
                type="text"
                placeholder="Link CSV da Perfect Pay / Google Sheets"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <button
                onClick={loadFromUrl}
                disabled={loading || !sheetUrl}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'SINCRONIZANDO...' : 'CONECTAR VENDAS'}
              </button>
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest text-slate-400"><span className="px-2 bg-white">OU</span></div>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-indigo-100 border-dashed rounded-2xl cursor-pointer bg-indigo-50/30 hover:bg-indigo-50 transition-all">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Importar Arquivo .csv</span>
                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>
              
              {history.length > 0 && (
                <div className="mt-8 w-full">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 px-1">Últimos Importados</h4>
                  <div className="space-y-3">
                    {history.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{new Date(item.timestamp).toLocaleDateString()} • {item.stats.vendas} vendas</span>
                        </div>
                        <div className="flex items-center space-x-2">
                           <button 
                            onClick={() => loadFromHistory(item)}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-indigo-700 transition-all"
                          >
                            Carregar
                          </button>
                          <button 
                            onClick={() => deleteFromHistory(item.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {insights && (
              <div className="bg-indigo-950 rounded-[32px] p-8 text-white shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 border border-white/10 mx-auto max-w-full">
                <h3 className="text-xl font-black mb-4 flex items-center text-indigo-400"><BrainCircuit className="w-6 h-6 mr-2" /> ESTRATÉGIA IA</h3>
                <div className="prose prose-invert max-w-none text-indigo-100 font-medium whitespace-pre-line">{insights}</div>
              </div>
            )}
            <Dashboard 
              data={data} 
              viewMode={viewMode} 
              setViewMode={setViewMode} 
              linkedFilters={linkedFilters}
              history={history}
              onLoadFromHistory={loadFromHistory}
              onDeleteFromHistory={deleteFromHistory}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
