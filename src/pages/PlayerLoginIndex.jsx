import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';

export default function PlayerLoginIndex() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      // Ist es ein Player mit Session-Token?
      const playerSessionToken = localStorage.getItem('playerSessionToken');
      if (playerSessionToken) {
        window.location.href = '/player-new';
        return;
      }

      // Ist es ein Admin der eingeloggt ist?
      try {
        const isAuthenticated = await (window.base44?.auth?.isAuthenticated?.() || Promise.resolve(false));
        if (isAuthenticated) {
          window.location.href = '/dashboard';
          return;
        }
      } catch (e) {
        console.warn('Auth check failed:', e);
      }

      // Sonst: Player-Login Formular
      window.location.href = '/player-new';
    };

    check();
  }, []);

  return (
    <div className="min-h-screen aurora-bg flex items-center justify-center">
      <div className="text-center">
        <Music2 className="w-12 h-12 text-primary mx-auto mb-3" />
        <p className="text-muted-foreground">Lade...</p>
      </div>
    </div>
  );
}