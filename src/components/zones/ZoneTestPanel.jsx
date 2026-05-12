import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const StepRow = ({ step }) => {
  const icons = { success: <CheckCircle2 className="w-4 h-4 text-green-400" />, error: <XCircle className="w-4 h-4 text-red-400" />, warning: <AlertCircle className="w-4 h-4 text-yellow-400" />, running: <RefreshCw className="w-4 h-4 text-primary animate-spin" /> };
  const icon = icons[step.status] || icons.running;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{step.name}</p>
        {step.human && <p className="text-xs text-muted-foreground mt-0.5">{step.human}</p>}
        {step.fix && <p className="text-xs text-yellow-400 mt-0.5">→ {step.fix}</p>}
      </div>
    </div>
  );
};

export default function ZoneTestPanel({ zone, account }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [overall, setOverall] = useState(null);

  const runTest = async () => {
    if (!account) {
      setResults([{ name: 'Voraussetzung', status: 'error', human: 'Kein Spotify Account zugewiesen.', fix: 'Weise dieser Zone einen Spotify Account zu.' }]);
      return;
    }
    if (account.authStatus !== 'connected') {
      setResults([{ name: 'Voraussetzung', status: 'error', human: `Account "${account.displayName}" ist nicht verbunden.`, fix: 'Verbinde den Spotify Account unter "Spotify Accounts".' }]);
      return;
    }

    setRunning(true);
    setResults([{ name: 'Tests laufen...', status: 'running', human: '' }]);

    try {
      // Get current target device
      const devices = await base44.entities.SpotifyDevice.filter({ spotifyAccountId: account.id, isSelectedTarget: true });
      const targetDevice = devices[0];

      const res = await invoke('spotifyAccountControl', {
        action: 'testDevice',
        accountId: account.id,
        deviceId: targetDevice?.providerDeviceId,
        zoneId: zone.id,
      });

      setResults(res.data?.results || []);
      setOverall(res.data?.success ? 'success' : 'error');
    } catch (e) {
      setResults([{ name: 'Test fehlgeschlagen', status: 'error', human: e.message, fix: 'Prüfe die Backend-Verbindung.' }]);
      setOverall('error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">Gerätetest: {zone.name}</p>
          {account && <p className="text-xs text-muted-foreground">Account: {account.displayName}</p>}
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2 h-10 px-5 font-semibold"
          onClick={runTest}
          disabled={running}
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {running ? 'Teste...' : 'Alle Tests ausführen'}
        </Button>
      </div>

      {results && (
        <div className="bg-muted/20 rounded-xl p-4">
          {results.map((step, i) => <StepRow key={i} step={step} />)}
          {overall && (
            <div className={`mt-3 pt-3 border-t border-border/30 flex items-center gap-2 font-semibold text-sm ${overall === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {overall === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {overall === 'success' ? 'Alle kritischen Tests bestanden.' : 'Tests fehlgeschlagen. Siehe Hinweise oben.'}
            </div>
          )}
        </div>
      )}

      {!results && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Klicke "Alle Tests ausführen" um Token, Geräte, Transfer und Lautstärke zu prüfen.
        </div>
      )}
    </div>
  );
}