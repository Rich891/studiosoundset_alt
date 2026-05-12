import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Radio, Music2, Plus, Volume2, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import NowPlayingCard from '@/components/dashboard/NowPlayingCard';
import SpotifyPlayer from '@/components/nowplaying/SpotifyPlayer';

export default function NowPlaying() {
  const { data: zones = [] }     = useQuery({ queryKey: ['zones'],     queryFn: () => base44.entities.Zone.filter({ isActive: true }) });
  const { data: devices = [] }   = useQuery({ queryKey: ['devices'],   queryFn: () => base44.entities.Device.filter({ isDeleted: false }) });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });

  const spotifyProviders = providers.filter(p => p.type === 'spotify_demo' && p.accessTokenStored);
  const activeDevices = devices.filter(d => d.status === 'online');

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-rose-400" />
            </div>
            Now Playing
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Aktuelle Wiedergabe und Steuerung</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-green-400 pulse-green" />
          <Wifi className="w-3.5 h-3.5 text-green-400" />
          <span className="text-sm font-semibold text-green-400">{activeDevices.length} Geräte aktiv</span>
        </div>
      </motion.div>

      {/* Spotify Players */}
      {spotifyProviders.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Spotify Steuerung</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {spotifyProviders.map(provider => (
              <SpotifyPlayer key={provider.id} provider={provider} />
            ))}
          </div>
        </div>
      )}

      {/* Zone Cards */}
      {zones.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bento-panel border-dashed border-primary/20 p-16 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-5">
            <Music2 className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold mb-2">Keine Zonen angelegt</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
            Lege Zonen an und weise ihnen Geräte zu, um die Wiedergabe zu sehen.
          </p>
          <Link to="/devices/add">
            <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold">
              <Plus className="w-4 h-4" /> Gerät & Zone hinzufügen
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Studio Zonen</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {zones.map((zone, idx) => {
              const device = devices.find(d => d.id === zone.assignedDeviceId);
              return (
                <motion.div
                  key={zone.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <NowPlayingCard zone={zone} device={device} providers={providers} />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}