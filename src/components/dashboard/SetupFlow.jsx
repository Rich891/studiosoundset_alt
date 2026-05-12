import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, AlertCircle, ArrowRight, Zap, Cpu, Music2, CalendarDays, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stepIcons = [Zap, Cpu, Music2, CalendarDays, PlayCircle];

export default function SetupFlow({ steps }) {
  const completed = steps.filter(s => s.status === 'done').length;
  const progress = (completed / steps.length) * 100;

  return (
    <div className="space-y-4">
      {/* Header + Progress */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Einrichtungsplan</p>
          <p className="text-sm text-muted-foreground mt-0.5">{completed} von {steps.length} Schritten erledigt</p>
        </div>
        <span className="text-2xl font-black gradient-text">{Math.round(progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <motion.div
          className="h-full rounded-full volume-gradient"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {steps.map((step, idx) => {
          const Icon = stepIcons[idx];
          const isDone = step.status === 'done';
          const isError = step.status === 'error';
          const isCurrent = !isDone && !isError && steps.slice(0, idx).every(s => s.status === 'done');

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
            >
              <Link to={step.link} className="block h-full">
                <div className={`
                  relative h-full rounded-xl border p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer
                  ${isDone
                    ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50'
                    : isError
                    ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                    : isCurrent
                    ? 'border-primary/40 bg-primary/8 hover:border-primary/60'
                    : 'border-border/30 bg-card/30 hover:border-border/50'
                  }
                `}>
                  {/* Status indicator */}
                  <div className="flex items-start justify-between">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isDone ? 'bg-green-500/15' : isError ? 'bg-red-500/15' : isCurrent ? 'bg-primary/15' : 'bg-muted/30'}
                    `}>
                      <Icon className={`w-5 h-5 ${isDone ? 'text-green-400' : isError ? 'text-red-400' : isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : isError
                      ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      : isCurrent
                      ? <div className="w-2 h-2 rounded-full bg-primary animate-pulse mt-1" />
                      : <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                    }
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground leading-tight">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{step.description}</p>
                  </div>

                  {/* CTA */}
                  <div className={`
                    flex items-center gap-1 text-xs font-semibold
                    ${isDone ? 'text-green-400' : isError ? 'text-red-400' : isCurrent ? 'text-primary' : 'text-muted-foreground'}
                  `}>
                    {isDone ? 'Fertig' : isError ? 'Fehler beheben' : isCurrent ? 'Jetzt einrichten' : 'Ausstehend'}
                    {!isDone && <ArrowRight className="w-3 h-3" />}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}