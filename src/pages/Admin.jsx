import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Users, Activity, Database, Link } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import { format } from 'date-fns';

export default function Admin() {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 20),
  });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });
  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: () => base44.entities.Device.filter({ isDeleted: false }) });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });

  const stats = [
    { label: 'Nutzer', value: users.length, icon: Users, color: 'text-purple-400' },
    { label: 'Provider', value: providers.length, icon: Database, color: 'text-blue-400' },
    { label: 'Geräte', value: devices.length, icon: Activity, color: 'text-green-400' },
    { label: 'Zonen', value: zones.length, icon: Shield, color: 'text-orange-400' },
    { label: 'Playlists', value: playlists.length, icon: Database, color: 'text-pink-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Nutzerverwaltung, System-Logs und Statusübersicht"
        actions={
          <RouterLink to="/admin/system-check">
            <Button variant="outline" size="sm">System-Check</Button>
          </RouterLink>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center">
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Nutzer</CardTitle></CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Nutzerdaten verfügbar.</p>
            ) : (
              <div className="space-y-2">
                {users.slice(0, 10).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{u.full_name || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{u.role}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Letzte Aktivitäten</CardTitle></CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Log-Einträge.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      log.status === 'error' ? 'bg-destructive' : log.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.created_date ? format(new Date(log.created_date), 'dd.MM.yy HH:mm') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}