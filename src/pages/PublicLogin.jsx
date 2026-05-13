import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Music2, User, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';

export default function PublicLogin() {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async () => {
    setLoading(true);
    await base44.auth.redirectToLogin();
  };

  const handlePlayerLogin = () => {
    window.location.href = '/player-new';
  };

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
          <Music2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-black gradient-text mb-2">StudioSoundSet</h1>
        <p className="text-muted-foreground">Professionelle Musikwiedergabe für Studios</p>
      </div>

      {/* Selection */}
      <div className="w-full max-w-lg space-y-4">
        <p className="text-center text-sm text-muted-foreground font-semibold mb-6">
          Wer bist du?
        </p>

        {/* Admin/User Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAdminLogin}
          disabled={loading}
          className={`w-full bento-panel p-8 text-center space-y-3 transition-all border-2 ${
            selected === 'admin'
              ? 'border-primary bg-primary/5'
              : 'border-transparent hover:border-primary/50'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Admin / User</h2>
            <p className="text-xs text-muted-foreground">
              Verwalte Accounts, Zonen und Playlists
            </p>
          </div>
          <Button className="w-full mt-4">
            {loading ? 'Wird weitergeleitet...' : 'Anmelden'}
          </Button>
        </motion.button>

        {/* Player Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePlayerLogin}
          className={`w-full bento-panel p-8 text-center space-y-3 transition-all border-2 ${
            selected === 'player'
              ? 'border-primary bg-primary/5'
              : 'border-transparent hover:border-primary/50'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Hardware Player</h2>
            <p className="text-xs text-muted-foreground">
              Musik auf Geräten abspielen
            </p>
          </div>
          <Button className="w-full mt-4">
            Player starten
          </Button>
        </motion.button>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground text-center">
        © 2026 StudioSoundSet. Nur für privaten Gebrauch.
      </p>
    </div>
  );
}