import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const StatusIcon = ({ status }) => {
  if (status === 'ok') return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  if (status === 'error') return <XCircle className="w-5 h-5 text-red-400" />;
  if (status === 'warning') return <AlertCircle className="w-5 h-5 text-yellow-400" />;
  if (status === 'running') return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
  return <div className="w-5 h-5 rounded-full border-2 border-border" />;
};

function TestRow({ test, onAction }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/20 last:border-0">
      <StatusIcon status={test.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{test.testName}</p>
        {test.humanMessage && <p className="text-xs text-muted-foreground mt-0.5">{test.humanMessage}</p>}
        {test.technicalMessage && <p className="text-xs text-muted-foreground/60 font-mono mt-0.5 truncate">{test.technicalMessage}</p>}
        {test.suggestedFix && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <ChevronRight className="w-3 h-3 text-yellow-400 flex-shrink-0" />
            <p className="text-xs text-yellow-300">{test.suggestedFix}</p>
          </div>
        )}
      </div>
      {test.actionLink && (
        <Link to={test.actionLink}>
          <Button size="sm" variant="outline" className="h-7 text-xs">{test.actionLabel || 'Beheben'}</Button>
        </Link>
      )}
    </div>
  );
}

export default function SystemCheck() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({ queryKey: ['spotifyAccounts'], queryFn: () => base44.entities.SpotifyAccount.list() });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => base44.entities.Playlist.list() });

  const runCheck = async () => {
    setRunning(true);
    const checks = [];

    const addCheck = (testName, category, status, humanMessage, suggestedFix = '', technicalMessage = '', actionLink = '', actionLabel = '') => {
      checks.push({ testName, category, status, humanMessage, suggestedFix, technicalMessage, actionLink, actionLabel });
      setResults([...checks]);
    };

    // Global checks
    addCheck('Spotify Client ID', 'global', 'running', 'Prüfe...');
    // We can't directly check env vars from frontend, so check indirectly
    if (accounts.length === 0) {
      checks[checks.length - 1] = { testName: 'Spotify Accounts', category: 'global', status: 'warning', humanMessage: 'Noch keine Spotify Accounts angelegt.', suggestedFix: 'Lege einen Account pro Zone an.', actionLink: '/spotify-accounts', actionLabel: 'Accounts anlegen' };
    } else {
      checks[checks.length - 1] = { testName: 'Spotify Accounts', category: 'global', status: 'ok', humanMessage: `${accounts.length} Account(s) angelegt.` };
    }

    // Per Account
    for (const acc of accounts) {
      addCheck(`Account: ${acc.displayName}`, 'account', 'running', 'Token wird geprüft...');
      if (acc.authStatus !== 'connected') {
        checks[checks.length - 1] = {
          testName: `Account: ${acc.displayName}`,
          category: 'account', status: 'error',
          humanMessage: `Nicht verbunden (Status: ${acc.authStatus}).`,
          suggestedFix: 'Verbinde den Account mit Spotify OAuth.',
          actionLink: '/spotify-accounts', actionLabel: 'Verbinden'
        };
        continue;
      }
      if (acc.tokenStatus === 'expired') {
        checks[checks.length - 1] = {
          testName: `Account: ${acc.displayName}`,
          category: 'account', status: 'error',
          humanMessage: 'Token abgelaufen.',
          suggestedFix: 'Erneut verbinden um Token zu erneuern.',
          actionLink: '/spotify-accounts', actionLabel: 'Erneuern'
        };
        continue;
      }
      // Test API
      try {
        const res = await invoke('spotifyAccountControl', { action: 'getDevices', accountId: acc.id });
        const deviceCount = res.data?.devices?.length || 0;
        checks[checks.length - 1] = {
          testName: `Account: ${acc.displayName}`,
          category: 'account', status: deviceCount > 0 ? 'ok' : 'warning',
          humanMessage: deviceCount > 0
            ? `Token gültig. ${deviceCount} Gerät(e) gefunden.`
            : 'Token gültig, aber keine Geräte sichtbar. Öffne Spotify auf dem Zielgerät.',
          suggestedFix: deviceCount === 0 ? 'Starte Spotify auf dem Gerät.' : '',
        };
      } catch (e) {
        checks[checks.length - 1] = {
          testName: `Account: ${acc.displayName}`,
          category: 'account', status: 'error',
          humanMessage: 'API-Test fehlgeschlagen.',
          technicalMessage: e.message,
          suggestedFix: 'Token möglicherweise ungültig. Account erneut verbinden.',
          actionLink: '/spotify-accounts', actionLabel: 'Neu verbinden'
        };
      }
      setResults([...checks]);
    }

    // Zone checks
    for (const zone of zones) {
      const account = accounts.find(a => a.id === zone.spotifyAccountId);
      addCheck(`Zone: ${zone.name}`, 'zone', account ? (account.authStatus === 'connected' ? 'ok' : 'warning') : 'error',
        account
          ? (account.authStatus === 'connected' ? `Account "${account.displayName}" verbunden.` : `Account nicht verbunden.`)
          : 'Kein Spotify Account zugewiesen.',
        !account ? 'Weise dieser Zone einen Account zu.' : account.authStatus !== 'connected' ? 'Account verbinden.' : '',
        '', '/zones', 'Zonen konfigurieren'
      );
      setResults([...checks]);
    }

    // Playlist checks
    addCheck('Playlists & Tracks', 'global',
      playlists.length === 0 ? 'warning' : playlists.some(p => p.syncStatus === 'synced') ? 'ok' : 'warning',
      playlists.length === 0 ? 'Keine Playlists importiert.' : `${playlists.filter(p => p.syncStatus === 'synced').length} von ${playlists.length} Playlists vollständig importiert.`,
      playlists.length === 0 ? 'Importiere Playlists unter "Playlists".' : '',
      '', '/playlists', 'Playlists importieren'
    );
    setResults([...checks]);

    // Base44 automation note
    addCheck('Scheduler (Base44)', 'global', 'warning',
      'Base44 Automationen laufen minimal alle 5 Minuten. Für "continuous" Lautstärke-Rampen ist das unzuverlässig.',
      'Verwende "hourly", "every_30_min" oder "every_15_min" Rampen-Modus für zuverlässige Steuerung.',
    );
    setResults([...checks]);

    setRunning(false);
    toast.success('System Check abgeschlossen.');
  };

  const grouped = {
    global: results.filter(r => r.category === 'global'),
    account: results.filter(r => r.category === 'account'),
    zone: results.filter(r => r.category === 'zone'),
  };

  const okCount = results.filter(r => r.status === 'ok').length;
  const warnCount = results.filter(r => r.status === 'warning').length;
  const errCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            System Check
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Prüft Tokens, Geräte, Playlists und Scheduler-Status.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold" onClick={runCheck} disabled={running}>
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          {running ? 'Prüfe...' : 'System Check starten'}
        </Button>
      </div>

      {results.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bento-panel p-4 text-center border-green-500/20 bg-green-500/5">
              <p className="text-2xl font-black text-green-400">{okCount}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">OK</p>
            </div>
            <div className="bento-panel p-4 text-center border-yellow-500/20 bg-yellow-500/5">
              <p className="text-2xl font-black text-yellow-400">{warnCount}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Warnungen</p>
            </div>
            <div className="bento-panel p-4 text-center border-red-500/20 bg-red-500/5">
              <p className="text-2xl font-black text-red-400">{errCount}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Fehler</p>
            </div>
          </div>

          {/* Results */}
          {[['Global', grouped.global], ['Spotify Accounts', grouped.account], ['Zonen', grouped.zone]].map(([title, items]) =>
            items.length > 0 ? (
              <div key={title} className="bento-panel p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{title}</p>
                {items.map((t, i) => <TestRow key={i} test={t} />)}
              </div>
            ) : null
          )}
        </>
      )}

      {results.length === 0 && (
        <div className="bento-panel border-dashed border-border/30 p-16 text-center">
          <Activity className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Noch kein Check ausgeführt</h3>
          <p className="text-muted-foreground text-sm">Klicke "System Check starten" um alle Komponenten zu prüfen.</p>
        </div>
      )}

      {/* Base44 limitations note */}
      <div className="bento-panel border-border/20 p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-bold text-foreground/60">Technische Grenzen dieser Plattform</p>
        <p>• <strong>Kein persistentes WebSocket:</strong> Tablet-Heartbeat wird per Polling realisiert (alle 15s).</p>
        <p>• <strong>Scheduler minimum 5 Minuten:</strong> Lautstärke-Rampen unter 5 Minuten sind nicht automatisierbar.</p>
        <p>• <strong>Spotify Web Playback SDK auf iOS eingeschränkt:</strong> iPads werden über Spotify Connect / API gesteuert, nicht über SDK.</p>
        <p>• <strong>Empfehlung für zuverlässige Rampen:</strong> Verwende "every_15_min" Modus. Für feinere Steuerung wird ein externer Worker empfohlen.</p>
      </div>
    </div>
  );
}