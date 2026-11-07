// Kennung der App bei Google ("OAuth-Client-ID"). Sie ist nicht geheim – sie sagt Google nur,
// welche App sich anmelden möchte, und funktioniert nur von der eigenen Web-Adresse aus.
// Leer = Sync ist noch nicht eingerichtet.
export const GOOGLE_CLIENT_ID = "";

// Solange die Kennung oben noch nicht eingetragen ist, kann sie in den Einstellungen gesetzt werden
// (wird dann nur auf diesem Gerät gemerkt).
export function clientId(): string {
  if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
  try {
    return localStorage.getItem("sync:clientId") ?? "";
  } catch {
    return "";
  }
}
