import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { COMMAND_STATUS, isPlayerOnline } from '@/lib/studioSoundSetRuntime';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const StatusIcon = ({ status }) => {
  if (status === 'ok') return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  if (status === 'error') return <XCircle className="w-5 h-5 text-red-400" />;
  if (status === 'warning') return <AlertCircle className="w-5 h-5 text-yellow-400" />;
  if (status === 'running') return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
  return <div className="w-5 h-5 rounded-full border-2 border-border" />;
};

function getProviderStatus(provider) {
  return provider?.status || provider?.authStatus || 'disconnected';
}

function getProviderName(provider) {
  return provider?.name || provider?.displayName || provider?.spotifyUserEmail || 'Spotify Provider';
}

function TestRow({ test }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/20 last:border-0">
      <StatusIcon status={test.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{test.testName}</p>
        {test.humanMessage && <p className="text-xs text-muted-foreground mt-0.5">{test.humanMessage}</p>}
        {test.technicalMessage && <p className="text-xs text-muted-foreground/60 font-mono mt-0.5 break-words">{test.technicalMessage}</p>}
        {test.suggestedFix && <div className="flex items-center gap-1.5 mt-1.5"><ChevronRight className="w-3 h-3 text-yellow-400 flex-shrink-0" /><p className="text-xs text-yellow-300">{test.suggestedFix}</p></div>}
      </div>
      {test.actionLink && <Link to={test.actionLink}><Button size="sm" variant="outline" className="h-7 text-xs">{test.actionLabel || 'Beheben'}</Button></Link>}
    </div>
  );
}

export default function SystemCheck() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);

  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list('-lastSeen') });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });
  const { data: commands = [] } = useQuery({ queryKey: ['playerCommands'], queryFn: () => base44.entities.PlayerCommand.list('-createdAt') });

  const runCheck = async () => {
    setRunning(true);
    const checks = [];
    const add = (testName, category, status, humanMessage, suggestedFix = '', technicalMessage = '', actionLink = '', actionLabel = '') => {
      checks.push({ testName, category, status, humanMessage, suggestedFix, technicalMessage, actionLink, actionLabel });
      setResults([...checks]);
    };

    const origin = window.location.origin;
    const redirectUri = `${origin}/spotify-callback`;
    add('Public HTTPS origin', 'remote', origin.startsWith('https://') || origin.includes('localhost') || origin.includes('127.0.0.1') ? 'ok' : 'error', origin, 'Use the Base44 public HTTPS domain for remote iPhone/iPad testing.', '', '/settings/network', 'Network');
    add('Spotify Redirect URI', 'remote', redirectUri.startsWith('https://') || redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1') ? 'ok' : 'error', redirectUri, 'Add this exact URI in Spotify Developer Dashboard.', '', '/settings/network', 'Copy URI');

    add('Spotify Provider entities', 'global', providers.length ? 'ok' : 'warning', providers.length ? `${providers.length} Provider configured.` : 'No Spotify Provider configured.', 'Create a Provider and connect Spotify.', '', '/spotify-accounts', 'Provider');

    for (const provider of providers) {
      const status = getProviderStatus(provider);
      if (status !== 'connected') {
        add(`Provider: ${getProviderName(provider)}`, 'account', 'error', `Not connected (status: ${status}).`, 'Connect or reconnect Spotify OAuth.', provider.lastError || '', '/spotify-accounts', 'Reconnect');
        continue;
      }
      add(`Provider: ${getProviderName(provider)}`, 'account', 'running', 'Testing Spotify API...');
      try {
        const res = await invoke('spotifyAccountControl', { action: 'getDevices', accountId: provider.id });
        const count = res.data?.devices?.length || 0;
        checks[checks.length - 1] = { testName: `Provider: ${getProviderName(provider)}`, category: 'account', status: 'ok', humanMessage: `Spotify API reachable. ${count} visible device(s).`, suggestedFix: count ? '' : 'Open the Player page to create the StudioSoundSet SDK device.' };
      } catch (e) {
        checks[checks.length - 1] = { testName: `Provider: ${getProviderName(provider)}`, category: 'account', status: 'error', humanMessage: 'Spotify API test failed.', technicalMessage: e.message, suggestedFix: 'Reconnect Spotify Provider.', actionLink: '/spotify-accounts', actionLabel: 'Reconnect' };
      }
      setResults([...checks]);
    }

    add('Zones', 'global', zones.length ? 'ok' : 'warning', zones.length ? `${zones.length} zone(s) configured.` : 'No zones configured.', 'Create at least one Zone.', '', '/zones', 'Zones');

    for (const player of players) {
      const online = isPlayerOnline(player);
      add(`Player: ${player.name}`, 'player', online ? 'ok' : 'warning', online ? 'Heartbeat online.' : 'No recent heartbeat.', 'Open the Player page on the Player device.', `sdkReady=${!!player.sdkReady}, spotifyDeviceId=${player.spotifyDeviceId || 'missing'}`, '/manage-players', 'Players');
    }
    if (!players.length) add('Players', 'player', 'warning', 'No Players configured.', 'Create a Player and open its QR login.', '', '/manage-players', 'Create Player');

    const missingTracks = playlists.filter(p => (p.totalTracks || 0) > 0 && (p.importedTracks || 0) < (p.totalTracks || 0));
    const failedTracks = playlists.filter(p => ['failed', 'error'].includes(p.trackSyncStatus || p.syncStatus));
    add('Playlist catalog', 'playlist', playlists.length ? (missingTracks.length || failedTracks.length ? 'warning' : 'ok') : 'warning', playlists.length ? `${playlists.length} playlist(s), ${missingTracks.length} missing tracks.` : 'No playlists imported.', missingTracks.length ? 'Open Playlists and Sync Again.' : 'Import playlists from a connected Provider.', '', '/playlists', 'Playlists');

    const stuckCommands = commands.filter(c => c.status === COMMAND_STATUS.PENDING || c.status === COMMAND_STATUS.PICKED_UP);
    const failedCommands = commands.filter(c => c.status === COMMAND_STATUS.FAILED || c.status === COMMAND_STATUS.TIMEOUT);
    add('PlayerCommand lifecycle', 'command', failedCommands.length ? 'warning' : 'ok', `${stuckCommands.length} pending/picked_up, ${failedCommands.length} failed/timeout.`, failedCommands.length ? 'Open Commands and inspect errors.' : 'No failed commands.', '', '/commands', 'Commands');

    add('Base44 runtime note', 'global', 'warning', 'Base44 does not expose the local Prisma/Next.js runtime. This port uses Base44 Entities and Functions.', 'Keep schemas for PlayerCommand, Player, Provider, Playlist and PlaylistTrack available in Base44.');

    setResults([...checks]);
    setRunning(false);
    toast.success('System Check abgeschlossen.');
  };

  const grouped = {
    remote: results.filter(r => r.category === 'remote'),
    global: results.filter(r => r.category === 'global'),
    account: results.filter(r => r.category === 'account'),
    player: results.filter(r => r.category === 'player'),
    playlist: results.filter(r => r.category === 'playlist'),
    command: results.filter(r => r.category === 'command'),
  };
  const okCount = results.filter(r => r.status === 'ok').length;
  const warnCount = results.filter(r => r.status === 'warning').length;
  const errCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Activity className="w-5 h-5 text-cyan-400" /></div>System Check</h1><p className="text-sm text-muted-foreground mt-1 ml-14">Diagnose player, Spotify, playlist and remote deployment issues.</p></div>
        <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold" onClick={runCheck} disabled={running}>{running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}{running ? 'Prüfe...' : 'Run All Tests'}</Button>
      </div>

      {results.length > 0 && <><div className="grid grid-cols-3 gap-4"><div className="bento-panel p-4 text-center border-green-500/20 bg-green-500/5"><p className="text-2xl font-black text-green-400">{okCount}</p><p className="text-xs text-muted-foreground font-semibold mt-1">OK</p></div><div className="bento-panel p-4 text-center border-yellow-500/20 bg-yellow-500/5"><p className="text-2xl font-black text-yellow-400">{warnCount}</p><p className="text-xs text-muted-foreground font-semibold mt-1">Warnings</p></div><div className="bento-panel p-4 text-center border-red-500/20 bg-red-500/5"><p className="text-2xl font-black text-red-400">{errCount}</p><p className="text-xs text-muted-foreground font-semibold mt-1">Errors</p></div></div>{[['Remote Deployment', grouped.remote], ['Global', grouped.global], ['Spotify Provider', grouped.account], ['Players', grouped.player], ['Playlists', grouped.playlist], ['Commands', grouped.command]].map(([title, items]) => items.length ? <div key={title} className="bento-panel p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{title}</p>{items.map((t, i) => <TestRow key={i} test={t} />)}</div> : null)}</>}

      {results.length === 0 && <div className="bento-panel border-dashed border-border/30 p-16 text-center"><Activity className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-xl font-bold mb-2">Noch kein Check ausgeführt</h3><p className="text-muted-foreground text-sm">Klicke "Run All Tests" um alle Komponenten zu prüfen.</p></div>}
    </div>
  );
}
