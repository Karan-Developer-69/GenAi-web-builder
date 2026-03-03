/* ───────────────── TAG PARSING (XML-LIKE) ───────────────── */

/**
 * Robustly extract content from a tag, handling unclosed or nested (simple) tags.
 */
export function parseTag(content: string, tagName: string): string | null {
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;

  const startIdx = content.indexOf(openTag);
  if (startIdx === -1) return null;

  const contentStart = startIdx + openTag.length;
  let endIdx = content.indexOf(closeTag, contentStart);

  // If no closing tag, take everything to the end
  if (endIdx === -1) {
    return content.slice(contentStart).trim();
  }

  return content.slice(contentStart, endIdx).trim();
}

/**
 * Extracts multiple file blocks from content formatted as:
 * <files>
 *   <file path="path/to/file">content</file>
 * </files>
 */
export function parseFilesFromTags(content: string): { path: string; content: string }[] {
  const filesBlock = parseTag(content, 'files') || content;
  const result: { path: string; content: string }[] = [];

  // Match <file path="name">content</file>
  // Non-greedy [\s\S]*? for content, but allow unclosed final tag
  const fileRegex = /<file\s+path="([^"]+)"\s*>([\s\S]*?)(?:<\/file>|$)/g;
  let match;

  while ((match = fileRegex.exec(filesBlock)) !== null) {
    const path = match[1];
    let fileContent = match[2].trim();

    // Remove trailing whitespace and potentially unclosed tags
    fileContent = fileContent.replace(/<\/file>$/, '').trim();

    result.push({ path, content: fileContent });
  }

  return result;
}

/**
 * Extracts theme and tasks from content formatted with tags.
 */

export interface Theme {
  name?: string;
  colors: {
    primary: string;
    background: string;
    text: string;
  };
  font?: string;
}

export interface Task {
  id: number;
  task: string;
  description: string;
}

export function parsePlanFromTags(content: string): { theme: Theme; tasks: Task[] } {
  const themeBlock = parseTag(content, 'theme');
  const tasksBlock = parseTag(content, 'tasks');

  const theme: Theme = {
    colors: {
      primary: '#007bff',
      background: '#121212',
      text: '#ffffff',
    },
  };
  if (themeBlock) {
    theme.name = parseTag(themeBlock, 'name') || 'Custom Theme';
    theme.colors.primary = parseTag(themeBlock, 'primary') || '#007bff';
    theme.colors.background = parseTag(themeBlock, 'background') || '#121212';
    theme.colors.text = parseTag(themeBlock, 'text') || '#ffffff';
    theme.font = parseTag(themeBlock, 'font') || 'Inter, sans-serif';
  }

  const tasks: Task[] = [];
  if (tasksBlock) {
    // Match <task id="1" description="...">Title</task>
    const taskRegex = /<task\s+id="([^"]+)"(?:\s+description="([^"]*)")?\s*>([\s\S]*?)(?:<\/task>|$)/g;
    let match;
    while ((match = taskRegex.exec(tasksBlock)) !== null) {
      const id = parseInt(match[1]);
      tasks.push({
        id: isNaN(id) ? tasks.length + 1 : id,
        task: match[3].trim(),
        description: match[2] || ""
      });
    }
  }

  return { theme, tasks };
}

/* ───────────────── JSON REPAIR (FALLBACK) ───────────────── */
export function repairTruncatedJSON(raw: string): string {
  let json = raw.trim();

  // Strip <thinking>...</thinking> blocks
  json = json.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  json = json.replace(/<thinking>[\s\S]*/g, '').trim();

  // Strip metadata tags
  const aiMetaTags = ['plan', 'step', 'files', 'output', 'result'];
  for (const tag of aiMetaTags) {
    json = json.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'g'), '').trim();
    json = json.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*$`, 'g'), '').trim();
  }

  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/```\s*$/, '').trim();
  }

  try {
    JSON.parse(json);
    return json;
  } catch { }

  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    }
    if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(json.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (objects.length > 0) return objects[0];

  if (start !== -1 && depth > 0) {
    const partial = json.slice(start);
    let fixed = partial.replace(/,\s*$/, '');
    fixed += '}'.repeat(depth);
    try {
      JSON.parse(fixed);
      return fixed;
    } catch { }
  }

  throw new Error('No valid structure found');
}

/* ──────────── CLEAN FILE CONTENT ──────────── */
export function cleanFileContent(content: string): string {
  if (!content || typeof content !== 'string') return content;
  let cleaned = content;
  if (cleaned.startsWith('{\\"') || cleaned.startsWith('[\\"')) {
    try {
      const unescaped = JSON.parse('"' + cleaned.replace(/"/g, '\\"') + '"');
      if (typeof unescaped === 'string' && (unescaped.trim().startsWith('{') || unescaped.trim().startsWith('['))) {
        return unescaped;
      }
    } catch {
      cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }
  if (cleaned.includes('\\n') && !cleaned.includes('\n')) {
    cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
  return cleaned;
}

/* ──────────── NORMALIZE FILE ENTRIES ──────────── */
export function normalizeFiles(files: unknown[]): { path: string; content: string }[] {
  if (!Array.isArray(files)) return [];
  const result: { path: string; content: string }[] = [];
  for (const entry of files) {
    if (entry && typeof entry === 'object') {
      const obj = entry as { path?: unknown; content?: unknown };
      if (typeof obj.path === 'string' && typeof obj.content === 'string') {
        result.push({
          path: obj.path,
          content: cleanFileContent(obj.content),
        });
        continue;
      }
    }
    if (typeof entry === 'string') {
      try {
        const parsed = JSON.parse(entry);
        if (parsed.path && typeof parsed.content === 'string') {
          result.push({
            path: parsed.path,
            content: cleanFileContent(parsed.content),
          });
        }
      } catch {
        console.warn('[normalizeFiles] Skipping unparseable entry:', entry.slice(0, 80));
      }
    }
  }
  return result;
}

/* ─────────────── VALIDATION ─────────────── */
export function validateFiles(files: { path: string; content: string }[]) {
  if (!Array.isArray(files)) throw new Error('Expected files array');
  if (files.length === 0) throw new Error('No files generated');
}