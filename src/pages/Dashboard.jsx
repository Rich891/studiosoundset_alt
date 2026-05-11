import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { 
  Zap, Cpu, Music2, Calendar, AlertTriangle, CheckCircle2, 
  Clock, Plus, Activity, Radio, FileText, Settings, ArrowRight,
  TrendingUp, Volume2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import NowPlayingCard from '@/components/dashboard/NowPlayingCard';
import SystemStatusCard from '@/components/dashboard/SystemStatusCard';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.filter({ isActive: true }),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.filter({ isDeleted: false }),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.filter({ isActive: true }),
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });

  const { data: scheduleBlocks = [] } = useQuery({
    queryKey: ['scheduleBlocks'],
    queryFn: () => base44.entities.ScheduleBlock.filter({ isActive: true }),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs-recent'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 5),
  });

  const connectedProviders = providers.filter(p => p.connectionStatus === 'connected');
  const onlineDevices = devices.filter(d => d.status === 'online' && d.isActive);
  const warningDevices = devices.filter(d => d.status === 'warning');
  const offlineDevices = devices.filter(d => d.status === 'offline' || !d.isActive);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const activeBlocks = scheduleBlocks.filter(b => 
    b.dayOfWeek === dayOfWeek && b.startTime <= currentTime && b.endTime >= currentTime
  );

  const quickActions = [
    { icon: Zap, label: 'Provider hinzufügen', path: '/providers/add', color: 'text-purple-400' },
    { icon: Cpu, label: 'Gerät hinzufügen', path: '/devices/add', color: 'text-blue-400' },
    { icon: Music2, label: 'Playlist importieren', path: '/playlists/import', color: 'text-green-400' },
    { icon: Calendar, label: 'Kalenderblock', path: '/calendar', color: 'text-orange-400' },
    { icon: FileText, label: 'Logs öffnen', path: '/logs', color: 'text-yellow-400' },
    { icon: Settings, label: 'Einstellungen', path: '/settings', color: 'text-gray-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Studio Sound <span className="gradient-text">Control Pro</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(new Date(), "dd.MM.yyyy")} · {format(new Date(), 'HH:mm')} Uhr
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-status-green rounded-full">
            <Activity className="w-3.5 h-3.5 status-green" />
            <span className="text-xs font-medium status-green">{activeBlocks.length} Blöcke aktiv</span>
          </div>
        </div>
      </div>

      {/* System Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SystemStatusCard
          icon={Zap}
          label="Provider verbunden"
          value={connectedProviders.length}
          total={providers.length}
          color="purple"
        />
        <SystemStatusCard
          icon={Cpu}
          label="Geräte online"
          value={onlineDevices.length}
          total={devices.length}
          color="blue"
          warning={warningDevices.length}
        />
        <SystemStatusCard
          icon={Music2}
          label="Playlists"
          value={playlists.length}
          color="green"
        />
        <SystemStatusCard
          icon={Calendar}
          label="Aktive Blöcke"
          value={activeBlocks.length}
          total={scheduleBlocks.length}
          color="orange"
        />
      </div>

      {/* Now Playing Zones */}
      {zones.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              Now Playing
            </h2>
            <Link to="/now-playing">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                Alle anzeigen <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {zones.slice(0, 3).map(zone => {
              const device = devices.find(d => d.id === zone.assignedDeviceId);
              return <NowPlayingCard key={zone.id} zone={zone} device={device} />;
            })}
          </div>
        </div>
      )}

      {/* Quick Actions & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Schnellaktionen
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickActions.map(action => (
              <Link key={action.path} to={action.path}>
                <Card className="glass-card hover:border-primary/40 transition-all cursor-pointer group">
                  <CardContent className="p-4 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <action.icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <span className="text-xs font-medium text-center text-foreground">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Letzte Logs
            </h2>
            <Link to="/logs">
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
                Alle <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
          <Card className="glass-card">
            <CardContent className="p-4 space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Noch keine Logs vorhanden.</p>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      log.status === 'error' ? 'bg-destructive' : 
                      log.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.created_date ? format(new Date(log.created_date), 'HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Setup Banner if no providers */}
      {providers.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-semibold text-foreground">Willkommen bei Studio Sound Control Pro</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Starte jetzt mit der Einrichtung. Verbinde zuerst einen Musikprovider.
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/how-it-works">
                <Button variant="outline" size="sm">Anleitung</Button>
              </Link>
              <Link to="/providers/add">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1" /> Provider hinzufügen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}