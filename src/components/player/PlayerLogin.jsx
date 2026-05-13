import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlayerLogin({ onLoginSuccess }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const attemptLogin = async () => {
      try {
        // Check if already authenticated
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          onLoginSuccess();
          return;
        }

        // Try to login with stored credentials
        const email = localStorage.getItem('playerEmail');
        const password = localStorage.getItem('playerPassword');

        if (!email || !password) {
          setError('Keine Player-Credentials gefunden. Bitte QR-Code scannen.');
          setLoading(false);
          return;
        }

        // Attempt login via backend endpoint
        const response = await base44.functions.invoke('playerLogin', {
          email,
          password,
        });

        if (response.data?.success) {
          onLoginSuccess();
        } else {
          setError(response.data?.error || 'Login fehlgeschlagen');
          setLoading(false);
        }
      } catch (e) {
        setError('Login-Fehler: ' + e.message);
        setLoading(false);
      }
    };

    attemptLogin();
  }, [onLoginSuccess]);

  if (loading) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Melde mich an...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-red-400 font-bold">Authentifizierung fehlgeschlagen</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          onClick={() => window.location.href = '/player-pairing'}
          className="w-full bg-primary"
        >
          QR-Code scannen
        </Button>
      </div>
    </div>
  );
}