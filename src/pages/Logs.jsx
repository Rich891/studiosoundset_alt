import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_CFG = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, color: 'text-green-400' },
  failed: { icon: <AlertCircle className="w-4 h-4 text-red-400" />, color: 'text-red-400' },
  pending: { icon: <Clock className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400' },
  picked_up: { icon: <Activity className="w-4 h-4 text-blue-400" />, color: 'text-blue-400' },
  timeout: { icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400' },
};

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: commands = [], isLoading, refetch, error } = useQuery({ queryKey: ['playerCommandsLog'], queryFn: () => base44.entities.PlayerCommand.list('-createdAt', 100), refetchInterval: 5000 });
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list() });

  const filtered = commands.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && (c.type || c.command) !== typeFilter) return false;
    return true;
  });
  const types = [...new Set(commands.map(c => c.type || c.command).filter(Boolean))];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4"><div><h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-muted/20 border border-border flex items-center justify-center"><FileText className="w-5 h-5 text-muted-foreground" /></div>Command Logs</h1><p className="text-sm text-muted-foreground mt-1 ml-14">Alle PlayerCommands mit Pickup, Abschluss und Fehlerdetails.</p></div><div className="flex items-center gap-2 flex-wrap"><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36 bg-muted/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Status</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="picked_up">Picked up</SelectItem><SelectItem value="timeout">Timeout</SelectItem></SelectContent></Select><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-44 bg-muted/30"><SelectValue placeholder="Alle Typen" /></SelectTrigger><SelectContent><SelectItem value="all">Alle Typen</SelectItem>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /></Button></div></div>
      {error && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">PlayerCommand Logs konnten nicht geladen werden: {error.message}. Prüfe, ob die Entity PlayerCommand in Base44 existiert.</div>}
      {isLoading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="bento-panel h-14 animate-pulse" />)}</div> : filtered.length === 0 ? <div className="bento-panel border-dashed border-border/30 p-16 text-center"><FileText className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-xl font-bold mb-2">Keine Einträge</h3><p className="text-muted-foreground text-sm">Logs erscheinen hier, wenn Admin Commands erstellt und der Player sie verarbeitet.</p></div> : <div className="space-y-2"><div className="flex gap-4 text-xs text-muted-foreground"><span>{filtered.length} Einträge</span><span className="text-green-400">{commands.filter(c => c.status === 'success').length} OK</span><span className="text-red-400">{commands.filter(c => c.status === 'failed' || c.status === 'timeout').length} Fehler/Timeout</span></div>{filtered.map(cmd => { const cfg = STATUS_CFG[cmd.status] || STATUS_CFG.pending; const player = players.find(p => p.id === cmd.playerId); return <div key={cmd.id} className="bento-panel p-4 flex items-start gap-3"><div className="flex-shrink-0 mt-0.5">{cfg.icon}</div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2 flex-wrap"><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-bold font-mono">{cmd.type || cmd.command}</span>{player && <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/30 rounded-full">{player.name}</span>}<span className={`text-xs font-semibold ${cfg.color}`}>{cmd.status}</span></div><p className="text-xs text-muted-foreground flex-shrink-0">{cmd.createdAt || cmd.created_date || ''}</p></div><div className="grid md:grid-cols-3 gap-2 text-xs text-muted-foreground mt-2"><span>Picked up: {cmd.pickedUpAt || '—'}</span><span>Completed: {cmd.completedAt || '—'}</span><span>Error: {cmd.errorCode || '—'}</span></div>{cmd.humanMessage && <p className="text-xs text-muted-foreground mt-2">{cmd.humanMessage}</p>}{cmd.technicalMessage && <p className="text-xs text-muted-foreground/50 font-mono mt-0.5 break-words">{cmd.technicalMessage}</p>}{cmd.suggestedFix && <p className="text-xs text-yellow-400 mt-1">→ {cmd.suggestedFix}</p>}</div></div>; })}</div>}
    </div>
  );
}
