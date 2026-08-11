const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

const PORT = process.env.PORT || 3000;
const MAP_W = 2400, MAP_H = 1800, CELL = 160;
const TICK = 1000 / 30;
const PLAYER_R = 18, SPEED = 4.2, BULLET_SPEED = 16;
const ROLL_DURATION = 250;
const EXPERIMENT_PW = "kimms";

// ===== 기본 설정값 =====
const DEFAULT_CFG = {
  maxHp: 100, hpRegen: 1, regenDelay: 5000,
  staminaMax: 100, staminaRegen: 2, meleeCost: 1, rollCost: 10, rollDist: 80,
  spawnProtect: 2500,
  ammoSlow1: 50, ammoSlow2: 100,
  pistol:  { mag: 16, dmg: 7, range: 800, interval: 250, reload: 1200 },
  shotgun: { mag: 5,  dmg: 2, pellets: 15, spread: 45, range: 320, interval: 700, reload: 2000 },
  sword:   { dmg: 10, range: 160, duration: 300 },
  spear:   { dmgNear: 10, dmgMid: 13, dmgFar: 15, range: 240, duration: 600 },
  fist:    { dmg: 3,  range: 45, duration: 250 },
  bandage: { use: 2000, cd: 3000, heal: 10 },
  medkit:  { use: 4000, cd: 5000, heal: 50 },
  adren:   { use: 2000, cd: 5000, dur: 5000, mult: 5 },
  heartBonus: 20, heartMax: 2, armorReduce: 10, vestReduce: 10,
  crateHp: 10, crateInitial: 10, crateBatch: 3, crateIntervalSec: 30,
  rate: { bandage: 15, medkit: 10, adren: 10, heart: 5, armor: 10, vest: 10 },
  dummyHp: 10000,
  slowPct: 25,
};

const CFG_SCHEMA = [
  ["maxHp", "기본 체력"], ["hpRegen", "초당 체력 회복"], ["regenDelay", "피격 후 회복 지연(ms)"],
  ["staminaMax", "스테미너 최대치"], ["staminaRegen", "초당 스테미너 회복"],
  ["meleeCost", "근접공격 스테미너"], ["rollCost", "앞구르기 스테미너"], ["rollDist", "앞구르기 거리(px)"],
  ["spawnProtect", "스폰 보호(ms)"], ["slowPct", "장전/회복 중 감속(%)"],
  ["ammoSlow1", "총알 무게 1단계(발)"], ["ammoSlow2", "총알 무게 2단계(발)"],
  ["pistol.mag", "권총 탄창 수"], ["pistol.dmg", "권총 데미지"], ["pistol.range", "권총 사거리(px)"],
  ["pistol.interval", "권총 발사간격(ms)"], ["pistol.reload", "권총 재장전(ms)"],
  ["shotgun.mag", "산탄총 탄창 수"], ["shotgun.dmg", "산탄 알갱이 데미지"], ["shotgun.pellets", "산탄 알갱이 수"],
  ["shotgun.spread", "산탄 퍼짐(도)"], ["shotgun.range", "산탄총 사거리(px)"],
  ["shotgun.interval", "산탄총 발사간격(ms)"], ["shotgun.reload", "산탄총 재장전(ms)"],
  ["sword.dmg", "칼 데미지"], ["sword.range", "칼 사거리(px)"], ["sword.duration", "칼 모션(ms)"],
  ["spear.dmgNear", "창 근거리 데미지"], ["spear.dmgMid", "창 중거리 데미지"], ["spear.dmgFar", "창 원거리 데미지"],
  ["spear.range", "창 사거리(px)"], ["spear.duration", "창 모션(ms)"],
  ["fist.dmg", "주먹 데미지"],
  ["bandage.use", "붕대 사용시간(ms)"], ["bandage.cd", "붕대 재사용(ms)"], ["bandage.heal", "붕대 회복(%)"],
  ["medkit.use", "구급상자 사용시간(ms)"], ["medkit.cd", "구급상자 재사용(ms)"], ["medkit.heal", "구급상자 회복(%)"],
  ["adren.use", "주사기 사용시간(ms)"], ["adren.cd", "주사기 재사용(ms)"], ["adren.dur", "주사기 지속(ms)"], ["adren.mult", "주사기 회복배율"],
  ["heartBonus", "하트 최대체력 증가"], ["heartMax", "하트 최대 개수"],
  ["armorReduce", "방어구 근접피해 감소(%)"], ["vestReduce", "방탄복 총알피해 감소(%)"],
  ["crateHp", "상자 내구도"], ["crateInitial", "시작 상자 수"], ["crateBatch", "주기당 상자 수"], ["crateIntervalSec", "상자 생성 주기(초)"],
  ["rate.bandage", "붕대 확률(%)"], ["rate.medkit", "구급상자 확률(%)"], ["rate.adren", "주사기 확률(%)"], ["rate.heart", "하트 확률(%)"], ["rate.armor", "방어구 확률(%)"], ["rate.vest", "방탄복 확률(%)"],
  ["dummyHp", "허수아비 체력"],
];

const walls = [
  { x: 400, y: 300, w: 260, h: 50 }, { x: 1740, y: 300, w: 260, h: 50 },
  { x: 400, y: 1450, w: 260, h: 50 }, { x: 1740, y: 1450, w: 260, h: 50 },
  { x: 1080, y: 800, w: 240, h: 200 },
  { x: 200, y: 780, w: 50, h: 260 }, { x: 2150, y: 760, w: 50, h: 260 },
  { x: 1000, y: 250, w: 50, h: 220 }, { x: 1350, y: 1330, w: 50, h: 220 },
];

const PALETTE = [
  "#ff5c5c", "#ff9d5c", "#ffd75c", "#b8e356",
  "#7dff8a", "#5cffd9", "#5cd9ff", "#5cb8ff",
  "#7a8cff", "#a06bff", "#c98aff", "#ff7ad9",
  "#ff5ca0", "#c9a24b", "#9aa3b5", "#f2f4f8",
];
const HAT_COUNT = 10;
const WEAPON_KO = { pistol: "권총", shotgun: "산탄총", sword: "칼", spear: "창", fist: "주먹" };
const SHOWCASE_TYPES = ["pistol", "shotgun", "sword", "spear", "bandage", "medkit", "adren", "heart", "armor", "vest", "ammo_pistol", "ammo_shotgun"];

const clone = o => JSON.parse(JSON.stringify(o));
function setPath(o, p, v) {
  const ks = p.split("."); const last = ks.pop();
  const t = ks.reduce((a, k) => (a == null ? a : a[k]), o);
  if (t && typeof t[last] === "number" && Number.isFinite(v)) t[last] = Math.max(0, Math.min(1000000, v));
}
function circleRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

let itemId = 0, crateIdG = 0, bulletIdG = 0, dummyN = 0;

class Room {
  // gameMode: 'dm' | 'showdown' | 'sandbox'
  constructor(id, cfg, opts = {}) {
    this.id = id; this.cfg = cfg;
    this.sandbox = !!opts.sandbox; this.allowCfg = !!opts.allowCfg;
    this.privateRoom = !!opts.privateRoom;
    this.gameMode = opts.gameMode || "sandbox";
    this.showcase = !!opts.showcase;
    this.players = {}; this.bullets = []; this.crates = []; this.items = [];
    this.cells = new Set(); this.lastCrateSpawn = Date.now();
    this.dmgQueue = []; this.respawnQueue = [];
    // 데스매치
    this.targetKills = 10; this.matchEndsAt = 0; this.chooserId = null;
    this.matchWinner = null; this.matchResetAt = 0;
    // 쇼다운
    this.sdPhase = "waiting"; this.sdCountdownEnd = 0; this.sdWinner = null; this.sdResetAt = 0;
    this.spawnCrates(this.cfg.crateInitial);
    if (this.showcase) this.buildShowcase();
  }

  buildShowcase() {
    this.showSpots = SHOWCASE_TYPES.map((type, i) => ({ type, x: 750 + i * 100, y: 1290 }));
    for (const s of this.showSpots) this.items.push({ id: itemId++, x: s.x, y: s.y, type: s.type, display: true, spot: s });
  }

  usedColors() {
    return Object.values(this.players).filter(p => !p.isDummy).map(p => p.color);
  }
  pickColor(want) {
    const used = this.usedColors();
    const wanted = PALETTE[want];
    if (wanted && !used.includes(wanted)) return wanted;
    for (const c of PALETTE) if (!used.includes(c)) return c;
    return PALETTE[(Math.random() * PALETTE.length) | 0];
  }

  spawnPos() {
    if (this.showcase) return { x: 1150 + Math.random() * 200, y: 1380 + Math.random() * 60 };
    for (let i = 0; i < 60; i++) {
      const x = 80 + Math.random() * (MAP_W - 160);
      const y = 80 + Math.random() * (MAP_H - 160);
      if (!walls.some(w => x > w.x - 40 && x < w.x + w.w + 40 && y > w.y - 40 && y < w.y + w.h + 40)) return { x, y };
    }
    return { x: MAP_W / 2, y: 120 };
  }

  spawnCrates(n) {
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 100; t++) {
        const cx = (Math.random() * (MAP_W / CELL)) | 0;
        const cy = (Math.random() * (MAP_H / CELL)) | 0;
        const key = cx + "," + cy;
        if (this.cells.has(key)) continue;
        const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
        if (x < 70 || x > MAP_W - 70 || y < 70 || y > MAP_H - 70) continue;
        if (walls.some(w => x > w.x - 60 && x < w.x + w.w + 60 && y > w.y - 60 && y < w.y + w.h + 60)) continue;
        this.cells.add(key);
        this.crates.push({ id: crateIdG++, x, y, hp: this.cfg.crateHp, maxHp: this.cfg.crateHp, cell: key });
        break;
      }
    }
  }

  resetGear(p) {
    p.weapons = []; p.active = 0;
    p.ammo = { pistol: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 } };
    p.items = { bandage: 0, medkit: 0, adren: 0 };
    p.armor = false; p.vest = false; p.hearts = 0; p.adrenUntil = 0;
    p.maxHp = this.cfg.maxHp;
    p.using = null; p.reloadStart = 0; p.reloadEnd = 0; p.pendingChoice = null; p.pendingExchange = null;
  }

  fullRespawn(p) {
    const pos = this.spawnPos();
    p.x = pos.x; p.y = pos.y;
    p.hp = p.maxHp; p.stamina = this.cfg.staminaMax;
    p.dead = false; p.using = null; p.reloadEnd = 0;
    p.protectUntil = Date.now() + this.cfg.spawnProtect;
  }

  addPlayer(id, name, colorIdx, hat) {
    const pos = this.spawnPos();
    this.players[id] = {
      id, name: String(name || "무명").slice(0, 10),
      x: pos.x, y: pos.y, angle: 0,
      hp: this.cfg.maxHp, maxHp: this.cfg.maxHp,
      stamina: this.cfg.staminaMax,
      score: 0, deaths: 0,
      color: this.pickColor(colorIdx | 0),
      hat: Math.max(0, Math.min(HAT_COUNT, hat | 0)),
      keys: {}, dead: false, respawnAt: 0,
      weapons: [], active: 0,
      ammo: { pistol: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 } },
      lastShot: {}, busyUntil: 0,
      attackAt: 0, attackType: "", attackSide: 0,
      rollUntil: 0, rollAngle: 0,
      reloadStart: 0, reloadEnd: 0, reloadGun: "",
      using: null, itemCd: { bandage: 0, medkit: 0, adren: 0 },
      items: { bandage: 0, medkit: 0, adren: 0 },
      armor: false, vest: false, hearts: 0, isDummy: false,
      protectUntil: Date.now() + this.cfg.spawnProtect,
      lastHitAt: 0, lastMoveAt: Date.now(),
      pendingChoice: null, pendingExchange: null,
      spectator: false,
      adrenUntil: 0, isBot: false, bot: null,
    };
    // 쇼다운 라운드 중 참가 → 관전
    if (this.gameMode === "showdown" && this.sdPhase === "playing") {
      this.players[id].dead = true;
      this.players[id].spectator = true;
    }
    return this.players[id];
  }

  addDummy(x, y) {
    const id = "dummy" + (dummyN++);
    this.players[id] = {
      id, name: "허수아비", x, y, angle: 0,
      hp: this.cfg.dummyHp, maxHp: this.cfg.dummyHp,
      stamina: 0, score: 0, deaths: 0, color: "#9aa3b5", hat: 0,
      keys: {}, dead: false, respawnAt: 0,
      weapons: [], active: 0,
      ammo: { pistol: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 } },
      lastShot: {}, busyUntil: 0, attackAt: 0, attackType: "", attackSide: 0,
      rollUntil: 0, rollAngle: 0, reloadStart: 0, reloadEnd: 0, reloadGun: "",
      using: null, itemCd: {}, items: { bandage: 0, medkit: 0, adren: 0 },
      armor: false, vest: false, hearts: 0, isDummy: true,
      protectUntil: 0, lastHitAt: 0, lastMoveAt: 0, pendingChoice: null, pendingExchange: null, spectator: false,
      adrenUntil: 0, isBot: false, bot: null,
    };
  }

  activeWeapon(p) { return p.weapons[p.active] || "fist"; }

  scatterDrop(p, types) {
    // 포개지지 않게 원형으로 흩뿌리기
    types.forEach((t, i) => {
      const a = (i / types.length) * Math.PI * 2 + Math.random() * .3;
      const d = 34 + (i % 2) * 24;
      this.items.push({ ...t, id: itemId++, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });
    });
  }

  dropAllOnDeath(p) {
    const drops = [];
    for (const w of p.weapons) drops.push({ type: w, noAmmo: true });
    for (const g of ["pistol", "shotgun"]) {
      const total = p.ammo[g].mag + p.ammo[g].reserve;
      if (total > 0) drops.push({ type: "ammo_" + g, amt: total });
    }
    for (let i = 0; i < p.items.bandage; i++) drops.push({ type: "bandage" });
    for (let i = 0; i < p.items.medkit; i++) drops.push({ type: "medkit" });
    for (let i = 0; i < p.items.adren; i++) drops.push({ type: "adren" });
    if (p.armor) drops.push({ type: "armor" });
    if (p.vest) drops.push({ type: "vest" });
    this.scatterDrop(p, drops);
    this.resetGear(p); // 체력/방어구/무기 초기화
  }

  damagePlayer(t, dmg, att, weaponName, kind) {
    if (t.dead) return;
    const now = Date.now();
    if (t.rollUntil > now || t.protectUntil > now) return; // 구르기 무적 / 스폰 보호
    if (kind === "bullet" && t.vest) dmg = dmg * (1 - this.cfg.vestReduce / 100);
    if (kind === "melee" && t.armor) dmg = dmg * (1 - this.cfg.armorReduce / 100);
    dmg = Math.max(0, dmg);
    t.hp -= dmg;
    t.lastHitAt = now;
    this.dmgQueue.push({ target: t.id, x: t.x, y: t.y, dmg });
    io.to(this.id).emit("hit", { x: t.x, y: t.y, color: t.color, target: t.id });
    if (t.hp <= 0) {
      t.dead = true; t.deaths++;
      if (att) {
        att.score++;
        io.to(this.id).emit("feed", { text: `${att.name} ⚔ ${t.name} (${weaponName})`, type: "kill" });
      }
      io.to(this.id).emit("death", { x: t.x, y: t.y, color: t.color });
      if (!t.isDummy) {
        if (this.gameMode !== "sandbox") this.dropAllOnDeath(t);
        if (this.gameMode === "showdown" && this.sdPhase === "playing") {
          t.spectator = true; // 탈락
        } else {
          t.respawnAt = now + 3000;
        }
      }
    }
  }

  damageCrate(c, dmg) {
    c.hp -= dmg;
    this.dmgQueue.push({ target: "c" + c.id, x: c.x, y: c.y - 20, dmg, crate: true });
    io.to(this.id).emit("crateHit", { x: c.x, y: c.y });
    if (c.hp <= 0) this.breakCrate(c);
  }

  breakCrate(c) {
    this.cells.delete(c.cell);
    this.crates = this.crates.filter(q => q !== c);
    const r = this.cfg.rate;
    // 무기는 무조건 1개 (4종 각 25%)
    const drops = [{ type: ["pistol", "shotgun", "sword", "spear"][(Math.random() * 4) | 0] }];
    if (Math.random() * 100 < r.bandage) drops.push({ type: "bandage" });
    if (Math.random() * 100 < r.medkit) drops.push({ type: "medkit" });
    if (Math.random() * 100 < r.adren) drops.push({ type: "adren" });
    if (Math.random() * 100 < r.heart) drops.push({ type: "heart" });
    if (Math.random() * 100 < r.armor) drops.push({ type: "armor" });
    if (Math.random() * 100 < r.vest) drops.push({ type: "vest" });
    drops.forEach((d, i) => {
      const a = Math.random() * Math.PI * 2;
      const dist = i === 0 ? 0 : 24 + Math.random() * 18;
      this.items.push({ ...d, id: itemId++, x: c.x + Math.cos(a) * dist, y: c.y + Math.sin(a) * dist });
    });
    io.to(this.id).emit("crateBreak", { x: c.x, y: c.y });
  }

  los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(d / 20);
    for (let i = 1; i < steps; i++) {
      const x = ax + (bx - ax) * i / steps, y = ay + (by - ay) * i / steps;
      if (walls.some(w => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h)) return false;
    }
    return true;
  }

  inArc(p, x, y, range, arc) {
    const dx = x - p.x, dy = y - p.y;
    if (Math.hypot(dx, dy) > range) return false;
    let d = Math.atan2(dy, dx) - p.angle;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d) < arc / 2;
  }
  inThrust(p, x, y, range, halfWidth) {
    const dx = x - p.x, dy = y - p.y;
    const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    const along = dx * fx + dy * fy;
    if (along < 0 || along > range) return false;
    return Math.abs(dx * -fy + dy * fx) < halfWidth;
  }
  spearDmg(p, tx, ty) {
    const s = this.cfg.spear;
    const dist = Math.hypot(tx - p.x, ty - p.y);
    const r = s.range;
    return dist > r * 2 / 3 ? s.dmgFar : dist > r / 3 ? s.dmgMid : s.dmgNear;
  }

  attack(p) {
    const now = Date.now();
    if (!p || p.dead || p.isDummy || now < p.busyUntil || p.reloadEnd > now || p.using) return;
    if (this.gameMode === "showdown" && this.sdPhase !== "playing" && this.sdPhase !== "waiting") return;
    p.protectUntil = 0; // 공격하면 스폰보호 해제
    const w = this.activeWeapon(p);
    if (w === "pistol" || w === "shotgun") {
      const g = this.cfg[w];
      if (now - (p.lastShot[w] || 0) < g.interval) return;
      const am = p.ammo[w];
      if (am.mag <= 0) { this.startReload(p); return; }
      p.lastShot[w] = now;
      am.mag--;
      const n = w === "shotgun" ? Math.max(1, g.pellets | 0) : 1;
      const spread = w === "shotgun" ? g.spread * Math.PI / 180 : 0;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? p.angle : p.angle - spread / 2 + spread * i / (n - 1);
        this.bullets.push({
          id: bulletIdG++,
          x: p.x + Math.cos(p.angle) * (PLAYER_R + 10),
          y: p.y + Math.sin(p.angle) * (PLAYER_R + 10),
          vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
          owner: p.id, life: Math.max(1, Math.ceil(g.range / BULLET_SPEED)), dmg: g.dmg, gun: w,
        });
      }
      io.to(this.id).emit("shot", { x: p.x, y: p.y, ang: p.angle, gun: w, id: p.id });
    } else {
      const m = this.cfg[w] || this.cfg.fist;
      const cost = w === "fist" ? 0 : this.cfg.meleeCost;
      if (p.stamina < cost) return;
      p.stamina -= cost;
      p.busyUntil = now + m.duration;
      p.attackAt = now; p.attackType = w;
      if (w === "fist") p.attackSide = 1 - p.attackSide;
      const hitP = t => (w === "spear"
        ? this.inThrust(p, t.x, t.y, m.range + PLAYER_R, PLAYER_R + 12)
        : this.inArc(p, t.x, t.y, m.range + PLAYER_R, w === "sword" ? Math.PI / 1.6 : Math.PI / 2))
        && this.los(p.x, p.y, t.x, t.y); // 벽 뒤는 못 때림
      const hitC = c => (w === "spear"
        ? this.inThrust(p, c.x, c.y, m.range + 28, 36)
        : this.inArc(p, c.x, c.y, m.range + 28, w === "sword" ? Math.PI / 1.6 : Math.PI / 2))
        && this.los(p.x, p.y, c.x, c.y);
      for (const id in this.players) {
        const t = this.players[id];
        if (t === p || t.dead) continue;
        if (hitP(t)) {
          const dmg = w === "spear" ? this.spearDmg(p, t.x, t.y) : m.dmg;
          this.damagePlayer(t, dmg, p, WEAPON_KO[w], "melee");
        }
      }
      for (const c of [...this.crates]) {
        if (hitC(c)) this.damageCrate(c, w === "spear" ? this.cfg.spear.dmgMid : m.dmg);
      }
      io.to(this.id).emit("melee", { id: p.id, type: w });
    }
  }

  startReload(p) {
    const now = Date.now();
    const w = this.activeWeapon(p);
    if (w !== "pistol" && w !== "shotgun") return;
    if (p.dead || p.reloadEnd > now || p.using || now < p.busyUntil) return;
    const g = this.cfg[w], am = p.ammo[w];
    if (am.mag >= g.mag || am.reserve <= 0) return;
    p.reloadStart = now; p.reloadEnd = now + g.reload; p.reloadGun = w;
    io.to(p.id).emit("sfx", "reload");
  }

  roll(p) {
    const now = Date.now();
    if (!p || p.dead || now < p.busyUntil || p.using || p.reloadEnd > now) return;
    if (p.stamina < this.cfg.rollCost) return;
    p.stamina -= this.cfg.rollCost;
    let dx = 0, dy = 0;
    if (p.keys.w) dy -= 1; if (p.keys.s) dy += 1;
    if (p.keys.a) dx -= 1; if (p.keys.d) dx += 1;
    p.rollAngle = (dx || dy) ? Math.atan2(dy, dx) : p.angle;
    p.rollUntil = now + ROLL_DURATION;
    p.busyUntil = now + ROLL_DURATION;
    p.lastMoveAt = now;
    io.to(this.id).emit("sfx_at", { s: "roll", x: p.x, y: p.y });
  }

  useItem(p, type) {
    const now = Date.now();
    if (!p || p.dead || p.using || now < p.busyUntil || p.reloadEnd > now) return;
    if (type !== "bandage" && type !== "medkit" && type !== "adren") return;
    if (p.items[type] <= 0 || now < p.itemCd[type]) return;
    p.using = { type, start: now, end: now + this.cfg[type].use };
  }

  switchWeapon(p, dir) {
    if (!p || p.weapons.length === 0) return;
    p.active = (p.active + dir + p.weapons.length) % p.weapons.length;
    p.reloadStart = 0; p.reloadEnd = 0;
  }

  dropWeapon(p) {
    if (!p || p.dead || p.using || p.weapons.length === 0) return;
    const type = p.weapons[p.active];
    p.weapons.splice(p.active, 1);
    p.active = Math.max(0, Math.min(p.active, p.weapons.length - 1));
    p.reloadStart = 0; p.reloadEnd = 0;
    this.items.push({
      id: itemId++,
      x: p.x + Math.cos(p.angle) * 42,
      y: p.y + Math.sin(p.angle) * 42,
      type, noAmmo: true, dropAt: Date.now(), dropper: p.id,
    });
    io.to(p.id).emit("toast", `${WEAPON_KO[type]} 버림`);
  }

  ammoTotal(p) {
    return p.ammo.pistol.mag + p.ammo.pistol.reserve + p.ammo.shotgun.mag + p.ammo.shotgun.reserve;
  }

  takeItem(it) {
    if (it.display) {
      // 전시실 아이템: 3초 후 제자리 재생성
      this.respawnQueue.push({ spot: it.spot, at: Date.now() + 3000 });
    }
    this.items = this.items.filter(q => q !== it);
  }

  pickup(p, it) {
    const now = Date.now();
    if (it.dropper === p.id && now - (it.dropAt || 0) < 1200) return;
    const weaponTypes = ["pistol", "shotgun", "sword", "spear"];
    if (weaponTypes.includes(it.type)) {
      if (p.weapons.length >= 2 || p.weapons.includes(it.type)) {
        if (p.isBot) {
          // 봇은 자동으로 부족한 탄창 선택
          const owned = ["pistol", "shotgun"].filter(x => p.weapons.includes(x));
          const g = owned.sort((a, b) => (p.ammo[a].mag + p.ammo[a].reserve) - (p.ammo[b].mag + p.ammo[b].reserve))[0] || "pistol";
          p.ammo[g].reserve += this.cfg[g].mag;
          this.takeItem(it);
          return;
        }
        // 무기칸 가득: 탄창 선택 (권총/산탄총 중 고르기)
        if (!p.pendingChoice || p.pendingChoice.itemId !== it.id) {
          p.pendingChoice = { itemId: it.id };
          io.to(p.id).emit("ammoChoice");
        }
        return; // 선택 전까지 아이템 유지
      }
      p.weapons.push(it.type);
      p.active = p.weapons.length - 1;
      if ((it.type === "pistol" || it.type === "shotgun") && !it.noAmmo) {
        p.ammo[it.type].mag = this.cfg[it.type].mag;
        p.ammo[it.type].reserve += this.cfg[it.type].mag;
      }
      io.to(p.id).emit("toast", `${WEAPON_KO[it.type]} 획득!`);
    } else if (it.type === "ammo_pistol" || it.type === "ammo_shotgun") {
      const g = it.type.slice(5);
      p.ammo[g].reserve += it.amt || this.cfg[g].mag;
      io.to(p.id).emit("toast", `${WEAPON_KO[g]} 탄약 +${it.amt || this.cfg[g].mag}발`);
    } else if (it.type === "bandage" || it.type === "medkit" || it.type === "adren") {
      p.items[it.type] = Math.min(9, p.items[it.type] + 1);
      const msg = { bandage: "붕대 획득 (1키)", medkit: "구급상자 획득 (2키)", adren: "💉 아드레날린 획득 (3키)" };
      io.to(p.id).emit("toast", msg[it.type]);
    } else if (it.type === "heart") {
      if (p.hearts >= this.cfg.heartMax) {
        if (now - (p._fullToastAt || 0) > 1500) {
          p._fullToastAt = now;
          io.to(p.id).emit("toast", `하트는 최대 ${this.cfg.heartMax}개까지`);
        }
        return;
      }
      p.maxHp += this.cfg.heartBonus;
      p.hearts++;
      io.to(p.id).emit("toast", `❤ 최대 체력 +${this.cfg.heartBonus} (${p.hearts}/${this.cfg.heartMax})`);
    } else if (it.type === "armor" || it.type === "vest") {
      const has = it.type === "armor" ? p.armor : p.vest;
      if (has) {
        if (p.isBot) {
          // 봇: 가장 적게 가진 회복템으로 자동 교환
          const heals = ["bandage", "medkit", "adren"];
          const g = heals.sort((a, c2) => p.items[a] - p.items[c2])[0];
          p.items[g] = Math.min(9, p.items[g] + 1);
          this.takeItem(it);
          return;
        }
        if (!p.pendingExchange || p.pendingExchange.itemId !== it.id) {
          p.pendingExchange = { itemId: it.id };
          io.to(p.id).emit("exchangeChoice");
        }
        return; // 선택 전까지 아이템 유지
      }
      if (it.type === "armor") {
        p.armor = true;
        io.to(p.id).emit("toast", `🛡 방어구 장착 (근접 피해 ${this.cfg.armorReduce}% 감소)`);
      } else {
        p.vest = true;
        io.to(p.id).emit("toast", `🦺 방탄복 장착 (총알 피해 ${this.cfg.vestReduce}% 감소)`);
      }
    }
    io.to(p.id).emit("sfx", "pickup");
    this.takeItem(it);
  }

  ammoPick(p, g) {
    if (!p || !p.pendingChoice) return;
    if (g !== "pistol" && g !== "shotgun") return;
    const it = this.items.find(q => q.id === p.pendingChoice.itemId);
    p.pendingChoice = null;
    io.to(p.id).emit("ammoChoiceEnd");
    if (!it) return;
    if ((p.x - it.x) ** 2 + (p.y - it.y) ** 2 > 80 * 80) return;
    p.ammo[g].reserve += this.cfg[g].mag;
    io.to(p.id).emit("toast", `${WEAPON_KO[g]} 탄창 획득 (+${this.cfg[g].mag}발)`);
    io.to(p.id).emit("sfx", "pickup");
    this.takeItem(it);
  }

  addBot(i) {
    const id = "bot_" + Math.random().toString(36).slice(2, 9);
    const p = this.addPlayer(id, "봇" + (i + 1), (Math.random() * PALETTE.length) | 0, (Math.random() * (HAT_COUNT + 1)) | 0);
    p.isBot = true;
    p.bot = {
      nextRoll: 0, strafeDir: Math.random() < .5 ? 1 : -1, strafeAt: 0,
      lastPos: { x: p.x, y: p.y }, lastPosAt: Date.now(),
      detourA: 0, detourUntil: 0,
      wanderA: Math.random() * Math.PI * 2, wanderUntil: 0,
      aimErr: .05 + Math.random() * .09, // 봇마다 조준 실력 다름
    };
    return p;
  }

  botWants(p, it) {
    const wt = ["pistol", "shotgun", "sword", "spear"];
    if (wt.includes(it.type)) return p.weapons.length < 2 && !p.weapons.includes(it.type);
    if (it.type === "ammo_pistol") return p.weapons.includes("pistol");
    if (it.type === "ammo_shotgun") return p.weapons.includes("shotgun");
    if (it.type === "bandage" || it.type === "medkit" || it.type === "adren") return p.items[it.type] < 3;
    if (it.type === "heart") return p.hearts < this.cfg.heartMax;
    if (it.type === "armor") return !p.armor;
    if (it.type === "vest") return !p.vest;
    return false;
  }

  botTick(p, now) {
    const b = p.bot;
    if (p.dead) { p.keys = {}; return; }

    // 가장 가까운 적 탐색
    let enemy = null, ed = 1e9;
    for (const id in this.players) {
      const t = this.players[id];
      if (t === p || t.dead || t.isDummy || t.spectator) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < ed) { ed = d; enemy = t; }
    }

    const gunIdx = p.weapons.findIndex(w => w === "pistol" || w === "shotgun");
    const gun = gunIdx >= 0 ? p.weapons[gunIdx] : null;
    const gunTotal = gun ? p.ammo[gun].mag + p.ammo[gun].reserve : 0;
    const meleeIdx = p.weapons.findIndex(w => w === "sword" || w === "spear");
    const armed = (gun && gunTotal > 0) || meleeIdx >= 0;

    // 회복/버프 판단
    if (!p.using) {
      const safe = !enemy || ed > 380 || !this.los(p.x, p.y, enemy.x, enemy.y);
      if (p.hp < p.maxHp * .4 && safe && p.items.medkit > 0 && now >= p.itemCd.medkit) this.useItem(p, "medkit");
      else if (p.hp < p.maxHp * .6 && safe && p.items.bandage > 0 && now >= p.itemCd.bandage) this.useItem(p, "bandage");
      else if (p.items.adren > 0 && now >= p.itemCd.adren && p.stamina < 25) this.useItem(p, "adren");
    }

    const seen = enemy && ed < 700 && this.los(p.x, p.y, enemy.x, enemy.y);
    let goalX = null, goalY = null, ignoreCrate = null;

    if (seen && armed) {
      // ===== 전투 =====
      if (gun && gunTotal > 0 && (ed > 180 || meleeIdx < 0)) p.active = gunIdx;
      else if (meleeIdx >= 0 && ed < 230) p.active = meleeIdx;
      else if (gun && gunTotal > 0) p.active = gunIdx;
      const w = p.weapons[p.active] || "fist";
      // 예측 조준 + 개인별 오차
      const lead = (w === "pistol" || w === "shotgun") ? Math.min(14, ed / BULLET_SPEED) : 0;
      const aimX = enemy.x + (enemy._vx || 0) * lead;
      const aimY = enemy.y + (enemy._vy || 0) * lead;
      p.angle = Math.atan2(aimY - p.y, aimX - p.x) + (Math.random() - .5) * b.aimErr * 2;
      // 거리 유지 + 스트레이프
      let want = w === "pistol" ? 340 : w === "shotgun" ? 110 : 50;
      if (now > b.strafeAt) { b.strafeDir *= -1; b.strafeAt = now + 900 + Math.random() * 1300; }
      const toE = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      let mv;
      if (ed > want + 60) mv = toE;
      else if (ed < want - 60) mv = toE + Math.PI;
      else mv = toE + Math.PI / 2 * b.strafeDir;
      goalX = p.x + Math.cos(mv) * 120; goalY = p.y + Math.sin(mv) * 120;
      // 공격
      if (w === "pistol" || w === "shotgun") {
        if (ed < this.cfg[w].range * .95) this.attack(p);
      } else {
        const m = this.cfg[w] || this.cfg.fist;
        if (ed < m.range + PLAYER_R + 6) this.attack(p);
      }
      // 회피 구르기
      if (now > b.nextRoll && ed < 520 && p.stamina > this.cfg.rollCost + 15) {
        this.roll(p);
        b.nextRoll = now + 2200 + Math.random() * 2600;
      }
    } else {
      // ===== 파밍 =====
      if (gun && p.ammo[gun].mag < this.cfg[gun].mag * .4 && p.ammo[gun].reserve > 0) this.startReload(p);
      let best = null, bd = 1e9, bc = null;
      for (const it of this.items) {
        if (!this.botWants(p, it)) continue;
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        if (d < bd) { bd = d; best = it; bc = null; }
      }
      if (!best || bd > 500) {
        for (const c of this.crates) {
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < bd) { bd = d; best = c; bc = c; }
        }
      }
      if (!armed && enemy && ed < 260) {
        // 무기 없으면 도망
        const a = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        goalX = p.x + Math.cos(a) * 180; goalY = p.y + Math.sin(a) * 180;
        p.angle = a;
      } else if (best) {
        goalX = best.x; goalY = best.y; ignoreCrate = bc;
        if (bc) {
          const d = Math.hypot(bc.x - p.x, bc.y - p.y);
          p.angle = Math.atan2(bc.y - p.y, bc.x - p.x);
          if (meleeIdx >= 0) p.active = meleeIdx;
          const w2 = p.weapons[p.active] || "fist";
          const rng = (w2 === "pistol" || w2 === "shotgun") ? 220 : ((this.cfg[w2] || this.cfg.fist).range + 26);
          if (d < rng) this.attack(p);
        } else {
          p.angle = Math.atan2(goalY - p.y, goalX - p.x);
        }
      } else {
        if (now > b.wanderUntil) { b.wanderA = Math.random() * Math.PI * 2; b.wanderUntil = now + 1600; }
        goalX = p.x + Math.cos(b.wanderA) * 140; goalY = p.y + Math.sin(b.wanderA) * 140;
        p.angle = b.wanderA;
      }
    }

    // ===== 이동 (장애물 회피 + 끼임 감지) =====
    p.keys = {};
    if (goalX != null) {
      let a = Math.atan2(goalY - p.y, goalX - p.x);
      if (now < b.detourUntil) a = b.detourA;
      else {
        for (const off of [0, .7, -.7, 1.3, -1.3, 2, -2]) {
          const na = a + off;
          const px = p.x + Math.cos(na) * 48, py = p.y + Math.sin(na) * 48;
          const hitW = walls.some(w => circleRect(px, py, 15, w));
          const hitC = this.crates.some(c => c !== ignoreCrate && circleRect(px, py, 15, { x: c.x - 23, y: c.y - 23, w: 46, h: 46 }));
          if (!hitW && !hitC) { a = na; break; }
        }
      }
      if (now - b.lastPosAt > 900) {
        if (Math.hypot(p.x - b.lastPos.x, p.y - b.lastPos.y) < 8) {
          b.detourA = a + (Math.random() < .5 ? 1.8 : -1.8);
          b.detourUntil = now + 650;
        }
        b.lastPos = { x: p.x, y: p.y }; b.lastPosAt = now;
      }
      const dx = Math.cos(a), dy = Math.sin(a);
      if (dy < -.38) p.keys.w = true;
      if (dy > .38) p.keys.s = true;
      if (dx < -.38) p.keys.a = true;
      if (dx > .38) p.keys.d = true;
    }
  }

  exchangePick(p, choice) {
    if (!p || !p.pendingExchange) return;
    if (!["bandage", "medkit", "adren"].includes(choice)) return;
    const it = this.items.find(q => q.id === p.pendingExchange.itemId);
    p.pendingExchange = null;
    io.to(p.id).emit("exchangeChoiceEnd");
    if (!it) return;
    if ((p.x - it.x) ** 2 + (p.y - it.y) ** 2 > 80 * 80) return;
    p.items[choice] = Math.min(9, p.items[choice] + 1);
    const ko = { bandage: "붕대", medkit: "구급상자", adren: "주사기" };
    io.to(p.id).emit("toast", `교환 완료: ${ko[choice]} 획득`);
    io.to(p.id).emit("sfx", "pickup");
    this.takeItem(it);
  }

  frontDrop(p, obj) {
    const a = p.angle + (Math.random() - .5) * .9;
    const d = 40 + Math.random() * 20;
    this.items.push({ ...obj, id: itemId++, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, dropAt: Date.now(), dropper: p.id });
  }

  dropAmmo(p, g) {
    if (!p || p.dead || p.using) return;
    if (g !== "pistol" && g !== "shotgun") return;
    const unit = this.cfg[g].mag;
    const am = p.ammo[g];
    const amt = Math.min(unit, am.mag + am.reserve);
    if (amt <= 0) return;
    const fromRes = Math.min(amt, am.reserve);
    am.reserve -= fromRes;
    am.mag -= (amt - fromRes);
    this.frontDrop(p, { type: "ammo_" + g, amt });
    io.to(p.id).emit("toast", `${WEAPON_KO[g]} 탄약 ${amt}발 버림`);
  }

  dropItem(p, type) {
    if (!p || p.dead || p.using) return;
    if (!["bandage", "medkit", "adren"].includes(type)) return;
    if (p.items[type] <= 0) return;
    p.items[type]--;
    this.frontDrop(p, { type });
    const ko = { bandage: "붕대", medkit: "구급상자", adren: "주사기" };
    io.to(p.id).emit("toast", `${ko[type]} 버림`);
  }

  humanCount() { return Object.values(this.players).filter(p => !p.isDummy).length; }
  aliveHumans() { return Object.values(this.players).filter(p => !p.isDummy && !p.dead); }

  startShowdownRound() {
    this.sdPhase = "playing";
    this.items = [];
    this.crates = []; this.cells = new Set();
    this.spawnCrates(this.cfg.crateInitial);
    this.lastCrateSpawn = Date.now();
    for (const id in this.players) {
      const p = this.players[id];
      if (p.isDummy) continue;
      p.spectator = false;
      p.score = 0; p.deaths = 0;
      this.resetGear(p);
      this.fullRespawn(p);
    }
    io.to(this.id).emit("toast", "쇼다운 시작! 최후의 1인이 되세요");
  }

  endMatch(winnerName) {
    this.matchWinner = winnerName;
    this.matchResetAt = Date.now() + 6000;
    io.to(this.id).emit("matchOver", { name: winnerName });
  }

  tick(now) {
    // ===== 모드 진행 =====
    if (this.gameMode === "dm") {
      if (this.humanCount() > 0 && !this.matchEndsAt) this.matchEndsAt = now + 300000; // 5분
      if (this.humanCount() === 0) { this.matchEndsAt = 0; this.matchWinner = null; this.chooserId = null; this.targetKills = 10; }
      if (!this.matchWinner && this.matchEndsAt) {
        const top = Object.values(this.players).filter(p => !p.isDummy).sort((a, b) => b.score - a.score)[0];
        if (top && top.score >= this.targetKills) this.endMatch(top.name);
        else if (now >= this.matchEndsAt) {
          const list = Object.values(this.players).filter(p => !p.isDummy).sort((a, b) => b.score - a.score);
          this.endMatch(list.length && list[0].score > 0 ? list[0].name : "무승부");
        }
      }
      if (this.matchWinner && now >= this.matchResetAt) {
        this.matchWinner = null;
        this.matchEndsAt = now + 300000;
        this.items = [];
        for (const id in this.players) {
          const p = this.players[id];
          if (p.isDummy) continue;
          p.score = 0; p.deaths = 0;
          this.resetGear(p);
          this.fullRespawn(p);
        }
      }
    } else if (this.gameMode === "showdown") {
      const humans = this.humanCount();
      if (this.sdPhase === "waiting") {
        if (humans >= 3) {
          this.sdPhase = "countdown";
          this.sdCountdownEnd = now + 10000;
          io.to(this.id).emit("toast", "3명 모임! 10초 후 시작");
        }
      } else if (this.sdPhase === "countdown") {
        if (humans < 3) { this.sdPhase = "waiting"; io.to(this.id).emit("toast", "인원 부족 - 대기로 전환"); }
        else if (now >= this.sdCountdownEnd) this.startShowdownRound();
      } else if (this.sdPhase === "playing") {
        const alive = this.aliveHumans();
        if (humans < 2) { this.sdPhase = "waiting"; }
        else if (alive.length <= 1) {
          this.sdWinner = alive.length ? alive[0].name : "무승부";
          this.sdPhase = "over";
          this.sdResetAt = now + 8000;
          io.to(this.id).emit("matchOver", { name: this.sdWinner });
        }
      } else if (this.sdPhase === "over") {
        if (now >= this.sdResetAt) {
          this.sdPhase = "waiting"; this.sdWinner = null;
          for (const id in this.players) {
            const p = this.players[id];
            if (p.isDummy) continue;
            p.spectator = false;
            this.resetGear(p);
            this.fullRespawn(p);
          }
        }
      }
    }

    // 전시실 재생성
    this.respawnQueue = this.respawnQueue.filter(r => {
      if (now < r.at) return true;
      this.items.push({ id: itemId++, x: r.spot.x, y: r.spot.y, type: r.spot.type, display: true, spot: r.spot });
      return false;
    });

    // ===== 플레이어 =====
    for (const id in this.players) {
      const p = this.players[id];
      if (p.isBot) this.botTick(p, now);
      if (p.dead) {
        const canRespawn = !p.isDummy && !p.spectator &&
          !(this.gameMode === "showdown" && this.sdPhase === "playing");
        if (canRespawn && now >= p.respawnAt) this.fullRespawn(p);
        continue;
      }
      if (!p.isDummy) {
        // 피격 후 일정 시간 지나야 자동회복
        if (now - p.lastHitAt > this.cfg.regenDelay)
          p.hp = Math.min(p.maxHp, p.hp + this.cfg.hpRegen / 30);
        // 2초 이상 정지 시 스테미너 회복 1.5배
        let rate = (now - p.lastMoveAt > 2000) ? this.cfg.staminaRegen * 1.5 : this.cfg.staminaRegen;
        if (p.adrenUntil > now) rate *= this.cfg.adren.mult;
        p.stamina = Math.min(this.cfg.staminaMax, p.stamina + rate / 30);
      }
      if (p.reloadEnd && now >= p.reloadEnd) {
        const g = this.cfg[p.reloadGun], am = p.ammo[p.reloadGun];
        if (g && am) {
          const take = Math.min(g.mag - am.mag, am.reserve);
          am.mag += take; am.reserve -= take;
        }
        p.reloadStart = 0; p.reloadEnd = 0; p.reloadGun = "";
      }
      if (p.using && now >= p.using.end) {
        const t = p.using.type;
        p.items[t]--;
        if (t === "adren") {
          p.adrenUntil = now + this.cfg.adren.dur;
          io.to(p.id).emit("toast", "⚡ 아드레날린! 스테미너 회복 증가");
        } else {
          p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * this.cfg[t].heal / 100));
          io.to(this.id).emit("healed", { x: p.x, y: p.y });
        }
        p.itemCd[t] = now + this.cfg[t].cd;
        p.using = null;
      }
      const rolling = p.rollUntil > now;
      const blockR = c => ({ x: c.x - 23, y: c.y - 23, w: 46, h: 46 });
      if (rolling) {
        const step = this.cfg.rollDist / (ROLL_DURATION / TICK);
        const nx = p.x + Math.cos(p.rollAngle) * step;
        const ny = p.y + Math.sin(p.rollAngle) * step;
        if (!walls.some(w => circleRect(nx, p.y, PLAYER_R, w)) && !this.crates.some(c => circleRect(nx, p.y, PLAYER_R, blockR(c)))) p.x = nx;
        if (!walls.some(w => circleRect(p.x, ny, PLAYER_R, w)) && !this.crates.some(c => circleRect(p.x, ny, PLAYER_R, blockR(c)))) p.y = ny;
        p.lastMoveAt = now;
      } else {
        let dx = 0, dy = 0;
        if (p.keys.w) dy -= 1; if (p.keys.s) dy += 1;
        if (p.keys.a) dx -= 1; if (p.keys.d) dx += 1;
        if (dx || dy) {
          p.lastMoveAt = now;
          // 감속: 장전/회복 + 총알 무게 중 큰 쪽 적용
          const total = this.ammoTotal(p);
          const slowAmmo = total > this.cfg.ammoSlow2 ? .5 : total > this.cfg.ammoSlow1 ? .25 : 0;
          const slowBusy = (p.using || p.reloadEnd > now) ? this.cfg.slowPct / 100 : 0;
          const mul = 1 - Math.max(slowAmmo, slowBusy);
          const len = Math.hypot(dx, dy);
          const nx = p.x + dx / len * SPEED * mul;
          const ny = p.y + dy / len * SPEED * mul;
          if (!walls.some(w => circleRect(nx, p.y, PLAYER_R, w)) && !this.crates.some(c => circleRect(nx, p.y, PLAYER_R, blockR(c)))) p.x = nx;
          if (!walls.some(w => circleRect(p.x, ny, PLAYER_R, w)) && !this.crates.some(c => circleRect(p.x, ny, PLAYER_R, blockR(c)))) p.y = ny;
        }
      }
      p.x = Math.max(PLAYER_R, Math.min(MAP_W - PLAYER_R, p.x));
      p.y = Math.max(PLAYER_R, Math.min(MAP_H - PLAYER_R, p.y));

      if (!p.isDummy) {
        let nearPending = false;
        for (const it of [...this.items]) {
          const near = (p.x - it.x) ** 2 + (p.y - it.y) ** 2 < 34 * 34;
          if (near) this.pickup(p, it);
          if (p.pendingChoice && it.id === p.pendingChoice.itemId &&
              (p.x - it.x) ** 2 + (p.y - it.y) ** 2 < 80 * 80) nearPending = true;
        }
        if (p.pendingChoice && !nearPending) {
          p.pendingChoice = null;
          io.to(p.id).emit("ammoChoiceEnd");
        }
        if (p.pendingExchange) {
          const it2 = this.items.find(q => q.id === p.pendingExchange.itemId);
          if (!it2 || (p.x - it2.x) ** 2 + (p.y - it2.y) ** 2 > 80 * 80) {
            p.pendingExchange = null;
            io.to(p.id).emit("exchangeChoiceEnd");
          }
        }
      }
    }

    // 속도 추적 (봇 예측 조준용)
    for (const id in this.players) {
      const q = this.players[id];
      q._vx = q.x - (q._lx ?? q.x); q._vy = q.y - (q._ly ?? q.y);
      q._lx = q.x; q._ly = q.y;
    }

    // ===== 총알 =====
    this.bullets = this.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) return false;
      if (walls.some(w => b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h)) return false;
      for (const c of this.crates) {
        if (Math.abs(b.x - c.x) < 25 && Math.abs(b.y - c.y) < 25) { this.damageCrate(c, b.dmg); return false; }
      }
      for (const id in this.players) {
        const t = this.players[id];
        if (t.dead || id === b.owner) continue;
        if ((t.x - b.x) ** 2 + (t.y - b.y) ** 2 < (PLAYER_R + 4) ** 2) {
          if (t.rollUntil > now || t.protectUntil > now) return false; // 무적엔 총알 소멸만
          this.damagePlayer(t, b.dmg, this.players[b.owner], WEAPON_KO[b.gun], "bullet");
          return false;
        }
      }
      return true;
    });

    if (now - this.lastCrateSpawn > this.cfg.crateIntervalSec * 1000) {
      this.lastCrateSpawn = now;
      if (!(this.gameMode === "showdown" && this.sdPhase !== "playing"))
        this.spawnCrates(this.cfg.crateBatch);
    }

    if (this.dmgQueue.length) {
      const merged = {};
      for (const d of this.dmgQueue) {
        if (!merged[d.target]) merged[d.target] = { ...d };
        else merged[d.target].dmg += d.dmg;
      }
      const out = Object.values(merged).map(d => ({ ...d, dmg: Math.round(d.dmg) })).filter(d => d.dmg > 0);
      if (out.length) io.to(this.id).emit("dmgs", out);
      this.dmgQueue = [];
    }

    // 매치 정보
    let match = null;
    if (this.gameMode === "dm") {
      match = { type: "dm", target: this.targetKills, endsAt: this.matchEndsAt, winner: this.matchWinner };
    } else if (this.gameMode === "showdown") {
      match = { type: "sd", phase: this.sdPhase, countdownEnd: this.sdCountdownEnd, alive: this.aliveHumans().length, humans: this.humanCount(), winner: this.sdWinner };
    }

    io.to(this.id).emit("state", {
      players: Object.values(this.players).map(p => ({
        id: p.id, name: p.name, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
        angle: p.angle, hp: Math.round(p.hp), maxHp: p.maxHp,
        stamina: Math.round(p.stamina), score: p.score, deaths: p.deaths,
        color: p.color, hat: p.hat, dead: p.dead, isDummy: p.isDummy,
        armor: p.armor, vest: p.vest, hearts: p.hearts,
        weapons: p.weapons, active: p.active, ammo: p.ammo,
        attackAt: p.attackAt, attackType: p.attackType, attackSide: p.attackSide,
        rollUntil: p.rollUntil, rollAngle: p.rollAngle,
        reloadStart: p.reloadStart, reloadEnd: p.reloadEnd,
        using: p.using, items: p.items,
        protectUntil: p.protectUntil, spectator: p.spectator,
        adrenUntil: p.adrenUntil, isBot: p.isBot,
      })),
      bullets: this.bullets.map(b => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y) })),
      crates: this.crates.map(c => ({ id: c.id, x: c.x, y: c.y, hp: c.hp, maxHp: c.maxHp })),
      items: this.items.map(it => ({ id: it.id, x: it.x, y: it.y, type: it.type })),
      match, now,
    });
  }
}

let practiceCfg = clone(DEFAULT_CFG);
const sdCfg = clone(DEFAULT_CFG);
sdCfg.rollCost = 5;
sdCfg.crateIntervalSec = 20;

const rooms = {
  dm: new Room("dm", clone(DEFAULT_CFG), { gameMode: "dm" }),
  showdown: new Room("showdown", sdCfg, { gameMode: "showdown" }),
};

io.on("connection", socket => {
  let room = null;

  const leaveRoom = () => {
    if (!room) return;
    const p = room.players[socket.id];
    if (p) io.to(room.id).emit("feed", { text: `${p.name} 퇴장`, type: "leave" });
    delete room.players[socket.id];
    socket.leave(room.id);
    if (room.sandbox || room.privateRoom) delete rooms[room.id];
    room = null;
  };

  socket.on("getUsedColors", () => {
    const used = [...new Set([...rooms.dm.usedColors(), ...rooms.showdown.usedColors()])];
    socket.emit("usedColors", used.map(c => PALETTE.indexOf(c)).filter(i => i >= 0));
  });

  socket.on("join", data => {
    leaveRoom();
    const mode = ["dm", "showdown", "practice", "experiment", "bots"].includes(data.mode) ? data.mode : "dm";
    if (mode === "experiment" && data.pw !== EXPERIMENT_PW) {
      socket.emit("joinDenied", "비밀번호가 틀렸습니다");
      return;
    }
    if (mode === "dm") room = rooms.dm;
    else if (mode === "showdown") room = rooms.showdown;
    else if (mode === "bots") {
      room = new Room("bots_" + socket.id, clone(DEFAULT_CFG), { gameMode: "dm", privateRoom: true });
      rooms[room.id] = room;
    }
    else {
      const cfg = mode === "practice" ? clone(practiceCfg) : clone(DEFAULT_CFG);
      room = new Room("sb_" + socket.id, cfg, { sandbox: true, allowCfg: mode === "experiment", gameMode: "sandbox", showcase: mode === "experiment" });
      rooms[room.id] = room;
    }
    socket.join(room.id);
    const p = room.addPlayer(socket.id, data.name, data.color, data.hat);
    socket.emit("init", {
      id: socket.id, walls, mapW: MAP_W, mapH: MAP_H,
      mode, cfg: room.cfg, schema: CFG_SCHEMA, cell: CELL,
      palette: PALETTE, myColor: p.color,
    });
    io.to(room.id).emit("feed", { text: `${p.name} 입장`, type: "join" });
    // 데스매치/봇전투 첫 입장자: 목표 킬 수 선택
    if ((mode === "dm" || mode === "bots") && room.humanCount() === 1) {
      room.chooserId = socket.id;
      socket.emit("chooseTarget");
    }
    // 봇 소환
    if (mode === "bots") {
      const n = Math.max(1, Math.min(7, data.botCount | 0 || 3));
      for (let i = 0; i < n; i++) room.addBot(i);
      socket.emit("toast", `봇 ${n}명과 데스매치!`);
    }
    if (mode === "showdown" && room.sdPhase === "playing") {
      socket.emit("toast", "라운드 진행 중 — 다음 라운드에 참여합니다");
    }
  });

  socket.on("setTarget", n => {
    if (!room || room.gameMode !== "dm") return;
    if (socket.id !== room.chooserId) return;
    if (![5, 10, 15, 20].includes(n)) return;
    room.targetKills = n;
    io.to(room.id).emit("toast", `목표: ${n}킬 선취`);
  });

  socket.on("leave", () => leaveRoom());

  socket.on("input", d => {
    const p = room && room.players[socket.id];
    if (!p) return;
    p.keys = d.keys || {};
    p.angle = typeof d.angle === "number" ? d.angle : 0;
  });
  socket.on("attack", () => room && room.attack(room.players[socket.id]));
  socket.on("reload", () => room && room.startReload(room.players[socket.id]));
  socket.on("roll", () => room && room.roll(room.players[socket.id]));
  socket.on("switchWeapon", dir => room && room.switchWeapon(room.players[socket.id], dir === -1 ? -1 : 1));
  socket.on("useItem", type => room && room.useItem(room.players[socket.id], type));
  socket.on("dropWeapon", () => room && room.dropWeapon(room.players[socket.id]));
  socket.on("dropAmmo", g => room && room.dropAmmo(room.players[socket.id], g));
  socket.on("dropItem", t => room && room.dropItem(room.players[socket.id], t));
  socket.on("ammoPick", g => room && room.ammoPick(room.players[socket.id], g));
  socket.on("exchangePick", t => room && room.exchangePick(room.players[socket.id], t));

  socket.on("spawnDummy", () => {
    if (!room || !room.sandbox) return;
    const p = room.players[socket.id];
    if (!p) return;
    const a = Math.random() * Math.PI * 2;
    room.addDummy(p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120);
  });
  socket.on("resetDummies", () => {
    if (!room || !room.sandbox) return;
    for (const id in room.players) {
      const d = room.players[id];
      if (d.isDummy) { d.maxHp = room.cfg.dummyHp; d.hp = d.maxHp; d.dead = false; }
    }
  });
  socket.on("clearDummies", () => {
    if (!room || !room.sandbox) return;
    for (const id in room.players) if (room.players[id].isDummy) delete room.players[id];
  });
  socket.on("cfg", d => {
    if (!room || !room.allowCfg) return;
    setPath(room.cfg, String(d.path), Number(d.value));
    const p = room.players[socket.id];
    if (p && d.path === "maxHp") { p.maxHp = room.cfg.maxHp + p.hearts * room.cfg.heartBonus; p.hp = Math.min(p.hp, p.maxHp); }
    if (d.path === "dummyHp") for (const id in room.players) {
      const t = room.players[id];
      if (t.isDummy) { t.maxHp = room.cfg.dummyHp; t.hp = Math.min(t.hp, t.maxHp); }
    }
    socket.emit("cfgOk", room.cfg);
  });
  socket.on("applyToPractice", () => {
    if (!room || !room.allowCfg) return;
    practiceCfg = clone(room.cfg);
    socket.emit("toast", "현재 설정을 연습모드에 반영했습니다");
  });
  socket.on("resetPracticeCfg", () => {
    if (!room || !room.sandbox) return;
    practiceCfg = clone(DEFAULT_CFG);
    room.cfg = clone(practiceCfg);
    const p = room.players[socket.id];
    if (p) { p.maxHp = room.cfg.maxHp; p.hp = Math.min(p.hp, p.maxHp); }
    socket.emit("toast", "설정을 기본값으로 초기화했습니다");
    socket.emit("cfgOk", room.cfg);
  });

  socket.on("disconnect", () => leaveRoom());
});

setInterval(() => {
  const now = Date.now();
  for (const id in rooms) rooms[id].tick(now);
}, TICK);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중! http://localhost:${PORT}`);
  console.log(`친구 접속: http://내IP주소:${PORT} (같은 와이파이)`);
});
