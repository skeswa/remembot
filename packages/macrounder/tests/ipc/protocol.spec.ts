import { describe, test, expect } from "bun:test";
import {
  frameMessage,
  parseFramedMessages,
  generateRequestId,
  isRequest,
  isResponse,
  isNotification,
  createErrorResponse,
  createSuccessResponse,
  createNotification,
} from "../../src/ipc/framing";
import {
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcNotificationSchema,
  IPCMethod,
  IPCErrorCode,
} from "../../src/ipc/types";

describe("IPC Protocol", () => {
  describe("Message Framing", () => {
    test("should frame a JSON-RPC request", () => {
      const request = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.Ping,
        id: "test-123",
      };

      const framed = frameMessage(request);
      expect(framed.toString()).toBe(JSON.stringify(request) + "\n");
    });

    test("should parse framed messages", () => {
      const request1 = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.Ping,
        id: "test-1",
      };
      const request2 = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.GetVersion,
        id: "test-2",
      };

      const buffer = Buffer.concat([
        frameMessage(request1),
        frameMessage(request2),
      ]);

      const { messages, remaining } = parseFramedMessages(buffer);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(request1);
      expect(messages[1]).toEqual(request2);
      expect(remaining.length).toBe(0);
    });

    test("should handle partial messages", () => {
      const request = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.Ping,
        id: "test-123",
      };

      const framed = frameMessage(request);
      const partial = framed.subarray(0, framed.length - 5);

      const { messages, remaining } = parseFramedMessages(partial);
      expect(messages).toHaveLength(0);
      expect(remaining.length).toBe(partial.length);
    });

    test("should reject oversized messages", () => {
      const hugeMessage = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.Ping,
        params: { data: "x".repeat(11 * 1024 * 1024) }, // 11MB
        id: "test-123",
      };

      expect(() => frameMessage(hugeMessage)).toThrow("Message too large");
    });
  });

  describe("Message Type Detection", () => {
    test("should identify request messages", () => {
      const request = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.Ping,
        id: "test-123",
      };

      expect(isRequest(request)).toBe(true);
      expect(isResponse(request)).toBe(false);
      expect(isNotification(request)).toBe(false);
    });

    test("should identify response messages", () => {
      const response = {
        jsonrpc: "2.0" as const,
        result: { pong: true },
        id: "test-123",
      };

      expect(isRequest(response)).toBe(false);
      expect(isResponse(response)).toBe(true);
      expect(isNotification(response)).toBe(false);
    });

    test("should identify notification messages", () => {
      const notification = {
        jsonrpc: "2.0" as const,
        method: IPCMethod.Ping,
      };

      expect(isRequest(notification)).toBe(false);
      expect(isResponse(notification)).toBe(false);
      expect(isNotification(notification)).toBe(true);
    });
  });

  describe("Message Creation", () => {
    test("should create error response", () => {
      const response = createErrorResponse(
        "test-123",
        IPCErrorCode.ServiceNotFound,
        "Service not found",
        { service: "test" },
      );

      expect(response).toEqual({
        jsonrpc: "2.0",
        error: {
          code: IPCErrorCode.ServiceNotFound,
          message: "Service not found",
          data: { service: "test" },
        },
        id: "test-123",
      });
    });

    test("should create success response", () => {
      const response = createSuccessResponse("test-123", { success: true });

      expect(response).toEqual({
        jsonrpc: "2.0",
        result: { success: true },
        id: "test-123",
      });
    });

    test("should create notification", () => {
      const notification = createNotification(IPCMethod.Ping, { data: "test" });

      expect(notification).toEqual({
        jsonrpc: "2.0",
        method: IPCMethod.Ping,
        params: { data: "test" },
      });
    });
  });

  describe("Request ID Generation", () => {
    test("should generate unique request IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateRequestId());
      }

      expect(ids.size).toBe(1000); // All IDs should be unique
    });

    test("should generate valid request IDs", () => {
      const id = generateRequestId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(10);
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe("Schema Validation", () => {
    test("should validate JSON-RPC request", () => {
      const validRequest = {
        jsonrpc: "2.0",
        method: IPCMethod.Ping,
        id: "test-123",
      };

      const result = JsonRpcRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    test("should reject invalid JSON-RPC request", () => {
      const invalidRequest = {
        jsonrpc: "1.0", // Wrong version
        method: IPCMethod.Ping,
        id: "test-123",
      };

      const result = JsonRpcRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    test("should validate JSON-RPC response", () => {
      const validResponse = {
        jsonrpc: "2.0",
        result: { success: true },
        id: "test-123",
      };

      const result = JsonRpcResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    test("should validate JSON-RPC notification", () => {
      const validNotification = {
        jsonrpc: "2.0",
        method: IPCMethod.Ping,
      };

      const result = JsonRpcNotificationSchema.safeParse(validNotification);
      expect(result.success).toBe(true);
    });
  });
});
