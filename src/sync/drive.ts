// Zugriff auf Google Drive (über die normale Web-Schnittstelle von Google).
// Alles liegt im versteckten "App-Ordner" deines Drives: Du siehst ihn nicht zwischen deinen Dateien,
// und die App sieht umgekehrt nur diesen Ordner – nicht deine anderen Dateien.
// Jeder gespeicherte Eintrag der App = eine Datei mit dem Schlüssel als Namen.

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export type RemoteFile = { id: string; name: string; modifiedAt: string };

export class DriveAuthError extends Error {}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new DriveAuthError("Anmeldung abgelaufen");
  if (!response.ok) throw new Error(`Google Drive: ${response.status} ${await response.text().catch(() => "")}`);
  return response;
}

// Alle Dateien im App-Ordner (bei gleichem Namen zählt die neueste).
export async function listFiles(token: string): Promise<Map<string, RemoteFile>> {
  const files = new Map<string, RemoteFile>();
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      fields: "nextPageToken,files(id,name,appProperties)",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await (await call(token, `${API}/files?${params}`)).json();
    for (const file of data.files ?? []) {
      const modifiedAt = file.appProperties?.modifiedAt ?? "0";
      const existing = files.get(file.name);
      if (!existing || Number(modifiedAt) > Number(existing.modifiedAt)) {
        files.set(file.name, { id: file.id, name: file.name, modifiedAt });
      }
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return files;
}

export async function downloadFile(token: string, file: RemoteFile, asBlob: boolean): Promise<unknown> {
  const response = await call(token, `${API}/files/${file.id}?alt=media`);
  if (asBlob) return response.blob();
  return (await response.json()).value;
}

// Neue Datei anlegen (existing = undefined) oder vorhandene überschreiben.
export async function uploadFile(
  token: string,
  name: string,
  value: unknown,
  modifiedAt: string,
  existing?: RemoteFile,
): Promise<RemoteFile> {
  const isBlob = value instanceof Blob;
  const metadata: Record<string, unknown> = { appProperties: { modifiedAt } };
  if (!existing) Object.assign(metadata, { name, parents: ["appDataFolder"] });
  const boundary = `home-${crypto.randomUUID()}`;
  const content = isBlob ? value : JSON.stringify({ value });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${isBlob ? value.type || "application/octet-stream" : "application/json"}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ]);
  const url = existing
    ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&fields=id,name`
    : `${UPLOAD}/files?uploadType=multipart&fields=id,name`;
  const data = await (
    await call(token, url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    })
  ).json();
  return { id: data.id, name, modifiedAt };
}

export async function deleteFile(token: string, file: RemoteFile): Promise<void> {
  await call(token, `${API}/files/${file.id}`, { method: "DELETE" }).catch((error) => {
    if (!String(error).includes("404")) throw error; // schon weg = auch gut
  });
}
