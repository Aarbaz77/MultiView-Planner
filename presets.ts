import { AspectRatio, DeviceKind, Monitor, MountKind } from './types';
import { ASPECT_RATIOS, CASE_MODELS, COLORS, KEYBOARD_MODELS, MOUSE_MODELS, PPI_SCALE } from './constants';
import { createItem, getMonitorSizePx } from './utils';

export type PresetCategory = 'single' | 'dual' | 'triple' | 'monitor-only' | 'gaming' | 'productivity' | 'laptop' | 'creative';

export const PRESET_CATEGORIES: { id: PresetCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'single', label: 'Single' },
  { id: 'dual', label: 'Dual' },
  { id: 'triple', label: 'Triple+' },
  { id: 'monitor-only', label: 'Monitors only' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'laptop', label: 'With laptop' },
  { id: 'creative', label: 'Creative' },
];

export interface SetupPreset {
  id: string;
  name: string;
  description: string;
  categories: PresetCategory[];
  build: () => Monitor[];
}

const ratio = (w: number, h: number): AspectRatio =>
  ASPECT_RATIOS.find(r => r.w === w && r.h === h) ?? { label: `${w}:${h}`, w, h };

const R16_9 = ratio(16, 9);
const R16_10 = ratio(16, 10);
const R21_9 = ratio(21, 9);
const R32_9 = ratio(32, 9);

interface ScreenOptions {
  portrait?: boolean;
  curve?: number;
  angle?: number;
  tilt?: number;
}

// Lays a setup out the way a person would build it: screens side by side along one bottom
// edge, screens stacked above others, then desk items placed like the Add tab places them.
class SetupBuilder {
  items: Monitor[] = [];
  private rowRight = 0;
  private count = 0;

  private nextId() {
    this.count += 1;
    return `preset-${Date.now()}-${this.count}`;
  }

  private makeScreen(diagonal: number, r: AspectRatio, opts: ScreenOptions): Monitor {
    const screens = this.items.filter(m => !m.kind).length;
    return {
      id: this.nextId(),
      diagonal,
      ratio: r,
      orientation: opts.portrait ? 'portrait' : 'landscape',
      curve: opts.curve,
      angle: opts.angle,
      tilt: opts.tilt,
      x: 0,
      y: 0,
      color: COLORS[screens % COLORS.length],
    };
  }

  // Next screen in the bottom row, touching the previous one, bottoms lined up
  screen(diagonal: number, r: AspectRatio, opts: ScreenOptions = {}) {
    const m = this.makeScreen(diagonal, r, opts);
    const { w, h } = getMonitorSizePx(m);
    m.x = this.rowRight;
    m.y = -h;
    this.rowRight += w;
    this.items.push(m);
    return m;
  }

  // A screen sitting directly on top of `below`, centred over it
  above(below: Monitor, diagonal: number, r: AspectRatio, opts: ScreenOptions = {}) {
    const m = this.makeScreen(diagonal, r, opts);
    const { w, h } = getMonitorSizePx(m);
    m.x = below.x + getMonitorSizePx(below).w / 2 - w / 2;
    m.y = below.y - h;
    this.items.push(m);
    return m;
  }

  mount(kind: MountKind, ...screens: Monitor[]) {
    const groupId = this.nextId();
    screens.forEach(s => { s.mount = { kind, groupId }; });
  }

  laptop(diagonal: number, r: AspectRatio) {
    return this.add({ kind: 'laptop', diagonal, ratio: r });
  }

  peripheral(kind: Extract<DeviceKind, 'keyboard' | 'mouse' | 'case'>, name: string) {
    const models = kind === 'keyboard' ? KEYBOARD_MODELS : kind === 'mouse' ? MOUSE_MODELS : CASE_MODELS;
    const model = models.find(m => m.name === name)!;
    return this.add({ kind, name: model.name, size: model.size });
  }

  private add(item: Parameters<typeof createItem>[1]) {
    const m = createItem(this.items, item, this.nextId());
    this.items.push(m);
    return m;
  }

  // Slides a desk item so it sits to the left of the monitors
  toLeftOfWall(m: Monitor, gapInches = 3) {
    const wallLeft = Math.min(...this.items.filter(i => !i.kind).map(i => i.x));
    m.x = wallLeft - getMonitorSizePx(m).w - gapInches * PPI_SCALE;
    return m;
  }
}

const preset = (
  id: string,
  name: string,
  description: string,
  categories: PresetCategory[],
  setup: (b: SetupBuilder) => void,
): SetupPreset => ({
  id, name, description, categories,
  build: () => {
    const b = new SetupBuilder();
    setup(b);
    return b.items;
  },
});

const essentials = (b: SetupBuilder, keyboard = 'TKL (tenkeyless)', mouse = 'Standard mouse') => {
  b.peripheral('keyboard', keyboard);
  b.peripheral('mouse', mouse);
};

export const SETUP_PRESETS: SetupPreset[] = [
  // --- Single screen ---
  preset('single-27', 'Single 27" essentials', '27" 1440p with a TKL keyboard, mouse and a mid tower.', ['single', 'productivity'], b => {
    b.screen(27, R16_9);
    essentials(b);
    b.peripheral('case', 'Mid tower (ATX)');
  }),
  preset('ultrawide-gaming', 'Ultrawide gaming 34"', '34" 21:9 curved at 1800R, 65% keyboard, large mouse and a dual-chamber build.', ['single', 'gaming'], b => {
    b.screen(34, R21_9, { curve: 1800 });
    essentials(b, '65%', 'Ergonomic mouse (large)');
    b.peripheral('case', 'Dual-chamber (O11-style)');
  }),
  preset('super-ultrawide', 'Super ultrawide 49"', 'A 49" 32:9 at 1000R (G9 size), TKL keyboard and a full tower.', ['single', 'gaming'], b => {
    b.screen(49, R32_9, { curve: 1000 });
    essentials(b);
    b.peripheral('case', 'Full tower (E-ATX)');
  }),
  preset('compact-sff', 'Compact SFF desk', '27" with a Mini-ITX build, 60% keyboard and compact mouse.', ['single', 'gaming'], b => {
    b.screen(27, R16_9);
    essentials(b, '60%', 'Compact mouse');
    b.peripheral('case', 'Mini-ITX (small form factor)');
  }),

  // --- Two screens ---
  preset('dual-27', 'Dual 27"', 'Two 27" screens angled in 15°, full-size keyboard and a mid tower.', ['dual', 'productivity'], b => {
    b.screen(27, R16_9, { angle: 15 });
    b.screen(27, R16_9, { angle: -15 });
    essentials(b, 'Full-size');
    b.peripheral('case', 'Mid tower (ATX)');
  }),
  preset('dual-coder', 'Coder: landscape + vertical', '27" main with a 24" vertical for code and docs, on a dual arm.', ['dual', 'productivity'], b => {
    const main = b.screen(27, R16_9);
    const side = b.screen(24, R16_9, { portrait: true, angle: -20 });
    b.mount('dual', main, side);
    essentials(b, '75%');
  }),
  preset('dual-stacked', 'Stacked dual 27"', 'One 27" above the other on a dual arm, top one tilted down.', ['dual', 'productivity'], b => {
    const bottom = b.screen(27, R16_9);
    const top = b.above(bottom, 27, R16_9, { tilt: -10 });
    b.mount('dual', bottom, top);
    essentials(b);
  }),
  preset('ultrawide-vertical', 'Ultrawide + vertical', '34" curved ultrawide with a 27" portrait screen beside it.', ['dual', 'productivity', 'creative'], b => {
    b.screen(34, R21_9, { curve: 1800 });
    b.screen(27, R16_9, { portrait: true, angle: -25 });
    essentials(b);
    b.peripheral('case', 'Mid tower (ATX)');
  }),
  preset('mac-studio', 'Mac Studio creative', 'Two 32" displays (Pro Display XDR size) with a Mac Studio.', ['dual', 'creative', 'productivity'], b => {
    b.screen(32, R16_9, { angle: 15 });
    b.screen(32, R16_9, { angle: -15 });
    essentials(b, 'Low-profile (Magic Keyboard)', 'Trackpad');
    b.peripheral('case', 'Mac Studio');
  }),

  // --- Three or more ---
  preset('triple-27-wrap', 'Triple 27" wraparound', 'Three 27" screens wrapped around you on a triple arm.', ['triple', 'productivity', 'gaming'], b => {
    const left = b.screen(27, R16_9, { angle: 30 });
    const middle = b.screen(27, R16_9);
    const right = b.screen(27, R16_9, { angle: -30 });
    b.mount('triple', left, middle, right);
    essentials(b, 'Full-size');
    b.peripheral('case', 'Full tower (E-ATX)');
  }),
  preset('sim-racing', 'Sim racing triple 32"', 'Three 32" screens angled 45° for a wide field of view.', ['triple', 'gaming'], b => {
    b.screen(32, R16_9, { angle: 45 });
    b.screen(32, R16_9);
    b.screen(32, R16_9, { angle: -45 });
    b.peripheral('case', 'Dual-chamber (O11-style)');
  }),
  preset('streamer', 'Streaming triple', '27" for the game, a 24" vertical for chat and a 24" for OBS.', ['triple', 'gaming', 'creative'], b => {
    b.screen(24, R16_9, { portrait: true, angle: 25 });
    b.screen(27, R16_9);
    b.screen(24, R16_9, { angle: -25 });
    essentials(b);
    b.peripheral('case', 'Dual-chamber (O11-style)');
  }),
  preset('quad-24', 'Quad 24" grid', 'Four 24" screens, two over two, on two dual arms.', ['monitor-only', 'productivity'], b => {
    const bottomLeft = b.screen(24, R16_9);
    const bottomRight = b.screen(24, R16_9);
    const topLeft = b.above(bottomLeft, 24, R16_9);
    const topRight = b.above(bottomRight, 24, R16_9);
    b.mount('dual', bottomLeft, bottomRight);
    b.mount('dual', topLeft, topRight);
  }),

  // --- With a laptop ---
  preset('laptop-monitor', 'Laptop + monitor', '27" monitor with a 15.6" laptop beside it, keyboard and mouse.', ['laptop', 'dual', 'productivity'], b => {
    b.screen(27, R16_9);
    essentials(b);
    const laptop = b.laptop(15.6, R16_9);
    b.toLeftOfWall(laptop);
    laptop.depth = 4;
    laptop.angle = 20;
  }),
  preset('macbook-dual', 'MacBook + dual 27"', 'MacBook Pro 16" with two 27" displays, Magic Keyboard and trackpad.', ['laptop', 'triple', 'productivity', 'creative'], b => {
    b.screen(27, R16_9, { angle: 15 });
    b.screen(27, R16_9, { angle: -15 });
    essentials(b, 'Low-profile (Magic Keyboard)', 'Trackpad');
    const laptop = b.laptop(16.2, R16_10);
    b.toLeftOfWall(laptop);
    laptop.depth = 4;
    laptop.angle = 25;
  }),

  // --- Screens only ---
  preset('only-single-32', 'Single 32"', 'Just a 32" 4K screen.', ['monitor-only', 'single'], b => {
    b.screen(32, R16_9);
  }),
  preset('only-dual-24', 'Dual 24"', 'Two 24" screens side by side, nothing else.', ['monitor-only', 'dual'], b => {
    b.screen(24, R16_9);
    b.screen(24, R16_9);
  }),
  preset('only-triple-27', 'Triple 27" flat', 'Three 27" screens in a flat row.', ['monitor-only', 'triple'], b => {
    b.screen(27, R16_9);
    b.screen(27, R16_9);
    b.screen(27, R16_9);
  }),
];
