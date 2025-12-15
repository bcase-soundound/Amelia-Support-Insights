import React, { useState, useMemo } from 'react';
import { ApiService } from '../services/api';
import { Ticket, TicketHistoryItem, FilterParams, AiAnalysisResult } from '../types';
import AiAnalysisModal from './AiAnalysisModal';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Tag,
  User,
  Sparkles,
  Download,
  ArrowUpDown,
  ListFilter,
  Ban
} from 'lucide-react';

const Dashboard: React.FC = () => {
  // --- STATE ---
  const [filters, setFilters] = useState<FilterParams>({
    clientCode: '',
    isClientCodeNegated: false,
    clientName: '',
    priority: [],
    ticketType: [],
    subject: '',
    isSubjectNegated: false,
    dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<TicketHistoryItem[]>([]);
  
  // AI Results Map: TicketID -> Result
  const [aiResults, setAiResults] = useState<Record<number, AiAnalysisResult>>({});
  
  // UI State
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Sorting
  const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'score_asc' | 'score_desc'>('date_desc');

  // --- HANDLERS ---

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    setError('');
    setSelectedTicket(null);
    setAiResults({}); // Clear previous AI results on new search

    try {
      const response = await ApiService.searchTickets(filters);
      setTickets(response.searchResults);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch tickets. Please check your filters.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTicketSelect = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsLoadingHistory(true);
    try {
      const response = await ApiService.getTicketHistory(ticket.ticketId);
      setHistory(response.content);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFilterChange = (key: keyof FilterParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: 'priority' | 'ticketType', value: string) => {
    setFilters(prev => {
        const current = prev[key] as string[];
        if (current.includes(value)) {
            return { ...prev, [key]: current.filter(item => item !== value) };
        } else {
            return { ...prev, [key]: [...current, value] };
        }
    });
  };

  const handleAnalysisUpdate = (result: AiAnalysisResult) => {
    setAiResults(prev => ({
        ...prev,
        [result.ticketId]: result
    }));
  };

  const handleExport = () => {
    // 1. Headers
    const headers = [
        "Ticket ID", "Client", "Subject", "Priority", "Status", "Type", "Created", "Resolved", 
        "AI Score", "AI Summary", "RCA Detected", "Strengths", "Weaknesses", "AI Error"
    ];

    // 2. Helper to escape CSV
    const escapeCsv = (field: any) => {
        if (field === null || field === undefined) return '';
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    // 3. Map Data
    // We export the filtered/sorted view or the whole current search result? 
    // Usually exporting what matches current filters is best.
    const csvRows = processedTickets.map(t => {
        const ai = aiResults[t.ticketId];
        return [
            t.ticketId,
            t.ticketClientName,
            t.subject,
            t.priority,
            t.status,
            t.ticketType,
            t.created,
            t.resolved || '',
            ai ? ai.score : '',
            ai ? ai.summary : '',
            ai ? (ai.rcaDetected ? "Yes" : "No") : '',
            ai ? ai.strengths.join('; ') : '',
            ai ? ai.weaknesses.join('; ') : '',
            ai ? (ai.error || '') : ''
        ].map(escapeCsv).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `support_analysis_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DERIVED STATE ---

  const processedTickets = useMemo(() => {
    let result = [...tickets];

    // Sorting
    result.sort((a, b) => {
        const dateA = new Date(a.created).getTime();
        const dateB = new Date(b.created).getTime();
        const scoreA = aiResults[a.ticketId]?.score || 0;
        const scoreB = aiResults[b.ticketId]?.score || 0;

        switch (sortOption) {
            case 'date_asc': return dateA - dateB;
            case 'date_desc': return dateB - dateA;
            case 'score_asc': 
                // Put un-scored tickets at the end for clarity? Or treat as 0.
                if (!aiResults[a.ticketId] && aiResults[b.ticketId]) return 1;
                if (aiResults[a.ticketId] && !aiResults[b.ticketId]) return -1;
                return scoreA - scoreB;
            case 'score_desc':
                return scoreB - scoreA;
            default: return 0;
        }
    });

    return result;
  }, [tickets, aiResults, sortOption]);

  const stats = useMemo(() => {
     const analyzedCount = Object.keys(aiResults).length;
     if (analyzedCount === 0) return null;
     
     const totalScore = Object.values(aiResults).reduce((acc, curr) => acc + (curr.score || 0), 0);
     const rcaCount = Object.values(aiResults).filter(r => r.rcaDetected).length;
     
     return {
        avgScore: (totalScore / analyzedCount).toFixed(1),
        rcaPercentage: Math.round((rcaCount / analyzedCount) * 100)
     };
  }, [aiResults]);


  // --- HELPERS ---
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RESOLVED': return 'text-green-700 bg-green-50 border-green-200';
      case 'ACTIVE': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'NEW': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'PENDING_CLIENT': return 'text-orange-700 bg-orange-50 border-orange-200';
      default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p.toUpperCase()) {
      case 'P1': return 'text-red-700 bg-red-100';
      case 'P2': return 'text-orange-700 bg-orange-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getScoreColor = (score: number) => {
      if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
      if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Search className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Support Explorer</h1>
        </div>
        <div className="flex items-center gap-4">
             {/* Global Stats Widget if AI is active */}
             {stats && (
                 <div className="hidden md:flex items-center gap-4 mr-4 px-4 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                     <div className="flex flex-col items-center">
                         <span className="text-[10px] uppercase text-slate-400 font-bold">Avg Quality</span>
                         <span className={`text-sm font-bold ${Number(stats.avgScore) >= 8 ? 'text-green-600' : 'text-slate-700'}`}>{stats.avgScore}</span>
                     </div>
                     <div className="w-px h-6 bg-slate-200"></div>
                     <div className="flex flex-col items-center">
                         <span className="text-[10px] uppercase text-slate-400 font-bold">RCA Rate</span>
                         <span className="text-sm font-bold text-blue-600">{stats.rcaPercentage}%</span>
                     </div>
                 </div>
             )}
            <div className="text-sm text-slate-500">
                <User className="h-4 w-4 inline mr-2"/>
                <span className="font-semibold text-slate-700">reporting_api</span>
            </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar / Filter Panel */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-0 overflow-y-auto flex-shrink-0">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase flex justify-between">
                    Client Code
                    {filters.isClientCodeNegated && <span className="text-[10px] text-red-500 font-bold uppercase">Excluded</span>}
                </label>
                <div className="flex gap-2 mt-1">
                    <input 
                    type="text" 
                    value={filters.clientCode}
                    onChange={(e) => handleFilterChange('clientCode', e.target.value)}
                    className={`block w-full rounded-md shadow-sm focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white text-slate-900 ${filters.isClientCodeNegated ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-300 focus:border-blue-500'}`}
                    placeholder="e.g. chipotle, ipsoft"
                    />
                    <button
                        type="button"
                        onClick={() => handleFilterChange('isClientCodeNegated', !filters.isClientCodeNegated)}
                        className={`p-2 rounded-md border transition-colors ${filters.isClientCodeNegated ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-300 text-slate-400 hover:text-slate-600'}`}
                        title="Exclude this client"
                    >
                        <Ban className="h-4 w-4" />
                    </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase flex justify-between">
                    Subject Pattern
                    {filters.isSubjectNegated && <span className="text-[10px] text-red-500 font-bold uppercase">Excluded</span>}
                </label>
                <div className="flex gap-2 mt-1">
                    <input 
                    type="text" 
                    value={filters.subject || ''}
                    onChange={(e) => handleFilterChange('subject', e.target.value)}
                    className={`block w-full rounded-md shadow-sm focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white text-slate-900 ${filters.isSubjectNegated ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-300 focus:border-blue-500'}`}
                    placeholder="e.g. *error*"
                    />
                    <button
                        type="button"
                        onClick={() => handleFilterChange('isSubjectNegated', !filters.isSubjectNegated)}
                        className={`p-2 rounded-md border transition-colors ${filters.isSubjectNegated ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-300 text-slate-400 hover:text-slate-600'}`}
                        title="Exclude this subject pattern"
                    >
                        <Ban className="h-4 w-4" />
                    </button>
                </div>
              </div>
              
              <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Priority</label>
                    <div className="flex flex-wrap gap-2">
                        {['P1', 'P2', 'P3', 'P4'].map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => toggleArrayFilter('priority', p)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
                                    filters.priority.includes(p) 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Type</label>
                    <div className="flex flex-col gap-2">
                        {[
                            { id: 'INCIDENT', label: 'Incident' },
                            { id: 'SERVICE_REQUEST', label: 'Service Request' }
                        ].map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleArrayFilter('ticketType', t.id)}
                                className={`px-3 py-2 text-xs font-medium rounded-md border flex items-center justify-between transition-all ${
                                    filters.ticketType.includes(t.id) 
                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {t.label}
                                {filters.ticketType.includes(t.id) && <CheckCircle2 className="h-3 w-3" />}
                            </button>
                        ))}
                    </div>
                  </div>
              </div>

              <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Date Range</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input 
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                        className="block w-full rounded-md border-slate-300 shadow-sm sm:text-xs px-2 py-2 border bg-white text-slate-900"
                    />
                    <input 
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                        className="block w-full rounded-md border-slate-300 shadow-sm sm:text-xs px-2 py-2 border bg-white text-slate-900"
                    />
                  </div>
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {isSearching ? <RefreshCw className="animate-spin h-4 w-4" /> : 'Apply Filters'}
              </button>
            </form>
          </div>
          
          {/* AI Sorting & Filtering Panel */}
          {Object.keys(aiResults).length > 0 && (
             <div className="p-5 border-b border-slate-100 bg-purple-50/50">
                 <h2 className="text-sm font-semibold text-purple-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Tools
                 </h2>
                 <div className="space-y-4">
                     <div>
                        <label className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1">
                            <ArrowUpDown className="h-3 w-3" /> Sort By
                        </label>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                            className="mt-1 block w-full rounded-md border-purple-200 shadow-sm sm:text-sm px-3 py-2 border bg-white text-slate-900 focus:border-purple-500 focus:ring-purple-500"
                        >
                            <option value="date_desc">Date (Newest)</option>
                            <option value="date_asc">Date (Oldest)</option>
                            <option value="score_desc">Quality Score (High-Low)</option>
                            <option value="score_asc">Quality Score (Low-High)</option>
                        </select>
                     </div>

                     <button
                        onClick={handleExport}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                     >
                        <Download className="h-4 w-4" /> Export Report
                     </button>
                 </div>
             </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden relative">
           
           {/* Ticket List Column */}
           <div className={`flex-1 flex flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 ${selectedTicket ? 'w-1/3 max-w-md hidden lg:flex' : 'w-full'}`}>
              
              {/* List Header */}
              <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                 <div className="flex flex-col">
                    <h2 className="text-lg font-medium text-slate-800">Results</h2>
                    <span className="text-xs font-medium text-slate-500">
                      {processedTickets.length} tickets
                    </span>
                 </div>
                 
                 {tickets.length > 0 && (
                     <button 
                        onClick={() => setIsAiModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
                     >
                        <Sparkles className="h-3.5 w-3.5" />
                        {Object.keys(aiResults).length > 0 ? 'Run New Analysis' : 'Run AI Analysis'}
                     </button>
                 )}
              </div>

              {/* List Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {error && (
                  <div className="text-center p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {tickets.length === 0 && !isSearching && !error && (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Search className="h-12 w-12 mb-3 opacity-20" />
                    <p>No tickets found.</p>
                  </div>
                )}

                {processedTickets.map(ticket => {
                  const ai = aiResults[ticket.ticketId];
                  return (
                    <div 
                        key={ticket.ticketId}
                        onClick={() => handleTicketSelect(ticket)}
                        className={`bg-white p-4 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-all ${selectedTicket?.ticketId === ticket.ticketId ? 'ring-2 ring-blue-500 border-transparent' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                            </span>
                            <span className="text-xs font-mono text-slate-500">#{ticket.ticketId}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                        </span>
                        </div>
                        
                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2">
                            {ticket.subject || "(No Subject)"}
                        </h3>

                        {/* AI Summary Badge inside Ticket Card */}
                        {ai && (
                            <div className="mb-3 flex items-center gap-2">
                                <div className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase flex items-center gap-1 ${getScoreColor(ai.score)}`}>
                                    <span>Score: {ai.score}</span>
                                </div>
                                {ai.rcaDetected && (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200 flex items-center gap-1">
                                        <Sparkles className="h-2 w-2"/> RCA
                                    </span>
                                )}
                                {ai.error && (
                                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200">
                                        Failed
                                    </span>
                                )}
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-50">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-1.5" title="Client Code">
                                <Tag className="h-3 w-3 text-slate-400" />
                                <span className="font-medium">{ticket.ticketClientCode}</span>
                                </div>
                                <div className="flex items-center gap-1.5" title="Created Date">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span>{new Date(ticket.created).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                  );
                })}
              </div>
           </div>

           {/* Ticket Detail View */}
           {(selectedTicket) && (
             <div className="flex-[2] bg-white flex flex-col h-full overflow-hidden absolute inset-0 lg:static z-20">
               {/* Detail Header */}
               <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm flex-shrink-0">
                 <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setSelectedTicket(null)}
                     className="lg:hidden p-2 hover:bg-slate-100 rounded-full text-slate-500"
                   >
                     <ArrowLeft className="h-5 w-5" />
                   </button>
                   <div>
                     <div className="flex items-center gap-3 mb-1">
                       <h2 className="text-xl font-bold text-slate-900">#{selectedTicket.ticketId}</h2>
                       <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusColor(selectedTicket.status)}`}>
                          {selectedTicket.status}
                       </span>
                     </div>
                     <p className="text-sm text-slate-500 truncate max-w-md">{selectedTicket.subject}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4 text-sm text-slate-600">
                   <div className="text-right hidden sm:block">
                     <div className="font-medium text-slate-900">{selectedTicket.ticketClientName}</div>
                     <div className="text-xs text-slate-500">Client</div>
                   </div>
                 </div>
               </div>

               {/* Scrollable Content */}
               <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
                  
                  {/* AI Analysis Card (Top of Detail View) */}
                  {aiResults[selectedTicket.ticketId] && (
                      <div className="max-w-3xl mx-auto mb-8 animate-fadeIn">
                          <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
                             <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-purple-600" />
                                    <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wide">AI Quality Insights</h3>
                                </div>
                                <div className={`px-3 py-1 rounded-full border text-xs font-bold ${getScoreColor(aiResults[selectedTicket.ticketId].score)}`}>
                                    Score: {aiResults[selectedTicket.ticketId].score}/10
                                </div>
                             </div>
                             
                             {aiResults[selectedTicket.ticketId].error ? (
                                 <div className="p-4 text-red-600 text-sm">
                                     <AlertCircle className="h-4 w-4 inline mr-2"/>
                                     Analysis Failed: {aiResults[selectedTicket.ticketId].error}
                                 </div>
                             ) : (
                                <div className="p-5 space-y-4">
                                    <p className="text-sm text-slate-700 italic border-l-4 border-purple-300 pl-3">
                                        "{aiResults[selectedTicket.ticketId].summary}"
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <h4 className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3"/> Strengths
                                            </h4>
                                            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 marker:text-green-300">
                                                {aiResults[selectedTicket.ticketId].strengths.map((s,i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-red-700 uppercase mb-2 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3"/> Weaknesses
                                            </h4>
                                            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 marker:text-red-300">
                                                {aiResults[selectedTicket.ticketId].weaknesses.map((w,i) => <li key={i}>{w}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    {aiResults[selectedTicket.ticketId].rcaDetected && (
                                        <div className="mt-2 bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded flex items-center gap-2 border border-blue-100">
                                            <CheckCircle2 className="h-3 w-3"/> Root Cause Analysis detected in history.
                                        </div>
                                    )}
                                </div>
                             )}
                          </div>
                      </div>
                  )}

                  {isLoadingHistory ? (
                    <div className="flex justify-center items-center h-32 text-slate-500 gap-2">
                      <RefreshCw className="animate-spin h-5 w-5" /> Loading history...
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <ListFilter className="h-3 w-3"/> Activity Timeline
                      </h3>
                      <div className="space-y-6">
                        {history.map((item, index) => (
                          <div key={item.id} className="relative pl-8 group">
                            {/* Vertical Line */}
                            {index !== history.length - 1 && (
                              <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-slate-200 group-hover:bg-slate-300 transition-colors"></div>
                            )}
                            
                            {/* Icon Logic */}
                            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white z-10 
                              ${item.source === 'workflow' ? 'border-purple-400 text-purple-500' : 
                                item.comment ? 'border-blue-400 text-blue-500' : 'border-slate-300 text-slate-400'}`}>
                              {item.comment ? <MessageSquare className="h-3 w-3" /> : 
                               item.source === 'workflow' ? <CheckCircle2 className="h-3 w-3" /> : 
                               <AlertCircle className="h-3 w-3" />}
                            </div>

                            {/* Content Card */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                                  <span className="font-bold text-slate-700">{item.actorName || item.actorId || "System"}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] uppercase">{item.source || "unknown"}</span>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(item.created).toLocaleString()}
                                </span>
                              </div>

                              {/* Comment Render */}
                              {item.comment && (
                                <div className="mt-2 text-sm text-slate-800 bg-slate-50 p-3 rounded border border-slate-100 prose prose-sm max-w-none">
                                  <div dangerouslySetInnerHTML={{ __html: item.comment.content }} />
                                </div>
                              )}

                              {/* Field Updates Render */}
                              {item.fieldUpdates && item.fieldUpdates.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {item.fieldUpdates.map((update, idx) => (
                                    <div key={idx} className="text-xs flex items-center gap-2 bg-yellow-50 text-yellow-800 px-2 py-1 rounded w-fit border border-yellow-100">
                                      <span className="font-semibold">{update.field}:</span>
                                      <span className="line-through opacity-60">{update.oldValue}</span>
                                      <ChevronRight className="h-3 w-3" />
                                      <span className="font-bold">{update.newValue}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Workflow fallback */}
                              {item.source === 'workflow' && !item.comment && (!item.fieldUpdates || item.fieldUpdates.length === 0) && (
                                <div className="text-xs text-slate-500 italic">
                                  Workflow automation executed.
                                </div>
                              )}

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
             </div>
           )}

           {/* Empty State for Details */}
           {!selectedTicket && (
             <div className="hidden lg:flex flex-[2] bg-slate-100 items-center justify-center text-slate-400 flex-col">
                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                  <Filter className="h-10 w-10 text-slate-300" />
                </div>
                <p className="font-medium">Select a ticket to view history & insights</p>
             </div>
           )}

        </main>
      </div>

      <AiAnalysisModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
        tickets={processedTickets} // Pass processed tickets to support filtered analysis
        onAnalysisUpdate={handleAnalysisUpdate}
      />
    </div>
  );
};

export default Dashboard;