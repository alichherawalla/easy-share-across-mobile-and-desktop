import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconLock, IconLoader2, IconCheck, IconPlugConnected, IconShieldCheck, IconKey } from '@tabler/icons-react';
import type { DiscoveredDevice, ConnectionState } from '@easyshare/shared';

interface PairingModalProps {
  isOpen: boolean;
  device: DiscoveredDevice | null;
  onClose: () => void;
  onPair: (passphrase: string) => void;
  connectionState: ConnectionState;
  isIncoming?: boolean;
}

type PairingStep = 'input' | 'connecting' | 'verifying' | 'establishing' | 'success' | 'error';

function getStepFromState(connectionState: ConnectionState, isSubmitting: boolean, isIncoming: boolean): PairingStep {
  if (connectionState.error) return 'error';
  if (connectionState.status === 'connected') return 'success';
  // For incoming requests, stay in input until user submits passphrase
  if (isIncoming && !isSubmitting) return 'input';
  if (connectionState.status === 'pairing') return 'verifying';
  if (connectionState.status === 'connecting') return 'connecting';
  if (isSubmitting) return isIncoming ? 'verifying' : 'connecting';
  return 'input';
}

const stepMessages: Record<PairingStep, { title: string; subtitle: string }> = {
  input: { title: 'Enter Passphrase', subtitle: 'Enter the same passphrase on both devices' },
  connecting: { title: 'Connecting...', subtitle: 'Establishing connection to device' },
  verifying: { title: 'Verifying...', subtitle: 'Checking passphrase match' },
  establishing: { title: 'Securing...', subtitle: 'Establishing encrypted connection' },
  success: { title: 'Connected!', subtitle: 'Devices paired successfully' },
  error: { title: 'Failed', subtitle: 'Could not complete pairing' },
};

// Get a more detailed status message
function getDetailedStatus(connectionState: ConnectionState): string | undefined {
  return connectionState.statusMessage;
}

export function PairingModal({
  isOpen,
  device,
  onClose,
  onPair,
  connectionState,
  isIncoming = false,
}: PairingModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const error = connectionState.error;

  const currentStep = getStepFromState(connectionState, isSubmitting, isIncoming);
  const stepInfo = stepMessages[currentStep];

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
                {/* Status Steps - shown when pairing is in progress */}
                {currentStep !== 'input' && (
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      {currentStep === 'error' ? (
                        <div className="p-2 rounded-full bg-red-500/20">
                          <IconX size={20} className="text-red-400" />
                        </div>
                      ) : currentStep === 'success' ? (
                        <div className="p-2 rounded-full bg-green-500/20">
                          <IconCheck size={20} className="text-green-400" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-blue-500/20">
                          <IconLoader2 size={20} className="text-blue-400 animate-spin" />
                        </div>
                      )}
                      <div>
                        <p className="text-white font-medium">{stepInfo.title}</p>
                        <p className="text-neutral-500 text-sm">{stepInfo.subtitle}</p>
                      </div>
                    </div>

                    {/* Verbose status message */}
                    {connectionState.statusMessage && (
                      <motion.div
                        key={connectionState.statusMessage}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50"
                      >
                        <p className="text-neutral-300 text-sm font-mono">
                          {connectionState.statusMessage}
                        </p>
                      </motion.div>
                    )}

                    {/* Progress Steps */}
                    <div className="space-y-2">
                      <StepIndicator
                        icon={IconPlugConnected}
                        label="Connect to device"
                        status={currentStep === 'connecting' ? 'active' :
                               ['verifying', 'establishing', 'success'].includes(currentStep) ? 'complete' :
                               currentStep === 'error' ? 'error' : 'pending'}
                      />
                      <StepIndicator
                        icon={IconKey}
                        label="Verify passphrase"
                        status={currentStep === 'verifying' ? 'active' :
                               ['establishing', 'success'].includes(currentStep) ? 'complete' :
                               currentStep === 'error' && connectionState.status === 'pairing' ? 'error' : 'pending'}
                      />
                      <StepIndicator
                        icon={IconShieldCheck}
                        label="Establish secure connection"
                        status={currentStep === 'establishing' ? 'active' :
                               currentStep === 'success' ? 'complete' : 'pending'}
                      />
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                      >
                        <p className="text-red-400 text-sm">{error}</p>
                      </motion.div>
                    )}

                    {currentStep === 'error' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSubmitting(false);
                        }}
                        className="mt-4 w-full py-2 px-4 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                )}

                {/* Input form - shown only in input state */}
                {currentStep === 'input' && (
                  <div className="space-y-4">
                    <p className="text-neutral-400 text-sm">
                      Enter the same passphrase on both devices to establish a secure connection.
                    </p>

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
                      Start Pairing
                    </button>
                  </div>
                )}
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Step indicator component
function StepIndicator({
  icon: Icon,
  label,
  status,
}: {
  icon: typeof IconCheck;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`
          w-6 h-6 rounded-full flex items-center justify-center transition-colors
          ${status === 'complete' ? 'bg-green-500/20' :
            status === 'active' ? 'bg-blue-500/20' :
            status === 'error' ? 'bg-red-500/20' :
            'bg-neutral-800'}
        `}
      >
        {status === 'complete' ? (
          <IconCheck size={14} className="text-green-400" />
        ) : status === 'active' ? (
          <IconLoader2 size={14} className="text-blue-400 animate-spin" />
        ) : status === 'error' ? (
          <IconX size={14} className="text-red-400" />
        ) : (
          <Icon size={14} className="text-neutral-600" />
        )}
      </div>
      <span
        className={`text-sm ${
          status === 'complete' ? 'text-green-400' :
          status === 'active' ? 'text-blue-400' :
          status === 'error' ? 'text-red-400' :
          'text-neutral-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
