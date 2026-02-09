import { motion } from 'framer-motion';
import {
  IconFile,
  IconMessage,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import type { Transfer, TextTransfer, FileTransfer } from '@easyshare/shared';
import { formatFileSize, formatTransferSpeed, formatDuration } from '@easyshare/shared';

interface TransferItemProps {
  transfer: Transfer;
  index: number;
  onClick?: () => void;
}

export function TransferItem({ transfer, index, onClick }: TransferItemProps) {
  const isText = transfer.type === 'text';
  const isSent = transfer.direction === 'send';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={onClick}
      className={`group p-4 rounded-xl bg-neutral-900/40 hover:bg-neutral-900/60
        border border-neutral-800/50 hover:border-neutral-700/50
        transition-colors duration-200 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`
          p-2.5 rounded-lg
          ${isText ? 'bg-blue-500/10' : 'bg-purple-500/10'}
        `}>
          {isText ? (
            <IconMessage size={18} className="text-blue-400" />
          ) : (
            <IconFile size={18} className="text-purple-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isSent ? (
              <IconArrowUp size={14} className="text-neutral-500" />
            ) : (
              <IconArrowDown size={14} className="text-neutral-500" />
            )}
            <span className="text-sm text-neutral-400">
              {isSent ? 'Sent to' : 'Received from'} {transfer.deviceName}
            </span>
          </div>

          {isText ? (
            <p className="text-white text-sm line-clamp-2">
              {(transfer as TextTransfer).content}
            </p>
          ) : (
            <>
              <p className="text-white text-sm">
                {(transfer as FileTransfer).fileName}
                <span className="text-neutral-500 ml-2">
                  {formatFileSize((transfer as FileTransfer).fileSize)}
                </span>
              </p>
              {(transfer as FileTransfer).speedBytesPerSec != null && (
                <p className="text-xs text-neutral-600 mt-0.5">
                  {formatTransferSpeed((transfer as FileTransfer).speedBytesPerSec!)}
                  {' · '}
                  {formatDuration((transfer as FileTransfer).durationMs!)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Time */}
        <div className="text-right">
          <p className="text-xs text-neutral-500">{formatDate(transfer.timestamp)}</p>
          <p className="text-xs text-neutral-600">{formatTime(transfer.timestamp)}</p>
        </div>
      </div>
    </motion.div>
  );
}
