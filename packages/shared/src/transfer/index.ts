import type {
  TextTransfer,
  FileTransfer,
  TransferProgress,
  TextMessage,
  FileRequestMessage,
  FileAcceptMessage,
  FileRejectMessage,
  FileChunkMessage,
  FileCompleteMessage,
  DeviceInfo,
} from '../types';
import {
  generateMessageId,
  encrypt,
  decrypt,
  calculateChecksum,
  verifyChecksum,
  encodeBase64,
  decodeBase64,
} from '../crypto';

// Constants
export const CHUNK_SIZE = 64 * 1024; // 64KB chunks
export const MAX_TEXT_LENGTH = 1024 * 1024; // 1MB max text

/**
 * Create a text transfer record
 */
export function createTextTransfer(
  content: string,
  device: DeviceInfo,
  direction: 'send' | 'receive'
): TextTransfer {
  return {
    id: generateMessageId(),
    type: 'text',
    timestamp: Date.now(),
    direction,
    deviceId: device.id,
    deviceName: device.name,
    content,
  };
}

/**
 * Create a file transfer record
 */
export function createFileTransfer(
  fileName: string,
  fileSize: number,
  mimeType: string,
  device: DeviceInfo,
  direction: 'send' | 'receive'
): FileTransfer {
  return {
    id: generateMessageId(),
    type: 'file',
    timestamp: Date.now(),
    direction,
    deviceId: device.id,
    deviceName: device.name,
    fileName,
    fileSize,
    mimeType,
  };
}

/**
 * Create a text message
 */
export function createTextMessage(content: string): TextMessage {
  return {
    type: 'text',
    id: generateMessageId(),
    timestamp: Date.now(),
    payload: {
      content,
    },
  };
}

/**
 * Create an encrypted text message
 */
export function createEncryptedTextMessage(
  content: string,
  secretKey: string
): { message: TextMessage; nonce: string } {
  const { encrypted, nonce } = encrypt(content, secretKey);
  return {
    message: createTextMessage(encrypted),
    nonce,
  };
}

/**
 * Decrypt a text message
 */
export function decryptTextMessage(
  message: TextMessage,
  nonce: string,
  secretKey: string
): string | null {
  const decrypted = decrypt(message.payload.content, nonce, secretKey);
  if (!decrypted) return null;
  return new TextDecoder().decode(decrypted);
}

/**
 * Create a file request message
 */
export function createFileRequest(
  fileName: string,
  fileSize: number,
  mimeType: string,
  fileData: Uint8Array
): FileRequestMessage {
  return {
    type: 'file_request',
    id: generateMessageId(),
    timestamp: Date.now(),
    payload: {
      fileName,
      fileSize,
      mimeType,
      checksum: calculateChecksum(fileData),
    },
  };
}

/**
 * Create a file accept message
 */
export function createFileAccept(requestId: string): FileAcceptMessage {
  return {
    type: 'file_accept',
    id: generateMessageId(),
    timestamp: Date.now(),
    payload: {
      requestId,
    },
  };
}

/**
 * Create a file reject message
 */
export function createFileReject(requestId: string, reason: string): FileRejectMessage {
  return {
    type: 'file_reject',
    id: generateMessageId(),
    timestamp: Date.now(),
    payload: {
      requestId,
      reason,
    },
  };
}

/**
 * Create a file chunk message
 */
export function createFileChunk(
  requestId: string,
  chunkIndex: number,
  totalChunks: number,
  data: Uint8Array
): FileChunkMessage {
  return {
    type: 'file_chunk',
    id: generateMessageId(),
    timestamp: Date.now(),
    payload: {
      requestId,
      chunkIndex,
      totalChunks,
      data: encodeBase64(data),
    },
  };
}

/**
 * Create a file complete message
 */
export function createFileComplete(requestId: string, fileData: Uint8Array): FileCompleteMessage {
  return {
    type: 'file_complete',
    id: generateMessageId(),
    timestamp: Date.now(),
    payload: {
      requestId,
      checksum: calculateChecksum(fileData),
    },
  };
}

/**
 * Split file data into chunks
 */
export function* chunkFile(
  data: Uint8Array,
  chunkSize: number = CHUNK_SIZE
): Generator<{ chunk: Uint8Array; index: number; total: number }> {
  const totalChunks = Math.ceil(data.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    yield {
      chunk: data.slice(start, end),
      index: i,
      total: totalChunks,
    };
  }
}

/**
 * Reassemble chunks into complete file data
 */
export function reassembleChunks(
  chunks: Map<number, Uint8Array>,
  totalChunks: number
): Uint8Array | null {
  // Verify all chunks are present
  if (chunks.size !== totalChunks) {
    return null;
  }

  // Calculate total size
  let totalSize = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i);
    if (!chunk) return null;
    totalSize += chunk.length;
  }

  // Reassemble
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i)!;
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Calculate transfer progress
 */
export function calculateProgress(
  transferId: string,
  bytesTransferred: number,
  totalBytes: number,
  currentFile?: string
): TransferProgress {
  return {
    transferId,
    bytesTransferred,
    totalBytes,
    percentage: totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0,
    currentFile,
  };
}

/**
 * Verify received file integrity
 */
export function verifyFileIntegrity(data: Uint8Array, expectedChecksum: string): boolean {
  return verifyChecksum(data, expectedChecksum);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

// Re-export for convenience
export { decodeBase64 };
