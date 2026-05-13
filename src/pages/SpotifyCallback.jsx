import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SpotifyCallback() {
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');
  const [accountName, setAccountName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state'); // this is the accountId
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Spotify hat die Verbindung abgelehnt: ${error}`);
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setMessage('Ungültige Callback-Parameter.');
      return;
    }

    const exchange = async () => {
      try {
        // Get account name for display
        try {
          const accounts = await base44.entities.SpotifyAccount.list();
          const acc = accounts.find(a => a.id === state);
          if (acc) setAccountName(acc.displayName);
        } catch {}

        const redirectUri = 'https://fit-sound-flow.base44.app/spotify-callback';
        const res = await base44.functions.invoke('spotifyAccountControl', {
          action: 'exchange',
          code,
          redirectUri,
          accountId: state,
        });

        if (res.data?.success) {
          setStatus('success');
          setMessage('Spotify Account erfolgreich verbunden!');
          setTimeout(() => navigate('/spotify-accounts'), 2000);
        } else {
          setStatus('error');
          setMessage(res.data?.error || 'Token-Austausch fehlgeschlagen.');
        }
      } catch (e) {
        setStatus('error');
        setMessage(e.message);
      }
    };

    exchange();
  }, [navigate]);

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-10 max-w-md w-full text-center space-y-5">
        {status === 'loading' && (
          <>
            <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto" />
            <h2 className="text-xl font-bold">Spotify verbinden...</h2>
            <p className="text-muted-foreground text-sm">Token wird ausgetauscht.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold text-green-400">Verbindung erfolgreich!</h2>
            {accountName && <p className="text-muted-foreground text-sm">Account: <strong>{accountName}</strong></p>}
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">Weiterleitung...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-destructive">Verbindung fehlgeschlagen</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button className="w-full" onClick={() => navigate('/spotify-accounts')}>
              Zurück zu Spotify Accounts
            </Button>
          </>
        )}
      </div>
    </div>
  );
}