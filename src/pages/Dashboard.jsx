import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap, Cpu, Music2, CalendarDays, PlayCircle, Activity,
  Radio, CheckCircle2, AlertCircle, Clock, ArrowRight,
  Plus, TestTube, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import SetupFlow from '@/components/dashboard/SetupFlow';

export default function Dashboard() {
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });
  const { data: devices = [] }   = useQuery({ queryKey: ['devices'],   queryFn: () => base44.entities.Device.list() });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });
  const { data: zones = [] }     = useQuery({ queryKey: ['zones'],     queryFn: () => base44.entities.Zone.list() });
  const { data: blocks = [] }    = useQuery({ queryKey: ['scheduleBlocks'], queryFn: () => base44.entities.ScheduleBlock.list() });

  const connectedProviders = providers.filter(p => p.connectionStatus === 'connected');
  const onlineDevices = devices.filter(d => d.status === 'online');
  const activeBlocks = blocks.filter(b => b.isActive);

  const setupSteps = [
    { id: 1, title: 'Provider', description: 'Spotify verbinden', status: providers.length > 0 ? 'done' : 'open', action: '/providers/add', link: '/providers' },
    { id: 2, title: 'Gerät', description: 'Lautsprecher einrichten', status: devices.length > 0 ? 'done' : 'open', action: '/devices/add', link: '/devices' },
    { id: 3, title: 'Playlist', description: 'Musik importieren', status: playlists.length > 0 ? 'done' : 'open', action: '/playlists/import', link: '/playlists' },
    { id: 4, title: 'Kalender', description: 'Zeitblöcke planen', status: blocks.length > 0 ? 'done' : 'open', action: '/calendar', link: '/calendar' },
    { id: 5, title: 'Testen', description: 'System prüfen', status: connectedProviders.length > 0 && onlineDevices.length > 0 ? 'done' : 'open', action: '/admin/system-check', link: '/admin/system-check' },
  ];

  const statCards = [
    { icon: Zap,       label: 'Provider',  value: `${connectedProviders.length}/${providers.length}`,    sub: 'verbunden',    color: 'violet', link: '/providers' },
    { icon: Cpu,       label: 'Geräte',    value: `${onlineDevices.length}/${devices.length}`,            sub: 'online',       color: 'cyan',   link: '/devices' },
    { icon: Music2,    label: 'Playlists', value: playlists.length,                                       sub: 'importiert',   color: 'green',  link: '/playlists' },
    { icon: Radio,     label: 'Zonen',     value: zones.length,                                           sub: 'konfiguriert', color: 'rose',   link: '/devices' },
    { icon: CalendarDays, label: 'Blöcke', value: activeBlocks.length,                                   sub: 'aktiv geplant',color: 'orange', link: '/calendar' },
  ];

  const systemHealth = [
    { label: 'Provider Auth',     ok: connectedProviders.length > 0,   okText: `${connectedProviders.length} verbunden`, failText: 'Setup erforderlich' },
    { label: 'Geräte erkannt',    ok: devices.length > 0,              okText: `${devices.length} Geräte`, failText: 'Kein Gerät gefunden' },
    { label: 'Playlists geladen', ok: playlists.length > 0,            okText: `${playlists.length} Playlists`, failText: 'Keine importiert' },
    { label: 'Kalenderblöcke',   ok: activeBlocks.length > 0,         okText: `${activeBlocks.length} aktiv`, failText: 'Keine Blöcke' },
  ];

  const quickActions = [
    { label: 'Provider verbinden', icon: Zap,          link: '/providers/add',        color: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-300' },
    { label: 'Gerät hinzufügen',   icon: Cpu,          link: '/devices/add',          color: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20 text-cyan-300' },
    { label: 'Playlist importieren',icon: Download,    link: '/playlists/import',     color: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-300' },
    { label: 'Block erstellen',    icon: CalendarDays, link: '/calendar',             color: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20 text-orange-300' },
    { label: 'System Check',       icon: TestTube,     link: '/admin/system-check',   color: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-foreground leading-tight">
            Studio<span className="gradient-text">Sound</span>Set
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{format(new Date(), "EEEE, dd. MMMM yyyy · HH:mm 'Uhr'")}</p>
        </div>
        <Link to="/now-playing">
          <Button className="bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 h-10 px-5 gap-2">
            <PlayCircle className="w-4 h-4" /> Now Playing
          </Button>
        </Link>
      </motion.div>

      {/* Setup Flow */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bento-panel border-border/30 p-5"
      >
        <SetupFlow steps={setupSteps} />
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, idx) => {
          const colorMap = {
            violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', hover: 'hover:border-violet-500/35 hover:shadow-[0_0_25px_hsl(252,87%,67%,0.12)]' },
            cyan:   { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-400',   hover: 'hover:border-cyan-500/35 hover:shadow-[0_0_25px_hsl(187,96%,47%,0.12)]' },
            green:  { bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-400',  hover: 'hover:border-green-500/35 hover:shadow-[0_0_25px_hsl(142,71%,45%,0.12)]' },
            rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   hover: 'hover:border-rose-500/35 hover:shadow-[0_0_25px_hsl(328,85%,60%,0.12)]' },
            orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', hover: 'hover:border-orange-500/35 hover:shadow-[0_0_25px_hsl(25,95%,53%,0.12)]' },
          };
          const c = colorMap[card.color];
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
            >
              <Link to={card.link} className="block">
                <div className={`rounded-xl border ${c.border} ${c.hover} transition-all duration-200 p-4 bg-card/50`}>
                  <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${c.text}`} />
                  </div>
                  <p className={`text-3xl font-black ${c.text}`}>{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  <p className="text-xs font-semibold text-foreground/70 mt-0.5">{card.label}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Grid: System Health + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 bento-panel border-cyan-500/15 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">System Health</h3>
                <p className="text-xs text-muted-foreground">Echtzeit-Statusprüfung</p>
              </div>
            </div>
            <Link to="/admin/system-check">
              <Button size="sm" className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 h-8 gap-1.5 text-xs">
                <TestTube className="w-3.5 h-3.5" /> System Check
              </Button>
            </Link>
          </div>

          <div className="space-y-2.5">
            {systemHealth.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20">
                <div className="flex items-center gap-2.5">
                  {item.ok
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  }
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <span className={`text-sm font-semibold ${item.ok ? 'text-green-400' : 'text-yellow-400'}`}>
                  {item.ok ? item.okText : item.failText}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bento-panel border-border/20 p-5 space-y-3"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Quick Actions</h3>
              <p className="text-xs text-muted-foreground">Direkt loslegen</p>
            </div>
          </div>

          <div className="space-y-2">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <motion.div key={idx} whileTap={{ scale: 0.97 }}>
                  <Link to={action.link}>
                    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${action.color}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-semibold">{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-60" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}