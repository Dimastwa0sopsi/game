// Inventory: 36 slots (9 hotbar + 27 storage), cursor stack and crafting helpers.
import { ITEMS, RECIPES, Recipe } from "./registry";

export interface Slot {
  id: string;
  count: number;
  durability?: number;
}

export const HOTBAR = 9;
export const TOTAL_SLOTS = 36;

export class Inventory {
  slots: Array<Slot | null> = new Array(TOTAL_SLOTS).fill(null);
  cursor: Slot | null = null;
  selected = 0;
  version = 0;

  touch() {
    this.version++;
  }

  add(id: string, count = 1): number {
    const def = ITEMS[id];
    const max = def?.stack ?? 64;
    let left = count;
    for (let pass = 0; pass < 2 && left > 0; pass++) {
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        const s = this.slots[i];
        if (pass === 0) {
          if (s && s.id === id && s.count < max) {
            const put = Math.min(max - s.count, left);
            s.count += put;
            left -= put;
          }
        } else if (!s) {
          const put = Math.min(max, left);
          this.slots[i] = { id, count: put, durability: def?.tool?.durability };
          left -= put;
        }
      }
    }
    this.touch();
    return left;
  }

  countOf(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  consume(id: string, count = 1): boolean {
    if (this.countOf(id) < count) return false;
    let left = count;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    this.touch();
    return true;
  }

  held(): Slot | null {
    return this.slots[this.selected];
  }

  damageHeld(amount = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    const def = ITEMS[s.id];
    if (!def?.tool) return;
    s.durability = (s.durability ?? def.tool.durability) - amount;
    if (s.durability <= 0) this.slots[this.selected] = null;
    this.touch();
  }

  /** UI click: pick up / place / merge / split stacks. */
  clickSlot(index: number, right: boolean) {
    const slot = this.slots[index];
    if (right) {
      if (this.cursor) {
        if (!slot) {
          this.slots[index] = { id: this.cursor.id, count: 1, durability: this.cursor.durability };
          this.cursor.count--;
        } else if (slot.id === this.cursor.id && slot.count < (ITEMS[slot.id]?.stack ?? 64)) {
          slot.count++;
          this.cursor.count--;
        }
        if (this.cursor.count <= 0) this.cursor = null;
      } else if (slot) {
        const half = Math.ceil(slot.count / 2);
        this.cursor = { id: slot.id, count: half, durability: slot.durability };
        slot.count -= half;
        if (slot.count <= 0) this.slots[index] = null;
      }
    } else {
      if (this.cursor && slot && slot.id === this.cursor.id) {
        const max = ITEMS[slot.id]?.stack ?? 64;
        const put = Math.min(max - slot.count, this.cursor.count);
        slot.count += put;
        this.cursor.count -= put;
        if (this.cursor.count <= 0) this.cursor = null;
      } else {
        const tmp = this.cursor;
        this.cursor = slot;
        this.slots[index] = tmp;
      }
    }
    this.touch();
  }

  /** Shift-click quick move between hotbar and storage. */
  quickMove(index: number) {
    const slot = this.slots[index];
    if (!slot) return;
    const targetRange = index < HOTBAR ? [HOTBAR, TOTAL_SLOTS] : [0, HOTBAR];
    const max = ITEMS[slot.id]?.stack ?? 64;
    for (let i = targetRange[0]; i < targetRange[1]; i++) {
      const t = this.slots[i];
      if (t && t.id === slot.id && t.count < max) {
        const put = Math.min(max - t.count, slot.count);
        t.count += put;
        slot.count -= put;
        if (slot.count <= 0) {
          this.slots[index] = null;
          this.touch();
          return;
        }
      }
    }
    for (let i = targetRange[0]; i < targetRange[1]; i++) {
      if (!this.slots[i]) {
        this.slots[i] = slot;
        this.slots[index] = null;
        break;
      }
    }
    this.touch();
  }

  findCraftable(): number[] {
    const out: number[] = [];
    RECIPES.forEach((r, i) => {
      if (this.canCraft(r)) out.push(i);
    });
    return out;
  }

  canCraft(r: Recipe): boolean {
    return Object.entries(r.need).every(([id, n]) => this.countOf(id) >= n);
  }

  craft(r: Recipe): boolean {
    if (!this.canCraft(r)) return false;
    for (const [id, n] of Object.entries(r.need)) this.consume(id, n);
    this.add(r.out, r.count);
    return true;
  }

  toJSON() {
    return { slots: this.slots, selected: this.selected };
  }

  load(data?: { slots?: Array<Slot | null>; selected?: number } | null) {
    if (!data?.slots) return;
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    data.slots.forEach((s, i) => {
      if (i < TOTAL_SLOTS && s && ITEMS[s.id]) this.slots[i] = { id: s.id, count: s.count, durability: s.durability };
    });
    this.selected = Math.min(HOTBAR - 1, Math.max(0, data.selected ?? 0));
    this.touch();
  }
}
