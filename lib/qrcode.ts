import { renderSVG } from "uqr";

/**
 * Generates a QR code as an inline SVG markup string encoding the given URL.
 * Runs fully locally (no third-party service call) — the URL never leaves
 * our own server.
 */
export function generateQrCodeSvg(url: string): string {
  return renderSVG(url, { border: 2 });
}
