import { HelpCircle, Zap, Cpu, Music2, Calendar, Volume2, Shield, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';

const steps = [
  {
    icon: Zap,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    step: '1',
    title: 'Musikprovider verbinden',
    desc: 'Verbinde einen Musikprovider (z.B. Spotify Demo, Business Music oder Custom API). Die API-Zugangsdaten werden sicher in Base44 gespeichert.',
    link: '/providers/add',
    linkLabel: 'Provider hinzufügen',
  },
  {
    icon: Cpu,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    step: '2',
    title: 'Wiedergabegerät konfigurieren',
    desc: 'Füge ein Wiedergabegerät hinzu (Computer, Smartphone, Smart Speaker). Weise es einer Studiozone zu.',
    link: '/devices/add',
    linkLabel: 'Gerät hinzufügen',
  },
  {
    icon: Music2,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    step: '3',
    title: 'Playlists importieren',
    desc: 'Importiere Playlists aus deinem Musikprovider. Vergib Energie-Level und Stimmungen für eine smarte Automatisierung.',
    link: '/playlists',
    linkLabel: 'Playlists verwalten',
  },
  {
    icon: Calendar,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    step: '4',
    title: 'Zeitplan erstellen',
    desc: 'Definiere Zeitblöcke im Kalender: Welche Playlist soll wann in welcher Zone laufen? Mit optionaler Lautstärke-Rampe.',
    link: '/calendar',
    linkLabel: 'Kalender öffnen',
  },
  {
    icon: Volume2,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    step: '5',
    title: 'Automatisierung läuft',
    desc: 'Die App steuert automatisch Playlist und Lautstärke basierend auf deinen Zeitblöcken. Du siehst alles live im Dashboard.',
    link: '/',
    linkLabel: 'Zum Dashboard',
  },
];

const faqs = [
  {
    q: 'Ist Spotify für gewerbliche Studiobeschallung geeignet?',
    a: 'Nein. Spotify ist in dieser App nur für technische Tests und private Demo-Nutzung vorgesehen. Für öffentliche oder gewerbliche Nutzung benötigst du einen lizenzierten Business-Musikprovider (GEMA-konform).',
  },
  {
    q: 'Wie werden API-Zugangsdaten gesichert?',
    a: 'Alle Client-Secrets und Tokens werden ausschließlich serverseitig in Base44 Secrets gespeichert. Sie sind niemals im Browser oder in der Datenbank sichtbar.',
  },
  {
    q: 'Was passiert wenn kein Zeitblock aktiv ist?',
    a: 'Die Wiedergabe bleibt auf dem zuletzt gesetzten Zustand. Du kannst manuelle Overrides setzen, um außerhalb der Zeitpläne zu steuern.',
  },
  {
    q: 'Kann ich mehrere Zonen gleichzeitig steuern?',
    a: 'Ja. Jede Zone hat ihr eigenes Gerät und eigene Zeitblöcke. Sie werden unabhängig voneinander gesteuert.',
  },
];

export default function HowItWorks() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <PageHeader
        title="So funktioniert Studio Sound Control Pro"
        subtitle="Schritt-für-Schritt Anleitung zur Einrichtung deiner Studiobeschallung"
      />

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((s, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-5 flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Schritt {s.step}</span>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
              <Link to={s.link}>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  {s.linkLabel} <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" /> Häufige Fragen
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-4">
                <h4 className="font-medium text-sm text-foreground mb-1">{faq.q}</h4>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Legal Note */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4">
          <p className="text-sm text-yellow-400 font-medium mb-1">⚠️ Rechtlicher Hinweis</p>
          <p className="text-xs text-yellow-400/80">
            Für die öffentliche oder gewerbliche Beschallung (GEMA-pflichtig) musst du einen lizenzierten Musikprovider nutzen.
            Spotify, Apple Music und ähnliche Consumer-Dienste dürfen in Deutschland nicht für gewerbliche Zwecke genutzt werden.
            Diese App unterstützt Business-Music-Provider als rechtssichere Alternative.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}