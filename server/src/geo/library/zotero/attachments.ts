import { MAX_ATTACHMENT_BYTES } from "./client.ts";
import { libraryPath, itemKey, ZoteroError, type ZoteroClient, type ZoteroItemRef } from "./types.ts";

export interface ZoteroFullText {
  content: string;
  indexedPages?: number;
  totalPages?: number;
  indexedChars?: number;
  totalChars?: number;
}

async function attachmentPath(client: ZoteroClient, ref: ZoteroItemRef): Promise<string> {
  if (ref.connection !== client.connection) throw new ZoteroError("unreachable", "wrong-item-partition");
  if (client.connection === "local") {
    if (!client.serverId) await client.read(`${libraryPath(ref)}/items`, { discover: true, query: { limit: 1 } });
    if (client.serverId !== ref.serverId) throw new ZoteroError("unreachable", "wrong-item-partition");
  }
  return `${libraryPath(ref)}/items/${itemKey(ref.itemKey)}`;
}

export async function getAttachmentFullText(client: ZoteroClient, ref: ZoteroItemRef): Promise<ZoteroFullText> {
  const { data } = await client.read<ZoteroFullText>(`${await attachmentPath(client, ref)}/fulltext`);
  if (typeof data.content !== "string") throw new ZoteroError("unreachable", "invalid-fulltext");
  return data;
}

export async function getAttachmentFile(client: ZoteroClient, ref: ZoteroItemRef, maxBytes = MAX_ATTACHMENT_BYTES): Promise<Buffer> {
  return client.download(`${await attachmentPath(client, ref)}/file`, maxBytes);
}

export function selectItemLink(ref: Pick<ZoteroItemRef, "libraryType" | "libraryId" | "itemKey">): string {
  libraryPath(ref);
  return `zotero://select/${ref.libraryType === "group" ? `groups/${ref.libraryId}` : "library"}/items/${itemKey(ref.itemKey)}`;
}

export function openPdfLink(ref: Pick<ZoteroItemRef, "libraryType" | "libraryId">, attachmentKey: string, page = 1): string {
  libraryPath(ref);
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("PDF page must be a positive integer");
  return `zotero://open-pdf/${ref.libraryType === "group" ? `groups/${ref.libraryId}` : "library"}/items/${itemKey(attachmentKey)}?page=${page}`;
}
