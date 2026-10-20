/**
 * Minimal, dependency-free XML parser tailored to content files.
 *
 * Keeps child order (rule order matters) and can re-serialize a subtree, which
 * we need for HTML-ish <description> blocks. Runs unchanged in Node and in the
 * browser/webview.
 */

export interface XmlElement {
  kind: "element";
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export interface XmlText {
  kind: "text";
  text: string;
  cdata?: boolean;
}

export type XmlNode = XmlElement | XmlText;

export class XmlParseError extends Error {
  constructor(message: string, public readonly position: number) {
    super(`${message} (at offset ${position})`);
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body] ?? m;
  });
}

export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

const NAME_RE = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const WS_RE = /\s*/y;

export function parseXml(input: string): XmlElement {
  // Strip BOM.
  let src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let pos = 0;
  const root: XmlElement = { kind: "element", name: "#document", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];

  const skipWs = () => {
    WS_RE.lastIndex = pos;
    WS_RE.exec(src);
    pos = WS_RE.lastIndex;
  };
  const readName = (): string => {
    NAME_RE.lastIndex = pos;
    const m = NAME_RE.exec(src);
    if (!m) throw new XmlParseError("Expected a name", pos);
    pos = NAME_RE.lastIndex;
    return m[0];
  };

  while (pos < src.length) {
    const lt = src.indexOf("<", pos);
    const top = stack[stack.length - 1];
    if (lt === -1) {
      pushText(top, src.slice(pos));
      break;
    }
    if (lt > pos) pushText(top, src.slice(pos, lt));
    pos = lt;

    if (src.startsWith("<!--", pos)) {
      const end = src.indexOf("-->", pos + 4);
      if (end === -1) throw new XmlParseError("Unterminated comment", pos);
      pos = end + 3;
    } else if (src.startsWith("<![CDATA[", pos)) {
      const end = src.indexOf("]]>", pos + 9);
      if (end === -1) throw new XmlParseError("Unterminated CDATA", pos);
      top.children.push({ kind: "text", text: src.slice(pos + 9, end), cdata: true });
      pos = end + 3;
    } else if (src.startsWith("<?", pos)) {
      const end = src.indexOf("?>", pos + 2);
      if (end === -1) throw new XmlParseError("Unterminated processing instruction", pos);
      pos = end + 2;
    } else if (src.startsWith("<!", pos)) {
      // DOCTYPE or similar; skip (no internal subset support).
      const end = src.indexOf(">", pos + 2);
      if (end === -1) throw new XmlParseError("Unterminated declaration", pos);
      pos = end + 1;
    } else if (src.startsWith("</", pos)) {
      pos += 2;
      const name = readName();
      skipWs();
      if (src[pos] !== ">") throw new XmlParseError(`Expected '>' after </${name}`, pos);
      pos++;
      const open = stack.pop();
      if (!open || open === root || open.name !== name) {
        throw new XmlParseError(`Mismatched closing tag </${name}> (open: <${open?.name}>)`, pos);
      }
    } else {
      pos++;
      const name = readName();
      const el: XmlElement = { kind: "element", name, attrs: {}, children: [] };
      for (;;) {
        skipWs();
        const c = src[pos];
        if (c === ">") {
          pos++;
          top.children.push(el);
          stack.push(el);
          break;
        }
        if (c === "/" && src[pos + 1] === ">") {
          pos += 2;
          top.children.push(el);
          break;
        }
        if (c === undefined) throw new XmlParseError(`Unterminated tag <${name}>`, pos);
        const attr = readName();
        skipWs();
        if (src[pos] !== "=") throw new XmlParseError(`Expected '=' after attribute ${attr}`, pos);
        pos++;
        skipWs();
        const q = src[pos];
        if (q !== '"' && q !== "'") throw new XmlParseError(`Expected quote for attribute ${attr}`, pos);
        const end = src.indexOf(q, pos + 1);
        if (end === -1) throw new XmlParseError(`Unterminated attribute ${attr}`, pos);
        el.attrs[attr] = decodeEntities(src.slice(pos + 1, end));
        pos = end + 1;
      }
    }
  }
  if (stack.length !== 1) {
    throw new XmlParseError(`Unclosed tag <${stack[stack.length - 1].name}>`, pos);
  }
  const docEl = root.children.find((c): c is XmlElement => c.kind === "element");
  if (!docEl) throw new XmlParseError("No root element", 0);
  return docEl;
}

function pushText(parent: XmlElement, raw: string) {
  if (raw.length === 0) return;
  const text = decodeEntities(raw);
  const last = parent.children[parent.children.length - 1];
  if (last && last.kind === "text" && !last.cdata) last.text += text;
  else parent.children.push({ kind: "text", text });
}

export function childElements(el: XmlElement, name?: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (const c of el.children) if (c.kind === "element" && (name === undefined || c.name === name)) out.push(c);
  return out;
}

export function firstChild(el: XmlElement, name: string): XmlElement | undefined {
  for (const c of el.children) if (c.kind === "element" && c.name === name) return c;
  return undefined;
}

/** Concatenated text content of a node (like DOM textContent). */
export function textContent(node: XmlNode): string {
  if (node.kind === "text") return node.text;
  let s = "";
  for (const c of node.children) s += textContent(c);
  return s;
}

/** Serialize the children of an element back to markup (used for HTML descriptions). */
export function innerXml(el: XmlElement): string {
  let s = "";
  for (const c of el.children) s += outerXml(c);
  return s;
}

export function outerXml(node: XmlNode): string {
  if (node.kind === "text") return node.cdata ? node.text : escapeText(node.text);
  let s = `<${node.name}`;
  for (const [k, v] of Object.entries(node.attrs)) s += ` ${k}="${escapeAttr(v)}"`;
  if (node.children.length === 0) return `${s} />`;
  return `${s}>${innerXml(node)}</${node.name}>`;
}
