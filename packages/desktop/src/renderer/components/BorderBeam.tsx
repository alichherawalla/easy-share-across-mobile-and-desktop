import { motion } from 'framer-motion';

interface BorderBeamProps {
  duration?: number;
  size?: number;
}

export function BorderBeam({ duration = 4, size = 200 }: BorderBeamProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
      <motion.div
        className="absolute"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
          offsetPath: `path('M 0 0 L ${window.innerWidth} 0 L ${window.innerWidth} ${window.innerHeight} L 0 ${window.innerHeight} Z')`,
        }}
        animate={{
          offsetDistance: ['0%', '100%'],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {/* Simpler border glow effect */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          animation: `border-beam ${duration}s linear infinite`,
        }}
      />
    </div>
  );
}
