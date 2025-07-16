import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from "./types";

// Message framing constants
const FRAME_DELIMITER = "\n";
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Frame a JSON-RPC message for transmission over socket
 * Uses newline-delimited JSON (NDJSON) format
 */
export function frameMessage(
  message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
): Buffer {
  const json = JSON.stringify(message);

  if (json.length > MAX_MESSAGE_SIZE) {
    throw new Error(
      `Message too large: ${json.length} bytes (max: ${MAX_MESSAGE_SIZE})`,
    );
  }

  return Buffer.from(json + FRAME_DELIMITER);
}

/**
 * Parse framed messages from a buffer
 * Returns array of parsed messages and remaining buffer
 */
export function parseFramedMessages(buffer: Buffer): {
  messages: (JsonRpcRequest | JsonRpcResponse | JsonRpcNotification)[];
  remaining: Buffer;
} {
  const messages: (JsonRpcRequest | JsonRpcResponse | JsonRpcNotification)[] =
    [];
  let remaining = buffer;

  while (true) {
    const delimiterIndex = remaining.indexOf(FRAME_DELIMITER);

    if (delimiterIndex === -1) {
      // No complete message in buffer
      break;
    }

    const messageBuffer = remaining.subarray(0, delimiterIndex);

    if (messageBuffer.length === 0) {
      // Empty message, skip
      remaining = remaining.subarray(delimiterIndex + 1);
      continue;
    }

    try {
      const messageStr = messageBuffer.toString("utf8");
      const message = JSON.parse(messageStr);
      messages.push(message);
    } catch (error) {
      // Invalid JSON, skip this message
      console.error("Failed to parse IPC message:", error);
    }

    remaining = remaining.subarray(delimiterIndex + 1);
  }

  // Check if remaining buffer is too large
  if (remaining.length > MAX_MESSAGE_SIZE) {
    // Buffer overflow protection
    return { messages, remaining: Buffer.alloc(0) };
  }

  return { messages, remaining };
}

/**
 * Create a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a message is a request
 */
export function isRequest(
  message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
): message is JsonRpcRequest {
  return (
    "id" in message &&
    "method" in message &&
    !("result" in message || "error" in message)
  );
}

/**
 * Check if a message is a response
 */
export function isResponse(
  message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
): message is JsonRpcResponse {
  return "id" in message && ("result" in message || "error" in message);
}

/**
 * Check if a message is a notification
 */
export function isNotification(
  message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

/**
 * Create an error response
 */
export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
      data,
    },
    id,
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse(
  id: string | number,
  result: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    result,
    id,
  };
}

/**
 * Create a notification
 */
export function createNotification(
  method: string,
  params?: unknown,
): JsonRpcNotification {
  return {
    jsonrpc: "2.0",
    method,
    params,
  };
}
