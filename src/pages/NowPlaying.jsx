import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radio, Music2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NowPlayingCard from '@/components/dashboard/NowPlayingCard';
import SpotifyPlayer from '@/components/nowplaying/SpotifyPlayer';
import PageHeader from '@/components/ui/PageHeader';

export default function NowPlaying() {
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.filter({ isActive: true }),
  });
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.filter({ isDeleted: false }),
  });
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const spotifyProviders = providers.filter(p => p.type === 'spotify_demo' && p.accessTokenStored);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Now Playing"
        subtitle="Aktuelle Wiedergabe und Spotify-Steuerung"
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full">
            <Radio className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">{zones.length} Zonen aktiv</span>
          </div>
        }
      />

      {/* Spotify Live Controls */}
      {spotifyProviders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {spotifyProviders.map(provider => (
            <SpotifyPlayer key={provider.id} provider={provider} />
          ))}
        </div>
      )}

      {/* Zone Cards */}
      {zones.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Studiozonen angelegt</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Lege zuerst Zonen an und weise ihnen Geräte zu, um die Wiedergabe zu sehen.
            </p>
            <Link to="/devices/add">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Gerät & Zone hinzufügen
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {zones.map(zone => {
            const device = devices.find(d => d.id === zone.assignedDeviceId);
            return <NowPlayingCard key={zone.id} zone={zone} device={device} />;
          })}
        </div>
      )}
    </div>
  );
}