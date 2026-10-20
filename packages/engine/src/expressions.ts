/**
 * The small boolean language used by `requirements`, `supports` and
 * `equipped` attributes.
 *
 *   ,  &  &&     logical AND
 *   |  ||        logical OR
 *   !            NOT
 *   ( )          grouping
 *   ID_FOO       "the character has element ID_FOO"   (requirements)
 *   [key:value]  a check delegated to the caller       (e.g. [str:13], [level:fighter:3], [armor:none])
 *   free text    "element supports this keyword"       (supports)
 */

export type Expr =
  | { op: "and"; left: Expr; right: Expr }
  | { op: "or"; left: Expr; right: Expr }
  | { op: "not"; expr: Expr }
  | { op: "id"; id: string }
  | { op: "bracket"; key: string; value: string }
  | { op: "word"; word: string }
  | { op: "const"; value: boolean };

type Token =
  | { t: "and" }
  | { t: "or" }
  | { t: "not" }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "bracket"; key: string; value: string }
  | { t: "word"; text: string };

export class ExpressionError extends Error {}

function tokenize(src: string): Token[] {
  const s = src.replace(/&amp;/g, "&");
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "&" || c === ",") {
      while (s[i] === "&" || s[i] === ",") i++;
      out.push({ t: "and" });
    } else if (c === "|") {
      while (s[i] === "|") i++;
      out.push({ t: "or" });
    } else if (c === "!") {
      out.push({ t: "not" });
      i++;
    } else if (c === "(") {
      out.push({ t: "lp" });
      i++;
    } else if (c === ")") {
      out.push({ t: "rp" });
      i++;
    } else if (c === "[") {
      const end = s.indexOf("]", i);
      if (end === -1) throw new ExpressionError(`Unterminated '[' in "${src}"`);
      out.push({ t: "bracket", ...parseBracket(s.slice(i + 1, end)) });
      i = end + 1;
    } else if (/\s/.test(c)) {
      i++;
    } else {
      let j = i;
      while (j < s.length && !"&,|!()[".includes(s[j])) j++;
      const text = s.slice(i, j).trim();
      if (text) out.push({ t: "word", text });
      i = j;
    }
  }
  return out;
}

/** "[level:fighter:3]" -> key "level:fighter", value "3"; also supports "key=value". */
export function parseBracket(inner: string): { key: string; value: string } {
  const text = inner.trim();
  const sep = text.includes("=") ? "=" : ":";
  const idx = text.lastIndexOf(sep);
  if (idx === -1) return { key: text.toLowerCase(), value: "" };
  return { key: text.slice(0, idx).trim().toLowerCase(), value: text.slice(idx + 1).trim().toLowerCase() };
}

export function parseExpression(src: string): Expr {
  const tokens = tokenize(src);
  if (tokens.length === 0) return { op: "const", value: true };
  let pos = 0;
  const peek = () => tokens[pos];

  const parseOr = (): Expr => {
    let left = parseAnd();
    while (peek()?.t === "or") {
      pos++;
      left = { op: "or", left, right: parseAnd() };
    }
    return left;
  };
  const parseAnd = (): Expr => {
    let left = parseUnary();
    while (peek()?.t === "and") {
      pos++;
      left = { op: "and", left, right: parseUnary() };
    }
    return left;
  };
  const parseUnary = (): Expr => {
    const tok = tokens[pos++];
    if (!tok) throw new ExpressionError(`Unexpected end of expression "${src}"`);
    switch (tok.t) {
      case "not":
        return { op: "not", expr: parseUnary() };
      case "lp": {
        const e = parseOr();
        if (tokens[pos]?.t !== "rp") throw new ExpressionError(`Missing ')' in "${src}"`);
        pos++;
        return e;
      }
      case "bracket":
        return { op: "bracket", key: tok.key, value: tok.value };
      case "word":
        if (/^ID_\w+$/.test(tok.text)) return { op: "id", id: tok.text };
        if (tok.text === "true" || tok.text === "false") return { op: "const", value: tok.text === "true" };
        return { op: "word", word: tok.text };
      default:
        throw new ExpressionError(`Unexpected token in "${src}"`);
    }
  };

  const expr = parseOr();
  if (pos < tokens.length) throw new ExpressionError(`Unexpected trailing tokens in "${src}"`);
  return expr;
}

export interface EvalHandlers {
  id?: (id: string) => boolean;
  bracket?: (key: string, value: string) => boolean;
  word?: (word: string) => boolean;
}

export function evaluate(expr: Expr, h: EvalHandlers): boolean {
  switch (expr.op) {
    case "and":
      return evaluate(expr.left, h) && evaluate(expr.right, h);
    case "or":
      return evaluate(expr.left, h) || evaluate(expr.right, h);
    case "not":
      return !evaluate(expr.expr, h);
    case "const":
      return expr.value;
    case "id":
      // In supports expressions an ID is just another keyword.
      return h.id ? h.id(expr.id) : h.word ? h.word(expr.id) : false;
    case "bracket":
      return h.bracket ? h.bracket(expr.key, expr.value) : false;
    case "word":
      return h.word ? h.word(expr.word) : false;
  }
}

const cache = new Map<string, Expr>();

/** Parse with memoization; malformed expressions evaluate to `fallback`. */
export function compile(src: string): Expr | null {
  let e = cache.get(src);
  if (e) return e;
  try {
    e = parseExpression(src);
  } catch {
    return null;
  }
  if (cache.size > 20000) cache.clear();
  cache.set(src, e);
  return e;
}

export function evaluateString(src: string | undefined, h: EvalHandlers, fallback = false): boolean {
  if (!src || !src.trim()) return true;
  const e = compile(src);
  return e ? evaluate(e, h) : fallback;
}

/**
 * Element-id "range" supports, e.g. "ID_A|ID_B|ID_C": a single pipe and only
 * ids, meaning "one of exactly these elements".
 */
export function isIdRange(supports: string): boolean {
  return supports.includes("|") && !supports.includes("||");
}

export function matchesSupports(
  supports: string | undefined,
  element: { id: string; supports: string[] },
  variables?: (name: string) => string | undefined,
): boolean {
  if (!supports || !supports.trim()) return true;
  let expr = supports;
  if (variables && expr.includes("$(")) {
    expr = expr.replace(/\$\(([^)]+)\)/g, (m, name: string) => variables(name.trim()) ?? m);
  }
  if (isIdRange(expr)) {
    return expr
      .split("|")
      .map((s) => s.trim())
      .some((id) => id === element.id);
  }
  return evaluateString(expr, { word: (w) => element.supports.includes(w) }, false);
}
