// crypto.ts - AES-256-GCM encrypt/decrypt for system_settings
export async function getKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string, base64Key: string): Promise<{ encrypted: string; iv: string }> {
  const key = await getKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decrypt(encrypted: string, iv: string, base64Key: string): Promise<string> {
  const key = await getKey(base64Key);
  const cipherBuf = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivBuf = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}
