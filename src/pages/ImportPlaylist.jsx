import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Download, Music2, Check, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';

export default function ImportPlaylist() {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [energyLevel, setEnergyLevel] = useState('medium');
  const [mood, setMood] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      // Extract playlist name from URL or use generic
      const name = playlistUrl.includes('spotify') ? 'Spotify Playlist' :
                   playlistUrl.includes('apple') ? 'Apple Music Playlist' : 'Importierte Playlist';
      return base44.entities.Playlist.create({
        providerId: selectedProvider,
        name,
        providerPlaylistUri: playlistUrl,
        energyLevel,
        mood,
        licenseStatus: 'unknown',
        totalTracks: 0,
        lastImportedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      toast.success('Playlist wurde importiert!');
      navigate('/playlists');
    },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/playlists')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <PageHeader title="Playlist importieren" subtitle="Füge eine Playlist aus deinem Musikprovider hinzu" />
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 space-y-5">
          <div>
            <Label>Provider *</Label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="mt-1.5 bg-muted/50">
                <SelectValue placeholder="Provider auswählen" />
              </SelectTrigger>
              <SelectContent>
                {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Playlist-URL oder ID *</Label>
            <Input
              value={playlistUrl}
              onChange={e => setPlaylistUrl(e.target.value)}
              className="mt-1.5 bg-muted/50"
              placeholder="https://open.spotify.com/playlist/..."
            />
            <p className="text-xs text-muted-foreground mt-1">Füge die URL oder ID der Playlist ein.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Energie-Level</Label>
              <Select value={energyLevel} onValueChange={setEnergyLevel}>
                <SelectTrigger className="mt-1.5 bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="very_high">Sehr hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stimmung (optional)</Label>
              <Input value={mood} onChange={e => setMood(e.target.value)} className="mt-1.5 bg-muted/50" placeholder="z.B. Motivierend" />
            </div>
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={() => importMutation.mutate()}
            disabled={!selectedProvider || !playlistUrl || importMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {importMutation.isPending ? 'Importieren...' : 'Playlist importieren'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}