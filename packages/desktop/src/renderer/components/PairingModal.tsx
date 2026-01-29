import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconLock, IconLoader2 } from '@tabler/icons-react';
import type { DiscoveredDevice, ConnectionState } from '@easyshare/shared';

interface PairingModalProps {
  isOpen: boolean;
  device: DiscoveredDevice | null;
  onClose: () => void;
  onPair: (passphrase: string) => void;
  connectionState: ConnectionState;
}

export function PairingModal({
  isOpen,
  device,
  onClose,
  onPair,
  connectionState,
}: PairingModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const error = connectionState.error;

  // Reset submitting state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setPassphrase('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.trim() && !isSubmitting) {
      setIsSubmitting(true);
      onPair(passphrase.trim());
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-neutral-800">
                    <IconLock size={20} className="text-neutral-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-white">Pair Device</h2>
                    {device && (
                      <p className="text-sm text-neutral-500">{device.name}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <IconX size={20} className="text-neutral-500" />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6">
                <p className="text-neutral-400 text-sm mb-4">
                  Enter the same passphrase on both devices to establish a secure connection.
                </p>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="passphrase"
                      className="block text-sm text-neutral-500 mb-2"
                    >
                      Passphrase
                    </label>
                    <input
                      id="passphrase"
                      type="text"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter a shared passphrase"
                      disabled={isSubmitting}
                      autoFocus
                      className={`
                        w-full px-4 py-3 rounded-lg
                        bg-neutral-800 border border-neutral-700
                        text-white placeholder-neutral-500
                        focus:outline-none focus:border-neutral-600
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-200
                      `}
                    />
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm"
                    >
                      {error}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={!passphrase.trim() || isSubmitting}
                    className={`
                      w-full py-3 px-4 rounded-lg font-medium
                      flex items-center justify-center gap-2
                      transition-all duration-200
                      ${passphrase.trim() && !isSubmitting
                        ? 'bg-white text-neutral-900 hover:bg-neutral-200'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {isSubmitting ? (
                      <>
                        <IconLoader2 size={18} className="animate-spin" />
                        Pairing...
                      </>
                    ) : (
                      'Pair'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
