import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMIN_LIVE_REFETCH_INTERVAL_MS, ADMIN_TIMEOUT_SWEEP_INTERVAL_MS, COMMAND_STATUS, listPlayerCommands, markStalePendingCommands } from '@/lib/studioSoundSetRuntime';

function statusClass(status) {
  if (status === COMMAND_STATUS.SUCCESS) return 'text-green-400 border-green-500/30 bg-green-500/10';
  if (status === COMMAND_STATUS.FAILED || status === COMMAND_STATUS.TIMEOUT) return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (status === COMMAND_STATUS.PICKED_UP) return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
  return 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';
}

function StatusIcon({ status }) {
  if (status === COMMAND_STATUS.SUCCESS) return <CheckCircle2 className="w-4 h-4" />;
  if (status === COMMAND_STATUS.FAILED || status === COMMAND_STATUS.TIMEOUT) return <XCircle className="w-4 h-4" />;
  if (status === COMMAND_STATUS.PICKED_UP) return <Activity className="w-4 h-4" />;
  return <Clock className="w-4 h-4" />;
}

export default function Commands() {
  const queryClient = useQueryClient();
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-updated_date'), refetchInterval: ADMIN_LIVE_REFETCH_INTERVAL_MS });
  const { data: commands = [], isLoading, error } = useQuery({ queryKey: ['playerCommands'], queryFn: () => listPlayerCommands(), refetchInterval: ADMIN_LIVE_REFETCH_INTERVAL_MS });
  const playerIds = useMemo(() => players.map((player) => player.id).filter(Boolean).join('|'), [players]);

  useEffect(() => {
    if (!playerIds) return undefined;
    const run = async () => {
      await Promise.allSettled(playerIds.split('|').map((id) => markStalePendingCommands(id)));
      queryClient.invalidateQueries({ queryKey: ['playerCommands'] });
    };
    const id = setInterval(run, ADMIN_TIMEOUT_SWEEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playerIds, queryClient]);

  const pending = commands.filter(c => c.status === COMMAND_STATUS.PENDING || c.status === COMMAND_STATUS.PICKED_UP).length;
  const failed = commands.filter(c => c.status === COMMAND_STATUS.FAILED || c.status === COMMAND_STATUS.TIMEOUT).length;
  const success = commands.filter(c => c.status === COMMAND_STATUS.SUCCESS).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap"><div><h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Activity className="w-5 h-5 text-cyan-400" /></div>Commands</h1><p className="text-sm text-muted-foreground mt-1 ml-14">Command lifecycle: pending -> picked_up -> success/failed. No fake success states.</p></div><Button variant="outline" className="gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ['playerCommands'] })}><RefreshCw className="w-4 h-4" /> Refresh</Button></div>
      {error && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"><p className="font-bold">Command Backend nicht erreichbar.</p><p className="mt-1">{error.humanMessage || error.message}</p><p className="mt-2 text-red-200/80">Commands laufen ueber die Backend-Funktion `playerCommandControl`, nicht ueber lokale Browser-Fallbacks.</p></div>}
      <div className="grid grid-cols-3 gap-3"><div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-black text-yellow-300">{pending}</p></div><div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Success</p><p className="text-2xl font-black text-green-400">{success}</p></div><div className="bento-panel p-4"><p className="text-xs text-muted-foreground">Failed/Timeout</p><p className="text-2xl font-black text-red-400">{failed}</p></div></div>
      <div className="bento-panel p-5 space-y-3">{isLoading ? <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div> : commands.length === 0 ? <div className="py-12 text-sm text-muted-foreground flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Noch keine Commands.</div> : <div className="space-y-2">{commands.slice(0, 100).map((cmd) => { const player = players.find(p => p.id === cmd.playerId); return <div key={cmd.id} className="rounded-xl border border-border/40 bg-background/40 p-4 grid lg:grid-cols-[160px_1fr_130px_160px] gap-3 items-start"><div><p className="font-bold text-sm">{cmd.type || cmd.command}</p><p className="text-xs text-muted-foreground">{player?.name || cmd.playerId || 'Unknown player'}</p></div><div className="text-xs text-muted-foreground space-y-1"><p>Created: {cmd.createdAt || cmd.created_date || '-'}</p><p>Picked up: {cmd.pickedUpAt || '-'}</p><p>Completed: {cmd.completedAt || '-'}</p>{(cmd.humanMessage || cmd.errorCode) && <p className="break-words">{cmd.errorCode ? `${cmd.errorCode}: ` : ''}{cmd.humanMessage}</p>}{cmd.suggestedFix && <p className="text-yellow-300 break-words">Fix: {cmd.suggestedFix}</p>}</div><div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${statusClass(cmd.status)}`}><StatusIcon status={cmd.status} />{cmd.status}</div><pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words max-h-28 overflow-auto">{cmd.payload ? JSON.stringify(cmd.payload, null, 2) : ''}</pre></div>; })}</div>}</div>
    </div>
  );
}
