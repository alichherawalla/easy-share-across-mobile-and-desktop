import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import type {
  DeviceInfo,
  PairedDevice,
  ConnectionState,
  Message,
  Transfer,
  TransferProgress,
  TextMessage,
  FileRequestMessage,
  FileChunkMessage,
  FileCompleteMessage,
} from '@easyshare/shared';
import {
  MessageBuffer,
  serializeMessage,
  deserializeMessage,
  getMessageLength,
  createPingMessage,
  createPongMessage,
  createTextMessage,
  createFileRequest,
  createFileAccept,
  createFileChunk,
  createFileComplete,
  createTextTransfer,
  createFileTransfer,
  calculateProgress,
  chunkFile,
  reassembleChunks,
  verifyFileIntegrity,
  decodeBase64,
  createPairRequest,
  createPairingState,
  handlePairingMessage,
  createPairedDevice,
  getPairedDevice,
} from '@easyshare/shared';
import type { StorageService } from './storage';

export class ConnectionManager {
  private server: net.Server | null = null;
  private socket: net.Socket | null = null;
  private messageBuffer: MessageBuffer = new MessageBuffer();
  private connectionState: ConnectionState = { status: 'disconnected' };
  private connectedDevice: DeviceInfo | null = null;
  private currentPairingState: ReturnType<typeof createPairingState> | null = null;
  private pendingPassphrase: string | null = null;
  private localDevice: DeviceInfo | null = null;
  private storageService: StorageService;

  // File transfer state
  private pendingFileRequest: FileRequestMessage | null = null;
  private pendingFilePath: string | null = null;
  private receivingChunks: Map<number, Uint8Array> = new Map();
  private receivingFileInfo: { fileName: string; totalChunks: number; checksum: string } | null = null;

  // Callbacks
  private onConnectionStateChangeCallback?: (state: ConnectionState) => void;
  private onTransferProgressCallback?: (progress: TransferProgress) => void;
  private onTransferCompleteCallback?: (transfer: Transfer) => void;
  private onTextReceivedCallback?: (text: string, device: DeviceInfo) => void;
  private onPairingRequestCallback?: (device: DeviceInfo) => void;

  // Store pending pairing message when waiting for user passphrase
  private pendingPairingMessage: Message | null = null;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  async start(): Promise<void> {
    const settings = this.storageService.getSettings();

    this.localDevice = {
      id: settings.deviceId,
      name: settings.deviceName,
      platform: 'macos',
      version: '1.0.0',
      host: '',
      port: 0,
    };

    // Create TCP server
    this.server = net.createServer((socket) => {
      this.handleIncomingConnection(socket);
    });

    // Listen on random available port
    await new Promise<void>((resolve) => {
      this.server!.listen(0, () => {
        const address = this.server!.address() as net.AddressInfo;
        this.localDevice!.port = address.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.disconnect();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getServerInfo(): DeviceInfo {
    return this.localDevice!;
  }

  async connectToDevice(device: DeviceInfo): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        this.connectedDevice = device;
        this.updateConnectionState({ status: 'connected', device });
        this.setupSocketHandlers();
        resolve(true);
      });

      this.socket.on('error', (err) => {
        console.error('Connection error:', err);
        this.updateConnectionState({ status: 'disconnected', error: err.message });
        resolve(false);
      });

      this.socket.connect(device.port, device.host);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connectedDevice = null;
    this.currentPairingState = null;
    this.pendingPassphrase = null;
    this.updateConnectionState({ status: 'disconnected' });
  }

  async startPairing(deviceId: string, passphrase: string): Promise<boolean> {
    if (!this.socket || !this.localDevice) {
      return false;
    }

    this.pendingPassphrase = passphrase;
    this.currentPairingState = createPairingState(this.localDevice);
    this.currentPairingState.passphrase = passphrase;
    this.currentPairingState.remoteDevice = this.connectedDevice!;

    this.updateConnectionState({ status: 'pairing' });

    // Send pair request
    const request = createPairRequest(this.localDevice);
    this.sendMessage(request);

    return true;
  }

  async sendText(text: string): Promise<boolean> {
    console.log('sendText called, socket:', !!this.socket, 'device:', !!this.connectedDevice);
    if (!this.socket || !this.connectedDevice) {
      console.log('sendText: No socket or device');
      return false;
    }

    const message = createTextMessage(text);
    this.sendMessage(message);
    console.log('sendText: Message sent');

    // Create transfer record
    const transfer = createTextTransfer(text, this.connectedDevice, 'send');
    console.log('sendText: Transfer created', transfer.id);
    if (this.onTransferCompleteCallback) {
      console.log('sendText: Calling onTransferComplete callback');
      this.onTransferCompleteCallback(transfer);
    } else {
      console.log('sendText: No onTransferComplete callback!');
    }

    return true;
  }

  async sendFile(filePath: string): Promise<boolean> {
    if (!this.socket || !this.connectedDevice) {
      return false;
    }

    try {
      const fileData = await fs.promises.readFile(filePath);
      const fileName = path.basename(filePath);
      const stats = await fs.promises.stat(filePath);
      const mimeType = 'application/octet-stream'; // Could be improved with mime type detection

      // Send file request
      const request = createFileRequest(fileName, stats.size, mimeType, fileData);
      this.sendMessage(request);

      // Wait for accept, then send chunks - store both request and full path
      this.pendingFileRequest = request;
      this.pendingFilePath = filePath;

      return true;
    } catch (err) {
      console.error('Failed to read file:', err);
      return false;
    }
  }

  // Callbacks
  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChangeCallback = callback;
  }

  onTransferProgress(callback: (progress: TransferProgress) => void): void {
    this.onTransferProgressCallback = callback;
  }

  onTransferComplete(callback: (transfer: Transfer) => void): void {
    this.onTransferCompleteCallback = callback;
  }

  onTextReceived(callback: (text: string, device: DeviceInfo) => void): void {
    this.onTextReceivedCallback = callback;
  }

  onPairingRequest(callback: (device: DeviceInfo) => void): void {
    this.onPairingRequestCallback = callback;
  }

  respondToPairing(passphrase: string): void {
    this.pendingPassphrase = passphrase;

    // Process the pending pairing message now that we have the passphrase
    if (this.pendingPairingMessage) {
      const message = this.pendingPairingMessage;
      this.pendingPairingMessage = null;
      this.handlePairingMessage(message);
    }
  }

  // Private methods
  private handleIncomingConnection(socket: net.Socket): void {
    // If we already have a connection, reject
    if (this.socket) {
      socket.destroy();
      return;
    }

    this.socket = socket;
    this.updateConnectionState({ status: 'connecting' });
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('data', (data) => {
      this.messageBuffer.append(new Uint8Array(data));
      this.processMessages();
    });

    this.socket.on('close', () => {
      this.disconnect();
    });

    this.socket.on('error', (err) => {
      console.error('Socket error:', err);
      this.disconnect();
    });
  }

  private processMessages(): void {
    const messages = this.messageBuffer.extractAllMessages();
    for (const message of messages) {
      this.handleMessage(message);
    }
  }

  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'ping':
        this.sendMessage(createPongMessage(message.id));
        break;

      case 'pair_request':
      case 'pair_challenge':
      case 'pair_response':
      case 'pair_confirm':
      case 'pair_reject':
        this.handlePairingMessage(message);
        break;

      case 'text':
        this.handleTextMessage(message as TextMessage);
        break;

      case 'file_request':
        this.handleFileRequest(message as FileRequestMessage);
        break;

      case 'file_accept':
        this.handleFileAccept();
        break;

      case 'file_chunk':
        this.handleFileChunk(message as FileChunkMessage);
        break;

      case 'file_complete':
        this.handleFileComplete(message as FileCompleteMessage);
        break;
    }
  }

  private handlePairingMessage(message: Message): void {
    if (!this.currentPairingState || !this.localDevice) {
      // Create new pairing state for incoming request
      this.currentPairingState = createPairingState(this.localDevice!);
    }

    // If this is an incoming pair_request and we don't have a passphrase yet,
    // store the message and notify the UI to get the passphrase from user
    if (message.type === 'pair_request' && !this.pendingPassphrase) {
      console.log('Received pair_request, waiting for user passphrase');
      this.pendingPairingMessage = message;

      // Extract remote device info from the message and notify UI
      const remoteDevice = (message as any).payload?.deviceInfo as DeviceInfo | undefined;
      if (remoteDevice) {
        this.connectedDevice = remoteDevice;
        this.updateConnectionState({ status: 'pairing', device: remoteDevice });
        if (this.onPairingRequestCallback) {
          this.onPairingRequestCallback(remoteDevice);
        }
      }
      return;
    }

    const { newState, response } = handlePairingMessage(
      this.currentPairingState,
      message,
      this.pendingPassphrase || undefined
    );

    this.currentPairingState = newState;

    if (response) {
      this.sendMessage(response);
    }

    if (newState.status === 'success') {
      // Pairing successful - save paired device
      const pairedDevice = createPairedDevice(newState);
      if (pairedDevice) {
        this.storageService.addPairedDevice(pairedDevice);
        this.connectedDevice = newState.remoteDevice!;
        this.updateConnectionState({ status: 'connected', device: this.connectedDevice });
      }
    } else if (newState.status === 'failed') {
      this.updateConnectionState({ status: 'disconnected', error: newState.error });
    } else if (newState.status === 'waiting') {
      // Need passphrase from user - update UI
      this.connectedDevice = newState.remoteDevice!;
      this.updateConnectionState({ status: 'pairing', device: this.connectedDevice });
    }
  }

  private handleTextMessage(message: TextMessage): void {
    if (!this.connectedDevice) return;

    const text = message.payload.content;

    // Create transfer record
    const transfer = createTextTransfer(text, this.connectedDevice, 'receive');
    if (this.onTransferCompleteCallback) {
      this.onTransferCompleteCallback(transfer);
    }

    if (this.onTextReceivedCallback) {
      this.onTextReceivedCallback(text, this.connectedDevice);
    }
  }

  private handleFileRequest(message: FileRequestMessage): void {
    if (!this.connectedDevice) return;

    // Auto-accept files from paired devices (configurable)
    const settings = this.storageService.getSettings();
    const isPaired = getPairedDevice(this.connectedDevice.id, this.storageService.getPairedDevices());

    if (settings.autoAcceptFromPaired && isPaired) {
      this.receivingFileInfo = {
        fileName: message.payload.fileName,
        totalChunks: Math.ceil(message.payload.fileSize / (64 * 1024)),
        checksum: message.payload.checksum,
      };
      this.receivingChunks.clear();
      this.sendMessage(createFileAccept(message.id));
    } else {
      // For now, auto-accept all - in real app would prompt user
      this.receivingFileInfo = {
        fileName: message.payload.fileName,
        totalChunks: Math.ceil(message.payload.fileSize / (64 * 1024)),
        checksum: message.payload.checksum,
      };
      this.receivingChunks.clear();
      this.sendMessage(createFileAccept(message.id));
    }
  }

  private async handleFileAccept(): Promise<void> {
    if (!this.pendingFileRequest || !this.connectedDevice || !this.pendingFilePath) return;

    try {
      const fileData = await fs.promises.readFile(this.pendingFilePath);

      let bytesTransferred = 0;
      const totalBytes = fileData.length;

      for (const { chunk, index, total } of chunkFile(fileData)) {
        const chunkMessage = createFileChunk(this.pendingFileRequest.id, index, total, chunk);
        this.sendMessage(chunkMessage);

        bytesTransferred += chunk.length;
        if (this.onTransferProgressCallback) {
          this.onTransferProgressCallback(
            calculateProgress(this.pendingFileRequest.id, bytesTransferred, totalBytes)
          );
        }
      }

      // Send completion
      const completeMessage = createFileComplete(this.pendingFileRequest.id, fileData);
      this.sendMessage(completeMessage);

      // Create transfer record
      const transfer = createFileTransfer(
        this.pendingFileRequest.payload.fileName,
        totalBytes,
        this.pendingFileRequest.payload.mimeType,
        this.connectedDevice,
        'send'
      );
      if (this.onTransferCompleteCallback) {
        this.onTransferCompleteCallback(transfer);
      }

      // Clear progress
      if (this.onTransferProgressCallback) {
        this.onTransferProgressCallback(null as any);
      }

      this.pendingFileRequest = null;
      this.pendingFilePath = null;
    } catch (err) {
      console.error('Failed to send file:', err);
      this.pendingFileRequest = null;
      this.pendingFilePath = null;
    }
  }

  private handleFileChunk(message: FileChunkMessage): void {
    const chunkData = decodeBase64(message.payload.data);
    this.receivingChunks.set(message.payload.chunkIndex, chunkData);

    // Report progress
    if (this.onTransferProgressCallback && this.receivingFileInfo) {
      const bytesReceived = Array.from(this.receivingChunks.values()).reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      this.onTransferProgressCallback(
        calculateProgress(
          message.payload.requestId,
          this.receivingChunks.size,
          message.payload.totalChunks,
          this.receivingFileInfo.fileName
        )
      );
    }
  }

  private async handleFileComplete(message: FileCompleteMessage): Promise<void> {
    if (!this.receivingFileInfo || !this.connectedDevice) return;

    const totalChunks = this.receivingFileInfo.totalChunks;
    const fileData = reassembleChunks(this.receivingChunks, totalChunks);

    if (!fileData) {
      console.error('Failed to reassemble file - missing chunks');
      return;
    }

    // Verify integrity
    if (!verifyFileIntegrity(fileData, message.payload.checksum)) {
      console.error('File integrity check failed');
      return;
    }

    // Save file
    const settings = this.storageService.getSettings();
    const savePath = path.join(settings.saveDirectory, this.receivingFileInfo.fileName);

    try {
      await fs.promises.writeFile(savePath, Buffer.from(fileData));

      // Create transfer record
      const transfer = createFileTransfer(
        this.receivingFileInfo.fileName,
        fileData.length,
        'application/octet-stream',
        this.connectedDevice,
        'receive'
      );
      (transfer as any).filePath = savePath;

      if (this.onTransferCompleteCallback) {
        this.onTransferCompleteCallback(transfer);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }

    // Clean up
    this.receivingChunks.clear();
    this.receivingFileInfo = null;
  }

  private sendMessage(message: Message): void {
    if (!this.socket) return;

    const buffer = serializeMessage(message);
    this.socket.write(Buffer.from(buffer));
  }

  private updateConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    if (this.onConnectionStateChangeCallback) {
      this.onConnectionStateChangeCallback(state);
    }
  }
}
