/*
 * Stands in for @coinbase/cdp-sdk (see next.config.ts).
 *
 * RainbowKit loads the Base Account connector, whose server build imports CdpClient for
 * server-side payment functions that Salda never calls. The real SDK pulls in optional
 * @x402 packages that are not installed, which breaks the build. Nothing here runs unless
 * one of those payment functions is called, and then it fails clearly.
 */
export class CdpClient {
  constructor() {
    throw new Error("Coinbase CDP payments are not available in Salda.");
  }
}
