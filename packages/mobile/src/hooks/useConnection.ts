import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';
import type {
  DeviceInfo,
  PairedDevice,
  ConnectionState,
  TransferProgress,
  Transfer,
  Message,
  TextMessage,
  FileRequestMessage,
  FileAcceptMessage,
  FileChunkMessage,
  FileCompleteMessage,
  FileAckMessage,
} from '@easyshare/shared';
import {
  MessageBuffer,
  serializeMessage,
  deserializeMessage,
  createPingMessage,
  createPongMessage,
  createTextMessage,
  createTextTransfer,
  createPairingState,
  createPairRequest,
  handlePairingMessage,
  createPairedDevice,
  decodeBase64,
  reassembleChunks,
  verifyFileIntegrity,
  createFileTransfer,
  calculateProgress,
  createFileAccept,
  createFileAck,
  createFileRequest,
  createFileRequestStreaming,
  createFileChunk,
  createFileChunkFromBase64,
  createFileComplete,
  createFileCompleteStreaming,
  chunkFile,
  IncrementalChecksum,
} from '@easyshare/shared';

type PairingSuccessCallback = (device: PairedDevice) => void;
type TransferCompleteCallback = (transfer: Transfer) => void;
type TextReceivedCallback = (text: string, device: DeviceInfo) => void;
type PairingRequestCallback = (device: DeviceInfo) => void;

export function useConnection() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
  });
  const [currentProgress, setCurrentProgress] = useState<TransferProgress | null>(null);
  const [serverPort, setServerPort] = useState<number>(0);

  const socketRef = useRef<TcpSocket.Socket | null>(null);
  const serverRef = useRef<TcpSocket.Server | null>(null);
  const messageBufferRef = useRef<MessageBuffer>(new MessageBuffer());
  const connectedDeviceRef = useRef<DeviceInfo | null>(null);
  const pairingStateRef = useRef<ReturnType<typeof createPairingState> | null>(null);
  const pendingPassphraseRef = useRef<string | null>(null);
  const localDeviceRef = useRef<DeviceInfo | null>(null);

  // File receiving state
  const receivingChunksRef = useRef<Map<number, Uint8Array>>(new Map());
  const receivingFileInfoRef = useRef<{
    fileName: string;
    fileSize: number;
    totalChunks: number;
    checksum: string;
  } | null>(null);
  // Streaming receive state (for large files)
  const receivingHasherRef = useRef<IncrementalChecksum | null>(null);
  const receivingTempPathRef = useRef<string | null>(null);
  const receivingBytesWrittenRef = useRef<number>(0);
  const receivingStreamingRef = useRef<boolean>(false);
  // Write queue ensures appendFile calls complete sequentially (handleFileChunk is not awaited)
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Buffer to batch multiple chunks into fewer disk writes (reduces bridge calls)
  const writeBufferPartsRef = useRef<string[]>([]); // Accumulates base64 chunks
  const writeBufferBytesRef = useRef<number>(0); // Track binary size of buffered data
  const WRITE_BUFFER_THRESHOLD = 512 * 1024; // Flush to disk every 512KB

  // File sending state
  const pendingFileRequestRef = useRef<FileRequestMessage | null>(null);
  const pendingFileDataRef = useRef<Uint8Array | null>(null);
  const pendingFileUriRef = useRef<string | null>(null);
  const pendingFileSizeRef = useRef<number>(0);
  const pendingFileChecksumRef = useRef<string | null>(null);

  // HTTP transfer state
  const httpSendingRequestIdRef = useRef<string | null>(null);

  // Promise resolver for sendFile — resolved when transfer completes
  const sendFileResolverRef = useRef<((success: boolean) => void) | null>(null);

  // Transfer timing
  const transferStartTimeRef = useRef<number>(0);

  // Keepalive state
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongReceivedRef = useRef<number>(Date.now());
  const transferActiveRef = useRef<boolean>(false); // Skip keepalive timeout during transfers
  const KEEPALIVE_INTERVAL = 5000; // Send ping every 5 seconds
  const KEEPALIVE_TIMEOUT = 120000; // Disconnect if no pong for 2 minutes (generous for backgrounding)

  // Auto-reconnect state — survives disconnect so we can reconnect on foreground return
  const lastConnectedDeviceRef = useRef<DeviceInfo | null>(null);
  const autoReconnectingRef = useRef<boolean>(false);

  // Callbacks
  const onPairingSuccessRef = useRef<PairingSuccessCallback | null>(null);
  const onTransferCompleteRef = useRef<TransferCompleteCallback | null>(null);
  const onTextReceivedRef = useRef<TextReceivedCallback | null>(null);
  const onPairingRequestRef = useRef<PairingRequestCallback | null>(null);

  // Store pending pairing message when we need user input
  const pendingPairingMessageRef = useRef<Message | null>(null);

  const processMessages = useCallback(() => {
    const messages = messageBufferRef.current.extractAllMessages();
    for (const message of messages) {
      handleMessage(message);
    }
  }, []);

  const handleMessage = useCallback((message: Message) => {
    // Any incoming message proves the connection is alive — reset keepalive timer.
    // This is more robust than only relying on pong responses.
    lastPongReceivedRef.current = Date.now();

    switch (message.type) {
      case 'ping':
        sendMessage(createPongMessage(message.id));
        break;

      case 'pong':
        break;

      case 'pair_request':
      case 'pair_challenge':
      case 'pair_response':
      case 'pair_confirm':
      case 'pair_reject':
        handlePairingMessageCallback(message);
        break;

      case 'text':
        handleTextMessage(message as TextMessage);
        break;

      case 'file_request':
        handleFileRequest(message as FileRequestMessage);
        break;

      case 'file_accept':
        handleFileAccept(message as FileAcceptMessage);
        break;

      case 'file_chunk':
        handleFileChunk(message as FileChunkMessage);
        break;

      case 'file_complete':
        handleFileComplete(message as FileCompleteMessage);
        break;

      case 'file_ack':
        handleFileAck(message as FileAckMessage);
        break;
    }
  }, []);

  const handlePairingMessageCallback = useCallback((message: Message) => {
    // Create pairing state if needed
    if (!pairingStateRef.current) {
      if (localDeviceRef.current) {
        pairingStateRef.current = createPairingState(localDeviceRef.current);
      } else {
        // Create a minimal local device if not set yet
        const fallbackDevice: DeviceInfo = {
          id: 'local',
          name: 'This Device',
          platform: 'android',
          version: '1.0.0',
          host: '',
          port: 0,
        };
        pairingStateRef.current = createPairingState(fallbackDevice);
        console.log('Warning: localDevice not set, using fallback for pairing');
      }
    }

    if (!pairingStateRef.current) return;

    // If this is an incoming pair_request and we don't have a passphrase yet,
    // store the message and notify the UI to get the passphrase from user
    if (message.type === 'pair_request' && !pendingPassphraseRef.current) {
      console.log('Received pair_request, waiting for user passphrase');
      pendingPairingMessageRef.current = message;

      // Extract remote device info from the message and notify UI
      const remoteDevice = (message as any).payload?.deviceInfo as DeviceInfo | undefined;
      if (remoteDevice) {
        connectedDeviceRef.current = remoteDevice;
        setConnectionState({
          status: 'pairing',
          device: remoteDevice,
          statusMessage: `Pairing request from ${remoteDevice.name}. Enter passphrase to continue.`,
          pairingStep: 'waiting_for_passphrase',
        });
        if (onPairingRequestRef.current) {
          onPairingRequestRef.current(remoteDevice);
        }
      }
      return;
    }

    // Log and update status based on message type
    console.log(`Processing pairing message: ${message.type}`);

    if (message.type === 'pair_request') {
      setConnectionState({
        status: 'pairing',
        device: connectedDeviceRef.current || undefined,
        statusMessage: 'Deriving encryption key from passphrase...',
        pairingStep: 'deriving_key',
      });
    } else if (message.type === 'pair_challenge') {
      setConnectionState({
        status: 'pairing',
        device: connectedDeviceRef.current || undefined,
        statusMessage: 'Received challenge. Computing response...',
        pairingStep: 'responding_to_challenge',
      });
    } else if (message.type === 'pair_response') {
      setConnectionState({
        status: 'pairing',
        device: connectedDeviceRef.current || undefined,
        statusMessage: 'Verifying passphrase match...',
        pairingStep: 'verifying_response',
      });
    }

    const { newState, response } = handlePairingMessage(
      pairingStateRef.current,
      message,
      pendingPassphraseRef.current || undefined
    );

    pairingStateRef.current = newState;

    if (response) {
      if (response.type === 'pair_challenge') {
        setConnectionState({
          status: 'pairing',
          device: connectedDeviceRef.current || undefined,
          statusMessage: 'Sending cryptographic challenge...',
          pairingStep: 'sending_challenge',
        });
      } else if (response.type === 'pair_response') {
        setConnectionState({
          status: 'pairing',
          device: connectedDeviceRef.current || undefined,
          statusMessage: 'Sending challenge response...',
          pairingStep: 'responding_to_challenge',
        });
      } else if (response.type === 'pair_confirm') {
        setConnectionState({
          status: 'pairing',
          device: connectedDeviceRef.current || undefined,
          statusMessage: 'Passphrase verified! Confirming pairing...',
          pairingStep: 'confirming',
        });
      }
      sendMessage(response);
    }

    if (newState.status === 'success') {
      const pairedDevice = createPairedDevice(newState);
      if (pairedDevice && onPairingSuccessRef.current) {
        onPairingSuccessRef.current(pairedDevice);
        connectedDeviceRef.current = newState.remoteDevice!;
        setConnectionState({
          status: 'connected',
          device: connectedDeviceRef.current || undefined,
          statusMessage: 'Pairing successful! Devices are now paired.',
          pairingStep: 'success',
        });
      }
    } else if (newState.status === 'failed') {
      setConnectionState({
        status: 'disconnected',
        error: newState.error,
        statusMessage: `Pairing failed: ${newState.error}`,
        pairingStep: 'failed',
      });
    } else if (newState.status === 'waiting') {
      connectedDeviceRef.current = newState.remoteDevice!;
      setConnectionState({
        status: 'pairing',
        device: connectedDeviceRef.current || undefined,
        statusMessage: 'Waiting for passphrase...',
        pairingStep: 'waiting_for_passphrase',
      });
    }
  }, [sendMessage]);

  const handleTextMessage = useCallback((message: TextMessage) => {
    if (!connectedDeviceRef.current) return;

    const text = message.payload.content;
    const transfer = createTextTransfer(text, connectedDeviceRef.current, 'receive');

    if (onTransferCompleteRef.current) {
      onTransferCompleteRef.current(transfer);
    }

    if (onTextReceivedRef.current) {
      onTextReceivedRef.current(text, connectedDeviceRef.current);
    }
  }, []);

  const handleFileRequest = useCallback(async (message: FileRequestMessage) => {
    const fileSize = message.payload.fileSize;
    const httpUrl = message.payload.httpUrl;
    console.log('Received file request:', message.payload.fileName, fileSize, 'httpUrl:', httpUrl ? 'yes' : 'no');

    transferActiveRef.current = true; // Pause keepalive timeout during transfer
    transferStartTimeRef.current = Date.now();

    // Store file info
    receivingFileInfoRef.current = {
      fileName: message.payload.fileName,
      fileSize,
      totalChunks: Math.ceil(fileSize / (64 * 1024)),
      checksum: message.payload.checksum,
    };

    // HTTP download path (desktop→mobile large file)
    if (httpUrl) {
      console.log('Using HTTP download for large file from:', httpUrl);
      const acceptMessage = createFileAccept(message.id);
      sendMessage(acceptMessage);

      const downloadDir = RNFS.DownloadDirectoryPath;
      const tempPath = `${downloadDir}/.easyshare_http_${Date.now()}`;
      const finalPath = `${downloadDir}/${message.payload.fileName}`;

      try {
        // RNFS.downloadFile runs entirely in native — zero bridge overhead
        const result = RNFS.downloadFile({
          fromUrl: httpUrl,
          toFile: tempPath,
          progress: (res) => {
            setCurrentProgress(
              calculateProgress(message.id, res.bytesWritten, fileSize, message.payload.fileName)
            );
          },
          progressInterval: 100,
        });

        const downloadResult = await result.promise;
        console.log('HTTP download complete, status:', downloadResult.statusCode, 'bytes:', downloadResult.bytesWritten);

        if (downloadResult.statusCode !== 200) {
          console.error('HTTP download failed with status:', downloadResult.statusCode);
          try { await RNFS.unlink(tempPath); } catch (_) {}
          sendMessage(createFileAck(message.id, false));
          setCurrentProgress(null);
          receivingFileInfoRef.current = null;
          transferActiveRef.current = false;
          lastPongReceivedRef.current = Date.now();
          return;
        }

        // Verify file size — TCP ensures data integrity at the transport layer,
        // and Content-Length validates the right amount of data was received.
        // Avoids reading the entire file back through the RN bridge for checksum.
        const stat = await RNFS.stat(tempPath);
        if (stat.size !== fileSize) {
          console.error('HTTP download size mismatch:', stat.size, '!==', fileSize);
          try { await RNFS.unlink(tempPath); } catch (_) {}
          sendMessage(createFileAck(message.id, false));
          setCurrentProgress(null);
          receivingFileInfoRef.current = null;
          transferActiveRef.current = false;
          lastPongReceivedRef.current = Date.now();
          return;
        }

        // Show 100% before completing
        setCurrentProgress(
          calculateProgress(message.id, fileSize, fileSize, message.payload.fileName)
        );

        // Move to final path
        try { await RNFS.unlink(finalPath); } catch (_) {}
        await RNFS.moveFile(tempPath, finalPath);
        console.log('HTTP download saved to:', finalPath);

        // Notify transfer complete
        if (connectedDeviceRef.current) {
          const durationMs = Date.now() - transferStartTimeRef.current;
          const transfer = createFileTransfer(
            message.payload.fileName,
            fileSize,
            'application/octet-stream',
            connectedDeviceRef.current,
            'receive',
            durationMs
          );
          (transfer as any).filePath = finalPath;
          if (onTransferCompleteRef.current) {
            onTransferCompleteRef.current(transfer);
          }
        }

        // Send ack to desktop so it can shut down HTTP server
        sendMessage(createFileAck(message.id, true));
        setCurrentProgress(null);
        receivingFileInfoRef.current = null;
        transferActiveRef.current = false;
        lastPongReceivedRef.current = Date.now();
      } catch (err) {
        console.error('HTTP download error:', err);
        try { await RNFS.unlink(tempPath); } catch (_) {}
        sendMessage(createFileAck(message.id, false));
        setCurrentProgress(null);
        receivingFileInfoRef.current = null;
        transferActiveRef.current = false;
        lastPongReceivedRef.current = Date.now();
      }
      return;
    }

    // Chunk-based path (small files or fallback)
    const isLargeFile = fileSize > 5 * 1024 * 1024;

    if (isLargeFile) {
      // Streaming receive: hash incrementally, write chunks to disk
      receivingStreamingRef.current = true;
      receivingHasherRef.current = new IncrementalChecksum();
      const downloadDir = RNFS.DownloadDirectoryPath;
      receivingTempPathRef.current = `${downloadDir}/.easyshare_tmp_${Date.now()}`;
      receivingBytesWrittenRef.current = 0;
      writeQueueRef.current = Promise.resolve();
      console.log('Using streaming receive for large file (chunk fallback)');
    } else {
      // Small file: collect chunks in memory
      receivingStreamingRef.current = false;
      receivingChunksRef.current.clear();
    }

    // Auto-accept the file transfer
    const acceptMessage = createFileAccept(message.id);
    sendMessage(acceptMessage);
    console.log('Sent file accept for:', message.payload.fileName);
  }, []);

  const flushWriteBuffer = useCallback(() => {
    if (writeBufferPartsRef.current.length === 0) return;
    const bufferedBase64 = writeBufferPartsRef.current.join('');
    const bufferedBytes = writeBufferBytesRef.current;
    writeBufferPartsRef.current = [];
    writeBufferBytesRef.current = 0;

    writeQueueRef.current = writeQueueRef.current.then(async () => {
      try {
        await RNFS.appendFile(receivingTempPathRef.current!, bufferedBase64, 'base64');
        receivingBytesWrittenRef.current += bufferedBytes;
      } catch (err) {
        console.error('Error writing buffered chunks to disk:', err);
      }
    });
  }, []);

  const handleFileChunk = useCallback((message: FileChunkMessage) => {
    if (receivingStreamingRef.current) {
      // Streaming mode: hash chunk synchronously, buffer for batched disk write
      const chunkData = decodeBase64(message.payload.data);
      receivingHasherRef.current?.update(chunkData);
      const chunkLength = chunkData.length;

      // Accumulate base64 data in buffer (array join is faster than string concat)
      writeBufferPartsRef.current.push(message.payload.data);
      writeBufferBytesRef.current += chunkLength;

      // Flush to disk when buffer reaches threshold (fewer bridge calls = faster)
      if (writeBufferBytesRef.current >= WRITE_BUFFER_THRESHOLD) {
        flushWriteBuffer();
      }

      if (receivingFileInfoRef.current) {
        setCurrentProgress(
          calculateProgress(
            message.payload.requestId,
            message.payload.chunkIndex * 64 * 1024,
            receivingFileInfoRef.current.fileSize,
            receivingFileInfoRef.current.fileName
          )
        );
      }
    } else {
      // In-memory mode for small files
      const chunkData = decodeBase64(message.payload.data);
      receivingChunksRef.current.set(message.payload.chunkIndex, chunkData);

      if (receivingFileInfoRef.current) {
        setCurrentProgress(
          calculateProgress(
            message.payload.requestId,
            receivingChunksRef.current.size * 64 * 1024,
            receivingFileInfoRef.current.fileSize,
            receivingFileInfoRef.current.fileName
          )
        );
      }
    }
  }, []);

  const handleFileComplete = useCallback(async (message: FileCompleteMessage) => {
    if (!receivingFileInfoRef.current || !connectedDeviceRef.current) return;

    const fileName = receivingFileInfoRef.current.fileName;
    const downloadDir = RNFS.DownloadDirectoryPath;
    const filePath = `${downloadDir}/${fileName}`;

    if (receivingStreamingRef.current) {
      // Flush any remaining buffered data to disk
      flushWriteBuffer();
      // Wait for all queued chunk writes to complete before verifying
      await writeQueueRef.current;
      writeQueueRef.current = Promise.resolve();

      // Streaming mode: verify incremental checksum and rename temp file
      const computedChecksum = receivingHasherRef.current?.digest();
      const expectedChecksum = message.payload.checksum;

      if (computedChecksum !== expectedChecksum) {
        console.error('File integrity check failed (streaming):', computedChecksum, '!==', expectedChecksum);
        // Clean up temp file
        try {
          if (receivingTempPathRef.current) {
            await RNFS.unlink(receivingTempPathRef.current);
          }
        } catch (_) {}
        setCurrentProgress(null);
        receivingFileInfoRef.current = null;
        receivingHasherRef.current = null;
        receivingTempPathRef.current = null;
        receivingStreamingRef.current = false;
        return;
      }

      try {
        // Move temp file to final destination
        if (receivingTempPathRef.current) {
          // If target already exists, remove it first
          try { await RNFS.unlink(filePath); } catch (_) {}
          await RNFS.moveFile(receivingTempPathRef.current, filePath);
        }
        console.log('File saved to (streaming):', filePath);

        const durationMs = Date.now() - transferStartTimeRef.current;
        const transfer = createFileTransfer(
          fileName,
          receivingBytesWrittenRef.current,
          'application/octet-stream',
          connectedDeviceRef.current,
          'receive',
          durationMs
        );
        (transfer as any).filePath = filePath;

        if (onTransferCompleteRef.current) {
          onTransferCompleteRef.current(transfer);
        }
      } catch (err) {
        console.error('Failed to save file (streaming):', err);
        try {
          if (receivingTempPathRef.current) {
            await RNFS.unlink(receivingTempPathRef.current);
          }
        } catch (_) {}
      }

      // Clean up streaming state
      receivingHasherRef.current = null;
      receivingTempPathRef.current = null;
      receivingBytesWrittenRef.current = 0;
      receivingStreamingRef.current = false;
      writeBufferPartsRef.current = [];
      writeBufferBytesRef.current = 0;
    } else {
      // In-memory mode for small files
      const totalChunks = receivingFileInfoRef.current.totalChunks;
      const fileData = reassembleChunks(receivingChunksRef.current, totalChunks);

      if (!fileData) {
        console.error('Failed to reassemble file');
        setCurrentProgress(null);
        receivingChunksRef.current.clear();
        receivingFileInfoRef.current = null;
        return;
      }

      if (!verifyFileIntegrity(fileData, message.payload.checksum)) {
        console.error('File integrity check failed');
        setCurrentProgress(null);
        receivingChunksRef.current.clear();
        receivingFileInfoRef.current = null;
        return;
      }

      try {
        const base64Data = Buffer.from(fileData).toString('base64');
        await RNFS.writeFile(filePath, base64Data, 'base64');
        console.log('File saved to:', filePath);

        const durationMs = Date.now() - transferStartTimeRef.current;
        const transfer = createFileTransfer(
          fileName,
          fileData.length,
          'application/octet-stream',
          connectedDeviceRef.current,
          'receive',
          durationMs
        );
        (transfer as any).filePath = filePath;

        if (onTransferCompleteRef.current) {
          onTransferCompleteRef.current(transfer);
        }
      } catch (err) {
        console.error('Failed to save file:', err);
        const transfer = createFileTransfer(
          fileName,
          fileData.length,
          'application/octet-stream',
          connectedDeviceRef.current,
          'receive'
        );
        if (onTransferCompleteRef.current) {
          onTransferCompleteRef.current(transfer);
        }
      }

      receivingChunksRef.current.clear();
    }

    setCurrentProgress(null);
    receivingFileInfoRef.current = null;
    transferActiveRef.current = false; // Resume keepalive timeout
    lastPongReceivedRef.current = Date.now(); // Reset pong timer
  }, []);

  const sendMessage = useCallback((message: Message) => {
    if (!socketRef.current) return;

    try {
      const buffer = serializeMessage(message);
      socketRef.current.write(Buffer.from(buffer));
    } catch (err) {
      console.error('sendMessage error (broken pipe?):', err);
    }
  }, []);

  // Keepalive functions - defined first to avoid circular dependencies
  const stopKeepaliveRef = useRef<() => void>(() => {});
  const startKeepaliveRef = useRef<() => void>(() => {});
  const disconnectRef = useRef<() => void>(() => {});

  const stopKeepalive = useCallback(() => {
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  }, []);
  stopKeepaliveRef.current = stopKeepalive;

  const disconnect = useCallback((userInitiated?: boolean) => {
    stopKeepaliveRef.current();
    socketRef.current?.destroy();
    socketRef.current = null;
    connectedDeviceRef.current = null;
    pairingStateRef.current = null;
    pendingPassphraseRef.current = null;
    transferActiveRef.current = false;

    // Only clear auto-reconnect target when the user explicitly disconnects
    if (userInitiated) {
      lastConnectedDeviceRef.current = null;
    }

    // Resolve any pending sendFile promise so multi-file loops don't hang
    if (sendFileResolverRef.current) {
      sendFileResolverRef.current(false);
      sendFileResolverRef.current = null;
    }

    setConnectionState({ status: 'disconnected' });
  }, []);
  disconnectRef.current = disconnect;

  const startKeepalive = useCallback(() => {
    stopKeepaliveRef.current();
    lastPongReceivedRef.current = Date.now();

    keepaliveIntervalRef.current = setInterval(() => {
      if (!socketRef.current) {
        stopKeepaliveRef.current();
        return;
      }

      // Skip timeout check when app is backgrounded (file picker, other apps)
      // or during active transfers
      const appInForeground = AppState.currentState === 'active';
      if (!transferActiveRef.current && appInForeground) {
        const timeSinceLastPong = Date.now() - lastPongReceivedRef.current;
        if (timeSinceLastPong > KEEPALIVE_TIMEOUT) {
          console.log('Keepalive timeout - disconnecting');
          disconnectRef.current();
          return;
        }
      }

      // Send ping (still attempt even in background — may succeed)
      sendMessage(createPingMessage());
    }, KEEPALIVE_INTERVAL);
  }, [sendMessage]);
  startKeepaliveRef.current = startKeepalive;

  const connect = useCallback(async (device: DeviceInfo): Promise<boolean> => {
    setConnectionState({
      status: 'connecting',
      device,
      statusMessage: `Opening TCP connection to ${device.name}...`,
      pairingStep: 'connecting',
    });

    return new Promise((resolve) => {
      const socket = TcpSocket.createConnection(
        {
          host: device.host,
          port: device.port,
        },
        () => {
          socketRef.current = socket;
          connectedDeviceRef.current = device;
          lastConnectedDeviceRef.current = device;
          autoReconnectingRef.current = false;
          setConnectionState({
            status: 'connected',
            device,
            statusMessage: `Connected to ${device.name}`,
            pairingStep: 'idle',
          });
          // Start keepalive after connection is established
          startKeepaliveRef.current();
          resolve(true);
        }
      );

      socket.on('data', (data) => {
        const bytes = typeof data === 'string' ? Buffer.from(data) : data;
        messageBufferRef.current.append(new Uint8Array(bytes));
        processMessages();
      });

      socket.on('close', () => {
        disconnectRef.current();
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setConnectionState({
          status: 'disconnected',
          error: error.message,
          statusMessage: `Connection failed: ${error.message}`,
          pairingStep: 'failed',
        });
        resolve(false);
      });
    });
  }, [processMessages]);

  const startPairing = useCallback(
    async (deviceId: string, passphrase: string): Promise<boolean> => {
      if (!socketRef.current || !localDeviceRef.current) {
        return false;
      }

      pendingPassphraseRef.current = passphrase;
      pairingStateRef.current = createPairingState(localDeviceRef.current);
      pairingStateRef.current.passphrase = passphrase;
      pairingStateRef.current.remoteDevice = connectedDeviceRef.current!;

      setConnectionState({
        status: 'pairing',
        device: connectedDeviceRef.current || undefined,
        statusMessage: 'Sending pairing request...',
        pairingStep: 'sending_request',
      });

      const request = createPairRequest(localDeviceRef.current);
      sendMessage(request);

      setConnectionState({
        status: 'pairing',
        device: connectedDeviceRef.current || undefined,
        statusMessage: 'Waiting for challenge from remote device...',
        pairingStep: 'waiting_for_challenge',
      });

      return true;
    },
    [sendMessage]
  );

  const sendText = useCallback(
    async (text: string): Promise<boolean> => {
      console.log('sendText called, socket:', !!socketRef.current, 'device:', !!connectedDeviceRef.current);
      if (!socketRef.current || !connectedDeviceRef.current) {
        console.log('sendText: No socket or device');
        return false;
      }

      const message = createTextMessage(text);
      sendMessage(message);
      console.log('sendText: Message sent');

      const transfer = createTextTransfer(text, connectedDeviceRef.current, 'send');
      console.log('sendText: Transfer created', transfer.id);
      if (onTransferCompleteRef.current) {
        console.log('sendText: Calling onTransferComplete callback');
        onTransferCompleteRef.current(transfer);
      } else {
        console.log('sendText: No onTransferComplete callback registered!');
      }

      return true;
    },
    [sendMessage]
  );

  const handleFileAccept = useCallback(async (message?: FileAcceptMessage) => {
    if (!pendingFileRequestRef.current || !connectedDeviceRef.current) {
      console.log('handleFileAccept: Missing pending file request');
      return;
    }

    transferActiveRef.current = true; // Pause keepalive timeout during send
    const requestId = pendingFileRequestRef.current.id;
    const fileName = pendingFileRequestRef.current.payload.fileName;
    const uploadUrl = message?.payload?.uploadUrl;

    // HTTP upload path (mobile→desktop large file)
    if (uploadUrl && pendingFileUriRef.current) {
      console.log('Using HTTP upload to:', uploadUrl);
      // pendingFileUriRef holds a resolved file path (content:// was copied to temp in sendFile)
      const uploadPath = pendingFileUriRef.current;
      const totalSize = pendingFileSizeRef.current;
      httpSendingRequestIdRef.current = requestId;

      try {
        // Use XMLHttpRequest instead of RNFS.uploadFiles — more reliable on Android.
        // RN's XHR natively handles file:// URIs in FormData.
        const fileUriForUpload = uploadPath.startsWith('file://') ? uploadPath : `file://${uploadPath}`;
        console.log('Starting XHR upload from:', fileUriForUpload);

        const status = await new Promise<number>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', (e: any) => {
            if (e.lengthComputable) {
              setCurrentProgress(
                calculateProgress(requestId, e.loaded, totalSize, fileName)
              );
            }
          });
          xhr.addEventListener('load', () => resolve(xhr.status));
          xhr.addEventListener('error', () => reject(new Error(`XHR upload error: ${xhr.status}`)));
          xhr.addEventListener('abort', () => reject(new Error('XHR upload aborted')));

          xhr.open('POST', uploadUrl);

          const formData = new FormData();
          formData.append('file', {
            uri: fileUriForUpload,
            type: 'application/octet-stream',
            name: fileName,
          } as any);

          xhr.send(formData);
        });

        console.log('HTTP upload complete, status:', status);

        // Clean up temp file (created in sendFile for content:// URIs)
        if (uploadPath.includes('.easyshare_send_')) {
          try { await RNFS.unlink(uploadPath); } catch (_) {}
        }

        // Desktop will verify and send file_ack.
        // Transfer completion handled by handleFileAck.
        pendingFileUriRef.current = null;
        pendingFileSizeRef.current = 0;
        pendingFileChecksumRef.current = null;
      } catch (err) {
        console.error('HTTP upload error:', err);
        // Clean up temp file on error
        if (uploadPath.includes('.easyshare_send_')) {
          try { await RNFS.unlink(uploadPath); } catch (_) {}
        }
        pendingFileUriRef.current = null;
        pendingFileSizeRef.current = 0;
        pendingFileChecksumRef.current = null;
        httpSendingRequestIdRef.current = null;
        setCurrentProgress(null);
        pendingFileRequestRef.current = null;
        transferActiveRef.current = false;
        lastPongReceivedRef.current = Date.now();
      }
      return;
    }

    // Chunk-based path (small files or fallback)
    if (pendingFileDataRef.current) {
      // Small/medium file - data already in memory
      console.log('File accepted, sending chunks from memory...');
      const fileData = pendingFileDataRef.current;
      const totalSize = fileData.length;
      let chunksSent = 0;

      for (const { chunk, index, total } of chunkFile(fileData)) {
        const chunkMessage = createFileChunk(requestId, index, total, chunk);
        sendMessage(chunkMessage);
        chunksSent++;

        const bytesTransferred = Math.min(chunksSent * 64 * 1024, totalSize);
        setCurrentProgress(
          calculateProgress(requestId, bytesTransferred, totalSize, fileName)
        );

        if (chunksSent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const completeMessage = createFileComplete(requestId, fileData);
      sendMessage(completeMessage);
      console.log('File transfer complete (from memory)');

      pendingFileDataRef.current = null;

      const durationMs = Date.now() - transferStartTimeRef.current;
      const transfer = createFileTransfer(
        fileName,
        totalSize,
        pendingFileRequestRef.current.payload.mimeType,
        connectedDeviceRef.current,
        'send',
        durationMs
      );
      if (onTransferCompleteRef.current) {
        onTransferCompleteRef.current(transfer);
      }

      setCurrentProgress(null);
      pendingFileRequestRef.current = null;
      transferActiveRef.current = false;
      lastPongReceivedRef.current = Date.now();

      if (sendFileResolverRef.current) {
        sendFileResolverRef.current(true);
        sendFileResolverRef.current = null;
      }

    } else if (pendingFileUriRef.current) {
      // Large file without HTTP (fallback) - stream from disk with pre-computed checksum
      console.log('File accepted, streaming from disk (chunk fallback)...');
      const fileUri = pendingFileUriRef.current;
      const totalSize = pendingFileSizeRef.current;
      const preComputedChecksum = pendingFileChecksumRef.current!;
      const PROTOCOL_CHUNK_SIZE = 64 * 1024; // 64KB protocol chunks
      const DISK_READ_SIZE = 512 * 1024; // 512KB disk reads (8x fewer bridge calls)
      const totalChunks = Math.ceil(totalSize / PROTOCOL_CHUNK_SIZE);

      let currentPosition = 0;
      let chunkIndex = 0;

      while (currentPosition < totalSize) {
        const readSize = Math.min(DISK_READ_SIZE, totalSize - currentPosition);

        try {
          const base64Block = await RNFS.read(fileUri, readSize, currentPosition, 'base64');
          const binaryBlock = Buffer.from(base64Block, 'base64');
          const actualReadSize = binaryBlock.length;

          let blockOffset = 0;
          while (blockOffset < actualReadSize) {
            const end = Math.min(blockOffset + PROTOCOL_CHUNK_SIZE, actualReadSize);
            const slice = binaryBlock.slice(blockOffset, end);
            const chunkBase64 = slice.toString('base64');
            const chunkMessage = createFileChunkFromBase64(requestId, chunkIndex, totalChunks, chunkBase64);
            sendMessage(chunkMessage);

            chunkIndex++;
            blockOffset = end;
          }

          currentPosition += actualReadSize;
          setCurrentProgress(
            calculateProgress(requestId, currentPosition, totalSize, fileName)
          );

          await new Promise(resolve => setTimeout(resolve, 5));
        } catch (readErr) {
          console.error('Error reading chunk during send:', readErr);
          break;
        }
      }

      const completeMessage = createFileCompleteStreaming(requestId, preComputedChecksum);
      sendMessage(completeMessage);
      console.log('File transfer complete (streamed)');

      const durationMs = Date.now() - transferStartTimeRef.current;
      const transfer = createFileTransfer(
        fileName,
        totalSize,
        pendingFileRequestRef.current.payload.mimeType,
        connectedDeviceRef.current,
        'send',
        durationMs
      );
      if (onTransferCompleteRef.current) {
        onTransferCompleteRef.current(transfer);
      }

      pendingFileUriRef.current = null;
      pendingFileSizeRef.current = 0;
      pendingFileChecksumRef.current = null;
      setCurrentProgress(null);
      pendingFileRequestRef.current = null;
      transferActiveRef.current = false;
      lastPongReceivedRef.current = Date.now();

      if (sendFileResolverRef.current) {
        sendFileResolverRef.current(true);
        sendFileResolverRef.current = null;
      }
    }
  }, [sendMessage]);

  const handleFileAck = useCallback((message: FileAckMessage) => {
    const requestId = message.payload.requestId;
    console.log('Received file_ack for', requestId, 'success:', message.payload.success);

    // This ack is for an HTTP upload (mobile→desktop)
    if (httpSendingRequestIdRef.current === requestId && pendingFileRequestRef.current && connectedDeviceRef.current) {
      const fileName = pendingFileRequestRef.current.payload.fileName;
      const fileSize = pendingFileRequestRef.current.payload.fileSize;
      const mimeType = pendingFileRequestRef.current.payload.mimeType;

      if (message.payload.success) {
        const durationMs = Date.now() - transferStartTimeRef.current;
        const transfer = createFileTransfer(fileName, fileSize, mimeType, connectedDeviceRef.current, 'send', durationMs);
        if (onTransferCompleteRef.current) {
          onTransferCompleteRef.current(transfer);
        }
      }

      setCurrentProgress(null);
      pendingFileRequestRef.current = null;
      httpSendingRequestIdRef.current = null;
      transferActiveRef.current = false;
      lastPongReceivedRef.current = Date.now();

      // Resolve sendFile promise
      if (sendFileResolverRef.current) {
        sendFileResolverRef.current(message.payload.success);
        sendFileResolverRef.current = null;
      }
    }
  }, []);

  const sendFile = useCallback(async (fileUri: string, providedFileName?: string): Promise<boolean> => {
    if (!socketRef.current || !connectedDeviceRef.current) {
      console.log('sendFile: No socket or device');
      return false;
    }

    let tempFilePath: string | null = null; // Track temp file for cleanup
    transferStartTimeRef.current = Date.now();

    // Create a promise that resolves when the full transfer completes.
    // This allows callers to await sendFile() for sequential multi-file transfers.
    const transferComplete = new Promise<boolean>((resolve) => {
      sendFileResolverRef.current = resolve;
    });
    try {
      console.log('sendFile: Reading file from:', fileUri);

      // For content:// URIs, RNFS.stat and RNFS.read with offsets may not work.
      // Copy to a temp file first so all operations work reliably.
      let resolvedUri = fileUri;
      if (fileUri.startsWith('content://')) {
        tempFilePath = `${RNFS.CachesDirectoryPath}/.easyshare_send_${Date.now()}`;
        console.log('sendFile: Copying content:// URI to temp file:', tempFilePath);
        await RNFS.copyFile(fileUri, tempFilePath);
        resolvedUri = tempFilePath;
      }

      // Get file info using react-native-fs stat
      let fileName = providedFileName || 'file';
      let fileSize = 0;

      // Get file stats first to check size
      try {
        const stat = await RNFS.stat(resolvedUri);
        fileSize = stat.size;
        if (!providedFileName) {
          fileName = stat.name || 'file';
        }
        console.log('sendFile: File stats - name:', fileName, 'size:', fileSize);
      } catch (statErr) {
        console.log('sendFile: stat failed, will try to read file');
        // If no filename provided, try to extract it from URI
        if (!providedFileName) {
          if (fileUri.startsWith('content://')) {
            const uriParts = decodeURIComponent(fileUri).split('/');
            const lastPart = uriParts[uriParts.length - 1];
            if (lastPart) {
              const nameParts = lastPart.split(':');
              fileName = nameParts[nameParts.length - 1] || lastPart;
              if (fileName.includes('%')) {
                fileName = decodeURIComponent(fileName);
              }
            }
          } else {
            const parts = fileUri.split('/');
            fileName = parts[parts.length - 1] || 'file';
          }
        }
      }

      console.log('sendFile: Using filename:', fileName, 'fileSize:', fileSize);

      // If stat failed or returned 0, fall back to reading the whole file
      if (fileSize === 0) {
        console.log('sendFile: fileSize is 0, reading full file to determine size...');
        try {
          const base64Content = await RNFS.readFile(resolvedUri, 'base64');
          const fileData = new Uint8Array(Buffer.from(base64Content, 'base64'));
          fileSize = fileData.length;
          console.log('sendFile: Read full file, actual size:', fileSize);

          if (fileSize === 0) {
            console.error('sendFile: File is genuinely empty');
            return false;
          }

          // We already have the data in memory, use the in-memory path directly
          const mimeType = 'application/octet-stream';
          const request = createFileRequest(fileName, fileData.length, mimeType, fileData);
          pendingFileRequestRef.current = request;
          pendingFileDataRef.current = fileData;
          sendMessage(request);
          console.log('sendFile: File request sent (stat-fallback), waiting for accept');
          setCurrentProgress(calculateProgress(request.id, 0, fileData.length, fileName));
          return await transferComplete;
        } catch (readErr) {
          console.error('sendFile: Failed to read file for size detection:', readErr);
          return false;
        }
      }

      console.log('sendFile: Reading file content...');

      // For smaller files (< 5MB), use the old approach for simplicity
      if (fileSize > 0 && fileSize < 5 * 1024 * 1024) {
        const base64Content = await RNFS.readFile(resolvedUri, 'base64');
        const fileData = new Uint8Array(Buffer.from(base64Content, 'base64'));

        const mimeType = 'application/octet-stream';
        const request = createFileRequest(fileName, fileData.length, mimeType, fileData);

        pendingFileRequestRef.current = request;
        pendingFileDataRef.current = fileData;

        sendMessage(request);
        console.log('sendFile: File request sent (small file), waiting for accept');
        setCurrentProgress(calculateProgress(request.id, 0, fileData.length, fileName));

        return await transferComplete;
      }

      // For files >= 5MB, use HTTP transfer. Skip expensive checksum computation —
      // the desktop will verify by file size (TCP ensures data integrity).
      console.log('sendFile: Large file, skipping checksum for HTTP transfer');

      const mimeType = 'application/octet-stream';
      const checksum = `size:${fileSize}`; // Size-based verification placeholder
      const request = createFileRequestStreaming(fileName, fileSize, mimeType, checksum);

      // Store resolved file path for HTTP upload — never load full file into memory
      pendingFileRequestRef.current = request;
      pendingFileUriRef.current = resolvedUri; // Use resolved path (temp file for content:// URIs)
      pendingFileSizeRef.current = fileSize;
      pendingFileChecksumRef.current = checksum;
      pendingFileDataRef.current = null;

      sendMessage(request);
      console.log('sendFile: File request sent (HTTP mode), waiting for accept');
      setCurrentProgress(calculateProgress(request.id, 0, fileSize, fileName));

      return await transferComplete;
    } catch (err) {
      console.error('sendFile error:', err);
      if (tempFilePath) {
        try { await RNFS.unlink(tempFilePath); } catch (_) {}
      }
      sendFileResolverRef.current = null;
      return false;
    }
  }, [sendMessage]);

  const onPairingSuccess = useCallback((callback: PairingSuccessCallback) => {
    onPairingSuccessRef.current = callback;
  }, []);

  const onTransferComplete = useCallback((callback: TransferCompleteCallback) => {
    onTransferCompleteRef.current = callback;
  }, []);

  const onTextReceived = useCallback((callback: TextReceivedCallback) => {
    onTextReceivedRef.current = callback;
  }, []);

  const onPairingRequest = useCallback((callback: PairingRequestCallback) => {
    onPairingRequestRef.current = callback;
  }, []);

  const respondToPairing = useCallback((passphrase: string) => {
    pendingPassphraseRef.current = passphrase;

    // Process the pending pairing message now that we have the passphrase
    if (pendingPairingMessageRef.current) {
      const message = pendingPairingMessageRef.current;
      pendingPairingMessageRef.current = null;
      handlePairingMessageCallback(message);
    }
  }, [handlePairingMessageCallback]);

  const setLocalDevice = useCallback((device: DeviceInfo) => {
    localDeviceRef.current = device;
  }, []);

  const startServer = useCallback((): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (serverRef.current) {
        // Server already running - get port from the server itself
        const address = serverRef.current.address();
        const existingPort = typeof address === 'object' ? address?.port || 0 : 0;
        resolve(existingPort);
        return;
      }

      const server = TcpSocket.createServer((socket) => {
        console.log('Client connected from:', socket.remoteAddress);

        // Store the socket for communication
        socketRef.current = socket;

        // Set connection state to 'connecting' - will be updated to 'connected' or 'pairing' when we receive the first message
        // For now, create a placeholder device based on the remote address
        const remoteDevice: DeviceInfo = {
          id: socket.remoteAddress || 'unknown',
          name: socket.remoteAddress || 'Unknown Device',
          platform: 'macos',
          version: '1.0.0',
          host: socket.remoteAddress || '',
          port: 0,
        };
        connectedDeviceRef.current = remoteDevice;
        setConnectionState({ status: 'connected', device: remoteDevice });

        // Start keepalive when client connects
        startKeepaliveRef.current();

        socket.on('data', (data) => {
          const bytes = typeof data === 'string' ? Buffer.from(data) : data;
          messageBufferRef.current.append(new Uint8Array(bytes));
          processMessages();
        });

        socket.on('close', () => {
          console.log('Client disconnected');
          stopKeepaliveRef.current();
          if (socketRef.current === socket) {
            socketRef.current = null;
            connectedDeviceRef.current = null;
            setConnectionState({ status: 'disconnected' });
          }
        });

        socket.on('error', (error) => {
          console.error('Client socket error:', error);
        });
      });

      server.on('error', (error) => {
        console.error('Server error:', error);
        reject(error);
      });

      // Listen on a random available port (0 lets the OS assign one)
      server.listen({ port: 0, host: '0.0.0.0' }, () => {
        const address = server.address();
        const port = typeof address === 'object' ? address?.port || 0 : 0;
        console.log('Server listening on port:', port);
        serverRef.current = server;
        setServerPort(port);
        resolve(port);
      });
    });
  }, [processMessages]);

  const stopServer = useCallback(() => {
    stopKeepaliveRef.current();
    if (serverRef.current) {
      serverRef.current.close();
      serverRef.current = null;
      setServerPort(0);
    }
  }, []);

  // When app returns from background (e.g. file picker):
  // 1. Reset keepalive timer so we don't self-disconnect
  // 2. Auto-reconnect if the OS killed our socket while backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        lastPongReceivedRef.current = Date.now();

        // Auto-reconnect if socket died while backgrounded
        const wasConnected = lastConnectedDeviceRef.current !== null;
        const isDisconnected = !socketRef.current || socketRef.current.destroyed;
        if (wasConnected && isDisconnected && !autoReconnectingRef.current) {
          const device = lastConnectedDeviceRef.current!;
          console.log('App returned to foreground — auto-reconnecting to', device.name);
          autoReconnectingRef.current = true;
          // Small delay to let the OS finish restoring the app
          setTimeout(() => {
            connect(device).then((success) => {
              autoReconnectingRef.current = false;
              if (!success) {
                console.log('Auto-reconnect failed');
                lastConnectedDeviceRef.current = null;
              }
            }).catch(() => {
              autoReconnectingRef.current = false;
              lastConnectedDeviceRef.current = null;
            });
          }, 500);
        }
      }
    });
    return () => subscription.remove();
  }, [connect]);

  return {
    connectionState,
    currentProgress,
    serverPort,
    connect,
    disconnect,
    startPairing,
    respondToPairing,
    sendText,
    sendFile,
    startServer,
    stopServer,
    onPairingSuccess,
    onTransferComplete,
    onTextReceived,
    onPairingRequest,
    setLocalDevice,
  };
}
