import React, { useState } from 'react';
import { ApiService } from '../services/api';
import { Ticket, TicketHistoryItem, FilterParams } from '../types';
import AiAnalysisModal from './AiAnalysisModal';
import { 
  Search, 
  Calendar, 
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
  Sparkles
} from 'lucide-react';

const Dashboard: React.FC = () => {
  // State
  const [filters, setFilters] = useState<FilterParams>({
    clientCode: '',
    clientName: '',
    priority: '',
    ticketType: '',
    dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days default
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<TicketHistoryItem[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  
  // AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Handlers
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    setError('');
    setSelectedTicket(null); // clear selection on new search

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
      // Don't clear ticket selection, just show error in panel
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Helper for Status Colors
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RESOLVED': return 'text-green-700 bg-green-50 border-green-200';
      case 'ACTIVE': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'NEW': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'PENDING_CLIENT': return 'text-orange-700 bg-orange-50 border-orange-200';
      default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  // Helper for Priority Colors
  const getPriorityColor = (p: string) => {
    switch (p.toUpperCase()) {
      case 'P1': return 'text-red-700 bg-red-100';
      case 'P2': return 'text-orange-700 bg-orange-100';
      default: return 'text-slate-600 bg-slate-100';
    }
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
        <div className="text-sm text-slate-500">
          Logged in as <span className="font-semibold text-slate-700">reporting_api</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar / Filter Panel */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col z-0 overflow-y-auto">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Client Code</label>
                <input 
                  type="text" 
                  value={filters.clientCode}
                  onChange={(e) => handleFilterChange('clientCode', e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white text-slate-900"
                  placeholder="e.g. chipotle"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white text-slate-900"
                >
                  <option value="">All Priorities</option>
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Medium</option>
                  <option value="P4">P4 - Low</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Type</label>
                <select
                  value={filters.ticketType}
                  onChange={(e) => handleFilterChange('ticketType', e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white text-slate-900"
                >
                  <option value="">All Types</option>
                  <option value="INCIDENT">Incident</option>
                  <option value="SERVICE_REQUEST">Service Request</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">From</label>
                  <input 
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 sm:text-xs px-2 py-2 border bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">To</label>
                  <input 
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 sm:text-xs px-2 py-2 border bg-white text-slate-900"
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
          
          {/* Recent Searches or Stats could go here */}
          <div className="p-5">
             <div className="text-xs text-slate-400">
               Enter criteria above to find tickets.
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden relative">
           
           {/* Ticket List Column */}
           <div className={`flex-1 flex flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 ${selectedTicket ? 'w-1/3 max-w-md hidden lg:flex' : 'w-full'}`}>
              
              {/* List Header */}
              <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
                 <div className="flex flex-col">
                    <h2 className="text-lg font-medium text-slate-800">Results</h2>
                    <span className="text-xs font-medium text-slate-500">
                      {tickets.length} found
                    </span>
                 </div>
                 
                 {tickets.length > 0 && (
                     <button 
                        onClick={() => setIsAiModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium border border-purple-200 transition-colors"
                     >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Analysis
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

                {tickets.map(ticket => (
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
                    
                    <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-slate-50">
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

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {ticket.ticketType && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {ticket.ticketType}
                          </span>
                        )}
                        {ticket.ticketSource && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="opacity-60 text-[9px] uppercase">Via</span> {ticket.ticketSource}
                          </span>
                        )}
                      </div>

                      {ticket.requesterEmail && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500" title={ticket.requesterEmail}>
                          <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{ticket.requesterEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
           </div>

           {/* Ticket Detail View (Slide-over or conditional render) */}
           {(selectedTicket) && (
             <div className="flex-[2] bg-white flex flex-col h-full overflow-hidden absolute inset-0 lg:static z-20">
               {/* Detail Header */}
               <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
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

               {/* History Timeline */}
               <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
                  {isLoadingHistory ? (
                    <div className="flex justify-center items-center h-full text-slate-500 gap-2">
                      <RefreshCw className="animate-spin h-5 w-5" /> Loading history...
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Activity Timeline</h3>
                      <div className="space-y-6">
                        {history.map((item, index) => (
                          <div key={item.id} className="relative pl-8">
                            {/* Vertical Line */}
                            {index !== history.length - 1 && (
                              <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-slate-200"></div>
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
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                                  <span className="font-bold text-slate-700">{item.actorName || item.actorId || "System"}</span>
                                  <span>via {item.source || "unknown"}</span>
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
                                    <div key={idx} className="text-xs flex items-center gap-2 bg-yellow-50 text-yellow-800 px-2 py-1 rounded w-fit">
                                      <span className="font-semibold">{update.field}:</span>
                                      <span className="line-through opacity-60">{update.oldValue}</span>
                                      <ChevronRight className="h-3 w-3" />
                                      <span className="font-bold">{update.newValue}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Workflow fallback if no specific comment/field update but is workflow */}
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
                <p className="font-medium">Select a ticket to view history</p>
             </div>
           )}

        </main>
      </div>

      <AiAnalysisModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
        tickets={tickets}
      />
    </div>
  );
};

export default Dashboard;