import { describe, expect, it } from "vitest";
import { generateQrCodeSvg } from "./qrcode";

describe("generateQrCodeSvg", () => {
  it("returns SVG markup", () => {
    const svg = generateQrCodeSvg("https://example.com/session/abc-123");
    expect(svg.trim().startsWith("<svg")).toBe(true);
  });

  it("produces different output for different URLs", () => {
    const a = generateQrCodeSvg("https://example.com/session/aaa");
    const b = generateQrCodeSvg("https://example.com/session/bbb");
    expect(a).not.toEqual(b);
  });
});
