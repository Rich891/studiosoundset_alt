import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PlayerUsers() {
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['playerDevices'],
    queryFn: () => base44.entities.PlayerDevice.list('-pairedAt'),
    refetchInterval: 5000, // Auto-refresh every 5s
  });

  const { data: spotifyAccounts = [] } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list(),
  });

  const pairedDevices = devices.filter(d => d.isPaired);

  const getAccountName = (accountId) => {
    const acc = spotifyAccounts.find(a => a.id === accountId);
    return acc?.displayName || 'Unbekannt';
  };

  const getLastSeenText = (lastSeen) => {
    if (!lastSeen) return 'Noch nicht aktiv';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours}h`;
    const days = Math.floor(hours / 24);
    return `vor ${days}d`;
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
        <span className="text-muted-foreground">Lade Player-Users...</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          Player-Users
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-14">
          Automatisch erstellte Accounts für gekoppelte Player-Geräte.
        </p>
      </div>

      {pairedDevices.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Player-Geräte</h3>
          <p className="text-muted-foreground text-sm">
            Noch keine Geräte gekoppelt. Gehe zu <a href="/add-player-device" className="text-primary underline">Neues Gerät</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {pairedDevices.map((dev, i) => {
              const isOnline = dev.lastSeen && Date.now() - new Date(dev.lastSeen).getTime() < 300000; // Online if active in last 5 min

              return (
                <motion.div key={dev.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className={`bento-panel border overflow-hidden transition-all ${isOnline ? 'border-green-500/20 bg-green-500/5' : 'border-muted/30'}`}>
                    <div className="p-5 flex items-center gap-4 flex-wrap">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-green-500/20' : 'bg-muted/20'}`}>
                        {isOnline ? (
                          <Wifi className="w-5 h-5 text-green-400" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="font-bold text-lg">{dev.name}</p>
                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                          <span className={`text-xs font-semibold ${isOnline ? 'text-green-400' : 'text-muted-foreground'}`}>
                            {isOnline ? '● Online' : '● Offline'}
                          </span>
                          <span className="text-xs text-muted-foreground">{getLastSeenText(dev.lastSeen)}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/30 rounded-full">
                            {getAccountName(dev.spotifyAccountId)}
                          </span>
                        </div>

                        <div className="mt-2 p-2 bg-muted/20 rounded-lg">
                          <p className="text-[10px] text-muted-foreground font-semibold">Player Email</p>
                          <p className="font-mono text-xs text-primary mt-0.5 break-all">{dev.userId || 'N/A'}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold mt-1">Device ID</p>
                          <p className="font-mono text-xs text-cyan-400 break-all">{dev.deviceId}</p>
                        </div>

                        {dev.pairedAt && (
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Gekoppelt: {new Date(dev.pairedAt).toLocaleDateString('de', {
                              year: '2-digit',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs"
                          onClick={() => navigator.clipboard.writeText(dev.userId)}
                        >
                          Email kopieren
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}