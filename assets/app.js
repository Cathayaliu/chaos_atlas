/* ============================================================
   CHAOS ATLAS
   Vanilla JS · deterministic systems integrated in the browser
   ============================================================ */
(() => {
  'use strict';

  /* ---------- small utilities ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function formatNumber(value, decimals = 3) {
    return Number.isFinite(value) ? value.toFixed(decimals) : '—';
  }

  function signed(value, decimals = 4) {
    if (!Number.isFinite(value)) return '—';
    const rounded = value.toFixed(decimals);
    const n = Number(rounded);
    if (Math.abs(n) < Math.pow(10, -decimals) / 2) return (0).toFixed(decimals);
    return (n > 0 ? '+' : '−') + Math.abs(n).toFixed(decimals);
  }

  function superscript(value) {
    const map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(value).split('').map(c => map[c] || c).join('');
  }

  function formatLog10(logValue, digits = 1) {
    const exponent = Math.floor(logValue);
    const mantissa = Math.pow(10, logValue - exponent);
    if (digits <= 0) return `10${superscript(exponent)}`;
    return `${mantissa.toFixed(digits)} × 10${superscript(exponent)}`;
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const int = parseInt(full, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }

  function rgbaString(hex, alpha = 1) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function resizeCanvasToDisplay(canvas, maxDpr = 2) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height, dpr, cssWidth: rect.width, cssHeight: rect.height };
  }

  function setRangeFill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const pct = ((value - min) / (max - min)) * 100;
    input.style.setProperty('--p', `${clamp(pct, 0, 100)}%`);
  }

  function debounce(fn, delay) {
    let timer = null;
    const wrapped = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
  }

  function isVisibleElement(el) {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function deviceIsSmall() {
    return window.matchMedia('(max-width: 760px)').matches;
  }

  /* ---------- system definitions ---------- */

  const SYSTEMS = [
    {
      id: 'lorenz',
      index: 1,
      name: 'LORENZ',
      cn: '洛伦茨吸引子',
      year: '1963',
      family: 'ATMOSPHERIC CONVECTION',
      note: '大气对流的极简模型。三个变量在确定性的方程里，第一次显影了“蝴蝶效应”。',
      seed: [1.1, 1.1, 1.1],
      lyapSeed: [1.1, 1.1, 1.1],
      dt: 0.008,
      lyapDt: 0.012,
      params: [
        { key: 'sigma', symbol: 'σ', cn: '普朗特数', label: 'Prandtl', value: 10, min: 2, max: 20, step: 0.1, precision: 2 },
        { key: 'rho', symbol: 'ρ', cn: '瑞利数', label: 'Rayleigh', value: 28, min: 2, max: 60, step: 0.1, precision: 2 },
        { key: 'beta', symbol: 'β', cn: '几何因子', label: 'Geometry', value: 8 / 3, min: 0.5, max: 5, step: 0.001, precision: 3 }
      ],
      f(x, y, z, p, o) {
        o[0] = p.sigma * (y - x);
        o[1] = x * (p.rho - z) - y;
        o[2] = x * y - p.beta * z;
      },
      jac(x, y, z, p, o) {
        o[0] = -p.sigma; o[1] = p.sigma; o[2] = 0;
        o[3] = p.rho - z; o[4] = -1; o[5] = -x;
        o[6] = y; o[7] = x; o[8] = -p.beta;
      },
      view: { yaw: 0.54, pitch: 0.2 },
      palette: { a: '#aebbb0', b: '#f1aa70', tracer: ['#ff6b42', '#efe6d4', '#e9b87f', '#ffd8b1', '#d4ded2', '#ff8d66'] },
      preview: { yaw: 0.6, pitch: 0.22, warm: 2200, samples: 7000 }
    },
    {
      id: 'rossler',
      index: 2,
      name: 'RÖSSLER',
      cn: '罗斯勒吸引子',
      year: '1976',
      family: 'FOLDED RIBBON',
      note: '一条被反复折叠的丝带。它只用一项非线性，就展示了连续时间中的混沌。',
      seed: [1.2, 1.2, 0],
      lyapSeed: [1.2, 1.2, 0],
      dt: 0.016,
      lyapDt: 0.016,
      params: [
        { key: 'a', symbol: 'a', cn: '阻尼系数', label: 'Damping', value: 0.2, min: 0.05, max: 0.4, step: 0.002, precision: 3 },
        { key: 'b', symbol: 'b', cn: '偏移', label: 'Offset', value: 0.2, min: 0.03, max: 1, step: 0.002, precision: 3 },
        { key: 'c', symbol: 'c', cn: '折叠强度', label: 'Fold', value: 5.7, min: 2.5, max: 12, step: 0.02, precision: 2 }
      ],
      f(x, y, z, p, o) {
        o[0] = -y - z;
        o[1] = x + p.a * y;
        o[2] = p.b + z * (x - p.c);
      },
      jac(x, y, z, p, o) {
        o[0] = 0; o[1] = -1; o[2] = -1;
        o[3] = 1; o[4] = p.a; o[5] = 0;
        o[6] = z; o[7] = 0; o[8] = x - p.c;
      },
      view: { yaw: 0.72, pitch: 0.42 },
      palette: { a: '#d0c8b5', b: '#ef8e63', tracer: ['#ff7447', '#eadfcb', '#d9ad87', '#ffb494', '#cfd6c4', '#ff936c'] },
      preview: { yaw: 0.48, pitch: 0.5, warm: 2800, samples: 7200 }
    },
    {
      id: 'aizawa',
      index: 3,
      name: 'AIZAWA',
      cn: '相泽吸引子',
      year: '1982',
      family: 'TORUS / CHAOTIC CORE',
      note: '一圈被风穿透的发光涡环。环面与混沌在同一个相空间里共存。',
      seed: [0.1, 0.1, 0],
      lyapSeed: [0.1, 0.1, 0],
      dt: 0.01,
      lyapDt: 0.012,
      params: [
        { key: 'a', symbol: 'a', cn: '环向增长', label: 'Growth', value: 0.95, min: 0.6, max: 1.25, step: 0.005, precision: 3 },
        { key: 'b', symbol: 'b', cn: '漂移高度', label: 'Drift', value: 0.7, min: 0.35, max: 1.1, step: 0.005, precision: 3 },
        { key: 'c', symbol: 'c', cn: '环面常数', label: 'Torus', value: 0.6, min: 0.25, max: 1.2, step: 0.005, precision: 3 },
        { key: 'd', symbol: 'd', cn: '旋转耦合', label: 'Rotation', value: 3.5, min: 1.5, max: 5.5, step: 0.01, precision: 2 },
        { key: 'e', symbol: 'e', cn: '径向阻尼', label: 'Damping', value: 0.25, min: 0.05, max: 0.6, step: 0.005, precision: 2, hidden: true },
        { key: 'f', symbol: 'f', cn: '立方耦合', label: 'Coupling', value: 0.1, min: 0.02, max: 0.3, step: 0.005, precision: 2, hidden: true }
      ],
      f(x, y, z, p, o) {
        o[0] = (z - p.b) * x - p.d * y;
        o[1] = p.d * x + (z - p.b) * y;
        o[2] = p.c + p.a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + p.e * z) + p.f * z * x * x * x;
      },
      jac(x, y, z, p, o) {
        o[0] = z - p.b; o[1] = -p.d; o[2] = x;
        o[3] = p.d; o[4] = z - p.b; o[5] = y;
        o[6] = -2 * x * (1 + p.e * z) + 3 * p.f * z * x * x;
        o[7] = -2 * y * (1 + p.e * z);
        o[8] = p.a - z * z - p.e * (x * x + y * y) + p.f * x * x * x;
      },
      view: { yaw: 0.35, pitch: 0.23 },
      palette: { a: '#a9c4bc', b: '#e9d39c', tracer: ['#f3ca7e', '#d9e6dd', '#ff9c6f', '#b5ded2', '#f6e5bd', '#ff7d51'] },
      preview: { yaw: 0.5, pitch: 0.24, warm: 3000, samples: 7600 }
    },
    {
      id: 'thomas',
      index: 4,
      name: 'THOMAS',
      cn: '托马斯吸引子',
      year: '1999',
      family: 'CYCLICALLY SYMMETRIC',
      note: '三个正弦彼此缠绕，像一台永远织不完的机器。轻盈、对称，却在每一层褶皱里藏着分歧。',
      seed: [0, 1, 0],
      lyapSeed: [0, 1, 0],
      dt: 0.022,
      lyapDt: 0.025,
      params: [
        { key: 'b', symbol: 'b', cn: '阻尼参数', label: 'Damping', value: 0.208186, min: 0.12, max: 0.3, step: 0.0001, precision: 4 }
      ],
      f(x, y, z, p, o) {
        o[0] = Math.sin(y) - p.b * x;
        o[1] = Math.sin(z) - p.b * y;
        o[2] = Math.sin(x) - p.b * z;
      },
      jac(x, y, z, p, o) {
        o[0] = -p.b; o[1] = Math.cos(y); o[2] = 0;
        o[3] = 0; o[4] = -p.b; o[5] = Math.cos(z);
        o[6] = Math.cos(x); o[7] = 0; o[8] = -p.b;
      },
      view: { yaw: 0.7, pitch: -0.12 },
      palette: { a: '#c2b8ce', b: '#d9e2a6', tracer: ['#dce9a5', '#e1d4ee', '#f6e7be', '#acd5cd', '#ff9b7c', '#cbc1e3'] },
      preview: { yaw: 0.6, pitch: -0.1, warm: 2600, samples: 6500 }
    },
    {
      id: 'halvorsen',
      index: 5,
      name: 'HALVORSEN',
      cn: '哈尔沃森吸引子',
      year: '2000',
      family: 'ROTATIONALLY SYMMETRIC',
      note: '三条对称的臂彼此牵引。经典参数下，它收敛为一条稳定的周期轨道——它提醒我们：吸引子并不必然混沌。',
      seed: [-1.48, -1.51, -2.04],
      lyapSeed: [-1.48, -1.51, -2.04],
      dt: 0.008,
      lyapDt: 0.012,
      params: [
        { key: 'a', symbol: 'a', cn: '耗散参数', label: 'Damping', value: 1.89, min: 1.2, max: 2.5, step: 0.005, precision: 3 }
      ],
      f(x, y, z, p, o) {
        o[0] = -p.a * x - 4 * y - 4 * z - y * y;
        o[1] = -p.a * y - 4 * z - 4 * x - z * z;
        o[2] = -p.a * z - 4 * x - 4 * y - x * x;
      },
      jac(x, y, z, p, o) {
        o[0] = -p.a; o[1] = -4 - 2 * y; o[2] = -4;
        o[3] = -4; o[4] = -p.a; o[5] = -4 - 2 * z;
        o[6] = -4 - 2 * x; o[7] = -4; o[8] = -p.a;
      },
      view: { yaw: 0.4, pitch: 0.25 },
      palette: { a: '#adbccd', b: '#dfa59f', tracer: ['#f2b0a5', '#d6e2ec', '#f0d2ad', '#9fbcc9', '#ff9278', '#c4d5e2'] },
      preview: { yaw: 0.4, pitch: 0.22, warm: 2600, samples: 7000 }
    },
    {
      id: 'chen',
      index: 6,
      name: 'CHEN',
      cn: '陈氏吸引子',
      year: '1999',
      family: 'NON-EQUIVALENT BUTTERFLY',
      note: '洛伦茨的远亲，却拓扑不等价。它证明了蝴蝶的形状不止一种，混沌也有自己的方言。',
      seed: [-3, 2, 20],
      lyapSeed: [-3, 2, 20],
      dt: 0.006,
      lyapDt: 0.01,
      params: [
        { key: 'a', symbol: 'a', cn: '拉伸参数', label: 'Stretch', value: 35, min: 20, max: 45, step: 0.1, precision: 1 },
        { key: 'b', symbol: 'b', cn: '收缩参数', label: 'Contract', value: 3, min: 1.5, max: 8, step: 0.05, precision: 2 },
        { key: 'c', symbol: 'c', cn: '耦合参数', label: 'Coupling', value: 28, min: 20, max: 34, step: 0.1, precision: 1 }
      ],
      f(x, y, z, p, o) {
        o[0] = p.a * (y - x);
        o[1] = (p.c - p.a) * x - x * z + p.c * y;
        o[2] = x * y - p.b * z;
      },
      jac(x, y, z, p, o) {
        o[0] = -p.a; o[1] = p.a; o[2] = 0;
        o[3] = p.c - p.a - z; o[4] = p.c; o[5] = -x;
        o[6] = y; o[7] = x; o[8] = -p.b;
      },
      view: { yaw: 0.78, pitch: 0.18 },
      palette: { a: '#c6b9a5', b: '#ee8f5f', tracer: ['#ff7849', '#efe3cd', '#efb48b', '#ffc8a8', '#cfd7c7', '#ff9970'] },
      preview: { yaw: 0.62, pitch: 0.15, warm: 3000, samples: 7200 }
    }
  ];

  const SYSTEM_MAP = new Map(SYSTEMS.map(s => [s.id, s]));

  const LORENZ = SYSTEM_MAP.get('lorenz');
  const LORENZ_DEFAULTS = Object.fromEntries(LORENZ.params.map(p => [p.key, p.value]));
  const LORENZ_REFERENCE_LAMBDA = 0.9056;

  function defaultParams(system) {
    const p = {};
    system.params.forEach(param => { p[param.key] = param.value; });
    return p;
  }

  // state shared by the interactive instruments
  const app = {
    system: LORENZ,
    params: defaultParams(LORENZ),
    lyapunov: null,
    lab: null,
    paused: false,
    labVisible: false,
    heroVisible: true,
    spectrumVisible: false,
    bifurcationVisible: false
  };

  /* ---------- generic RK4 helpers ---------- */

  const _rhs = [0, 0, 0];

  function stepParticle(sys, p, pos, idx, dt) {
    const x = pos[idx], y = pos[idx + 1], z = pos[idx + 2];

    sys.f(x, y, z, p, _rhs);
    const k1x = _rhs[0], k1y = _rhs[1], k1z = _rhs[2];

    sys.f(x + dt * 0.5 * k1x, y + dt * 0.5 * k1y, z + dt * 0.5 * k1z, p, _rhs);
    const k2x = _rhs[0], k2y = _rhs[1], k2z = _rhs[2];

    sys.f(x + dt * 0.5 * k2x, y + dt * 0.5 * k2y, z + dt * 0.5 * k2z, p, _rhs);
    const k3x = _rhs[0], k3y = _rhs[1], k3z = _rhs[2];

    sys.f(x + dt * k3x, y + dt * k3y, z + dt * k3z, p, _rhs);
    const k4x = _rhs[0], k4y = _rhs[1], k4z = _rhs[2];

    const nx = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    const ny = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    const nz = z + (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);

    pos[idx] = nx;
    pos[idx + 1] = ny;
    pos[idx + 2] = nz;
    return [nx, ny, nz];
  }

  function advanceTriple(sys, p, state, dt) {
    const x = state[0], y = state[1], z = state[2];
    sys.f(x, y, z, p, _rhs);
    const k1x = _rhs[0], k1y = _rhs[1], k1z = _rhs[2];
    sys.f(x + dt * 0.5 * k1x, y + dt * 0.5 * k1y, z + dt * 0.5 * k1z, p, _rhs);
    const k2x = _rhs[0], k2y = _rhs[1], k2z = _rhs[2];
    sys.f(x + dt * 0.5 * k2x, y + dt * 0.5 * k2y, z + dt * 0.5 * k2z, p, _rhs);
    const k3x = _rhs[0], k3y = _rhs[1], k3z = _rhs[2];
    sys.f(x + dt * k3x, y + dt * k3y, z + dt * k3z, p, _rhs);
    const k4x = _rhs[0], k4y = _rhs[1], k4z = _rhs[2];
    state[0] = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    state[1] = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    state[2] = z + (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
    return state;
  }

  function generateTrajectory(sys, p, steps, dt, start, stride = 1) {
    const pts = [];
    let state = [start[0], start[1], start[2]];
    const out = [0, 0, 0];
    const push = () => {
      out[0] = state[0]; out[1] = state[1]; out[2] = state[2];
      pts.push(out[0], out[1], out[2]);
    };
    for (let i = 0; i < steps; i++) {
      advanceTriple(sys, p, state, dt);
      if (!Number.isFinite(state[0]) || !Number.isFinite(state[1]) || !Number.isFinite(state[2])) break;
      if (i % stride === 0) push();
    }
    return pts;
  }

  function computeBounds(array) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < array.length; i += 3) {
      const x = array[i], y = array[i + 1], z = array[i + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!Number.isFinite(minX)) {
      return { minX: -1, minY: -1, minZ: -1, maxX: 1, maxY: 1, maxZ: 1, cx: 0, cy: 0, cz: 0, half: 1 };
    }
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const half = Math.max((maxX - minX) * 0.5, (maxY - minY) * 0.5, (maxZ - minZ) * 0.5, 0.01);
    return { minX, minY, minZ, maxX, maxY, maxZ, cx, cy, cz, half };
  }

  function rotateProject(x, y, z, center, scale, yaw, pitch, zoom, cssWidth, cssHeight) {
    const px = (x - center.x) * scale;
    const py = (y - center.y) * scale;
    const pz = (z - center.z) * scale;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = px * cy + pz * sy;
    const z1 = -px * sy + pz * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = py * cp - z1 * sp;
    const z2 = py * sp + z1 * cp;
    const zcam = z2 + zoom;
    if (zcam < 0.12) return null;
    const aspect = cssWidth / cssHeight;
    const f = 2.15;
    const nx = (x1 * f) / (aspect * zcam);
    const ny = (y2 * f) / zcam;
    return {
      x: (nx * 0.5 + 0.5) * cssWidth,
      y: (1 - (ny * 0.5 + 0.5)) * cssHeight,
      depth: z2,
      zcam,
      scale: (zoom / zcam)
    };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeGlowSprite(size = 64, inner = 'rgba(255,244,226,0.95)', mid = 'rgba(255,150,92,0.34)') {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.14, 'rgba(255,235,210,0.55)');
    g.addColorStop(0.38, mid);
    g.addColorStop(1, 'rgba(255,96,56,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  /* ============================================================
     HERO FIELD — a living long-view portrait of Lorenz–63
     ============================================================ */

  class HeroField {
    constructor(canvas, section) {
      this.canvas = canvas;
      this.section = section;
      this.ctx = canvas.getContext('2d');
      this.dpr = 1;
      this.cssWidth = 1;
      this.cssHeight = 1;
      this.running = false;
      this.raf = null;
      this.visible = true;
      this.lastTime = 0;
      this.baseYaw = 0.56;
      this.pointerYaw = 0;
      this.pointerPitch = 0;
      this.dragYaw = 0;
      this.dragPitch = 0;
      this.pointerX = 0;
      this.pointerY = 0;
      this.smoothPointerX = 0;
      this.smoothPointerY = 0;
      this.dragging = false;
      this.sys = LORENZ;
      this.params = { ...LORENZ_DEFAULTS };
      this.rng = mulberry32(1963);
      this.glow = makeGlowSprite(64);
      this.nodes = [];
      this.lastCoordUpdate = 0;
      this.coordValue = 'X +00.000   Y +00.000   Z +00.000';
      this.build();
      this.resize();
      this.bind();
    }

    build() {
      const sys = this.sys;
      const p = this.params;
      const dt = 0.006;
      let state = [1.1, 1.1, 1.1];
      // settle onto the attractor
      for (let i = 0; i < 2200; i++) advanceTriple(sys, p, state, dt);

      const points = [];
      const speeds = [];
      let minSpeed = Infinity, maxSpeed = -Infinity;
      for (let i = 0; i < 6500; i++) {
        advanceTriple(sys, p, state, dt);
        if (i % 2 === 0) {
          points.push(state[0], state[1], state[2]);
          sys.f(state[0], state[1], state[2], p, _rhs);
          const speed = Math.hypot(_rhs[0], _rhs[1], _rhs[2]);
          speeds.push(speed);
          if (speed < minSpeed) minSpeed = speed;
          if (speed > maxSpeed) maxSpeed = speed;
        }
      }
      this.points = new Float32Array(points);
      this.count = this.points.length / 3;
      this.bounds = computeBounds(this.points);
      this.center = { x: this.bounds.cx, y: this.bounds.cy, z: this.bounds.cz };
      this.scale = 1 / this.bounds.half;

      // ribbons made from short arcs of one long orbit
      const strandCount = deviceIsSmall() ? 14 : 26;
      const colors = [
        'rgba(238,232,219,0.2)',
        'rgba(216,206,188,0.14)',
        'rgba(233,177,129,0.18)',
        'rgba(255,107,66,0.2)',
        'rgba(238,232,219,0.1)'
      ];
      this.strands = [];
      for (let i = 0; i < strandCount; i++) {
        const length = 190 + Math.floor(this.rng() * 280);
        const start = Math.floor(this.rng() * Math.max(1, this.count - length - 1));
        this.strands.push({
          start,
          length,
          color: colors[i % colors.length],
          glow: i % 5 === 0,
          bold: i === 3 || i === 17,
          dash: i === 7 || i === 20,
          width: 0.55 + this.rng() * 0.75
        });
      }

      // luminous dust from the attractor itself
      const dustCount = deviceIsSmall() ? 1450 : 2900;
      this.dust = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        const idx = Math.floor(this.rng() * this.count) * 3;
        this.dust[i * 3] = this.points[idx];
        this.dust[i * 3 + 1] = this.points[idx + 1];
        this.dust[i * 3 + 2] = this.points[idx + 2];
      }

      // moving luminous nodes, integrated live
      const nodeCount = deviceIsSmall() ? 42 : 74;
      this.nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        const idx = Math.floor(this.rng() * this.count) * 3;
        this.nodes.push({
          x: this.points[idx],
          y: this.points[idx + 1],
          z: this.points[idx + 2],
          phase: this.rng() * TAU,
          heat: this.rng(),
          size: 0.55 + this.rng() * 1.3
        });
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.cssWidth = Math.max(1, rect.width);
      this.cssHeight = Math.max(1, rect.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.85);
      this.canvas.width = Math.round(this.cssWidth * this.dpr);
      this.canvas.height = Math.round(this.cssHeight * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    bind() {
      let lastX = 0, lastY = 0;
      const onMove = e => {
        const rect = this.section.getBoundingClientRect();
        this.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointerY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        if (this.dragging) {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          this.dragYaw += dx * 0.004;
          this.dragPitch = clamp(this.dragPitch + dy * 0.0028, -0.45, 0.55);
          lastX = e.clientX;
          lastY = e.clientY;
        }
      };
      this.section.addEventListener('pointermove', onMove, { passive: true });
      this.section.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('a, button, input')) return;
        this.dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.section.classList.add('is-dragging');
      });
      window.addEventListener('pointerup', () => {
        if (!this.dragging) return;
        this.dragging = false;
        this.section.classList.remove('is-dragging');
      }, { passive: true });
      this.section.addEventListener('pointerleave', () => {
        this.pointerX = 0;
        this.pointerY = 0;
      });
    }

    projectPoint(x, y, z, yaw, pitch) {
      const px = (x - this.center.x) * this.scale;
      const py = (y - this.center.y) * this.scale;
      const pz = (z - this.center.z) * this.scale;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x1 = px * cy + pz * sy;
      const z1 = -px * sy + pz * cy;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const y2 = py * cp - z1 * sp;
      const z2 = py * sp + z1 * cp;
      const persp = 1 / (1 + z2 * 0.14);
      const unit = this.unitSize();
      const cx = this.cssWidth * (this.cssWidth < 760 ? 0.55 : 0.625);
      const cyv = this.cssHeight * (this.cssWidth < 760 ? 0.5 : 0.5);
      return {
        x: cx + x1 * unit * persp,
        y: cyv - y2 * unit * persp,
        depth: z2,
        persp
      };
    }

    unitSize() {
      if (this.cssWidth < 760) {
        return Math.min(this.cssWidth * 0.46, this.cssHeight * 0.3);
      }
      return Math.min(this.cssWidth * 0.32, this.cssHeight * 0.35);
    }

    draw(now) {
      const ctx = this.ctx;
      const w = this.cssWidth, h = this.cssHeight;
      if (!w || !h) return;
      const t = now * 0.001;
      const yaw = this.baseYaw + this.smoothPointerX * 0.12 + this.dragYaw;
      const pitch = 0.17 + this.smoothPointerY * 0.06 + this.dragPitch;
      this.currentYaw = yaw;
      this.currentPitch = pitch;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // ribbons
      for (let s = 0; s < this.strands.length; s++) {
        const strand = this.strands[s];
        const pts = [];
        for (let i = 0; i < strand.length; i++) {
          const idx = (strand.start + i) * 3;
          if (idx + 2 >= this.points.length) break;
          const pp = this.projectPoint(this.points[idx], this.points[idx + 1], this.points[idx + 2], yaw, pitch);
          pts.push(pp);
        }
        if (pts.length < 3) continue;
        const avgDepth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
        const depthAlpha = clamp(0.64 - avgDepth * 0.17, 0.28, 1);
        const buildPath = () => {
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
          }
        };
        if (strand.glow) {
          ctx.save();
          buildPath();
          ctx.strokeStyle = strand.color;
          ctx.globalAlpha = 0.13 * depthAlpha;
          ctx.lineWidth = 10;
          ctx.stroke();
          ctx.globalAlpha = 0.23 * depthAlpha;
          ctx.lineWidth = 2.8;
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        buildPath();
        ctx.strokeStyle = strand.bold ? 'rgba(255,112,68,0.5)' : strand.color;
        ctx.globalAlpha = strand.bold ? 0.64 * depthAlpha : depthAlpha;
        ctx.lineWidth = strand.bold ? 1.35 : strand.width;
        ctx.stroke();
        if (strand.dash) {
          ctx.globalAlpha = depthAlpha * 0.42;
          ctx.setLineDash([1.2, 7]);
          ctx.lineDashOffset = -now * 0.012;
          ctx.strokeStyle = 'rgba(255,132,86,0.42)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.setLineDash([]);

      // dust
      const dustStep = this.cssWidth < 760 ? 2 : 1;
      for (let i = 0; i < this.dust.length / 3; i += dustStep) {
        const pp = this.projectPoint(this.dust[i * 3], this.dust[i * 3 + 1], this.dust[i * 3 + 2], yaw, pitch);
        const alpha = clamp(0.34 - pp.depth * 0.07, 0.055, 0.38);
        const size = clamp(1.1 * pp.persp, 0.5, 1.55);
        ctx.fillStyle = `rgba(238,232,218,${alpha})`;
        ctx.fillRect(pp.x, pp.y, size, size);
      }

      // more luminous dust and a milky bokeh fringe
      ctx.fillStyle = 'rgba(255,144,95,0.36)';
      for (let i = 0; i < this.dust.length / 3; i += 13) {
        const pp = this.projectPoint(this.dust[i * 3], this.dust[i * 3 + 1], this.dust[i * 3 + 2], yaw, pitch);
        ctx.fillRect(pp.x, pp.y, 1.25, 1.25);
      }
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < this.dust.length / 3; i += this.cssWidth < 760 ? 38 : 24) {
        const pp = this.projectPoint(this.dust[i * 3], this.dust[i * 3 + 1], this.dust[i * 3 + 2], yaw, pitch);
        const size = 5 + ((i * 7) % 11);
        ctx.drawImage(this.glow, pp.x - size / 2, pp.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      // live nodes
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const pp = this.projectPoint(n.x, n.y, n.z, yaw, pitch);
        const flicker = 0.64 + 0.36 * Math.sin(t * 1.4 + n.phase);
        const size = (this.cssWidth < 760 ? 12 : 18) * n.size * pp.persp * flicker;
        ctx.globalAlpha = clamp(0.34 + 0.5 * pp.persp - 0.18, 0.12, 0.82);
        ctx.drawImage(this.glow, pp.x - size / 2, pp.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // a single hero particle with an exquisite bloom
      if (this.nodes.length) {
        const lead = this.nodes[0];
        const lp = this.projectPoint(lead.x, lead.y, lead.z, yaw, pitch);
        const g = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 28);
        g.addColorStop(0, 'rgba(255,249,237,0.95)');
        g.addColorStop(0.1, 'rgba(255,211,170,0.5)');
        g.addColorStop(0.4, 'rgba(255,96,56,0.12)');
        g.addColorStop(1, 'rgba(255,96,56,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 28, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,252,246,0.92)';
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 1.4, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      // telemetry readout — real coordinates from a live particle
      if (now - this.lastCoordUpdate > 100 && this.nodes.length) {
        this.lastCoordUpdate = now;
        const n = this.nodes[Math.floor(this.nodes.length / 3)];
        const coordEl = $('#heroCoord');
        if (coordEl) {
          coordEl.innerHTML = `X ${n.x >= 0 ? '+' : '−'}${Math.abs(n.x).toFixed(3).padStart(6, '0')} &nbsp; Y ${n.y >= 0 ? '+' : '−'}${Math.abs(n.y).toFixed(3).padStart(6, '0')} &nbsp; Z ${n.z >= 0 ? '+' : '−'}${Math.abs(n.z).toFixed(3).padStart(6, '0')}`;
        }
      }
    }

    advance(dtFactor = 1) {
      const p = this.params;
      const dt = 0.0065 * dtFactor;
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const state = [n.x, n.y, n.z];
        advanceTriple(this.sys, p, state, dt);
        n.x = state[0];
        n.y = state[1];
        n.z = state[2];
        if (!Number.isFinite(n.x) || Math.abs(n.x) > 500) {
          const idx = Math.floor(this.rng() * this.count) * 3;
          n.x = this.points[idx];
          n.y = this.points[idx + 1];
          n.z = this.points[idx + 2];
        }
      }
      this.baseYaw += this.dragging ? 0 : 0.00038 * dtFactor;
    }

    frame = now => {
      if (!this.running) return;
      if (!this.lastTime) this.lastTime = now;
      const elapsed = Math.min(50, now - this.lastTime);
      this.lastTime = now;
      this.smoothPointerX = lerp(this.smoothPointerX, this.pointerX, 0.04);
      this.smoothPointerY = lerp(this.smoothPointerY, this.pointerY, 0.04);
      this.advance(elapsed / 16.67);
      this.draw(now);
      this.raf = requestAnimationFrame(this.frame);
    };

    start() {
      if (this.running || this.reduced) return;
      this.running = true;
      this.lastTime = 0;
      this.raf = requestAnimationFrame(this.frame);
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    renderStatic() {
      this.smoothPointerX = this.pointerX;
      this.smoothPointerY = this.pointerY;
      this.draw(performance.now());
    }
  }

  /* ============================================================
     LYAPUNOV TRACKER — state + variational equations + QR
     ============================================================ */

  class LyapunovTracker {
    constructor(system, params, options = {}) {
      this.onPrime = options.onPrime || (() => {});
      this.maxHistory = 360;
      this.s = new Float64Array(12);
      this.k1 = new Float64Array(12);
      this.k2 = new Float64Array(12);
      this.k3 = new Float64Array(12);
      this.k4 = new Float64Array(12);
      this.tmp = new Float64Array(12);
      this.f = new Float64Array(3);
      this.j = new Float64Array(9);
      this.primeSteps = deviceIsSmall() ? 8800 : 12500;
      this.reset(system, params);
    }

    reset(system, params) {
      this.system = system;
      this.params = params;
      this.dt = system.lyapDt || 0.012;
      this.qrEvery = Math.max(1, Math.round(0.075 / this.dt));
      this.sums = [0, 0, 0];
      this.time = 0;
      this.stepsSinceQR = 0;
      this.history = [];
      this.ready = false;
      this.lastRecord = -Infinity;

      // settle onto the attracting set before measuring stretching
      const state = [system.lyapSeed[0], system.lyapSeed[1], system.lyapSeed[2]];
      const transient = Math.max(400, Math.round(7 / this.dt));
      for (let i = 0; i < transient; i++) {
        advanceTriple(system, params, state, this.dt);
        if (!Number.isFinite(state[0]) || !Number.isFinite(state[1]) || !Number.isFinite(state[2])) {
          state[0] = system.lyapSeed[0];
          state[1] = system.lyapSeed[1];
          state[2] = system.lyapSeed[2];
        }
      }

      this.s.fill(0);
      this.s[0] = state[0]; this.s[1] = state[1]; this.s[2] = state[2];
      this.s[3] = 1; this.s[7] = 1; this.s[11] = 1;

      this.prime();
    }

    evalDerivative(s, out) {
      const sys = this.system;
      const p = this.params;
      sys.f(s[0], s[1], s[2], p, this.f);
      sys.jac(s[0], s[1], s[2], p, this.j);

      out[0] = this.f[0];
      out[1] = this.f[1];
      out[2] = this.f[2];

      const j = this.j;
      const ax = s[3], ay = s[4], az = s[5];
      const bx = s[6], by = s[7], bz = s[8];
      const cx = s[9], cy = s[10], cz = s[11];

      out[3] = j[0] * ax + j[1] * ay + j[2] * az;
      out[4] = j[3] * ax + j[4] * ay + j[5] * az;
      out[5] = j[6] * ax + j[7] * ay + j[8] * az;

      out[6] = j[0] * bx + j[1] * by + j[2] * bz;
      out[7] = j[3] * bx + j[4] * by + j[5] * bz;
      out[8] = j[6] * bx + j[7] * by + j[8] * bz;

      out[9] = j[0] * cx + j[1] * cy + j[2] * cz;
      out[10] = j[3] * cx + j[4] * cy + j[5] * cz;
      out[11] = j[6] * cx + j[7] * cy + j[8] * cz;
    }

    step() {
      const s = this.s;
      const dt = this.dt;
      const k1 = this.k1, k2 = this.k2, k3 = this.k3, k4 = this.k4, tmp = this.tmp;

      this.evalDerivative(s, k1);
      for (let i = 0; i < 12; i++) tmp[i] = s[i] + dt * 0.5 * k1[i];
      this.evalDerivative(tmp, k2);
      for (let i = 0; i < 12; i++) tmp[i] = s[i] + dt * 0.5 * k2[i];
      this.evalDerivative(tmp, k3);
      for (let i = 0; i < 12; i++) tmp[i] = s[i] + dt * k3[i];
      this.evalDerivative(tmp, k4);
      for (let i = 0; i < 12; i++) s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);

      this.time += dt;
      this.stepsSinceQR++;
      if (this.stepsSinceQR >= this.qrEvery) {
        this.gramSchmidt();
        this.stepsSinceQR = 0;
      }

      if (this.time - this.lastRecord >= 0.55) {
        this.lastRecord = this.time;
        this.recordHistory();
      }
    }

    recordHistory() {
      if (!this.time) return;
      const v = this.values;
      this.history.push({ t: this.time, l1: v[0], l2: v[1], l3: v[2] });
      if (this.history.length > this.maxHistory) this.history.shift();
    }

    gramSchmidt() {
      const s = this.s;
      let ax = s[3], ay = s[4], az = s[5];
      let bx = s[6], by = s[7], bz = s[8];
      let cx = s[9], cy = s[10], cz = s[11];

      let r1 = Math.hypot(ax, ay, az);
      if (!(r1 > 1e-300) || !Number.isFinite(r1)) r1 = 1e-300;
      this.sums[0] += Math.log(r1);
      ax /= r1; ay /= r1; az /= r1;

      const bDotA = bx * ax + by * ay + bz * az;
      bx -= bDotA * ax; by -= bDotA * ay; bz -= bDotA * az;
      let r2 = Math.hypot(bx, by, bz);
      if (!(r2 > 1e-300) || !Number.isFinite(r2)) r2 = 1e-300;
      this.sums[1] += Math.log(r2);
      bx /= r2; by /= r2; bz /= r2;

      const cDotA = cx * ax + cy * ay + cz * az;
      const cDotB = cx * bx + cy * by + cz * bz;
      cx -= cDotA * ax + cDotB * bx;
      cy -= cDotA * ay + cDotB * by;
      cz -= cDotA * az + cDotB * bz;
      let r3 = Math.hypot(cx, cy, cz);
      if (!(r3 > 1e-300) || !Number.isFinite(r3)) r3 = 1e-300;
      this.sums[2] += Math.log(r3);
      cx /= r3; cy /= r3; cz /= r3;

      s[3] = ax; s[4] = ay; s[5] = az;
      s[6] = bx; s[7] = by; s[8] = bz;
      s[9] = cx; s[10] = cy; s[11] = cz;
    }

    prime() {
      const target = this.primeSteps;
      for (let i = 0; i < target; i++) this.step();
      if (this.stepsSinceQR !== 0) {
        this.gramSchmidt();
        this.stepsSinceQR = 0;
      }
      this.recordHistory();
      this.ready = true;
      this.onPrime(this);
    }

    advance(steps = 4) {
      for (let i = 0; i < steps; i++) this.step();
    }

    get values() {
      if (!this.time) return [0, 0, 0];
      return [this.sums[0] / this.time, this.sums[1] / this.time, this.sums[2] / this.time];
    }

    get sum() {
      return this.values.reduce((a, b) => a + b, 0);
    }

    get dimension() {
      const v = this.values;
      if (!Number.isFinite(v[0])) return 0;
      if (v[0] <= 0) return v[0] > -0.02 ? 1 : 0;
      if (v[0] + v[1] > 0) {
        return v[2] !== 0 ? 2 + (v[0] + v[1]) / Math.abs(v[2]) : 2;
      }
      return v[1] !== 0 ? 1 + v[0] / Math.abs(v[1]) : 1;
    }

    get regime() {
      const [l1, l2] = this.values;
      if (!Number.isFinite(l1) || !Number.isFinite(l2)) return 'MEASURING';
      // For a 3D flow, chaos needs λ₁ > 0 and a neutral direction λ₂ ≈ 0.
      // A limit cycle instead has λ₁ ≈ 0 with a clearly negative λ₂;
      // early finite-time estimates can still make λ₁ appear slightly positive.
      if (l1 > 0.05) return 'CHAOTIC';
      if (l1 > 0.005 && l2 > -0.03) return 'CHAOTIC';
      if (l1 > -0.006) return 'PERIODIC';
      return 'STABLE';
    }
  }

  /* ============================================================
     POINT RENDERER — additive GPU point cloud with 2D fallback
     ============================================================ */

  const POINT_VERT = `
    attribute vec3 aPosition;
    attribute float aHeat;
    uniform vec3 uCenter;
    uniform float uScale;
    uniform float uYaw;
    uniform float uPitch;
    uniform float uZoom;
    uniform float uSize;
    uniform vec2 uResolution;
    varying float vHeat;
    varying float vFade;

    void main() {
      vec3 p = (aPosition - uCenter) * uScale;
      float cy = cos(uYaw);
      float sy = sin(uYaw);
      vec3 q = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      float cp = cos(uPitch);
      float sp = sin(uPitch);
      q = vec3(q.x, q.y * cp - q.z * sp, q.y * sp + q.z * cp);
      float z = q.z + uZoom;
      float aspect = uResolution.x / max(uResolution.y, 1.0);
      float f = 2.15;
      gl_Position = vec4(q.x * f / (aspect * z), q.y * f / z, 0.0, 1.0);
      vHeat = aHeat;
      vFade = smoothstep(-1.1, 0.9, q.z) * 0.36 + 0.64;
      gl_PointSize = clamp(uSize * (uZoom / z), 0.8, 46.0);
    }
  `;

  const POINT_FRAG = `
    precision mediump float;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uOpacity;
    uniform float uPower;
    varying float vHeat;
    varying float vFade;

    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float d = length(c);
      float a = smoothstep(0.5, 0.04, d);
      a = pow(a, uPower) * uOpacity * vFade;
      vec3 color = mix(uColorA, uColorB, clamp(vHeat, 0.0, 1.0));
      gl_FragColor = vec4(color * a, a);
    }
  `;

  class PointRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = null;
      this.ctx2d = null;
      this.count = 0;
      this.positions = null;
      this.heat = null;
      this.dpr = 1;
      this.width = 1;
      this.height = 1;
      this.colors = { a: [0.68, 0.73, 0.69], b: [0.94, 0.66, 0.44] };
      this.init();
    }

    init() {
      let gl = null;
      try {
        gl = this.canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance'
        });
      } catch (err) {
        gl = null;
      }
      if (!gl) {
        this.init2D();
        return;
      }
      this.gl = gl;
      const program = this.createProgram(POINT_VERT, POINT_FRAG);
      if (!program) {
        this.gl = null;
        this.init2D();
        return;
      }
      this.program = program;
      this.positionBuffer = gl.createBuffer();
      this.heatBuffer = gl.createBuffer();
      this.uniforms = {
        center: gl.getUniformLocation(program, 'uCenter'),
        scale: gl.getUniformLocation(program, 'uScale'),
        yaw: gl.getUniformLocation(program, 'uYaw'),
        pitch: gl.getUniformLocation(program, 'uPitch'),
        zoom: gl.getUniformLocation(program, 'uZoom'),
        size: gl.getUniformLocation(program, 'uSize'),
        resolution: gl.getUniformLocation(program, 'uResolution'),
        colorA: gl.getUniformLocation(program, 'uColorA'),
        colorB: gl.getUniformLocation(program, 'uColorB'),
        opacity: gl.getUniformLocation(program, 'uOpacity'),
        power: gl.getUniformLocation(program, 'uPower')
      };
      this.positionLoc = gl.getAttribLocation(program, 'aPosition');
      this.heatLoc = gl.getAttribLocation(program, 'aHeat');
      gl.useProgram(program);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.clearColor(0.027, 0.035, 0.031, 1);
      this.mode = 'webgl';
    }

    init2D() {
      this.mode = '2d';
      this.ctx2d = this.canvas.getContext('2d');
      this.canvas.style.background = '#070908';
    }

    createShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    createProgram(vsSource, fsSource) {
      const gl = this.gl;
      const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
      const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn(gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    }

    setData(positions, heat) {
      this.positions = positions;
      this.heat = heat;
      this.count = positions.length / 3;
      if (this.mode !== 'webgl') return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.heatBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, heat, gl.STATIC_DRAW);
    }

    uploadPositions() {
      if (this.mode !== 'webgl' || !this.positions) return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions);
    }

    setColors(hexA, hexB) {
      this.colors = { a: this.normalizedColor(hexA), b: this.normalizedColor(hexB) };
      this.hexA = hexA;
      this.hexB = hexB;
    }

    normalizedColor(hex) {
      const { r, g, b } = hexToRgb(hex);
      return [r / 255, g / 255, b / 255];
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(1, Math.round(rect.width * this.dpr));
      this.height = Math.max(1, Math.round(rect.height * this.dpr));
      if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
      }
      if (this.gl) this.gl.viewport(0, 0, this.width, this.height);
    }

    render(camera, opacity = 1) {
      if (!this.count) return;
      if (this.mode === 'webgl') {
        this.renderWebGL(camera, opacity);
      } else {
        this.render2D(camera, opacity);
      }
    }

    renderWebGL(camera, opacity) {
      const gl = this.gl;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(this.positionLoc);
      gl.vertexAttribPointer(this.positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.heatBuffer);
      gl.enableVertexAttribArray(this.heatLoc);
      gl.vertexAttribPointer(this.heatLoc, 1, gl.FLOAT, false, 0, 0);

      gl.uniform3f(this.uniforms.center, camera.center.x, camera.center.y, camera.center.z);
      gl.uniform1f(this.uniforms.scale, camera.scale);
      gl.uniform1f(this.uniforms.yaw, camera.yaw);
      gl.uniform1f(this.uniforms.pitch, camera.pitch);
      gl.uniform1f(this.uniforms.zoom, camera.zoom);
      gl.uniform2f(this.uniforms.resolution, this.width, this.height);
      gl.uniform3fv(this.uniforms.colorA, this.colors.a);
      gl.uniform3fv(this.uniforms.colorB, this.colors.b);

      // a wide, dim halo
      gl.uniform1f(this.uniforms.size, 6.1 * this.dpr);
      gl.uniform1f(this.uniforms.opacity, 0.042 * opacity);
      gl.uniform1f(this.uniforms.power, 2.4);
      gl.drawArrays(gl.POINTS, 0, this.count);

      // a small luminous core
      gl.uniform1f(this.uniforms.size, 1.58 * this.dpr);
      gl.uniform1f(this.uniforms.opacity, 0.52 * opacity);
      gl.uniform1f(this.uniforms.power, 1.45);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }

    render2D(camera, opacity) {
      const ctx = this.ctx2d;
      if (!ctx) return;
      const w = this.cssWidth || this.canvas.clientWidth;
      const h = this.cssHeight || this.canvas.clientHeight;
      if (!w || !h) return;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#070908';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const ca = hexToRgb(this.hexA || '#aebbb0');
      const cb = hexToRgb(this.hexB || '#f1aa70');
      const bins = Array.from({ length: 8 }, () => []);
      for (let i = 0; i < this.count; i++) {
        const heat = this.heat[i];
        const bin = clamp(Math.floor(heat * 8), 0, 7);
        const p = rotateProject(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2],
          camera.center, camera.scale, camera.yaw, camera.pitch, camera.zoom, w, h);
        if (p) bins[bin].push(p);
      }
      for (let b = 0; b < 8; b++) {
        const t = b / 7;
        const r = Math.round(lerp(ca.r, cb.r, t));
        const g = Math.round(lerp(ca.g, cb.g, t));
        const bl = Math.round(lerp(ca.b, cb.b, t));
        ctx.fillStyle = `rgba(${r},${g},${bl},${0.34 * opacity})`;
        const list = bins[b];
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          ctx.fillRect(p.x, p.y, 1.2, 1.2);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ============================================================
     LAB / OBSERVATORY
     ============================================================ */

  class LabController {
    constructor() {
      this.stage = $('#labStage');
      this.canvas = $('#labCanvas');
      this.tracerCanvas = $('#tracerCanvas');
      this.tracerCtx = this.tracerCanvas.getContext('2d');
      this.systemListEl = $('#systemList');
      this.paramListEl = $('#parameterList');
      this.system = app.system;
      this.params = app.params;
      this.n = deviceIsSmall() ? 5400 : 11800;
      this.seedNonce = 0;
      this.simTime = 0;
      this.cloud = null;
      this.center = { x: 0, y: 0, z: 0 };
      this.initialHalf = 1;
      this.halfExtent = 1;
      this.scale = 1;
      this.fade = 0;
      this.dragging = false;
      this.lastInteraction = 0;
      this.lastCoordUpdate = 0;
      this.lastUIUpdate = 0;
      this.lastBoundsUpdate = 0;
      this.lastAxisDraw = 0;
      this.running = false;
      this.visible = false;
      this.needsRecalibration = false;
      this.reduced = reduceMotion.matches;
      this.paused = this.reduced;
      this.glowSprite = makeGlowSprite(80, 'rgba(255,245,229,0.9)', 'rgba(255,133,79,0.28)');

      this.renderer = new PointRenderer(this.canvas);
      this.resize();
      this.buildSystemList();
      this.buildParamUI();
      this.bindUI();
      this.bindStage();
      this.seedCloud();
      this.applySystemVisuals();
      this.syncPauseUI();

      this.tracker = new LyapunovTracker(this.system, this.params);
      app.tracker = this.tracker;
      this.publishLyapunov(true);
      this.observe();
    }

    buildSystemList() {
      this.systemListEl.innerHTML = '';
      SYSTEMS.forEach(sys => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'system-item';
        btn.dataset.system = sys.id;
        btn.setAttribute('aria-pressed', String(sys.id === this.system.id));
        btn.innerHTML = `
          <span class="system-item__num">${String(sys.index).padStart(2, '0')}</span>
          <span><span class="system-item__name">${sys.name}</span><span class="system-item__cn" style="display:block">${sys.cn.replace('吸引子', '')}</span></span>
          <span class="system-item__year">${sys.year}</span>
        `;
        btn.addEventListener('click', () => this.setSystem(sys.id));
        if (sys.id === this.system.id) btn.classList.add('is-active');
        this.systemListEl.appendChild(btn);
      });
    }

    buildParamUI() {
      this.paramListEl.innerHTML = '';
      const visibleParams = this.system.params.filter(p => !p.hidden);
      visibleParams.forEach(param => {
        const wrap = document.createElement('div');
        wrap.className = 'parameter';
        const value = this.params[param.key];
        wrap.innerHTML = `
          <div class="parameter__head">
            <label class="parameter__name" for="param-${param.key}">
              <span class="parameter__symbol">${param.symbol}</span>
              <span>${param.cn}</span>
            </label>
            <output class="parameter__value" for="param-${param.key}">${this.formatParam(param, value)}</output>
          </div>
          <input class="range" id="param-${param.key}" type="range"
            min="${param.min}" max="${param.max}" step="${param.step}" value="${value}"
            aria-label="${param.cn} ${param.symbol}" data-param="${param.key}">
        `;
        const input = $('input', wrap);
        const output = $('output', wrap);
        setRangeFill(input);
        input.addEventListener('input', () => {
          const num = Number(input.value);
          this.params[param.key] = num;
          output.textContent = this.formatParam(param, num);
          setRangeFill(input);
          this.markCalibration();
        });
        this.paramListEl.appendChild(wrap);
      });
    }

    formatParam(param, value) {
      return Number(value).toFixed(param.precision ?? 3);
    }

    applySystemVisuals() {
      const sys = this.system;
      $('#systemIndex').textContent = `SYS. ${String(sys.index).padStart(2, '0')}`;
      $('#systemTitle').textContent = sys.name;
      $('#systemChinese').textContent = sys.cn;
      $('#systemYear').textContent = sys.year;
      $('#systemCount').textContent = String(sys.index).padStart(2, '0');
      $('#systemNote').textContent = sys.note;
      $('#labParticles').textContent = `${this.n.toLocaleString('en-US')} PATHS`;
      $('#historySystem').textContent = sys.name;
      $('#spectrumSystem').textContent = sys.name;
      this.renderer.setColors(sys.palette.a, sys.palette.b);
      this.stage.dataset.palette = sys.id;
    }

    bindUI() {
      $('#pauseBtn').addEventListener('click', () => this.togglePause());
      $('#reseedBtn').addEventListener('click', () => this.reseed());
      $('#resetSystemBtn').addEventListener('click', () => this.resetParameters());
    }

    bindStage() {
      let lastX = 0, lastY = 0;
      this.stage.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('button, a, input')) return;
        this.dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.lastInteraction = performance.now();
        this.stage.classList.add('is-dragging');
        try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      });
      this.stage.addEventListener('pointermove', e => {
        if (!this.dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        this.targetYaw += dx * 0.0072;
        this.targetPitch = clamp(this.targetPitch + dy * 0.0055, -1.22, 1.22);
        this.lastInteraction = performance.now();
      });
      const stopDrag = e => {
        if (!this.dragging) return;
        this.dragging = false;
        this.lastInteraction = performance.now();
        this.stage.classList.remove('is-dragging');
        try { this.stage.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      };
      this.stage.addEventListener('pointerup', stopDrag);
      this.stage.addEventListener('pointercancel', stopDrag);
      this.stage.addEventListener('wheel', e => {
        e.preventDefault();
        this.targetZoom = clamp(this.targetZoom * (1 + e.deltaY * 0.0011), 2.05, 6.8);
        this.lastInteraction = performance.now();
      }, { passive: false });
      this.stage.addEventListener('dblclick', e => {
        if (e.target.closest('button, a, input')) return;
        this.resetCamera();
      });
      new ResizeObserver(() => {
        this.resize();
      }).observe(this.stage);
    }

    resetCamera() {
      const sys = this.system;
      this.targetYaw = sys.view.yaw;
      this.targetPitch = sys.view.pitch;
      this.targetZoom = 2.8;
      this.lastInteraction = performance.now();
    }

    resize() {
      this.renderer.resize();
      const rect = this.stage.getBoundingClientRect();
      this.cssWidth = Math.max(1, rect.width);
      this.cssHeight = Math.max(1, rect.height);
      this.tracerDpr = Math.min(window.devicePixelRatio || 1, 2);
      this.tracerCanvas.width = Math.round(this.cssWidth * this.tracerDpr);
      this.tracerCanvas.height = Math.round(this.cssHeight * this.tracerDpr);
      this.tracerCtx.setTransform(this.tracerDpr, 0, 0, this.tracerDpr, 0, 0);
      const gizmo = $('#axisGizmo');
      if (gizmo) {
        const gdpr = Math.min(window.devicePixelRatio || 1, 2);
        gizmo.width = 84 * gdpr;
        gizmo.height = 84 * gdpr;
        gizmo.getContext('2d').setTransform(gdpr, 0, 0, gdpr, 0, 0);
      }
      this.axisDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (this.center) this.drawTrails(performance.now());
    }

    observe() {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          this.visible = entry.isIntersecting;
          if (entry.isIntersecting) this.start();
          else if (!app.spectrumVisible) this.stop();
        });
      }, { rootMargin: '180px 0px', threshold: 0.01 });
      io.observe($('#observatory'));
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastFrame = 0;
      this.raf = requestAnimationFrame(this.frame);
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    syncPauseUI() {
      const btn = $('#pauseBtn');
      if (!btn) return;
      btn.classList.toggle('is-paused', this.paused);
      btn.setAttribute('aria-pressed', String(this.paused));
      const label = $('#pauseLabel');
      if (label) label.textContent = this.paused ? 'RESUME' : 'PAUSE';
      this.stage.classList.toggle('is-paused', this.paused);
      const status = $('#labStageStatus');
      const labels = status ? status.querySelectorAll('span') : [];
      if (labels[1]) labels[1].textContent = this.paused ? 'PAUSED' : 'INTEGRATING';
    }

    togglePause() {
      this.paused = !this.paused;
      this.syncPauseUI();
    }

    reseed() {
      this.seedNonce++;
      this.seedCloud();
      this.resetCamera();
      this.fade = 0;
      this.recalibrateTracker();
      this.stage.animate(
        [{ opacity: 0.45 }, { opacity: 1 }],
        { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }

    setSystem(id) {
      if (!SYSTEM_MAP.has(id) || id === this.system.id) return;
      this.clearCalibrationTimer();
      this.system = SYSTEM_MAP.get(id);
      this.params = defaultParams(this.system);
      app.system = this.system;
      app.params = this.params;
      this.seedNonce = 0;
      this.buildParamUI();
      this.buildSystemList();
      this.applySystemVisuals();
      this.resetCamera();
      this.seedCloud();
      this.fade = 0;
      this.recalibrateTracker();
      const reduced = this.reduced;
      if (!reduced) {
        this.stage.animate(
          [{ opacity: 0.55 }, { opacity: 1 }],
          { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
      }
    }

    resetParameters() {
      const next = defaultParams(this.system);
      this.params = next;
      app.params = next;
      this.buildParamUI();
      this.markCalibration(true);
      this.resetCamera();
      this.seedCloud();
    }

    markCalibration(immediate = false) {
      this.needsRecalibration = true;
      const status = $('#labStageStatus');
      if (status) {
        const labels = status.querySelectorAll('span');
        if (labels[1]) labels[1].textContent = 'ADAPTING…';
      }
      if (this.calibrationTimer) clearTimeout(this.calibrationTimer);
      this.calibrationTimer = setTimeout(() => {
        this.needsRecalibration = false;
        this.recalibrateTracker();
      }, immediate ? 45 : 260);
    }

    clearCalibrationTimer() {
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
    }

    recalibrateTracker() {
      this.clearCalibrationTimer();
      this.tracker = new LyapunovTracker(this.system, this.params);
      app.tracker = this.tracker;
      this.publishLyapunov(true);
      const status = $('#labStageStatus');
      if (status) {
        const labels = status.querySelectorAll('span');
        if (labels[1]) labels[1].textContent = this.paused ? 'PAUSED' : (this.system.id === 'lorenz' ? 'BUTTERFLY ATTRACTOR' : 'INTEGRATING');
      }
    }

    publishLyapunov(force = false) {
      const tracker = this.tracker;
      if (!tracker) return;
      const values = tracker.values.slice();
      const snapshot = {
        system: this.system,
        values,
        sum: tracker.sum,
        dimension: tracker.dimension,
        regime: tracker.regime,
        time: tracker.time,
        history: tracker.history.slice(),
        force
      };
      app.lyapunov = snapshot;
      this.updateReadouts(snapshot);
      document.dispatchEvent(new CustomEvent('chaos:lyapunov', { detail: snapshot }));
    }

    updateReadouts(snapshot) {
      const values = snapshot.values;
      const maxAbs = Math.max(0.45, ...values.map(v => Math.abs(v)));
      const logMax = Math.log1p(maxAbs);
      const bars = [
        { val: $('#miniL1'), row: $('.mini-row[data-mini="0"] i'), value: values[0] },
        { val: $('#miniL2'), row: $('.mini-row[data-mini="1"] i'), value: values[1] },
        { val: $('#miniL3'), row: $('.mini-row[data-mini="2"] i'), value: values[2] }
      ];
      bars.forEach((bar, i) => {
        if (!bar.val || !bar.row) return;
        bar.val.textContent = signed(bar.value, 4);
        const width = clamp(Math.log1p(Math.abs(bar.value)) / logMax * 50, 0, 50);
        bar.row.style.width = `${width}%`;
        bar.row.style.left = bar.value >= 0 ? '50%' : `${50 - width}%`;
      });
      const sumEl = $('#labSum');
      const dimEl = $('#labDim');
      const regimeEl = $('#labRegime');
      if (sumEl) sumEl.textContent = signed(snapshot.sum, 3);
      if (dimEl) dimEl.textContent = snapshot.dimension.toFixed(3);
      if (regimeEl) {
        const regime = snapshot.regime;
        regimeEl.innerHTML = `<i></i> ${regime}`;
        regimeEl.classList.toggle('is-stable', regime === 'STABLE');
        regimeEl.classList.toggle('is-periodic', regime === 'PERIODIC');
      }
      const meta = this.stage.querySelector('.lab-stage__status span:nth-child(2)');
      if (meta && this.needsRecalibration) meta.textContent = 'ADAPTING…';
    }

    seedCloud() {
      const sys = this.system;
      const p = this.params;
      const n = this.n;
      const positions = new Float32Array(n * 3);
      const heat = new Float32Array(n);
      const speeds = new Float32Array(n);
      const rng = mulberry32(sys.index * 9013 + this.seedNonce * 733 + 67);
      let minSpeed = Infinity, maxSpeed = -Infinity;
      const state = [
        sys.seed[0] + (rng() - 0.5) * 0.03,
        sys.seed[1] + (rng() - 0.5) * 0.03,
        sys.seed[2] + (rng() - 0.5) * 0.03
      ];
      const transient = 2100 + Math.floor(rng() * 500);
      for (let i = 0; i < transient; i++) advanceTriple(sys, p, state, sys.dt);
      for (let i = 0; i < n; i++) {
        advanceTriple(sys, p, state, sys.dt);
        if (!Number.isFinite(state[0]) || !Number.isFinite(state[1]) || !Number.isFinite(state[2]) ||
            Math.abs(state[0]) > 1e5 || Math.abs(state[1]) > 1e5 || Math.abs(state[2]) > 1e5) {
          state[0] = sys.seed[0] + (rng() - 0.5) * 0.1;
          state[1] = sys.seed[1] + (rng() - 0.5) * 0.1;
          state[2] = sys.seed[2] + (rng() - 0.5) * 0.1;
          for (let j = 0; j < 100; j++) advanceTriple(sys, p, state, sys.dt);
        }
        positions[i * 3] = state[0];
        positions[i * 3 + 1] = state[1];
        positions[i * 3 + 2] = state[2];
        sys.f(state[0], state[1], state[2], p, _rhs);
        const speed = Math.hypot(_rhs[0], _rhs[1], _rhs[2]);
        speeds[i] = speed;
        if (speed < minSpeed) minSpeed = speed;
        if (speed > maxSpeed) maxSpeed = speed;
      }
      const span = Math.max(1e-9, maxSpeed - minSpeed);
      for (let i = 0; i < n; i++) {
        const t = clamp((speeds[i] - minSpeed) / span, 0, 1);
        heat[i] = Math.pow(t, 0.82);
      }
      this.cloud = positions;
      this.heat = heat;
      this.bounds = computeBounds(positions);
      this.center = { x: this.bounds.cx, y: this.bounds.cy, z: this.bounds.cz };
      this.initialHalf = Math.max(0.05, this.bounds.half);
      this.halfExtent = this.initialHalf;
      this.scale = 1 / this.halfExtent;
      this.renderer.setData(positions, heat);
      this.renderer.setColors(this.system.palette.a, this.system.palette.b);
      this.renderer.center = this.center;
      this.renderer.scale = this.scale;
      this.buildTracers();
      this.simTime = 0;
      this.fade = 0;
      if (!this.targetYaw && this.targetYaw !== 0) this.resetCamera();
      if (this.targetYaw === undefined) this.resetCamera();
      app.cloudCount = n;
    }

    buildTracers() {
      const sys = this.system;
      const p = this.params;
      const count = 6;
      this.tracers = [];
      for (let t = 0; t < count; t++) {
        const idx = Math.floor(((t + 0.5) / count) * (this.n - 1));
        const state = [
          this.cloud[idx * 3],
          this.cloud[idx * 3 + 1],
          this.cloud[idx * 3 + 2]
        ];
        const history = [];
        for (let i = 0; i < 82; i++) {
          advanceTriple(sys, p, state, sys.dt);
          history.push([state[0], state[1], state[2]]);
        }
        this.tracers.push({
          history,
          color: sys.palette.tracer[t % sys.palette.tracer.length],
          head: state
        });
      }
    }

    advanceTracers() {
      const sys = this.system;
      const p = this.params;
      for (let t = 0; t < this.tracers.length; t++) {
        const tracer = this.tracers[t];
        advanceTriple(sys, p, tracer.head, sys.dt);
        tracer.history.push([tracer.head[0], tracer.head[1], tracer.head[2]]);
        if (tracer.history.length > 112) tracer.history.shift();
      }
    }

    updateCloud() {
      if (!this.cloud) return;
      const sys = this.system;
      const p = this.params;
      const pos = this.cloud;
      const n = this.n;
      for (let i = 0; i < n; i++) {
        const idx = i * 3;
        const x = pos[idx], y = pos[idx + 1], z = pos[idx + 2];
        sys.f(x, y, z, p, _rhs);
        const k1x = _rhs[0], k1y = _rhs[1], k1z = _rhs[2];
        sys.f(x + sys.dt * 0.5 * k1x, y + sys.dt * 0.5 * k1y, z + sys.dt * 0.5 * k1z, p, _rhs);
        const k2x = _rhs[0], k2y = _rhs[1], k2z = _rhs[2];
        sys.f(x + sys.dt * 0.5 * k2x, y + sys.dt * 0.5 * k2y, z + sys.dt * 0.5 * k2z, p, _rhs);
        const k3x = _rhs[0], k3y = _rhs[1], k3z = _rhs[2];
        sys.f(x + sys.dt * k3x, y + sys.dt * k3y, z + sys.dt * k3z, p, _rhs);
        const k4x = _rhs[0], k4y = _rhs[1], k4z = _rhs[2];
        const nx = x + (sys.dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        const ny = y + (sys.dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
        const nz = z + (sys.dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
        if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz) ||
            Math.abs(nx) > 1e5 || Math.abs(ny) > 1e5 || Math.abs(nz) > 1e5) {
          const rng = Math.random;
          pos[idx] = sys.seed[0] + (rng() - 0.5) * 0.1;
          pos[idx + 1] = sys.seed[1] + (rng() - 0.5) * 0.1;
          pos[idx + 2] = sys.seed[2] + (rng() - 0.5) * 0.1;
        } else {
          pos[idx] = nx;
          pos[idx + 1] = ny;
          pos[idx + 2] = nz;
        }
      }
      this.simTime += sys.dt;
    }

    updateBounds() {
      const bounds = computeBounds(this.cloud);
      if (!bounds) return;
      const targetHalf = clamp(bounds.half, this.initialHalf * 0.18, this.initialHalf * 3.5);
      this.center.x = lerp(this.center.x, bounds.cx, 0.12);
      this.center.y = lerp(this.center.y, bounds.cy, 0.12);
      this.center.z = lerp(this.center.z, bounds.cz, 0.12);
      this.halfExtent = lerp(this.halfExtent, targetHalf, 0.1);
      this.scale = 1 / Math.max(0.002, this.halfExtent);
    }

    cameraState() {
      return {
        center: this.center,
        scale: this.scale,
        yaw: this.yaw,
        pitch: this.pitch,
        zoom: this.zoom
      };
    }

    updateCamera(dtFactor) {
      if (!this.targetYaw && this.targetYaw !== 0) {
        this.targetYaw = this.system.view.yaw;
        this.targetPitch = this.system.view.pitch;
        this.targetZoom = 2.8;
      }
      if (!this.reduced && !this.dragging && performance.now() - this.lastInteraction > 2600) {
        this.targetYaw += 0.00105 * dtFactor;
      }
      this.yaw = lerp(this.yaw ?? this.targetYaw, this.targetYaw, 0.075);
      this.pitch = lerp(this.pitch ?? this.targetPitch, this.targetPitch, 0.075);
      this.zoom = lerp(this.zoom ?? this.targetZoom, this.targetZoom, 0.08);
      this.scale = 1 / Math.max(0.002, this.halfExtent);
    }

    drawTrails(now) {
      const ctx = this.tracerCtx;
      if (!ctx || !this.cssWidth || !this.cssHeight) return;
      if (!this.tracers || !this.tracers.length) return;
      ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
      const camera = this.cameraState();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let t = 0; t < this.tracers.length; t++) {
        const tracer = this.tracers[t];
        const hist = tracer.history;
        if (hist.length < 2) continue;
        const color = hexToRgb(tracer.color);
        let previous = null;
        for (let i = 0; i < hist.length; i++) {
          const pt = hist[i];
          const proj = rotateProject(pt[0], pt[1], pt[2],
            camera.center, camera.scale, camera.yaw, camera.pitch, camera.zoom,
            this.cssWidth, this.cssHeight);
          if (!proj) {
            previous = null;
            continue;
          }
          const progress = i / hist.length;
          if (previous) {
            ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${0.03 + progress * progress * 0.62})`;
            ctx.lineWidth = 0.55 + progress * (t === 0 ? 1.35 : 0.8);
            ctx.beginPath();
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(proj.x, proj.y);
            ctx.stroke();
          }
          previous = proj;
        }
        // luminous head
        if (previous) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.6;
          ctx.drawImage(this.glowSprite, previous.x - 14, previous.y - 14, 28, 28);
          ctx.globalAlpha = 1;
          ctx.fillStyle = t === 0 ? '#ffead7' : tracer.color;
          ctx.beginPath();
          ctx.arc(previous.x, previous.y, t === 0 ? 1.7 : 1.15, 0, TAU);
          ctx.fill();
          if (t === 0) {
            ctx.strokeStyle = 'rgba(255,229,207,0.35)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(previous.x, previous.y, 5.5 + Math.sin(now * 0.002) * 0.8, 0, TAU);
            ctx.stroke();
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    drawAxisGizmo() {
      const gizmo = $('#axisGizmo');
      if (!gizmo) return;
      const ctx = gizmo.getContext('2d');
      const dpr = this.axisDpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 84, 84);
      const yaw = this.yaw || 0;
      const pitch = this.pitch || 0;
      const cx = 42, cy = 42;
      const axisLen = 24;
      const project = (x, y, z) => {
        const cyw = Math.cos(yaw), syw = Math.sin(yaw);
        const x1 = x * cyw + z * syw;
        const z1 = -x * syw + z * cyw;
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const y2 = y * cp - z1 * sp;
        return { x: cx + x1 * axisLen, y: cy - y2 * axisLen };
      };
      const axes = [
        { p: project(1, 0, 0), label: 'x', color: 'rgba(240,235,224,0.65)' },
        { p: project(0, 1, 0), label: 'y', color: 'rgba(240,235,224,0.42)' },
        { p: project(0, 0, 1), label: 'z', color: 'rgba(255,96,56,0.75)' }
      ];
      ctx.font = '7px "DejaVu Sans Mono", monospace';
      axes.forEach(axis => {
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(axis.p.x, axis.p.y);
        ctx.stroke();
        ctx.fillStyle = axis.color;
        ctx.fillText(axis.label, axis.p.x + 3, axis.p.y - 2);
        ctx.beginPath();
        ctx.arc(axis.p.x, axis.p.y, 1.15, 0, TAU);
        ctx.fill();
      });
      ctx.strokeStyle = 'rgba(240,235,224,0.14)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, TAU);
      ctx.stroke();
    }

    updateTelemetry(now) {
      if (now - this.lastCoordUpdate > 110) {
        this.lastCoordUpdate = now;
        const tracer = this.tracers && this.tracers[0];
        if (tracer) {
          const [x, y, z] = tracer.head;
          const coordEl = $('#labCoords');
          if (coordEl) {
            coordEl.innerHTML = `x ${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3).padStart(6, '0')} &nbsp; y ${y >= 0 ? '+' : '−'}${Math.abs(y).toFixed(3).padStart(6, '0')} &nbsp; z ${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(3).padStart(6, '0')}`;
          }
        }
        const timeEl = $('#labTime');
        if (timeEl) timeEl.textContent = `T ${this.paused ? '❚❚' : '+'} ${this.simTime.toFixed(2).padStart(6, '0')}`;
      }
      if (now - this.lastUIUpdate > 160) {
        this.lastUIUpdate = now;
        this.publishLyapunov();
      }
      if (now - this.lastAxisDraw > 70) {
        this.lastAxisDraw = now;
        this.drawAxisGizmo();
      }
    }

    frame = now => {
      if (!this.running) return;
      if (!this.lastFrame) this.lastFrame = now;
      const dtFactor = clamp((now - this.lastFrame) / 16.667, 0.35, 2.5);
      this.lastFrame = now;

      // When the observatory is off screen but the spectrum is being read,
      // keep only the variational integrator alive — not the hidden 3D stage.
      if (!this.visible) {
        if (!this.paused) this.tracker.advance(3);
        if (now - this.lastUIUpdate > 220) {
          this.lastUIUpdate = now;
          this.publishLyapunov();
        }
        this.raf = requestAnimationFrame(this.frame);
        return;
      }

      this.fade = Math.min(1, this.fade + 0.035 * dtFactor);

      if (!this.paused) {
        this.updateCloud();
        this.advanceTracers();
        this.tracker.advance(2);
      }

      if (now - this.lastBoundsUpdate > 200) {
        this.lastBoundsUpdate = now;
        this.updateBounds();
      }
      this.updateCamera(dtFactor);
      this.renderer.uploadPositions();
      this.renderer.render(this.cameraState(), this.fade);
      this.drawTrails(now);
      this.updateTelemetry(now);
      this.raf = requestAnimationFrame(this.frame);
    };

    startIfVisible() {
      if (this.visible || app.spectrumVisible) this.start();
    }

    setSpectrumActive(active) {
      app.spectrumVisible = active;
      if (active) this.start();
      else if (!this.visible) this.stop();
    }
  }

  /* ============================================================
     SPECTRUM VIEW — live spectrum + finite-time convergence
     ============================================================ */

  class SpectrumView {
    constructor(lab) {
      this.lab = lab;
      this.canvas = $('#historyCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.snapshot = app.lyapunov;
      this.visible = false;
      this.lastDraw = 0;
      this.resizeObserver = new ResizeObserver(() => this.resizeAndDraw());
      this.resizeObserver.observe($('.history-canvas-wrap'));
      document.addEventListener('chaos:lyapunov', e => this.update(e.detail));
      const section = $('#spectrum');
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          this.visible = entry.isIntersecting;
          app.spectrumVisible = entry.isIntersecting;
          this.lab.setSpectrumActive(entry.isIntersecting);
          if (entry.isIntersecting) this.resizeAndDraw();
        });
      }, { rootMargin: '150px 0px', threshold: 0.01 }).observe(section);
      if (this.snapshot) this.update(this.snapshot);
      this.resizeAndDraw();
    }

    update(snapshot) {
      this.snapshot = snapshot;
      const values = snapshot.values;
      const maxAbs = Math.max(0.45, ...values.map(v => Math.abs(v)));
      const logMax = Math.log1p(maxAbs);
      const rows = $$('.spec-row');
      const valueIds = ['#specL1', '#specL2', '#specL3'];
      rows.forEach((row, i) => {
        const value = values[i];
        const valueEl = $(valueIds[i]);
        const fill = $('.spec-fill', row);
        if (valueEl) valueEl.textContent = signed(value, 4);
        if (fill) {
          const width = clamp(Math.log1p(Math.abs(value)) / logMax * 50, 0, 50);
          fill.style.width = `${width}%`;
          fill.style.left = value >= 0 ? '50%' : `${50 - width}%`;
        }
      });
      const sumEl = $('#specSum');
      const dimEl = $('#specDim');
      const regimeEl = $('#specRegime');
      const systemEl = $('#spectrumSystem');
      if (sumEl) sumEl.textContent = signed(snapshot.sum, 4);
      if (dimEl) dimEl.textContent = snapshot.dimension.toFixed(4);
      if (systemEl) systemEl.textContent = snapshot.system.name;
      if (regimeEl) {
        regimeEl.innerHTML = `<i></i> ${snapshot.regime}`;
        regimeEl.classList.toggle('is-stable', snapshot.regime === 'STABLE');
        regimeEl.classList.toggle('is-periodic', snapshot.regime === 'PERIODIC');
      }
      const timeEl = $('#historyTime');
      if (timeEl) timeEl.textContent = snapshot.time.toFixed(1);
      const sysEl = $('#historySystem');
      if (sysEl) sysEl.textContent = snapshot.system.name;
      if (this.visible) this.draw();
    }

    resizeAndDraw() {
      const wrap = $('.history-canvas-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
      this.dpr = dpr;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }

    draw() {
      if (!this.snapshot || !this.ctx || !this.cssWidth) return;
      const now = performance.now();
      if (now - this.lastDraw < 70) return;
      this.lastDraw = now;
      const ctx = this.ctx;
      const w = this.cssWidth;
      const h = this.cssHeight;
      const L = 54, R = 20, T = 18, B = 28;
      const pw = Math.max(10, w - L - R);
      const ph = Math.max(10, h - T - B);
      const data = this.snapshot.history;
      ctx.clearRect(0, 0, w, h);
      if (!data || data.length < 2) return;

      const xMin = Math.max(0, data[0].t - 1);
      const xMax = Math.max(data[data.length - 1].t, xMin + 4);
      let minV = Infinity, maxV = -Infinity;
      data.forEach(d => {
        if (d.l1 < minV) minV = d.l1;
        if (d.l1 > maxV) maxV = d.l1;
      });
      const yMin = Math.min(-0.08, minV - 0.08);
      const yMax = Math.max(1.03, maxV + 0.1);
      const xScale = t => L + ((t - xMin) / (xMax - xMin)) * pw;
      const yScale = v => T + (1 - (v - yMin) / (yMax - yMin)) * ph;

      // grid
      ctx.strokeStyle = 'rgba(240,235,224,0.09)';
      ctx.lineWidth = 0.65;
      ctx.font = '9px "DejaVu Sans Mono", monospace';
      ctx.fillStyle = 'rgba(240,235,224,0.52)';
      ctx.textBaseline = 'middle';
      const xStep = xMax > 42 ? 10 : 5;
      for (let t = 0; t <= xMax; t += xStep) {
        const x = xScale(t);
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillText(String(t), x - 4, T + ph + 13);
      }
      const rawStep = (yMax - yMin) / 5;
      const stepPow = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
      const stepNorm = rawStep / stepPow;
      const yStep = (stepNorm <= 1 ? 1 : stepNorm <= 2 ? 2 : stepNorm <= 5 ? 5 : 10) * stepPow;
      const yFirst = Math.ceil(yMin / yStep) * yStep;
      for (let v = yFirst; v <= yMax + 1e-9; v += yStep) {
        const y = yScale(v);
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(1), 10, y);
      }
      ctx.strokeStyle = 'rgba(240,235,224,0.24)';
      ctx.beginPath();
      ctx.moveTo(L, T);
      ctx.lineTo(L, T + ph);
      ctx.lineTo(L + pw, T + ph);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,235,224,0.58)';
      ctx.fillText('λ₁', 10, T - 8);
      ctx.textAlign = 'right';
      ctx.fillText('t / tu', L + pw, T - 8);
      ctx.textAlign = 'left';

      // zero line
      const zeroY = yScale(0);
      if (zeroY > T && zeroY < T + ph) {
        ctx.strokeStyle = 'rgba(240,235,224,0.28)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(L, zeroY);
        ctx.lineTo(L + pw, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // area under curve
      const grad = ctx.createLinearGradient(0, T, 0, T + ph);
      grad.addColorStop(0, 'rgba(255,96,56,0.14)');
      grad.addColorStop(1, 'rgba(255,96,56,0)');
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = xScale(d.t);
        const y = yScale(d.l1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(xScale(data[data.length - 1].t), zeroY);
      ctx.lineTo(xScale(data[0].t), zeroY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // current estimate reference
      const finalValue = this.snapshot.values[0];
      const finalY = yScale(finalValue);
      ctx.strokeStyle = 'rgba(226,165,111,0.52)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(L, finalY);
      ctx.lineTo(L + pw, finalY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(226,165,111,0.75)';
      ctx.fillText(signed(finalValue, 4), L + pw - 48, finalY - 6);

      // curve
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = xScale(d.t);
        const y = yScale(d.l1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ff6b42';
      ctx.lineWidth = 1.75;
      ctx.stroke();

      // leading point
      const last = data[data.length - 1];
      const lx = xScale(last.t);
      const ly = yScale(last.l1);
      ctx.fillStyle = '#ff6b42';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,96,56,0.13)';
      ctx.beginPath();
      ctx.arc(lx, ly, 9, 0, TAU);
      ctx.fill();
    }
  }

  /* ============================================================
     SENSITIVITY — twin orbits & divergence chart
     ============================================================ */

  class SensitivityExperiment {
    constructor() {
      this.canvas = $('#twinCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.slider = $('#deltaSlider');
      this.lambda = LORENZ_REFERENCE_LAMBDA;
      this.dt = 0.005;
      this.tMax = 28;
      this.stepsPerFrame = 10;
      this.logDelta = -6;
      this.delta0 = 1e-6;
      this.direction = [0.32, -0.78, 0.54];
      this.dirNorm = Math.hypot(...this.direction);
      this.direction = this.direction.map(v => v / this.dirNorm);
      this.samples = [];
      this.base = null;
      this.twin = null;
      this.time = 0;
      this.hold = 0;
      this.measuredLambda = this.lambda;
      this.running = false;
      this.visible = false;
      this.reduced = reduceMotion.matches;
      this.cssWidth = 1;
      this.cssHeight = 1;
      this.lastReadout = 0;
      this.lastFrame = 0;
      this.stepsPerSecond = 640;
      this.raf = null;
      this.setupBase();
      this.bind();
      this.setDeltaFromExponent(this.logDelta, true);
      new ResizeObserver(() => this.resize()).observe($('.twin-chart__canvas-wrap'));
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          this.visible = entry.isIntersecting;
          if (entry.isIntersecting) this.start();
          else this.stop();
        });
      }, { rootMargin: '160px 0px', threshold: 0.01 }).observe($('#sensitivity'));
      this.resize();
    }

    setupBase() {
      const state = [1.1, 1.1, 1.1];
      for (let i = 0; i < 1800; i++) advanceTriple(LORENZ, LORENZ_DEFAULTS, state, this.dt);
      this.base = [state[0], state[1], state[2]];
    }

    bind() {
      this.slider.addEventListener('input', () => {
        const expValue = -9 + (Number(this.slider.value) / 1000) * 8;
        this.setDeltaFromExponent(expValue);
        this.updateRange();
      });
      $$('.preset[data-delta]').forEach(btn => {
        btn.addEventListener('click', () => {
          const exponent = Math.log10(Number(btn.dataset.delta));
          this.setDeltaFromExponent(exponent);
          this.updateRange();
        });
      });
      $('#replayTwin').addEventListener('click', () => this.restart(true));
    }

    setDeltaFromExponent(exponent, initial = false) {
      this.logDelta = clamp(exponent, -9, -1);
      this.delta0 = Math.pow(10, this.logDelta);
      this.slider.value = String(Math.round(((this.logDelta + 9) / 8) * 1000));
      const expEl = $('#deltaExp');
      const mantissaEl = $('#deltaMantissa');
      const exponentFloor = Math.floor(this.logDelta + 1e-10);
      const mantissa = Math.pow(10, this.logDelta - exponentFloor);
      if (expEl) expEl.textContent = superscript(exponentFloor);
      if (mantissaEl) mantissaEl.textContent = mantissa >= 9.995 ? '10.0' : mantissa.toFixed(2);
      $$('.preset[data-delta]').forEach(btn => {
        const v = Math.log10(Number(btn.dataset.delta));
        btn.classList.toggle('is-active', Math.abs(v - this.logDelta) < 0.06);
      });
      this.updateRange();
      this.restart(initial);
    }

    updateRange() {
      setRangeFill(this.slider);
      this.draw();
      this.updateReadouts(true);
    }

    restart(initial = false) {
      if (!this.base) return;
      const b = this.base;
      this.twin = [
        b[0] + this.direction[0] * this.delta0,
        b[1] + this.direction[1] * this.delta0,
        b[2] + this.direction[2] * this.delta0
      ];
      this.time = 0;
      this.hold = 0;
      this.measuredLambda = this.lambda;
      this.samples = [{ t: 0, log10: Math.log10(this.delta0) }];
      this.lastFrame = 0;
      this.updateReadouts(true);
      if (this.reduced) {
        if (this.time < this.tMax) this.integrateFast();
        this.draw();
      } else if (this.visible) {
        this.start();
        this.draw();
      }
    }

    integrateFast() {
      const microSteps = Math.ceil(this.tMax / (this.dt * 20));
      for (let f = 0; f < microSteps; f++) {
        for (let i = 0; i < 20; i++) this.integrateStep();
        this.samples.push({ t: this.time, log10: this.currentLogSeparation() });
        if (this.time >= this.tMax) break;
      }
    }

    currentLogSeparation() {
      if (!this.twin) return this.logDelta;
      const dx = this.twin[0] - this.base[0];
      const dy = this.twin[1] - this.base[1];
      const dz = this.twin[2] - this.base[2];
      return Math.log10(Math.max(1e-16, Math.hypot(dx, dy, dz)));
    }

    integrateStep() {
      advanceTriple(LORENZ, LORENZ_DEFAULTS, this.base, this.dt);
      advanceTriple(LORENZ, LORENZ_DEFAULTS, this.twin, this.dt);
      this.time += this.dt;
    }

    estimateLambda() {
      // fit the pre-saturation portion of the curve
      const points = this.samples.filter(s => s.t > 0.35 && s.log10 < 0.35 && s.log10 > Math.log10(this.delta0) + 0.35);
      if (points.length < 7) return this.lambda;
      let meanT = 0, meanY = 0;
      points.forEach(s => { meanT += s.t; meanY += s.log10; });
      meanT /= points.length;
      meanY /= points.length;
      let numerator = 0, denominator = 0;
      points.forEach(s => {
        numerator += (s.t - meanT) * (s.log10 - meanY);
        denominator += (s.t - meanT) * (s.t - meanT);
      });
      if (denominator <= 0) return this.lambda;
      const slope = numerator / denominator;
      return slope * Math.LN10;
    }

    stepFrame(elapsed = 16.67) {
      if (this.time >= this.tMax) {
        this.hold += elapsed;
        if (this.hold > 2300 && !this.reduced) this.restart();
        return;
      }
      const steps = clamp(Math.round((elapsed / 1000) * this.stepsPerSecond), 1, 80);
      for (let i = 0; i < steps; i++) {
        this.integrateStep();
        if (this.time >= this.tMax) break;
      }
      const log10 = this.currentLogSeparation();
      this.samples.push({ t: this.time, log10 });
      if (this.samples.length > 1200) this.samples.shift();
      if (this.samples.length % 12 === 0) this.measuredLambda = this.estimateLambda();
    }

    horizon() {
      return Math.log(1 / this.delta0) / this.lambda;
    }

    updateReadouts(force = false) {
      const now = performance.now();
      if (!force && now - this.lastReadout < 90) return;
      this.lastReadout = now;
      const sep = Math.pow(10, this.currentLogSeparation());
      const cur = $('#twinCurrent');
      if (cur) {
        if (sep < 1e-3 || sep > 1e3) {
          const exp = Math.floor(Math.log10(sep));
          const mant = sep / Math.pow(10, exp);
          cur.textContent = `${mant.toFixed(2)}e${exp >= 0 ? '+' : '−'}${Math.abs(exp)}`;
        } else {
          cur.textContent = sep.toFixed(4);
        }
      }
      const horizonEl = $('#twinHorizon');
      if (horizonEl) horizonEl.innerHTML = `${this.horizon().toFixed(2)} <small>tu</small>`;
      const efEl = $('#twinEfold');
      if (efEl) efEl.innerHTML = `${(1 / this.lambda).toFixed(2)} <small>tu</small>`;
      const lambdaEl = $('#twinLambda');
      if (lambdaEl) lambdaEl.textContent = signed(this.measuredLambda, 4);
    }

    resize() {
      const wrap = $('.twin-chart__canvas-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }

    formatSepTick(value) {
      return `10${superscript(Math.round(value))}`;
    }

    draw() {
      if (!this.ctx || !this.cssWidth) return;
      const ctx = this.ctx;
      const w = this.cssWidth;
      const h = this.cssHeight;
      const L = w < 520 ? 42 : 52, R = w < 520 ? 14 : 20, T = 24, B = 32;
      const pw = Math.max(10, w - L - R);
      const ph = Math.max(10, h - T - B);
      ctx.clearRect(0, 0, w, h);

      const yMin = Math.floor(this.logDelta) - 1;
      const yMax = 1.45;
      const xMax = this.tMax;
      const xScale = t => L + (t / xMax) * pw;
      const yScale = v => T + (1 - (v - yMin) / (yMax - yMin)) * ph;

      // faint saturation wash
      ctx.fillStyle = 'rgba(255,107,66,0.055)';
      ctx.fillRect(L, T, pw, Math.max(0, yScale(1.45) - yScale(0)));
      const satY = yScale(0);
      ctx.strokeStyle = 'rgba(240,235,224,0.23)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(L, satY);
      ctx.lineTo(L + pw, satY);
      ctx.stroke();
      ctx.setLineDash([]);

      // graph paper, labelled in decades
      ctx.font = '8.5px "DejaVu Sans Mono", monospace';
      ctx.textBaseline = 'middle';
      const tickStep = this.logDelta <= -8 ? 3 : 2;
      const firstTick = Math.ceil(yMin / tickStep) * tickStep;
      for (let exp = firstTick; exp <= Math.floor(yMax); exp += tickStep) {
        const y = yScale(exp);
        ctx.strokeStyle = 'rgba(240,235,224,0.09)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(240,235,224,0.56)';
        ctx.fillText(`10${superscript(exp)}`, 8, y);
      }
      for (let t = 0; t <= 25; t += 5) {
        const x = xScale(t);
        ctx.strokeStyle = 'rgba(240,235,224,0.07)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillStyle = 'rgba(240,235,224,0.55)';
        ctx.fillText(String(t), x - 3, T + ph + 14);
      }
      // axes
      ctx.strokeStyle = 'rgba(240,235,224,0.34)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(L, T);
      ctx.lineTo(L, T + ph);
      ctx.lineTo(L + pw, T + ph);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,235,224,0.66)';
      ctx.font = '8.5px "DejaVu Sans Mono", monospace';
      ctx.fillText('δ(t)', L, 9);
      ctx.textAlign = 'right';
      ctx.fillText('t / tu', L + pw, 9);
      ctx.textAlign = 'left';

      // theoretical slope
      const horizon = Math.min(this.tMax, this.horizon());
      ctx.strokeStyle = 'rgba(255,107,66,0.88)';
      ctx.lineWidth = 1.15;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xScale(0), yScale(this.logDelta));
      ctx.lineTo(xScale(horizon), yScale(Math.min(1.4, this.logDelta + this.lambda * horizon / Math.LN10)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,125,86,0.92)';
      ctx.font = '8px "DejaVu Sans Mono", monospace';
      const midT = horizon * 0.52;
      const midY = this.logDelta + (this.lambda * midT) / Math.LN10;
      ctx.fillText('δ₀e^λ₁t', xScale(midT) + 6, yScale(midY) - 12);

      // actual curve
      if (this.samples.length > 1) {
        ctx.beginPath();
        this.samples.forEach((sample, i) => {
          const x = xScale(sample.t);
          const y = yScale(clamp(sample.log10, yMin, 1.4));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(240,235,224,0.12)';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = '#f1eadd';
        ctx.lineWidth = 1.85;
        ctx.stroke();

        // head
        const last = this.samples[this.samples.length - 1];
        const px = xScale(last.t);
        const py = yScale(clamp(last.log10, yMin, 1.4));
        ctx.fillStyle = 'rgba(255,107,66,0.16)';
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff6b42';
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, TAU);
        ctx.fill();
      }

      // horizon marker
      if (horizon > 0.5 && horizon < this.tMax) {
        const hx = xScale(horizon);
        ctx.strokeStyle = 'rgba(255,107,66,0.38)';
        ctx.setLineDash([1, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, T);
        ctx.lineTo(hx, T + ph);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,125,86,0.92)';
        ctx.font = '8px "DejaVu Sans Mono", monospace';
        ctx.fillText('τ', hx + 4, T + 9);
      }

      // small saturation label
      ctx.fillStyle = 'rgba(240,235,224,0.48)';
      ctx.font = '7.5px "DejaVu Sans Mono", monospace';
      ctx.fillText('MACROSCOPIC · 宏观尺度', L + 8, satY - 8);
    }

    frame = now => {
      if (!this.running) return;
      const elapsed = this.lastFrame ? clamp(now - this.lastFrame, 4, 140) : 16.67;
      this.lastFrame = now;
      this.stepFrame(elapsed);
      this.draw();
      this.updateReadouts();
      this.raf = requestAnimationFrame(this.frame);
    };

    start() {
      if (this.reduced) {
        if (this.time < this.tMax) this.integrateFast();
        this.draw();
        return;
      }
      if (this.running) return;
      this.running = true;
      this.lastFrame = 0;
      this.raf = requestAnimationFrame(this.frame);
    }

    stop() {
      this.running = false;
      this.lastFrame = 0;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  /* ============================================================
     BIFURCATION ATLAS — the logistic family
     ============================================================ */

  class BifurcationAtlas {
    constructor() {
      this.base = $('#bifurcationBase');
      this.overlay = $('#bifurcationOverlay');
      this.baseCtx = this.base.getContext('2d');
      this.overlayCtx = this.overlay.getContext('2d');
      this.plot = $('#bifurcationPlot');
      this.slider = $('#rSlider');
      this.cobweb = $('#cobwebCanvas');
      this.cobwebCtx = this.cobweb.getContext('2d');
      this.rMin = 2.8;
      this.rMax = 4;
      this.r = 3.9;
      this.analysis = null;
      this.dpr = 1;
      this.cssWidth = 1;
      this.cssHeight = 1;
      this.prepared = false;
      this.pendingR = null;
      this.raf = null;
      this.tweenRaf = null;
      this.lastInteraction = 0;
      this.resizeTimer = null;
      this.bind();
      this.slider.value = this.r.toFixed(4);
      setRangeFill(this.slider);
      if (this.overlay) {
        new ResizeObserver(() => {
          clearTimeout(this.resizeTimer);
          this.resizeTimer = setTimeout(() => this.resize(), 140);
        }).observe(this.plot);
      }
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.prepared) {
            this.prepare();
            io.disconnect();
          }
        });
      }, { rootMargin: '280px 0px', threshold: 0.01 });
      io.observe($('#bifurcation'));
      setTimeout(() => {
        if (!this.prepared) this.prepare();
      }, 900);
    }

    bind() {
      this.slider.addEventListener('input', () => {
        this.cancelTween();
        this.scheduleR(Number(this.slider.value));
      });

      $$('.preset[data-r]').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = Number(btn.dataset.r);
          this.animateTo(target);
        });
      });

      const pointerR = e => {
        const rect = this.overlay.getBoundingClientRect();
        const { L, pw } = this.margins();
        const x = e.clientX - rect.left;
        if (x < L - 2 || x > L + pw + 2) return null;
        return this.rMin + clamp((x - L) / pw, 0, 1) * (this.rMax - this.rMin);
      };
      this.overlay.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        this.cancelTween();
        this.pointerActive = true;
        try { this.overlay.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        const r = pointerR(e);
        if (r !== null) this.scheduleR(r);
      });
      this.overlay.addEventListener('pointermove', e => {
        const isMouse = e.pointerType === 'mouse';
        if (!isMouse && !this.pointerActive) return;
        const r = pointerR(e);
        if (r !== null) {
          this.cancelTween();
          this.scheduleR(r);
        }
      });
      const end = e => {
        this.pointerActive = false;
        try { this.overlay.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      };
      this.overlay.addEventListener('pointerup', end);
      this.overlay.addEventListener('pointercancel', end);
    }

    cancelTween() {
      if (this.tweenRaf) cancelAnimationFrame(this.tweenRaf);
      this.tweenRaf = null;
    }

    animateTo(target) {
      this.cancelTween();
      if (reduceMotion.matches) {
        this.commitR(target, true);
        return;
      }
      const start = this.r;
      const t0 = performance.now();
      const duration = 780;
      const step = now => {
        const t = clamp((now - t0) / duration, 0, 1);
        this.commitR(lerp(start, target, easeInOutCubic(t)), false);
        if (t < 1) this.tweenRaf = requestAnimationFrame(step);
        else this.tweenRaf = null;
      };
      this.tweenRaf = requestAnimationFrame(step);
    }

    scheduleR(r) {
      this.pendingR = clamp(r, this.rMin, this.rMax);
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = null;
        if (this.pendingR !== null) this.commitR(this.pendingR, true);
      });
    }

    prepare() {
      if (this.prepared && this.cssWidth > 1) {
        this.drawOverlay();
        return;
      }
      this.layout();
      this.prepared = true;
      this.renderBase();
      this.commitR(this.r, false);
    }

    layout() {
      const rect = this.plot.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      [this.base, this.overlay].forEach(canvas => {
        canvas.width = Math.round(rect.width * this.dpr);
        canvas.height = Math.round(rect.height * this.dpr);
      });
      this.baseCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.overlayCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    margins() {
      const w = this.cssWidth;
      const left = w < 520 ? 36 : 48;
      const right = w < 520 ? 12 : 18;
      const top = 27;
      const bottom = 30;
      return { L: left, R: right, T: top, B: bottom, pw: w - left - right, ph: this.cssHeight - top - bottom };
    }

    analyze(r) {
      let x = 0.41;
      for (let i = 0; i < 900; i++) x = r * x * (1 - x);
      let sum = 0;
      const total = 2400;
      const orbit = [];
      for (let i = 0; i < total; i++) {
        const derivative = r * (1 - 2 * x);
        x = r * x * (1 - x);
        sum += Math.log(Math.abs(derivative) + 1e-14);
        if (i >= total - 74) orbit.push(x);
      }
      const lambda = sum / total;
      let period = 0;
      if (lambda < 0.006) {
        const tail = orbit.slice(-52);
        for (let p = 1; p <= 48; p++) {
          let same = true;
          for (let i = 28; i < tail.length; i++) {
            if (Math.abs(tail[i] - tail[i - p]) > 2e-8) {
              same = false;
              break;
            }
          }
          if (same) {
            period = p;
            break;
          }
        }
      }
      let regime = 'CRITICAL';
      if (period > 0) regime = period === 1 ? 'FIXED' : `PERIOD ${period}`;
      else if (lambda > 0.002) regime = 'CHAOTIC';
      return {
        r,
        lambda,
        period,
        x,
        orbit,
        regime
      };
    }

    commitR(r, updateSlider = true) {
      this.r = clamp(r, this.rMin, this.rMax);
      this.analysis = this.analyze(this.r);
      if (updateSlider) this.slider.value = this.r.toFixed(4);
      setRangeFill(this.slider);
      this.updateReadout();
      this.updatePresetState();
      this.drawOverlay();
      this.drawCobweb();
      if (!this.prepared) {
        this.prepare();
      }
    }

    updateReadout() {
      const a = this.analysis;
      if (!a) return;
      const rText = this.r.toFixed(4);
      $('#bifR').textContent = rText;
      $('#bifRReadout').textContent = rText;
      $('#bifLambda').textContent = signed(a.lambda, 4);
      $('#bifPeriod').textContent = a.period ? String(a.period) : '∞';
      $('#bifOrbit').textContent = a.x.toFixed(4);
      $('#bifClass').textContent = a.regime;
    }

    updatePresetState() {
      $$('.preset[data-r]').forEach(btn => {
        btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.r) - this.r) < 0.0018);
      });
    }

    renderBase() {
      const ctx = this.baseCtx;
      const w = this.cssWidth, h = this.cssHeight;
      if (!w || !h) return;
      const { L, R, T, B, pw, ph } = this.margins();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // graph paper first
      ctx.strokeStyle = 'rgba(240,235,224,0.09)';
      ctx.lineWidth = 0.6;
      ctx.font = '8px "DejaVu Sans Mono", monospace';
      ctx.fillStyle = 'rgba(240,235,224,0.5)';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const y = T + ph * (i / 4);
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        const value = 1 - i / 4;
        ctx.fillText(value === 0 || value === 1 ? value.toFixed(0) : value.toFixed(2), 9, y);
      }
      const xStep = w < 560 ? 0.4 : 0.2;
      for (let r = this.rMin; r <= this.rMax + 0.001; r += xStep) {
        const x = L + ((r - this.rMin) / (this.rMax - this.rMin)) * pw;
        ctx.strokeStyle = 'rgba(240,235,224,0.055)';
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillStyle = 'rgba(240,235,224,0.5)';
        ctx.fillText(r.toFixed(1), x - 8, h - 9);
      }

      // dense sample field, rendered once into a low-res density map
      const dataW = Math.max(160, Math.min(1300, Math.round(pw)));
      const dataH = Math.max(140, Math.min(700, Math.round(ph)));
      const dataCanvas = document.createElement('canvas');
      dataCanvas.width = dataW;
      dataCanvas.height = dataH;
      const dctx = dataCanvas.getContext('2d');
      const image = dctx.createImageData(dataW, dataH);
      const data = image.data;
      const transient = 1000;
      const iterates = 210;
      for (let cx = 0; cx < dataW; cx++) {
        const r = this.rMin + ((cx + 0.5) / dataW) * (this.rMax - this.rMin);
        let x = 0.5;
        for (let i = 0; i < transient; i++) x = r * x * (1 - x);
        for (let i = 0; i < iterates; i++) {
          x = r * x * (1 - x);
          if (!Number.isFinite(x) || x < 0 || x > 1) continue;
          let y = Math.round((1 - x) * (dataH - 1));
          y = clamp(y, 0, dataH - 1);
          const idx = (y * dataW + cx) * 4;
          data[idx] = 237;
          data[idx + 1] = 231;
          data[idx + 2] = 218;
          data[idx + 3] = Math.min(255, data[idx + 3] + 26);
        }
      }
      dctx.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(dataCanvas, L, T, pw, ph);
      ctx.imageSmoothingEnabled = true;

      // axis
      ctx.strokeStyle = 'rgba(240,235,224,0.4)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(L, T);
      ctx.lineTo(L, T + ph);
      ctx.lineTo(L + pw, T + ph);
      ctx.stroke();

      // onset marker
      const onsetX = L + ((3.5699456 - this.rMin) / (this.rMax - this.rMin)) * pw;
      ctx.strokeStyle = 'rgba(255,107,66,0.34)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(onsetX, T);
      ctx.lineTo(onsetX, T + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,125,86,0.85)';
      ctx.font = '7px "DejaVu Sans Mono", monospace';
      ctx.fillText('ONSET', onsetX + 4, T + 8);

      ctx.fillStyle = 'rgba(240,235,224,0.62)';
      ctx.font = '8px "DejaVu Sans Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('x∞', 6, T - 10);
      ctx.textAlign = 'right';
      ctx.fillText('r →', L + pw, T - 10);
      ctx.textAlign = 'left';
    }

    drawOverlay() {
      if (!this.analysis) return;
      const ctx = this.overlayCtx;
      const w = this.cssWidth, h = this.cssHeight;
      if (!w || !h) return;
      const { L, T, pw, ph } = this.margins();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const x = L + ((this.r - this.rMin) / (this.rMax - this.rMin)) * pw;

      // selection column
      ctx.strokeStyle = 'rgba(255,107,66,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, T);
      ctx.lineTo(x, T + ph);
      ctx.stroke();

      // actual iterates at this r
      const orbit = this.analysis.orbit.slice(-64);
      ctx.fillStyle = 'rgba(255,125,86,0.72)';
      orbit.forEach((v, i) => {
        const y = T + ((1 - clamp(v, 0, 1)) * ph);
        ctx.beginPath();
        ctx.arc(x + Math.sin(i * 7.13) * 0.8, y, 1.15, 0, TAU);
        ctx.fill();
      });

      // handle
      const label = `r ${this.r.toFixed(4)}`;
      ctx.font = '8px "DejaVu Sans Mono", monospace';
      const labelWidth = ctx.measureText(label).width + 15;
      let labelX = x + 8;
      if (x > w - labelWidth - 20) labelX = x - labelWidth - 8;
      const labelY = T + 7;
      ctx.fillStyle = 'rgba(9,12,9,0.94)';
      ctx.fillRect(labelX, labelY, labelWidth, 17);
      ctx.strokeStyle = 'rgba(240,235,224,0.28)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(labelX, labelY, labelWidth, 17);
      ctx.fillStyle = '#f0ebe0';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX + 7, labelY + 9);

      // tiny top and bottom ticks
      ctx.fillStyle = '#ff6b42';
      ctx.beginPath();
      ctx.moveTo(x - 3, T);
      ctx.lineTo(x + 3, T);
      ctx.lineTo(x, T + 4);
      ctx.closePath();
      ctx.fill();
    }

    resize() {
      this.layout();
      if (!this.prepared) {
        this.prepare();
        return;
      }
      this.renderBase();
      this.drawOverlay();
      this.drawCobweb();
    }

    drawCobweb() {
      const canv = this.cobweb;
      if (!canv) return;
      const wrap = canv.parentElement;
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = rect.width, h = rect.height;
      if (canv.width !== Math.round(w * dpr) || canv.height !== Math.round(h * dpr)) {
        canv.width = Math.round(w * dpr);
        canv.height = Math.round(h * dpr);
      }
      const ctx = this.cobwebCtx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const padL = 25, padR = 18, padT = 18, padB = 24;
      const pw = w - padL - padR;
      const ph = h - padT - padB;
      const sx = v => padL + v * pw;
      const sy = v => padT + (1 - v) * ph;
      const r = this.r;

      // grid
      ctx.strokeStyle = 'rgba(240,235,224,0.07)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(sx(t), sy(0));
        ctx.lineTo(sx(t), sy(1));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx(0), sy(t));
        ctx.lineTo(sx(1), sy(t));
        ctx.stroke();
      }
      // frame
      ctx.strokeStyle = 'rgba(240,235,224,0.15)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(sx(0), sy(1), pw, ph);

      // diagonal
      ctx.strokeStyle = 'rgba(240,235,224,0.28)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(0));
      ctx.lineTo(sx(1), sy(1));
      ctx.stroke();
      ctx.setLineDash([]);

      // logistic parabola
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = i / 120;
        const y = r * x * (1 - x);
        if (i === 0) ctx.moveTo(sx(x), sy(y));
        else ctx.lineTo(sx(x), sy(y));
      }
      ctx.strokeStyle = 'rgba(240,235,224,0.62)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // cobweb path
      let x = 0.41;
      for (let i = 0; i < 100; i++) x = r * x * (1 - x);
      ctx.beginPath();
      let startX = x;
      let startY = x;
      ctx.moveTo(sx(startX), sy(startY));
      for (let i = 0; i < 74; i++) {
        const y = r * x * (1 - x);
        ctx.lineTo(sx(x), sy(y));
        ctx.lineTo(sx(y), sy(y));
        x = y;
      }
      ctx.strokeStyle = 'rgba(255,96,56,0.58)';
      ctx.lineWidth = 0.68;
      ctx.stroke();

      // current orbit point
      ctx.fillStyle = '#ff6b42';
      ctx.beginPath();
      ctx.arc(sx(x), sy(x), 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,96,56,0.16)';
      ctx.beginPath();
      ctx.arc(sx(x), sy(x), 8, 0, TAU);
      ctx.fill();

      // tiny endpoint labels
      ctx.fillStyle = 'rgba(240,235,224,0.35)';
      ctx.font = '7px "DejaVu Sans Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('0', sx(0) - 1, sy(0) + 10);
      ctx.fillText('1', sx(1) - 8, sy(1) - 8);
    }
  }

  /* ============================================================
     ARCHIVE — six small, real trajectories
     ============================================================ */

  class ArchiveView {
    constructor(lab) {
      this.lab = lab;
      this.cache = new Map();
      this.canvases = $$('.attractor-canvas');
      this.drawn = new Set();
      this.resizeTimer = null;
      this.glow = makeGlowSprite(48, 'rgba(255,244,228,0.8)', 'rgba(255,120,72,0.22)');
      this.observe();
      this.bindLinks();
      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.drawn.forEach(canvas => this.render(canvas, false));
        }, 220);
      }, { passive: true });
    }

    observe() {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.render(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '360px 0px', threshold: 0.01 });
      this.canvases.forEach(canvas => io.observe(canvas));
    }

    bindLinks() {
      $$('[data-open-system]').forEach(card => {
        card.addEventListener('click', e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          const id = card.dataset.openSystem;
          e.preventDefault();
          if (app.lab) app.lab.setSystem(id);
          const target = $('#observatory');
          if (target) {
            target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
          }
        });
      });
    }

    buildPreview(system) {
      if (this.cache.has(system.id)) return this.cache.get(system.id);
      const p = defaultParams(system);
      const rng = mulberry32(system.index * 7193 + 41);
      const orbitCount = 6;
      const perOrbit = 3600;
      const points = new Float32Array(orbitCount * perOrbit * 3);
      const orbits = [];
      let offset = 0;
      for (let orbit = 0; orbit < orbitCount; orbit++) {
        const state = [
          system.seed[0] + (rng() - 0.5) * 0.18,
          system.seed[1] + (rng() - 0.5) * 0.18,
          system.seed[2] + (rng() - 0.5) * 0.18
        ];
        const warm = system.preview.warm + orbit * 83;
        for (let i = 0; i < warm; i++) advanceTriple(system, p, state, system.dt);
        const start = offset;
        for (let i = 0; i < perOrbit; i++) {
          advanceTriple(system, p, state, system.dt);
          if (!Number.isFinite(state[0]) || !Number.isFinite(state[1]) || !Number.isFinite(state[2]) ||
              Math.abs(state[0]) > 1e5 || Math.abs(state[1]) > 1e5 || Math.abs(state[2]) > 1e5) {
            state[0] = system.seed[0];
            state[1] = system.seed[1];
            state[2] = system.seed[2];
          }
          points[offset * 3] = state[0];
          points[offset * 3 + 1] = state[1];
          points[offset * 3 + 2] = state[2];
          offset++;
        }
        orbits.push({ start, count: perOrbit });
      }
      const bounds = computeBounds(points);
      const cached = { points, bounds, orbits };
      this.cache.set(system.id, cached);
      return cached;
    }

    render(canvas, animate = true) {
      const id = canvas.dataset.systemCanvas;
      const system = SYSTEM_MAP.get(id);
      if (!system) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
      const w = rect.width;
      const h = rect.height;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cached = this.buildPreview(system);
      const { points, bounds, orbits } = cached;
      const n = points.length / 3;
      const yaw = system.preview.yaw;
      const pitch = system.preview.pitch;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const invHalf = 1 / Math.max(bounds.half, 1e-4);
      const projected = new Float32Array(n * 3);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < n; i++) {
        const x = (points[i * 3] - bounds.cx) * invHalf;
        const y = (points[i * 3 + 1] - bounds.cy) * invHalf;
        const z = (points[i * 3 + 2] - bounds.cz) * invHalf;
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        projected[i * 3] = x1;
        projected[i * 3 + 1] = y2;
        projected[i * 3 + 2] = z2;
        if (x1 < minX) minX = x1;
        if (x1 > maxX) maxX = x1;
        if (y2 < minY) minY = y2;
        if (y2 > maxY) maxY = y2;
      }
      const spanX = Math.max(0.01, maxX - minX);
      const spanY = Math.max(0.01, maxY - minY);
      const fit = Math.min((w * 0.9) / spanX, (h * 0.86) / spanY);
      const cx = w / 2 - ((minX + maxX) / 2) * fit;
      const cyScreen = h / 2 + ((minY + maxY) / 2) * fit;
      const toX = x => cx + x * fit;
      const toY = y => cyScreen - y * fit;

      const base = hexToRgb(system.palette.a);
      const accent = hexToRgb(system.palette.b);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // faint continuous threads preserve the sense of flow
      orbits.forEach((orbit, oi) => {
        ctx.beginPath();
        for (let i = 0; i < orbit.count; i += 2) {
          const idx = orbit.start + i;
          const px = toX(projected[idx * 3]);
          const py = toY(projected[idx * 3 + 1]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(${base.r},${base.g},${base.b},${oi === 0 ? 0.12 : 0.06})`;
        ctx.lineWidth = oi === 0 ? 0.68 : 0.45;
        ctx.stroke();
      });

      // pointillist density — the attractor's invariant measure
      ctx.fillStyle = `rgba(${base.r},${base.g},${base.b},0.17)`;
      for (let i = 0; i < n; i++) {
        ctx.fillRect(toX(projected[i * 3]), toY(projected[i * 3 + 1]), 1, 1);
      }
      ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},0.23)`;
      for (let i = 0; i < n; i += 5) {
        ctx.fillRect(toX(projected[i * 3]), toY(projected[i * 3 + 1]), 1, 1);
      }

      // larger bokeh glints give the cloud a photographic depth
      ctx.globalAlpha = 0.46;
      for (let i = 0; i < n; i += 271) {
        const px = toX(projected[i * 3]);
        const py = toY(projected[i * 3 + 1]);
        const size = 7 + (i % 5) * 2;
        ctx.drawImage(this.glow, px - size / 2, py - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (animate) {
        requestAnimationFrame(() => canvas.classList.add('is-drawn'));
      } else {
        canvas.classList.add('is-drawn');
      }
      this.drawn.add(canvas);
    }
  }

  /* ============================================================
     PAGE CHROME — loader, clock, navigation, cursor, motion
     ============================================================ */

  class PageUI {
    constructor(hero, lab) {
      this.hero = hero;
      this.lab = lab;
      this.body = document.body;
      this.header = $('#siteHeader');
      this.menu = $('#siteMenu');
      this.menuToggle = $('#menuToggle');
      this.menuOpen = false;
      this.loaderFinished = false;
      this.scrollRequested = false;
      this.heroVisible = true;
      this.lastFocus = null;
      this.cursor = $('.cursor');
      this.cursorRing = $('.cursor__ring');
      this.cursorDot = $('.cursor__dot');
      this.cursorTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      this.cursorCurrent = { x: this.cursorTarget.x, y: this.cursorTarget.y };
      this.body.classList.add('is-locked');
      this.initReveal();
      this.initClock();
      this.initScroll();
      this.initMenu();
      this.initCursor();
      this.initHeroVisibility();
      this.bindResize();
      this.initRanges();
      this.startLoader();
    }

    initReveal() {
      const items = $$('[data-reveal]');
      if (!items.length) return;
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -7% 0px', threshold: 0.08 });
      items.forEach(el => io.observe(el));
    }

    initClock() {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const tick = () => {
        const now = new Date();
        const text = formatter.format(now);
        const nav = $('#navClock');
        const foot = $('#footClock');
        if (nav) {
          nav.textContent = text;
          nav.setAttribute('datetime', now.toISOString());
        }
        if (foot) foot.textContent = `${text} CST`;
      };
      tick();
      this.clockTimer = setInterval(tick, 1000);
    }

    initScroll() {
      this.onScroll = () => {
        if (!this.scrollRequested) {
          this.scrollRequested = true;
          requestAnimationFrame(() => {
            this.scrollRequested = false;
            this.updateChrome();
          });
        }
      };
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.updateChrome();
    }

    updateChrome() {
      const y = window.scrollY || window.pageYOffset;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp(y / maxScroll, 0, 1);
      const progressEl = $('#pageProgress');
      if (progressEl) progressEl.style.width = `${progress * 100}%`;

      this.header.classList.toggle('is-scrolled', y > 22);

      const headerLine = (this.header.offsetHeight || 68) * 0.55;
      let overLight = false;
      $$('[data-theme="light"]').forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= headerLine && rect.bottom >= headerLine) overLight = true;
      });
      this.header.classList.toggle('theme-light', overLight);

      let currentId = '';
      const navSections = ['observatory', 'sensitivity', 'spectrum', 'bifurcation', 'archive'];
      const anchor = window.innerHeight * 0.38;
      navSections.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= anchor && rect.bottom >= anchor) currentId = id;
      });
      $$('.site-nav a').forEach(link => {
        const id = link.getAttribute('href').replace('#', '');
        const isActive = id === currentId;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    initMenu() {
      this.menuToggle.addEventListener('click', () => {
        this.setMenu(!this.menuOpen);
      });
      $$('#siteMenu a').forEach(link => {
        link.addEventListener('click', e => {
          const href = link.getAttribute('href');
          const target = href ? document.querySelector(href) : null;
          e.preventDefault();
          this.setMenu(false, true);
          if (target) {
            setTimeout(() => {
              target.scrollIntoView({
                behavior: reduceMotion.matches ? 'auto' : 'smooth',
                block: 'start'
              });
            }, 30);
          }
        });
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.menuOpen) {
          this.setMenu(false);
          this.menuToggle.focus();
        }
      });
      window.addEventListener('resize', () => {
        if (this.menuOpen && window.innerWidth > 1040) this.setMenu(false);
      }, { passive: true });
    }

    setMenu(open, viaLink = false) {
      if (open === this.menuOpen) return;
      this.menuOpen = open;
      this.menuToggle.setAttribute('aria-expanded', String(open));
      this.menu.setAttribute('aria-hidden', String(!open));
      this.menu.classList.toggle('is-open', open);
      this.body.classList.toggle('menu-open', open);
      this.body.classList.toggle('is-locked', open);
      $('#main').inert = open;
      const footer = $('.site-foot');
      if (footer) footer.inert = open;
      if (open) {
        this.lastFocus = document.activeElement;
        setTimeout(() => {
          const first = $('#siteMenu a');
          if (first) first.focus({ preventScroll: true });
        }, 150);
      } else if (!viaLink && this.lastFocus && this.lastFocus.focus) {
        this.lastFocus.focus({ preventScroll: true });
      }
    }

    initCursor() {
      if (!isFinePointer.matches || !this.cursor) return;
      document.documentElement.classList.add('has-custom-cursor');
      document.addEventListener('pointermove', e => {
        this.cursorTarget.x = e.clientX;
        this.cursorTarget.y = e.clientY;
        if (this.cursorDot) {
          this.cursorDot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        }
      }, { passive: true });
      document.addEventListener('pointerover', e => {
        const interactive = e.target.closest('a, button, input, [role="button"]');
        this.cursor.classList.toggle('is-hover', Boolean(interactive));
      }, { passive: true });
      document.addEventListener('pointerdown', () => this.cursor.classList.add('is-down'), { passive: true });
      document.addEventListener('pointerup', () => this.cursor.classList.remove('is-down'), { passive: true });
      document.documentElement.addEventListener('mouseleave', () => {
        this.cursor.style.opacity = '0';
      });
      document.documentElement.addEventListener('mouseenter', () => {
        this.cursor.style.opacity = '';
      });
      const loop = () => {
        this.cursorCurrent.x = lerp(this.cursorCurrent.x, this.cursorTarget.x, 0.16);
        this.cursorCurrent.y = lerp(this.cursorCurrent.y, this.cursorTarget.y, 0.16);
        if (this.cursorRing) {
          this.cursorRing.style.transform = `translate3d(${this.cursorCurrent.x}px, ${this.cursorCurrent.y}px, 0)`;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    initRanges() {
      $$('input.range').forEach(input => {
        setRangeFill(input);
        input.addEventListener('input', () => setRangeFill(input));
      });
    }

    initHeroVisibility() {
      if (this.hero.reduced) {
        this.hero.renderStatic();
        return;
      }
      this.hero.start();
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          this.heroVisible = entry.isIntersecting;
          if (entry.isIntersecting && this.loaderFinished) this.hero.start();
          else if (!entry.isIntersecting) this.hero.stop();
        });
      }, { threshold: 0.01 });
      io.observe($('#top'));
    }

    bindResize() {
      let raf = null;
      window.addEventListener('resize', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          this.updateChrome();
          this.hero.resize();
          if (this.hero.reduced) this.hero.renderStatic();
        });
      }, { passive: true });
    }

    startLoader() {
      const preloader = $('#preloader');
      const bar = $('#loadBar');
      const pct = $('#loadPct');
      const hint = $('#loadHint');
      if (!preloader) {
        this.finishLoader(true);
        return;
      }
      if (reduceMotion.matches) {
        if (bar) bar.style.transform = 'scaleX(1)';
        if (pct) pct.textContent = '100';
        setTimeout(() => this.finishLoader(true), 80);
        return;
      }
      const start = performance.now();
      const duration = 1550;
      let skipped = false;
      const finishEarly = () => {
        if (skipped) return;
        skipped = true;
        this.finishLoader();
      };
      preloader.addEventListener('click', finishEarly, { once: true });
      const tick = now => {
        if (this.loaderFinished) return;
        const p = clamp((now - start) / duration, 0, 1);
        const eased = easeOutCubic(p);
        if (bar) bar.style.transform = `scaleX(${eased})`;
        if (pct) pct.textContent = String(Math.round(eased * 100)).padStart(3, '0');
        if (hint) hint.textContent = p > 0.68 ? 'PHASE SPACE READY' : p > 0.34 ? 'INTEGRATING LORENZ–63' : 'LORENZ SYSTEM ONLINE';
        if (p < 1) requestAnimationFrame(tick);
        else setTimeout(() => this.finishLoader(), 250);
      };
      requestAnimationFrame(tick);
    }

    finishLoader(instant = false) {
      if (this.loaderFinished) return;
      this.loaderFinished = true;
      const preloader = $('#preloader');
      this.body.classList.remove('is-locked');
      this.body.classList.add('is-ready');
      if (preloader) {
        preloader.classList.add('is-done');
        preloader.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          preloader.style.display = 'none';
        }, instant ? 20 : 1050);
      }
      if (this.heroVisible) {
        if (this.hero.reduced) this.hero.renderStatic();
        else this.hero.start();
      }
      this.updateChrome();
    }
  }

  /* ============================================================
     INITIALISATION
     ============================================================ */

  function init() {
    if (!window.matchMedia) return;
    const heroEl = $('#heroCanvas');
    const hero = new HeroField(heroEl, $('.hero'));
    hero.reduced = reduceMotion.matches;

    const lab = new LabController();
    app.lab = lab;

    const spectrum = new SpectrumView(lab);
    const sensitivity = new SensitivityExperiment();
    const bifurcation = new BifurcationAtlas();
    const archive = new ArchiveView(lab);
    const ui = new PageUI(hero, lab);

    $$('#backToTop').forEach(btn => {
      btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      });
    });

    // a public handle for debugging and curious readers
    window.CHAOS_ATLAS = {
      app,
      systems: SYSTEMS,
      lab,
      spectrum,
      sensitivity,
      bifurcation,
      archive,
      ui
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
