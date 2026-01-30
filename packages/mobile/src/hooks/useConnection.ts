import { useState, useCallback, useRef, useEffect } from 'react';
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
  FileChunkMessage,
  FileCompleteMessage,
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
  createFileRequest,
  createFileChunk,
  createFileComplete,
  chunkFile,
  FileAcceptMessage,
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
    totalChunks: number;
    checksum: string;
  } | null>(null);

  // File sending state
  const pendingFileRequestRef = useRef<FileRequestMessage | null>(null);
  const pendingFileDataRef = useRef<Uint8Array | null>(null);

  // Keepalive state
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongReceivedRef = useRef<number>(Date.now());
  const KEEPALIVE_INTERVAL = 5000; // Send ping every 5 seconds
  const KEEPALIVE_TIMEOUT = 15000; // Disconnect if no pong for 15 seconds

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
    switch (message.type) {
      case 'ping':
        sendMessage(createPongMessage(message.id));
        break;

      case 'pong':
        // Update last pong time for keepalive
        lastPongReceivedRef.current = Date.now();
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
        handleFileAccept();
        break;

      case 'file_chunk':
        handleFileChunk(message as FileChunkMessage);
        break;

      case 'file_complete':
        handleFileComplete(message as FileCompleteMessage);
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

  const handleFileRequest = useCallback((message: FileRequestMessage) => {
    console.log('Received file request:', message.payload.fileName, message.payload.fileSize);

    // Store file info for reassembly
    receivingFileInfoRef.current = {
      fileName: message.payload.fileName,
      totalChunks: Math.ceil(message.payload.fileSize / (64 * 1024)),
      checksum: message.payload.checksum,
    };
    receivingChunksRef.current.clear();

    // Auto-accept the file transfer
    const acceptMessage = createFileAccept(message.id);
    sendMessage(acceptMessage);
    console.log('Sent file accept for:', message.payload.fileName);
  }, []);

  const handleFileChunk = useCallback((message: FileChunkMessage) => {
    const chunkData = decodeBase64(message.payload.data);
    receivingChunksRef.current.set(message.payload.chunkIndex, chunkData);

    if (receivingFileInfoRef.current) {
      setCurrentProgress(
        calculateProgress(
          message.payload.requestId,
          receivingChunksRef.current.size,
          message.payload.totalChunks,
          receivingFileInfoRef.current.fileName
        )
      );
    }
  }, []);

  const handleFileComplete = useCallback(async (message: FileCompleteMessage) => {
    if (!receivingFileInfoRef.current || !connectedDeviceRef.current) return;

    const totalChunks = receivingFileInfoRef.current.totalChunks;
    const fileData = reassembleChunks(receivingChunksRef.current, totalChunks);

    if (!fileData) {
      console.error('Failed to reassemble file');
      return;
    }

    if (!verifyFileIntegrity(fileData, message.payload.checksum)) {
      console.error('File integrity check failed');
      return;
    }

    // Save file to Downloads directory
    const fileName = receivingFileInfoRef.current.fileName;
    const downloadDir = RNFS.DownloadDirectoryPath;
    const filePath = `${downloadDir}/${fileName}`;

    try {
      // Convert Uint8Array to base64 for saving
      const base64Data = Buffer.from(fileData).toString('base64');
      await RNFS.writeFile(filePath, base64Data, 'base64');
      console.log('File saved to:', filePath);

      const transfer = createFileTransfer(
        fileName,
        fileData.length,
        'application/octet-stream',
        connectedDeviceRef.current,
        'receive'
      );
      // Add the file path to the transfer
      (transfer as any).filePath = filePath;

      if (onTransferCompleteRef.current) {
        onTransferCompleteRef.current(transfer);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
      // Still create transfer record even if save failed
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

    setCurrentProgress(null);
    receivingChunksRef.current.clear();
    receivingFileInfoRef.current = null;
  }, []);

  const sendMessage = useCallback((message: Message) => {
    if (!socketRef.current) return;

    const buffer = serializeMessage(message);
    socketRef.current.write(Buffer.from(buffer));
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

  const disconnect = useCallback(() => {
    stopKeepaliveRef.current();
    socketRef.current?.destroy();
    socketRef.current = null;
    connectedDeviceRef.current = null;
    pairingStateRef.current = null;
    pendingPassphraseRef.current = null;
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

      // Check if we've received a pong recently
      const timeSinceLastPong = Date.now() - lastPongReceivedRef.current;
      if (timeSinceLastPong > KEEPALIVE_TIMEOUT) {
        console.log('Keepalive timeout - disconnecting');
        disconnectRef.current();
        return;
      }

      // Send ping
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

  const handleFileAccept = useCallback(() => {
    if (!pendingFileRequestRef.current || !pendingFileDataRef.current || !connectedDeviceRef.current) {
      console.log('handleFileAccept: Missing pending file data');
      return;
    }

    console.log('File accepted, sending chunks...');
    const fileData = pendingFileDataRef.current;
    const requestId = pendingFileRequestRef.current.id;
    const fileName = pendingFileRequestRef.current.payload.fileName;

    let chunksSent = 0;
    const totalSize = fileData.length;

    for (const { chunk, index, total } of chunkFile(fileData)) {
      const chunkMessage = createFileChunk(requestId, index, total, chunk);
      sendMessage(chunkMessage);
      chunksSent++;

      // Update progress
      const bytesTransferred = Math.min(chunksSent * 64 * 1024, totalSize);
      setCurrentProgress(
        calculateProgress(requestId, bytesTransferred, totalSize, fileName)
      );
    }

    // Send completion
    const completeMessage = createFileComplete(requestId, fileData);
    sendMessage(completeMessage);
    console.log('File transfer complete');

    // Create transfer record
    const transfer = createFileTransfer(
      fileName,
      totalSize,
      pendingFileRequestRef.current.payload.mimeType,
      connectedDeviceRef.current,
      'send'
    );
    if (onTransferCompleteRef.current) {
      onTransferCompleteRef.current(transfer);
    }

    // Clear progress and pending state
    setCurrentProgress(null);
    pendingFileRequestRef.current = null;
    pendingFileDataRef.current = null;
  }, [sendMessage]);

  const sendFile = useCallback(async (fileUri: string, providedFileName?: string): Promise<boolean> => {
    if (!socketRef.current || !connectedDeviceRef.current) {
      console.log('sendFile: No socket or device');
      return false;
    }

    try {
      console.log('sendFile: Reading file from:', fileUri);

      // Get file info using react-native-fs stat
      let fileName = providedFileName || 'file';

      // If no filename provided, try to extract it
      if (!providedFileName) {
        // For content:// URIs, we need to get the actual file info
        if (fileUri.startsWith('content://')) {
          // Try to get stat info from the content URI
          try {
            const stat = await RNFS.stat(fileUri);
            fileName = stat.name || 'file';
            console.log('sendFile: stat result:', stat);
          } catch (statErr) {
            console.log('sendFile: stat failed, extracting name from URI');
            // Extract filename from URI as fallback
            const uriParts = decodeURIComponent(fileUri).split('/');
            const lastPart = uriParts[uriParts.length - 1];
            if (lastPart) {
              const nameParts = lastPart.split(':');
              fileName = nameParts[nameParts.length - 1] || lastPart;
              if (fileName.includes('%')) {
                fileName = decodeURIComponent(fileName);
              }
            }
          }
        } else {
          // Regular file path
          const parts = fileUri.split('/');
          fileName = parts[parts.length - 1] || 'file';
        }
      }

      console.log('sendFile: Using filename:', fileName);

      // Read file as base64 using react-native-fs
      console.log('sendFile: Reading file content...');
      const base64Content = await RNFS.readFile(fileUri, 'base64');

      // Convert base64 to Uint8Array using Buffer (available via polyfill)
      const fileData = new Uint8Array(Buffer.from(base64Content, 'base64'));

      console.log('sendFile: File read successfully, size:', fileData.length, 'name:', fileName);

      // Create file request
      const mimeType = 'application/octet-stream';
      const request = createFileRequest(fileName, fileData.length, mimeType, fileData);

      // Store for sending when accept is received
      pendingFileRequestRef.current = request;
      pendingFileDataRef.current = fileData;

      // Send file request
      sendMessage(request);
      console.log('sendFile: File request sent, waiting for accept');

      // Show initial progress
      setCurrentProgress(calculateProgress(request.id, 0, fileData.length, fileName));

      return true;
    } catch (err) {
      console.error('sendFile error:', err);
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
