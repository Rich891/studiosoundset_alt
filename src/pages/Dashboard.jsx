import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { 
  Zap, Cpu, Music, Calendar, CheckCircle2, AlertCircle, Clock, Activity, Radio
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.list(),
  });
  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ['scheduleBlocks'],
    queryFn: () => base44.entities.ScheduleBlock.list(),
  });

  // Setup Flow Status
  const setupSteps = [
    {
      id: 1,
      title: 'Provider',
      description: 'Spotify verbinden',
      icon: Zap,
      status: providers.length > 0 ? 'done' : 'open',
      action: '/providers/add',
      link: '/providers',
    },
    {
      id: 2,
      title: 'Gerät',
      description: 'Lautsprecher einrichten',
      icon: Cpu,
      status: devices.length > 0 ? 'done' : 'open',
      action: '/devices/add',
      link: '/devices',
    },
    {
      id: 3,
      title: 'Playlist',
      description: 'Musik importieren',
      icon: Music,
      status: playlists.length > 0 ? 'done' : 'open',
      action: '/playlists/import',
      link: '/playlists',
    },
    {
      id: 4,
      title: 'Kalender',
      description: 'Zeitblöcke planen',
      icon: Calendar,
      status: blocks.length > 0 ? 'done' : 'open',
      action: '/calendar',
      link: '/calendar',
    },
  ];

  const completedSteps = setupSteps.filter(s => s.status === 'done').length;
  const progress = (completedSteps / setupSteps.length) * 100;

  const connectedProviders = providers.filter(p => p.connectionStatus === 'connected');
  const onlineDevices = devices.filter(d => d.status === 'online');

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">
            Studio Sound <span className="gradient-text">Control Pro</span>
          </h1>
          <p className="text-muted-foreground mt-2">{format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
        </div>
      </div>

      {/* Setup Flow - Bento Style */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Einrichtungsplan</h2>
        <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {setupSteps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = step.status === 'done';
            return (
              <Link key={step.id} to={step.link}>
                <Card className={`glass-card transition-all cursor-pointer hover:border-primary/50 h-full ${isDone ? 'border-green-500/30 bg-green-500/5' : 'border-muted/20'}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDone ? 'bg-green-500/20' : 'bg-primary/20'}`}>
                        <Icon className={`w-6 h-6 ${isDone ? 'text-green-400' : 'text-primary'}`} />
                      </div>
                      {isDone && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                    </div>
                    <Button size="sm" className={`w-full text-xs h-8 ${isDone ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}>
                      {isDone ? '✓ Fertig' : 'Starten'}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Provider Status */}
        <Card className="glass-card border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Provider</p>
              {connectedProviders.length > 0 ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="text-3xl font-bold text-purple-400">{connectedProviders.length}/{providers.length}</div>
            <p className="text-xs text-muted-foreground">verbunden</p>
            <Link to="/providers"><Button size="sm" className="w-full h-8 text-xs">Verwalten</Button></Link>
          </CardContent>
        </Card>

        {/* Device Status */}
        <Card className="glass-card border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Geräte</p>
              {onlineDevices.length > 0 ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="text-3xl font-bold text-blue-400">{onlineDevices.length}/{devices.length}</div>
            <p className="text-xs text-muted-foreground">online</p>
            <Link to="/devices"><Button size="sm" className="w-full h-8 text-xs">Verwalten</Button></Link>
          </CardContent>
        </Card>

        {/* Playlists Status */}
        <Card className="glass-card border-green-500/20 bg-green-500/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Playlists</p>
              {playlists.length > 0 ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="text-3xl font-bold text-green-400">{playlists.length}</div>
            <p className="text-xs text-muted-foreground">importiert</p>
            <Link to="/playlists"><Button size="sm" className="w-full h-8 text-xs">Verwalten</Button></Link>
          </CardContent>
        </Card>

        {/* Calendar Status */}
        <Card className="glass-card border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Blöcke</p>
              {blocks.length > 0 ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="text-3xl font-bold text-orange-400">{blocks.length}</div>
            <p className="text-xs text-muted-foreground">geplant</p>
            <Link to="/calendar"><Button size="sm" className="w-full h-8 text-xs">Planen</Button></Link>
          </CardContent>
        </Card>
      </div>

      {/* System Health & Now Playing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Check */}
        <Card className="glass-card border-cyan-500/20 bg-cyan-500/5 lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">System Health</h3>
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Provider Auth</span>
                {connectedProviders.length > 0 ? <span className="text-green-400">✓ OK</span> : <span className="text-yellow-400">⚠ Setup erforderlich</span>}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Geräte erkannt</span>
                {devices.length > 0 ? <span className="text-green-400">✓ {devices.length} Stück</span> : <span className="text-yellow-400">⚠ Keine</span>}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Playlists sync</span>
                {playlists.length > 0 ? <span className="text-green-400">✓ {playlists.length} geladen</span> : <span className="text-yellow-400">⚠ Keine</span>}
              </div>
            </div>
            <Link to="/admin/system-check"><Button className="w-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 h-10">System Check starten</Button></Link>
          </CardContent>
        </Card>

        {/* Active Zones */}
        <Card className="glass-card border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Zonen</h3>
              <Radio className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-3xl font-bold text-rose-400">{zones.length}</div>
            <p className="text-xs text-muted-foreground">konfiguriert</p>
            <Link to="/devices"><Button size="sm" className="w-full h-8 text-xs">Einrichten</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}