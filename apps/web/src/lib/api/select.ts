import { DATA_MODE } from "../config";
import { fixtureTransport } from "../fixture/transport";
import { httpTransport } from "./http";
import type { Transport } from "./transport";

/**
 * Transport selection. The FIXTURE transport exists only for the P02 frontend
 * preview (labeled in the UI) and is removed when the API integration closes (P04).
 */
export function getTransport(): Transport {
  return DATA_MODE === "api" ? httpTransport : fixtureTransport;
}
