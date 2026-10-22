import { MAX_ATTACHMENT_BYTES } from "./client.ts";
import { createHash } from "node:crypto";
import { libraryPath, itemKey, ZoteroError, type ZoteroClient, type ZoteroItemRef, type ZoteroLibrary, type ZoteroFullTextInput } from "./types.ts";
import { conflict } from "./writes.ts";

export interface ZoteroFullText {
  content: string;
  indexedPages?: number;
  totalPages?: number;
  indexedChars?: number;
  totalChars?: number;
}

async function attachmentPath(client: ZoteroClient, ref: ZoteroItemRef): Promise<string> {
  if (ref.connection !== client.connection) throw new ZoteroError("failed", "wrong-item-partition");
  if (client.connection === "local") {
    if (!client.serverId) await client.read(`${libraryPath(ref)}/items`, { discover: true, query: { limit: 1 } });
    if (client.serverId !== ref.serverId) throw new ZoteroError("failed", "wrong-item-partition");
  }
  return `${libraryPath(ref)}/items/${itemKey(ref.itemKey)}`;
}

export async function getAttachmentFullText(client: ZoteroClient, ref: ZoteroItemRef): Promise<ZoteroFullText> {
  const { data } = await client.read<ZoteroFullText>(`${await attachmentPath(client, ref)}/fulltext`);
  if (typeof data.content !== "string") throw new ZoteroError("failed", "invalid-fulltext");
  return data;
}

export async function getAttachmentFile(client: ZoteroClient, ref: ZoteroItemRef, maxBytes = MAX_ATTACHMENT_BYTES): Promise<Buffer> {
  return client.download(`${await attachmentPath(client, ref)}/file`, maxBytes);
}

/** Explicit upload only. A partial failure is surfaced at its step; never reauthorizes or deletes the child. */
export async function uploadAttachment(client: ZoteroClient, library: ZoteroLibrary, parentKey: string, input: {
  bytes: Uint8Array; filename: string; contentType: string; title?: string; fullText?: ZoteroFullTextInput;
}): Promise<{ attachmentKey: string; uploaded: boolean; indexedChars?: number }> {
  const path = `${libraryPath(library)}/items`;
  itemKey(parentKey);
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new ZoteroError("failed", "upload-too-large");
  if (!input.filename || /[/\\\x00-\x1f]/.test(input.filename) || !input.contentType || /[\r\n]/.test(input.contentType)) throw new Error("Invalid attachment metadata");
  const fullText = input.contentType === "application/pdf" ? input.fullText : undefined;
  if (fullText && (typeof fullText.content !== "string" || !Number.isSafeInteger(fullText.indexedPages) || fullText.indexedPages < 0 || !Number.isSafeInteger(fullText.totalPages) || fullText.totalPages < fullText.indexedPages)) throw new Error("Invalid PDF full text");
  const bytes = Buffer.from(input.bytes);
  const snapshot = await client.read(path, { query: { limit: 1 } });
  if (snapshot.version === undefined) throw new ZoteroError("failed", "missing-library-version");
  const created = await conflict(client, path, () => client.create(library, "items", [{
    itemType: "attachment", linkMode: "imported_file", parentItem: parentKey,
    contentType: input.contentType, filename: input.filename, title: input.title ?? input.filename, tags: [], relations: {},
  }], snapshot.version!));
  const attachmentKey = itemKey(created.data[0]);
  const attachmentPath = `${path}/${attachmentKey}`;
  const auth = await conflict(client, attachmentPath, () => client.authorizeUpload(library, attachmentKey, {
    md5: createHash("md5").update(bytes).digest("hex"), filename: input.filename, filesize: String(bytes.length), mtime: String(Date.now()),
  }));
  const uploaded = !("exists" in auth);
  if (uploaded && "url" in auth) {
    if (Buffer.byteLength(auth.prefix) + Buffer.byteLength(auth.suffix) > 1024 * 1024) throw new ZoteroError("failed", "upload-too-large");
    await client.uploadFile(auth.url, auth.contentType, Buffer.concat([Buffer.from(auth.prefix), bytes, Buffer.from(auth.suffix)]));
    await conflict(client, attachmentPath, () => client.registerUpload(library, attachmentKey, auth.uploadKey));
  }
  if (fullText) await conflict(client, attachmentPath, () => client.putFullText(library, attachmentKey, fullText));
  return { attachmentKey, uploaded, ...(fullText ? { indexedChars: fullText.content.length } : {}) };
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
