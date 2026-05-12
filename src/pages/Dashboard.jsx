import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Music2, MapPin, Radio, Calendar, Settings, CheckCircle2,
  XCircle, AlertCircle, Clock, ChevronRight, Zap, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SETUP_STEPS = [
  { id: 1, title: 'Spotify Accounts verbinden', desc: 'Verbinde einen Spotify Premium Account pro Zone.', link: '/spotify-accounts', icon: Music2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  { id: 2, title: 'Zonen konfigurieren', desc: 'Tennishalle, Gym und Eriks Handy anlegen.', link: '/zones', icon: MapPin, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  { id: 3, title: 'Geräte laden & testen', desc: 'Pro Zone das Spotify-Gerät auswählen und testen.', link: '/zones', icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { id: 4, title: 'Playlists importieren', desc: 'Playlists und Tracks pro Account importieren.', link: '/playlists', icon: Music2, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  { id: 5, title: 'Wiedergabe testen', desc: 'Now Playing öffnen und Playback pro Zone testen.', link: '/now-playing', icon: Radio, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  { id: 6, title: 'Zeitplan erstellen', desc: 'Kalenderblöcke für automatische Steuerung anlegen.', link: '/calendar', icon: Calendar, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
];

function SetupStep({ step, status, index }) {
  const Icon = step.icon;
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link to={step.link}>
        <div className={`bento-panel border p-5 flex items-center gap-4 cursor-pointer group transition-all hover:scale-[1.01] ${isDone ? 'border-green-500/30 bg-green-500/5' : isError ? 'border-red-500/20 bg-red-500/5' : `border-border`}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${isDone ? 'bg-green-500/15 border-green-500/30' : step.bg}`}>
            {isDone ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : isError ? <XCircle className="w-6 h-6 text-red-400" /> : <Icon className={`w-6 h-6 ${step.color}`} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold">{step.title}</p>
            <p className="text-sm text-muted-foreground">{step.desc}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: accounts = [] } = useQuery({ queryKey: ['spotifyAccounts'], queryFn: () => base44.entities.SpotifyAccount.list() });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });

  const connectedAccounts = accounts.filter(a => a.authStatus === 'connected');
  const readyZones = zones.filter(z => z.currentStatus === 'ready');
  const syncedPlaylists = playlists.filter(p => p.syncStatus === 'synced');

  const getStepStatus = (stepId) => {
    if (stepId === 1) return connectedAccounts.length > 0 ? 'done' : 'open';
    if (stepId === 2) return zones.length >= 3 ? 'done' : zones.length > 0 ? 'in_progress' : 'open';
    if (stepId === 3) return readyZones.length > 0 ? 'done' : zones.length > 0 ? 'open' : 'open';
    if (stepId === 4) return syncedPlaylists.length > 0 ? 'done' : playlists.length > 0 ? 'in_progress' : 'open';
    if (stepId === 5) return connectedAccounts.length > 0 && playlists.length > 0 ? 'open' : 'open';
    return 'open';
  };

  const totalDone = SETUP_STEPS.filter(s => getStepStatus(s.id) === 'done').length;
  const progressPct = Math.round((totalDone / SETUP_STEPS.length) * 100);

  const hasWarnings = accounts.some(a => a.authStatus === 'expired') || zones.some(z => z.currentStatus === 'error');

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-black gradient-text">StudioSoundSet</h1>
        <p className="text-sm text-muted-foreground mt-1">Multi-Zone Spotify Control Hub — privater Betrieb</p>
      </motion.div>

      {/* Warning Banner */}
      {hasWarnings && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-300">System-Warnungen vorhanden</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {accounts.filter(a => a.authStatus === 'expired').length > 0 && 'Spotify Token abgelaufen. '}
              {zones.filter(z => z.currentStatus === 'error').length > 0 && 'Zonen-Test fehlgeschlagen.'}
            </p>
          </div>
          <Link to="/spotify-accounts"><Button size="sm" variant="outline">Beheben</Button></Link>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Spotify Accounts', value: accounts.length, sub: `${connectedAccounts.length} verbunden`, color: 'text-green-400', icon: Music2, link: '/spotify-accounts' },
          { label: 'Zonen', value: zones.length, sub: `${readyZones.length} bereit`, color: 'text-primary', icon: MapPin, link: '/zones' },
          { label: 'Playlists', value: playlists.length, sub: `${syncedPlaylists.length} synchronisiert`, color: 'text-violet-400', icon: Music2, link: '/playlists' },
          { label: 'Setup', value: `${progressPct}%`, sub: `${totalDone}/${SETUP_STEPS.length} Schritte`, color: 'text-cyan-400', icon: Zap, link: null },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Link to={stat.link || '#'}>
              <div className="bento-panel p-5 space-y-3 cursor-pointer">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Setup Flow */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Setup Flow</h2>
          <div className="flex items-center gap-3">
            <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-sm font-bold text-primary">{progressPct}%</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SETUP_STEPS.map((step, i) => (
            <SetupStep key={step.id} step={step} status={getStepStatus(step.id)} index={i} />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bento-panel border-border/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-bold text-foreground/60">⚠ Hinweis zur Spotify-Nutzung</p>
        <p>StudioSoundSet wird ausschließlich für private Demo-/Test-/Privatnutzung verwendet. Spotify ist keine rechtssichere Lösung für öffentliche oder gewerbliche Beschallung. Für gewerbliche Musikbeschallung sind spezielle Lizenzen (z.B. GEMA, GVL) erforderlich.</p>
      </div>
    </div>
  );
}