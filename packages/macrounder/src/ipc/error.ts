import { IPCErrorCode } from "./types";

export class IPCError extends Error {
  code: IPCErrorCode;

  constructor(code: IPCErrorCode, message: string) {
    super(message);
    this.name = "IPCError";
    this.code = code;
  }
}
