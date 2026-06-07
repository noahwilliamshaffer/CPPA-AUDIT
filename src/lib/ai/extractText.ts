/**
 * extractText — parses uploaded documents into plain text.
 *
 * All heavy parsers are dynamically imported to avoid module-init
 * crashes on Windows Node.js 20 during Turbopack build workers.
 *
 * Text is capped at MAX_CHARS per document to stay within Claude's
 * 200K-token context window when multiple documents are uploaded.
 */

import { readFile } from 'fs/promises';

const MAX_CHARS = 100_000;

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'md';

export async function extractText(
  filePath: string,
  fileType: SupportedFileType
): Promise<string> {
  let text: string;

  switch (fileType) {
    case 'pdf': {
      const { PDFParse } = await import('pdf-parse');
      const buffer = await readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
      break;
    }

    case 'docx': {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
      break;
    }

    case 'txt':
    case 'md': {
      text = await readFile(filePath, 'utf-8');
      break;
    }

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + '\n\n[Document truncated at 100,000 characters for analysis]';
  }

  return text.trim();
}

/**
 * extractTextFromBuffer — same as extractText, but operates entirely in memory
 * (no filesystem). Used by the ADD-17 autofill upload route, where documents are
 * processed in-memory and discarded — never written to disk.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<string> {
  let text: string;

  switch (fileType) {
    case 'pdf': {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
      break;
    }

    case 'docx': {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }

    case 'txt':
    case 'md': {
      text = buffer.toString('utf-8');
      break;
    }

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + '\n\n[Document truncated at 100,000 characters for analysis]';
  }

  return text.trim();
}
