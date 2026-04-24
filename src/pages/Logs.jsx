import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const statusIcons = {
  success: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
};

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['auditLogs-all'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 100),
  });

  const filtered = statusFilter === 'all' ? logs : logs.filter(l => l.status === statusFilter);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="System-Logs"
        subtitle="Alle Systemaktivitäten und Fehlerprotokolle"
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="success">Erfolgreich</SelectItem>
                <SelectItem value="warning">Warnung</SelectItem>
                <SelectItem value="error">Fehler</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="glass-card rounded-xl h-14 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Log-Einträge</h3>
            <p className="text-muted-foreground text-sm">Logs werden automatisch erstellt, wenn Aktionen ausgeführt werden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Summary */}
          <div className="flex gap-4 text-sm text-muted-foreground mb-2">
            <span>{filtered.length} Einträge</span>
            <span className="text-green-400">{logs.filter(l => l.status === 'success').length} OK</span>
            <span className="text-yellow-400">{logs.filter(l => l.status === 'warning').length} Warnung</span>
            <span className="text-red-400">{logs.filter(l => l.status === 'error').length} Fehler</span>
          </div>

          {filtered.map(log => (
            <div key={log.id} className="glass-card rounded-xl p-4 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{statusIcons[log.status] || statusIcons.success}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0">
                    {log.created_date ? format(new Date(log.created_date), 'dd.MM.yy HH:mm', { locale: de }) : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {log.entityType && <span>Typ: {log.entityType}</span>}
                  {log.userId && <span>User: {log.userId}</span>}
                  {log.errorMessage && <span className="text-red-400">Fehler: {log.errorMessage}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}