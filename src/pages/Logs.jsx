import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_CFG = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, color: 'text-green-400' },
  failed:  { icon: <AlertCircle className="w-4 h-4 text-red-400" />,    color: 'text-red-400' },
  pending: { icon: <Clock className="w-4 h-4 text-muted-foreground" />, color: 'text-muted-foreground' },
  running: { icon: <RefreshCw className="w-4 h-4 text-primary animate-spin" />, color: 'text-primary' },
  timeout: { icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400' },
};

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: commands = [], isLoading, refetch } = useQuery({
    queryKey: ['commands-log'],
    queryFn: () => base44.entities.Command.list('-created_date', 100),
    refetchInterval: 15000,
  });

  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['spotifyAccounts'], queryFn: () => base44.entities.SpotifyAccount.list() });

  const filtered = commands.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    return true;
  });

  const types = [...new Set(commands.map(c => c.type).filter(Boolean))];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/20 border border-border flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            Command-Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Alle gesendeten Steuerbefehle mit Status und Fehlermeldungen.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-muted/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="success">Erfolg</SelectItem>
              <SelectItem value="failed">Fehler</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="timeout">Timeout</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 bg-muted/30"><SelectValue placeholder="Alle Typen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="bento-panel h-14 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bento-panel border-dashed border-border/30 p-16 text-center">
          <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Einträge</h3>
          <p className="text-muted-foreground text-sm">Logs erscheinen hier wenn Steuerbefehle ausgeführt werden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{filtered.length} Einträge</span>
            <span className="text-green-400">{commands.filter(c => c.status === 'success').length} OK</span>
            <span className="text-red-400">{commands.filter(c => c.status === 'failed').length} Fehler</span>
          </div>
          {filtered.map(cmd => {
            const cfg = STATUS_CFG[cmd.status] || STATUS_CFG.pending;
            const zone = zones.find(z => z.id === cmd.zoneId);
            const acc = accounts.find(a => a.id === cmd.spotifyAccountId);
            return (
              <div key={cmd.id} className="bento-panel p-4 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold font-mono">{cmd.type}</span>
                      {zone && <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/30 rounded-full">{zone.name}</span>}
                      {acc && <span className="text-xs text-muted-foreground">{acc.displayName}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {cmd.created_date ? format(new Date(cmd.created_date), 'dd.MM.yy HH:mm:ss', { locale: de }) : ''}
                    </p>
                  </div>
                  {cmd.humanMessage && <p className="text-xs text-muted-foreground mt-0.5">{cmd.humanMessage}</p>}
                  {cmd.technicalMessage && <p className="text-xs text-muted-foreground/50 font-mono mt-0.5 truncate">{cmd.technicalMessage}</p>}
                  {cmd.suggestedFix && <p className="text-xs text-yellow-400 mt-1">→ {cmd.suggestedFix}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}