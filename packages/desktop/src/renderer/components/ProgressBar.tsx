import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  label?: string;
  info?: string;
}

export function ProgressBar({ progress, label, info }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">{label}</span>
          <span className="text-white font-light">{progress}%</span>
        </div>
      )}
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-white rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      {info && (
        <p className="text-xs text-neutral-500">{info}</p>
      )}
    </div>
  );
}
