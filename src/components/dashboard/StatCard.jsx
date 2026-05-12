import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function StatCard({ icon: Icon, label, value, sub, color, link, children }) {
  const colorMap = {
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', glow: 'hover:shadow-[0_0_30px_hsl(252,87%,67%,0.15)]' },
    cyan:   { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-400',   glow: 'hover:shadow-[0_0_30px_hsl(187,96%,47%,0.15)]' },
    green:  { bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-400',  glow: 'hover:shadow-[0_0_30px_hsl(142,71%,45%,0.15)]' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', glow: 'hover:shadow-[0_0_30px_hsl(25,95%,53%,0.15)]' },
    rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   glow: 'hover:shadow-[0_0_30px_hsl(328,85%,60%,0.15)]' },
    blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400',   glow: 'hover:shadow-[0_0_30px_hsl(221,83%,53%,0.15)]' },
  };
  const c = colorMap[color] || colorMap.violet;

  const inner = (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className={`bento-panel ${c.border} ${c.glow} h-full`}
    >
      <div className="p-5 h-full flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <p className="text-xs font-medium text-muted-foreground text-right leading-tight">{label}</p>
        </div>

        <div className="flex-1">
          <p className={`text-4xl font-black ${c.text} leading-none`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>

        {children}
      </div>
    </motion.div>
  );

  return link ? <Link to={link} className="block h-full">{inner}</Link> : inner;
}