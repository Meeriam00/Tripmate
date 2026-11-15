import { isTrip } from "./storage";
import type { Trip } from "./types";

/**
 * Shareable links without a server: the whole trip is compressed and placed
 * in the URL fragment (#/import/…). Fragments never reach a server, so the
 * data is only visible to people who have the link. Opening it lets the
 * recipient add a copy to their own browser.
 */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== "undefined";

export async function encodeTrip(trip: Trip): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(trip));
  if (canCompress()) return "z" + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
  return "j" + toBase64Url(json);
}

export async function decodeTrip(payload: string): Promise<Trip> {
  const kind = payload[0];
  const bytes = fromBase64Url(payload.slice(1));
  const raw = kind === "z" ? await pipe(bytes, new DecompressionStream("deflate-raw")) : bytes;
  const trip = JSON.parse(new TextDecoder().decode(raw));
  if (!isTrip(trip)) throw new Error("This link doesn't contain a valid trip.");
  return trip;
}

export async function shareUrl(trip: Trip): Promise<string> {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/import/${await encodeTrip(trip)}`;
}
