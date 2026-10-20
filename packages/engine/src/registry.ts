import type { ElementDef } from "./model.js";
import { parseElementsFile, type AppendDef, type ParseWarning } from "./parser.js";

export interface RegistryWarning extends ParseWarning {}

/**
 * All loaded content. Later additions override earlier ones with the same id,
 * so user content can replace bundled core elements.
 */
export class ContentRegistry {
  private byId = new Map<string, ElementDef>();
  private byTypeCache = new Map<string, ElementDef[]>();
  private pendingAppends: AppendDef[] = [];
  /** Multiclass element id -> class element id. */
  private multiclassToClass = new Map<string, string>();
  /** Class element id -> multiclass element id. */
  private classToMulticlass = new Map<string, string>();
  readonly warnings: RegistryWarning[] = [];

  get size(): number {
    return this.byId.size;
  }

  addXml(xml: string, file?: string): void {
    let parsed;
    try {
      parsed = parseElementsFile(xml, file);
    } catch (e) {
      this.warnings.push({ file, message: `failed to parse: ${(e as Error).message}` });
      return;
    }
    this.warnings.push(...parsed.warnings);
    for (const el of parsed.elements) this.add(el);
    this.pendingAppends.push(...parsed.appends);
    this.byTypeCache.clear();
  }

  add(el: ElementDef): void {
    const existing = this.byId.get(el.id);
    if (existing) {
      this.warnings.push({
        file: el.file,
        element: el.id,
        message: `duplicate id; overriding element from ${existing.file ?? "unknown file"}`,
      });
      if (existing.multiclass) {
        this.byId.delete(existing.multiclass.id);
        this.multiclassToClass.delete(existing.multiclass.id);
        this.classToMulticlass.delete(existing.id);
      }
    }
    this.byId.set(el.id, el);
    if (el.type === "Class" && el.multiclass) {
      const mc = synthesizeMulticlass(el);
      this.byId.set(mc.id, mc);
      this.multiclassToClass.set(mc.id, el.id);
      this.classToMulticlass.set(el.id, mc.id);
    }
    this.byTypeCache.clear();
  }

  /**
   * Apply <append> nodes. Call once after all files are loaded (appends may
   * target elements from files loaded later).
   */
  finalize(): void {
    const remaining: AppendDef[] = [];
    for (const ap of this.pendingAppends) {
      const target = this.byId.get(ap.id);
      if (!target) {
        remaining.push(ap);
        continue;
      }
      for (const s of ap.supports) if (!target.supports.includes(s)) target.supports.push(s);
      for (const s of ap.setters) {
        if (!target.setters.some((x) => x.name.toLowerCase() === s.name.toLowerCase())) target.setters.push(s);
      }
      target.rules.push(...ap.rules);
      if (ap.spellcasting && !target.spellcasting) target.spellcasting = ap.spellcasting;
    }
    for (const ap of remaining) {
      this.warnings.push({ element: ap.id, message: "append target not found" });
    }
    this.pendingAppends = [];
    this.byTypeCache.clear();
  }

  get(id: string): ElementDef | undefined {
    return this.byId.get(id);
  }

  all(): IterableIterator<ElementDef> {
    return this.byId.values();
  }

  ofType(type: string): ElementDef[] {
    let list = this.byTypeCache.get(type);
    if (!list) {
      list = [];
      for (const el of this.byId.values()) if (el.type === type) list.push(el);
      list.sort((a, b) => a.name.localeCompare(b.name));
      this.byTypeCache.set(type, list);
    }
    return list;
  }

  types(): string[] {
    const set = new Set<string>();
    for (const el of this.byId.values()) set.add(el.type);
    return [...set].sort();
  }

  multiclassOf(classId: string): ElementDef | undefined {
    const id = this.classToMulticlass.get(classId);
    return id ? this.byId.get(id) : undefined;
  }

  classOfMulticlass(multiclassId: string): ElementDef | undefined {
    const id = this.multiclassToClass.get(multiclassId);
    return id ? this.byId.get(id) : undefined;
  }
}

/**
 * A class with a <multiclass> node yields a second element of type
 * "Multiclass": the class's own rules followed by the multiclass rules, with
 * the multiclass id. Class rules that should only apply to a starting class
 * exclude themselves via requirements like "!ID_..._MULTICLASS_FIGHTER".
 */
function synthesizeMulticlass(cls: ElementDef): ElementDef {
  const mc = cls.multiclass!;
  const reqs = [cls.requirements, mc.requirements].filter(Boolean).map((r) => `(${r})`);
  const prereqs = [cls.prerequisite, mc.prerequisite].filter(Boolean);
  return {
    id: mc.id,
    name: cls.name,
    type: "Multiclass",
    source: cls.source,
    supports: [...cls.supports],
    requirements: reqs.length ? reqs.join("&&") : undefined,
    prerequisite: prereqs.length ? prereqs.join(", ") : undefined,
    description: (mc.description ?? "") + cls.description,
    sheet: cls.sheet,
    setters: [...cls.setters, ...mc.setters],
    rules: [...cls.rules, ...mc.rules],
    spellcasting: cls.spellcasting,
    compendiumDisplay: false,
    file: cls.file,
  };
}
