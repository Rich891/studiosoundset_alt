import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Download, Music2, ChevronLeft, Search, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';

function extractSpotifyPlaylistId(input) {
  // Handle full URL: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
  const urlMatch = input.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  // Handle bare ID
  if (/^[a-zA-Z0-9]{22}$/.test(input.trim())) return input.trim();
  return null;
}

export default function ImportPlaylist() {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [energyLevel, setEnergyLevel] = useState('medium');
  const [mood, setMood] = useState('');
  const [fetchedPlaylist, setFetchedPlaylist] = useState(null);
  const [fetching, setFetching] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const spotifyProviders = providers.filter(p => p.type === 'spotify_demo' && p.accessTokenStored);

  const handleFetchInfo = async () => {
    const playlistId = extractSpotifyPlaylistId(playlistUrl);
    if (!playlistId) {
      toast.error('Ungültige Spotify Playlist-URL oder ID');
      return;
    }
    if (!selectedProvider) {
      toast.error('Bitte erst einen Provider auswählen');
      return;
    }
    setFetching(true);
    setFetchedPlaylist(null);
    try {
      const res = await base44.functions.invoke('spotifyControl', {
        action: 'getPlaylistInfo',
        providerId: selectedProvider,
        playlistId,
      });
      if (res.data?.success && res.data?.playlist) {
        setFetchedPlaylist(res.data.playlist);
        toast.success('Playlist gefunden!');
      } else {
        toast.error('Playlist nicht gefunden. Ist die URL korrekt und der Provider verbunden?');
      }
    } catch (e) {
      toast.error('Fehler beim Laden: ' + e.message);
    } finally {
      setFetching(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const playlistId = extractSpotifyPlaylistId(playlistUrl);
      const name = fetchedPlaylist?.name || 'Importierte Playlist';
      const coverUrl = fetchedPlaylist?.images?.[0]?.url || '';
      const totalTracks = fetchedPlaylist?.tracks?.total || 0;
      const providerPlaylistUri = fetchedPlaylist?.uri || `spotify:playlist:${playlistId}`;
      const externalUrl = fetchedPlaylist?.external_urls?.spotify || '';
      const ownerName = fetchedPlaylist?.owner?.display_name || '';
      const description = fetchedPlaylist?.description || '';

      return base44.entities.Playlist.create({
        providerId: selectedProvider,
        name,
        providerPlaylistId: playlistId,
        providerPlaylistUri,
        coverUrl,
        externalUrl,
        ownerName,
        description,
        energyLevel,
        mood,
        licenseStatus: 'demo',
        totalTracks,
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
        <PageHeader title="Playlist importieren" subtitle="Spotify-Playlist in die App laden" />
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 space-y-5">
          {/* Provider */}
          <div>
            <Label>Spotify Provider *</Label>
            {spotifyProviders.length === 0 ? (
              <p className="text-sm text-destructive mt-1.5">Kein verbundener Spotify-Provider gefunden. Bitte zuerst verbinden.</p>
            ) : (
              <Select value={selectedProvider} onValueChange={(v) => { setSelectedProvider(v); setFetchedPlaylist(null); }}>
                <SelectTrigger className="mt-1.5 bg-muted/50">
                  <SelectValue placeholder="Provider auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {spotifyProviders.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* URL Input + Fetch */}
          <div>
            <Label>Spotify Playlist-URL oder ID *</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                value={playlistUrl}
                onChange={e => { setPlaylistUrl(e.target.value); setFetchedPlaylist(null); }}
                className="bg-muted/50 flex-1"
                placeholder="https://open.spotify.com/playlist/..."
              />
              <Button
                variant="outline"
                onClick={handleFetchInfo}
                disabled={!playlistUrl || !selectedProvider || fetching}
              >
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Füge die vollständige Spotify-URL oder die Playlist-ID ein, dann auf Suche klicken.</p>
          </div>

          {/* Fetched Playlist Preview */}
          {fetchedPlaylist && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              {fetchedPlaylist.images?.[0]?.url && (
                <img src={fetchedPlaylist.images[0].url} alt={fetchedPlaylist.name} className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{fetchedPlaylist.name}</p>
                <p className="text-xs text-muted-foreground">{fetchedPlaylist.tracks?.total} Songs · {fetchedPlaylist.owner?.display_name}</p>
                {fetchedPlaylist.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{fetchedPlaylist.description}</p>
                )}
              </div>
              <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
            </div>
          )}

          {/* Metadata */}
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
            disabled={!selectedProvider || !playlistUrl || !fetchedPlaylist || importMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {importMutation.isPending ? 'Importieren...' : 'Playlist importieren'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}