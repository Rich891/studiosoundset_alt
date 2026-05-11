import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { 
  Zap, Cpu, Music2, Calendar, Activity, Radio, FileText, Plus, ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    queryFn: () => base44.entities.AuditLog.list('-created_date', 3),
  });

  const connectedProviders = providers.filter(p => p.connectionStatus === 'connected');
  const onlineDevices = devices.filter(d => d.status === 'online' && d.isActive);
  const warningDevices = devices.filter(d => d.status === 'warning');

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const activeBlocks = scheduleBlocks.filter(b => 
    b.dayOfWeek === dayOfWeek && b.startTime <= currentTime && b.endTime >= currentTime
  );

  const quickActions = [
    { icon: Zap, label: 'Provider', path: '/providers/add', color: 'text-purple-400' },
    { icon: Cpu, label: 'Gerät', path: '/devices/add', color: 'text-blue-400' },
    { icon: Music2, label: 'Playlist', path: '/playlists/import', color: 'text-green-400' },
    { icon: Calendar, label: 'Kalender', path: '/calendar', color: 'text-orange-400' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Studio Sound <span className="gradient-text">Control Pro</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {format(new Date(), "dd.MM.yyyy")} · {format(new Date(), 'HH:mm')}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-full border border-green-500/20">
          <Activity className="w-3 h-3 text-green-400" />
          <span className="text-xs font-medium text-green-400">{activeBlocks.length} aktiv</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SystemStatusCard icon={Zap} label="Provider" value={connectedProviders.length} total={providers.length} color="purple" />
        <SystemStatusCard icon={Cpu} label="Online" value={onlineDevices.length} total={devices.length} color="blue" warning={warningDevices.length} />
        <SystemStatusCard icon={Music2} label="Playlists" value={playlists.length} color="green" />
        <SystemStatusCard icon={Calendar} label="Blöcke" value={activeBlocks.length} total={scheduleBlocks.length} color="orange" />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Schnellstart</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map(action => (
                <Link key={action.path} to={action.path}>
                  <Card className="glass-card hover:border-primary/40 transition-all cursor-pointer group h-full">
                    <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <action.icon className={`w-5 h-5 ${action.color}`} />
                      </div>
                      <span className="text-xs font-medium text-center">{action.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Now Playing */}
          {zones.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Now Playing</h2>
                <Link to="/now-playing">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">Alle</Button>
                </Link>
              </div>
              <div className="space-y-2">
                {zones.slice(0, 2).map(zone => {
                  const device = devices.find(d => d.id === zone.assignedDeviceId);
                  return (
                    <Card key={zone.id} className="glass-card p-3 hover:bg-card/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: `${zone.color}20`, color: zone.color }}>
                          ♪
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{zone.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{device?.name || 'Kein Gerät'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium">{device?.currentVolume || '—'}%</p>
                          <p className="text-xs">{device?.status === 'online' ? '🟢' : '🔴'}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Aktivität</h2>
            <Card className="glass-card">
              <CardContent className="p-4 space-y-2">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Keine Einträge</p>
                ) : (
                  auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 pb-2 border-b border-border/50 last:border-b-0 last:pb-0">
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                        log.status === 'error' ? 'bg-destructive' : 
                        log.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground line-clamp-2">{log.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.created_date ? format(new Date(log.created_date), 'HH:mm') : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Setup CTA */}
          {providers.length === 0 && (
            <Card className="border-primary/30 bg-primary/10">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2">Willkommen</h3>
                <p className="text-xs text-muted-foreground mb-3">Verbinde einen Musikprovider zum Starten.</p>
                <Link to="/providers/add">
                  <Button size="sm" className="w-full bg-primary hover:bg-primary/90 h-8 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Provider
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}