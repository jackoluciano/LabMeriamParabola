/* script.js: logika bersama untuk index.html (lab) dan game.html (game) */

/* ===== Utilitas bersama ===== */
const $ = (s) => document.querySelector(s);
// Percepatan gravitasi planet (m/s²)
const G = { Bumi: 9.8, Bulan: 1.62, Mars: 3.71, Jupiter: 24.8 };
// Format angka gaya Indonesia (koma desimal)
const f1 = (n) => (Math.round(n * 100) / 100).toString().replace(".", ",");

/* ===== Mesin 3D: proyeksi perspektif di atas canvas 2D (tanpa library) ===== */
const R3 = {
  B(c, w, h) {
    const cp = Math.cos(c.pit),
      sp = Math.sin(c.pit),
      cy = Math.cos(c.yaw),
      sy = Math.sin(c.yaw);
    return {
      e: [c.tx + c.d * cp * cy, c.ty + c.d * sp, c.tz + c.d * cp * sy],
      f: [-cp * cy, -sp, -cp * sy],
      r: [sy, 0, -cy],
      u: [-cy * sp, cp, -sy * sp],
      k: h * 1.07,
      w,
      h,
    };
  },
  P(b, p) {
    const v = [p[0] - b.e[0], p[1] - b.e[1], p[2] - b.e[2]],
      z = v[0] * b.f[0] + v[1] * b.f[1] + v[2] * b.f[2];
    if (z < 0.5) return null;
    return [
      b.w / 2 + ((v[0] * b.r[0] + v[2] * b.r[2]) / z) * b.k,
      b.h / 2 - ((v[0] * b.u[0] + v[1] * b.u[1] + v[2] * b.u[2]) / z) * b.k,
      z,
      b.k / z,
    ];
  },
  U(b, px, py) {
    const a = (px - b.w / 2) / b.k,
      t = -(py - b.h / 2) / b.k,
      d = [0, 1, 2].map((i) => b.f[i] + a * b.r[i] + t * b.u[i]);
    if (d[1] > -1e-4) return null;
    const s = -b.e[1] / d[1];
    return [b.e[0] + d[0] * s, b.e[2] + d[2] * s];
  },
  draw(g, w, h, s) {
    const b = R3.B(s.cam, w, h),
      P = (p) => R3.P(b, p),
      hz = h / 2 - b.k * Math.tan(s.cam.pit),
      hy = Math.max(0, Math.min(h, hz));
    let q = g.createLinearGradient(0, 0, 0, Math.max(hy, 1));
    q.addColorStop(0, s.sky);
    q.addColorStop(1, s.sky2);
    g.fillStyle = q;
    g.fillRect(0, 0, w, h);
    if (s.stars) {
      g.fillStyle = "#fff";
      for (let i = 0; i < 90; i++) {
        g.globalAlpha = 0.4 + (i % 3) * 0.2;
        g.fillRect((((i * 97) % 101) / 101) * w, (((i * 53) % 89) / 89) * Math.max(0, hz - 8), 1.6, 1.6);
      }
      g.globalAlpha = 1;
    }
    q = g.createLinearGradient(0, hy, 0, h);
    q.addColorStop(0, s.sky2);
    q.addColorStop(0.2, s.ground);
    q.addColorStop(1, s.ground);
    g.fillStyle = q;
    g.fillRect(0, hy, w, h - hy);
    g.lineWidth = 1;
    g.strokeStyle = s.grid;
    g.beginPath();
    const ln = (f, n) => {
      let on = 0;
      for (let i = 0; i <= n; i++) {
        const p = P(f(i / n));
        if (p) {
          on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
          on = 1;
        } else on = 0;
      }
    };
    for (let z = -60; z <= 60; z += 10) ln((t) => [-20 + (s.gx + 20) * t, 0, z], 40);
    for (let x = 0; x <= s.gx; x += 10) ln((t) => [x, 0, -60 + 120 * t], 24);
    g.stroke();
    g.fillStyle = "#ffffffd0";
    g.font = '11px "IBM Plex Sans",sans-serif';
    for (let x = 0; x <= s.gx; x += s.lstep) {
      const p = P([x, 0, -4]);
      if (p) g.fillText(x + " m", p[0] - 10, p[1] + 12);
    }
    const poly = (pts, fill, st) => {
      const a = pts.map(P);
      if (a.some((v) => !v)) return;
      g.beginPath();
      a.forEach((v, i) => (i ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1])));
      g.closePath();
      if (fill) {
        g.fillStyle = fill;
        g.fill();
      }
      if (st) {
        g.strokeStyle = st;
        g.stroke();
      }
    };
    const circ = (x, y, z, r) =>
      Array.from({ length: 32 }, (_, i) => {
        const t = (i / 32) * 6.283;
        return [x + r * Math.cos(t), y, z + r * Math.sin(t)];
      });
    const disc = (x, y, z, r, f) => poly(circ(x, y, z, r), f);
    const box = (x0, x1, y0, y1, z0, z1, c) => {
      const V = [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ];
      [
        [0, 1, 5, 4, 0.75],
        [1, 2, 6, 5, 0.6],
        [2, 3, 7, 6, 0.75],
        [3, 0, 4, 7, 0.6],
        [4, 5, 6, 7, 1],
      ]
        .map((f) => {
          const m = [0, 1, 2].map((k) => f.slice(0, 4).reduce((a, i) => a + V[i][k] / 4, 0)),
            p = P(m);
          return [p ? p[2] : 0, f];
        })
        .sort((m, n) => n[0] - m[0])
        .forEach(([, f]) => {
          const pts = f.slice(0, 4).map((i) => V[i]);
          poly(pts, c);
          poly(pts, "rgba(0,0,0," + (1 - f[4]) * 0.6 + ")");
        });
    };
    if (s.target) {
      const t = s.target;
      disc(t.x, 0.05, t.z, t.r, "#0d8a74");
      disc(t.x, 0.06, t.z, t.r * 0.62, "#fff");
      disc(t.x, 0.07, t.z, t.r * 0.26, "#c4372b");
      const a = P([t.x, 0, t.z]),
        c = P([t.x, 8, t.z]);
      if (a && c) {
        g.strokeStyle = "#fff";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(c[0], c[1]);
        g.stroke();
        poly(
          [
            [t.x, 8, t.z],
            [t.x, 6.2, t.z],
            [t.x + 3, 7.1, t.z],
          ],
          "#0d8a74",
        );
      }
    }
    if (s.mark != null) disc(s.mark, 0.08, s.markz || 0, 0.8, "#c4372b");
    if (s.ball) disc(s.ball[0], 0.03, s.ball[2], 0.9, "rgba(0,0,0,.3)");
    if (s.ring) {
      g.globalAlpha = Math.max(0, s.ring.a);
      g.lineWidth = 3;
      poly(circ(s.ring.x, 0.2, s.ring.z, s.ring.k), null, s.ring.c);
      g.globalAlpha = 1;
    }
    if (s.pred) {
      g.fillStyle = s.predc;
      s.pred.forEach((p) => {
        const a = P(p);
        if (a) {
          g.beginPath();
          g.arc(a[0], a[1], 2.2, 0, 7);
          g.fill();
        }
      });
    }
    if (s.trail && s.trail.length) {
      g.shadowColor = "#f2a100";
      g.shadowBlur = 12;
      g.strokeStyle = "#f2a100";
      g.lineWidth = 3.5;
      g.beginPath();
      let on = 0;
      s.trail.forEach((p) => {
        const a = P(p);
        if (a) {
          on ? g.lineTo(a[0], a[1]) : g.moveTo(a[0], a[1]);
          on = 1;
        }
      });
      g.stroke();
      g.shadowBlur = 0;
    }
    const it = [],
      add = (p, f) => {
        if (P(p)) it.push([P(p)[2], f]);
      };
    if (s.wall) {
      const w = s.wall;
      add([w.x, w.h / 2, 0], () => box(w.x - 1, w.x + 1, 0, w.h, -w.hw, w.hw, s.wallc || "#9aa7b4"));
    }
    if (s.cannon) {
      const c = s.cannon;
      if (c.pil > 0) add([0, c.pil / 2, 0], () => box(-1.2, 1.2, 0, c.pil, -1.2, 1.2, "#7a8794"));
      add([0, c.h, 0], () => {
        const o = P([0, c.h, 0]),
          a = (c.a * Math.PI) / 180,
          z = (c.az * Math.PI) / 180,
          t = P([6 * Math.cos(a) * Math.cos(z), c.h + 6 * Math.sin(a), 6 * Math.cos(a) * Math.sin(z)]);
        if (!o || !t) return;
        g.lineCap = "round";
        g.strokeStyle = "#2457d6";
        g.lineWidth = 1.6 * o[3];
        g.beginPath();
        g.moveTo(o[0], o[1]);
        g.lineTo(t[0], t[1]);
        g.stroke();
        g.fillStyle = "#13283b";
        g.beginPath();
        g.arc(o[0], o[1], 1.8 * o[3], 0, 7);
        g.fill();
      });
    }
    if (s.ball)
      add(s.ball, () => {
        const o = P(s.ball),
          r = 0.9 * o[3],
          q = g.createRadialGradient(o[0] - r / 3, o[1] - r / 3, r / 6, o[0], o[1], r);
        q.addColorStop(0, "#ffe08a");
        q.addColorStop(1, "#f2a100");
        g.shadowColor = "#f2a100";
        g.shadowBlur = 10;
        g.fillStyle = q;
        g.beginPath();
        g.arc(o[0], o[1], r, 0, 7);
        g.fill();
        g.shadowBlur = 0;
      });
    it.sort((m, n) => n[0] - m[0]).forEach((i) => i[1]());
    (s.arrows || []).forEach((r) => {
      const a = P(r.o),
        z = P([r.o[0] + r.d[0], r.o[1] + r.d[1], r.o[2] + r.d[2]]);
      if (!a || !z) return;
      const t = Math.atan2(z[1] - a[1], z[0] - a[0]);
      g.strokeStyle = g.fillStyle = r.c;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(z[0], z[1]);
      g.stroke();
      g.beginPath();
      g.moveTo(z[0], z[1]);
      g.lineTo(z[0] - 9 * Math.cos(t - 0.4), z[1] - 9 * Math.sin(t - 0.4));
      g.lineTo(z[0] - 9 * Math.cos(t + 0.4), z[1] - 9 * Math.sin(t + 0.4));
      g.fill();
    });
    g.fillStyle = s.partc || "#fff";
    (s.parts || []).forEach((p) => {
      const a = P(p);
      if (a) {
        g.beginPath();
        g.arc(a[0], a[1], 2.6, 0, 7);
        g.fill();
      }
    });
  },
};

/* ===== Halaman lab (index.html) ===== */
function initLab() {
  const cv = $("#stage"),
    ctx = cv.getContext("2d");
  const S = {
    g: 9.8,
    v: 20,
    a: 45,
    h: 0,
    tx: 40,
    tr: 3,
    ball: null,
    trail: [],
    land: null,
    rows: [],
    shots: 0,
    hits: 0,
    speed: 1,
  };
  const F = { v: " m/s", a: "°", h: " m", g: " m/s²", tx: " m" };
  let cw = 0,
    ch = 0,
    last = 0;
  const col = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function calc() {
    const r = (S.a * Math.PI) / 180,
      vx = S.v * Math.cos(r),
      vy = S.v * Math.sin(r);
    const T = (vy + Math.sqrt(vy * vy + 2 * S.g * S.h)) / S.g;
    return { vx, vy, T, R: vx * T, H: S.h + (vy * vy) / (2 * S.g) };
  }
  function fit() {
    const d = devicePixelRatio || 1;
    cw = cv.parentElement.clientWidth;
    ch = cv.parentElement.clientHeight || Math.max(300, Math.min(650, cw * 0.8));
    cv.width = cw * d;
    cv.height = ch * d;
    cv.style.height = ch + "px";
    ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }

  function fire() {
    if (S.ball) return;
    S.ball = { t: 0, c: calc(), g: S.g, h: S.h, x: 0, y: S.h };
    S.trail = [];
    S.land = null;
    S.shots++;
    $("#fire").disabled = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  function tick(now) {
    const b = S.ball;
    if (!b) return;
    b.t += Math.min(0.05, (now - last) / 1000) * S.speed;
    last = now;
    const done = b.t >= b.c.T,
      t = done ? b.c.T : b.t;
    b.x = b.c.vx * t;
    b.y = done ? 0 : b.h + b.c.vy * t - 0.5 * b.g * t * t;
    S.trail.push([b.x, b.y]);
    if (done) {
      land(b);
    } else {
      draw();
      requestAnimationFrame(tick);
    }
  }
  function land(b) {
    const R = b.c.R,
      err = R - S.tx,
      hit = Math.abs(err) <= S.tr;
    if (hit) S.hits++;
    S.rows.unshift({ n: S.shots, v: S.v, a: S.a, h: S.h, g: b.g, R, hit });
    S.land = R;
    S.ball = null;
    $("#fire").disabled = false;
    const m = $("#msg");
    m.className = hit ? "hit" : "miss";
    m.textContent = hit
      ? `Kena! Peluru mendarat di ${f1(R)} m, tepat di zona target.`
      : err > 0
        ? `Terlalu jauh ${f1(err)} m. Kurangi kecepatan, atau ubah sudut menjauhi 45°.`
        : `Kurang jauh ${f1(-err)} m. Tambah kecepatan, atau dekatkan sudut ke 45°.`;
    after(b, hit);
    boom(R, 0, hit);
    loopFx();
  }
  function after(b, hit) {
    const m = $("#msg");
    save();
    render();
  }

  function render() {
    $("#score").textContent = `Kena ${S.hits} dari ${S.shots}`;
    $("#rows").innerHTML = S.rows.length
      ? S.rows
          .slice(0, 8)
          .map(
            (r) =>
              `<tr><td>${r.n}</td><td>${r.v}</td><td>${r.a}</td><td>${r.h}</td><td>${f1(r.g)}</td><td>${f1(r.R)}</td><td class="${r.hit ? "ok" : "no"}">${r.hit ? "Kena" : "Meleset"}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="7" style="color:var(--muted)">Belum ada data. Tekan Tembak untuk memulai.</td></tr>';
  }
  function sync() {
    for (const k in F) $("#" + k + "o").value = f1(S[k]) + F[k];
    const c = calc();
    $("#rR").textContent = f1(c.R) + " m";
    $("#rH").textContent = f1(c.H) + " m";
    $("#rT").textContent = f1(c.T) + " s";
    $("#rVx").textContent = f1(c.vx) + " m/s";
    $("#rVy").textContent = f1(c.vy) + " m/s";
    draw();
    chart();
  }

  for (const k in F) {
    const el = $("#" + k);
    el.addEventListener("input", () => {
      S[k] = +el.value;
      if (k === "g") setPlanet("");
      sync();
    });
  }
  $("#speed").addEventListener("change", (e) => (S.speed = +e.target.value));
  $("#vec").addEventListener("change", draw);
  $("#fire").addEventListener("click", fire);
  $("#rand").addEventListener("click", () => {
    S.tx = Math.round((15 + Math.random() * 105) * 2) / 2;
    $("#tx").value = S.tx;
    sync();
  });
  $("#clear").addEventListener("click", () => {
    S.rows = [];
    S.shots = S.hits = 0;
    S.land = null;
    S.trail = [];
    $("#msg").className = "";
    $("#msg").textContent = "Data dihapus. Atur parameter lalu tekan Tembak.";
    save();
    render();
    draw();
  });

  // Tema planet
  const TH = {
    Bulan: { a: "#03040a", b: "#1b1d2e", g: "#6d6d78" },
    Mars: { a: "#6d2f1c", b: "#e6a577", g: "#9b4b2d" },
    Jupiter: { a: "#2b1d18", b: "#c9955c", g: "#5b4331" },
  };
  // Efek pendaratan (goyangan kamera)
  let shake = 0;
  // Grafik R(theta)
  const gc = $("#gr"),
    gx = gc.getContext("2d");
  function chart() {
    const w = gc.clientWidth || 300,
      h = 150,
      d = devicePixelRatio || 1;
    gc.width = w * d;
    gc.height = h * d;
    gx.setTransform(d, 0, 0, d, 0, 0);
    const R = (a) => {
      const r = (a * Math.PI) / 180,
        vy = S.v * Math.sin(r);
      return (S.v * Math.cos(r) * (vy + Math.sqrt(vy * vy + 2 * S.g * S.h))) / S.g;
    };
    let mx = 1,
      ma = 0;
    for (let a = 0; a <= 90; a++)
      if (R(a) > mx) {
        mx = R(a);
        ma = a;
      }
    const X = (a) => 30 + (a / 90) * (w - 42),
      Y = (r) => h - 24 - (r / mx) * (h - 44);
    gx.font = '11px "IBM Plex Sans",sans-serif';
    gx.strokeStyle = col("--line");
    gx.fillStyle = col("--muted");
    gx.lineWidth = 1;
    gx.beginPath();
    gx.moveTo(30, 6);
    gx.lineTo(30, h - 24);
    gx.lineTo(w - 8, h - 24);
    gx.stroke();
    [0, 45, 90].forEach((a) => gx.fillText(a + "°", X(a) - 8, h - 8));
    gx.fillText("R (m)", 2, 12);
    gx.strokeStyle = col("--accent");
    gx.lineWidth = 2;
    gx.beginPath();
    for (let a = 0; a <= 90; a++) a ? gx.lineTo(X(a), Y(R(a))) : gx.moveTo(X(a), Y(R(a)));
    gx.stroke();
    gx.fillStyle = col("--hit");
    gx.beginPath();
    gx.arc(X(ma), Y(mx), 4, 0, 7);
    gx.fill();
    gx.fillText(`terjauh ${f1(mx)} m di ${ma}°`, X(ma) > w * 0.6 ? X(ma) - 130 : X(ma) + 8, Y(mx) + 14);
    gx.fillStyle = col("--ball");
    gx.strokeStyle = col("--ink");
    gx.beginPath();
    gx.arc(X(S.a), Y(R(S.a)), 6, 0, 7);
    gx.fill();
    gx.stroke();
  }
  const K = "lab-parabola-v1";
  function save() {
    try {
      localStorage.setItem(
        K,
        JSON.stringify({ rows: S.rows.slice(0, 20), shots: S.shots, hits: S.hits, seen: 1 }),
      );
    } catch (e) {}
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(K) || "null");
      if (d) {
        S.rows = d.rows || [];
        S.shots = d.shots || 0;
        S.hits = d.hits || 0;
        return d.seen;
      }
    } catch (e) {}
  }
  $("#help").addEventListener("click", () => $("#tut").showModal());
  $("#tut").addEventListener("close", save);
  // Drag-and-drop HTML5: planet -> arena
  function setPlanet(n) {
    $("#pn").textContent = n;
    document.querySelectorAll(".planet").forEach((p) => p.classList.toggle("on", p.dataset.n === n));
  }
  function pick(n) {
    if (!G[n]) return;
    S.g = G[n];
    $("#g").value = S.g;
    setPlanet(n);
    sync();
  }
  document.querySelectorAll(".planet").forEach((p) => {
    p.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", p.dataset.n);
      e.dataTransfer.effectAllowed = "copy";
    });
    p.addEventListener("click", () => pick(p.dataset.n));
    p.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(p.dataset.n);
      }
    });
  });
  const zone = $("#zone");
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    pick(e.dataTransfer.getData("text/plain"));
  });

  $("#theme").addEventListener("click", () => {
    const r = document.documentElement,
      dark = r.dataset.theme
        ? r.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    draw();
  });
  addEventListener("resize", () => {
    fit();
    chart();
  });
  const seen = load();
  fit();
  sync();
  render();
  if (!seen)
    try {
      $("#tut").showModal();
    } catch (e) {}
  // ===== Arena 3D: kamera, garis lintasan, efek, interaksi =====
  var SKY3 = { Bulan: ["#03040a", "#1b1d2e"], Mars: ["#8c3f26", "#e6a577"], Jupiter: ["#3a2a20", "#c9955c"] },
    FX3 = { p: [], t: 9, hit: 0 },
    cam = { yaw: Math.PI + 0.5, pit: 0.38, zoom: 1, fr: 60, drag: 0, o: null, b: null };
  function draw() {
    if (!R3 || !cam) return;
    const th = TH[S.planet],
      c = calc(),
      b = S.ball,
      j = shake > 0.3 ? shake * 0.15 : 0;
    const W = cam.drag ? cam.fr : Math.max(40, c.R * 1.15, S.tx * 1.25);
    cam.fr = W;
    const sk = SKY3[S.planet] || [col("--sky1"), col("--sky2")];
    const sc = {
      sky: sk[0],
      sky2: sk[1],
      ground: th ? th.g : col("--ground"),
      grid: "rgba(255,255,255,.22)",
      stars: S.planet === "Bulan",
      gx: W * 1.3,
      lstep: W > 90 ? 20 : 10,
      wallc: th ? "#d0d0d8" : "#8a99a8",
      cam: {
        yaw: cam.yaw,
        pit: cam.pit,
        d: Math.max(45, W * 1.05) * cam.zoom,
        tx: W / 2 + (Math.random() - 0.5) * j,
        ty: 3 + (Math.random() - 0.5) * j,
        tz: 0,
      },
      cannon: { h: S.h, a: S.a, az: 0, pil: S.h > 0 ? S.h - 0.8 : 0 },
      target: { x: S.tx, z: 0, r: S.tr },
      wall: null,
      pred: Array.from({ length: 41 }, (_, i) => {
        const t = (c.T * i) / 40;
        return [c.vx * t, Math.max(0, S.h + c.vy * t - 0.5 * S.g * t * t) + 0.9, 0];
      }),
      predc: col("--accent"),
      trail: S.trail.map((p) => [p[0], p[1] + 0.9, 0]),
      mark: S.land,
      ball: b && b.x != null ? [b.x, b.y + 0.9, 0] : null,
      arrows: [],
      ring:
        FX3.t < 0.8
          ? {
              x: S.land || 0,
              z: 0,
              k: 1 + FX3.t * 14,
              a: 1 - FX3.t / 0.8,
              c: FX3.hit ? "#3ecfb2" : "#ff5a4a",
            }
          : null,
      parts: FX3.t < 1 ? FX3.p.map((p) => [p.x, p.y, p.z]) : [],
      partc: FX3.hit ? "#3ecfb2" : "#d9c9a0",
    };
    if (sc.ball && $("#vec").checked) {
      const vy = b.c.vy - b.g * b.t;
      sc.arrows = [
        { o: sc.ball, d: [Math.min(14, b.c.vx * 0.7), 0, 0], c: "#2457d6" },
        { o: sc.ball, d: [0, Math.max(-14, Math.min(14, vy * 0.7)), 0], c: "#e0392b" },
      ];
    }
    cam.b = R3.B(sc.cam, cw, ch);
    R3.draw(ctx, cw, ch, sc);
  }
  function boom(x, y, h) {
    shake = h ? 6 : 11;
    FX3.t = 0;
    FX3.hit = h;
    FX3.p = Array.from({ length: 40 }, () => ({
      x: S.land || 0,
      y: 0.5,
      z: 0,
      vx: (Math.random() - 0.5) * 14,
      vy: 3 + Math.random() * 12,
      vz: (Math.random() - 0.5) * 14,
    }));
  }
  function loopFx() {
    const dt = 0.016;
    shake *= 0.86;
    FX3.t += dt;
    FX3.p.forEach((p) => {
      p.x += p.vx * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.vy -= 25 * dt;
    });
    draw();
    if (FX3.t < 1 || shake > 0.3) requestAnimationFrame(loopFx);
  }
  // seret bendera = pindah target, seret lain = putar kamera, scroll = zoom
  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect(),
      h = R3.U(cam.b, e.clientX - r.left, e.clientY - r.top);
    if (h && Math.abs(h[0] - S.tx) < S.tr + 5 && Math.abs(h[1]) < 8) cam.drag = 1;
    else cam.o = [e.clientX, e.clientY];
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect();
    if (cam.drag) {
      const h = R3.U(cam.b, e.clientX - r.left, e.clientY - r.top);
      if (h) {
        S.tx = Math.max(5, Math.min(150, Math.round(h[0] * 2) / 2));
        $("#tx").value = S.tx;
        sync();
      }
    } else if (cam.o) {
      cam.yaw -= (e.clientX - cam.o[0]) * 0.006;
      cam.pit = Math.max(0.05, Math.min(1.4, cam.pit + (e.clientY - cam.o[1]) * 0.006));
      cam.o = [e.clientX, e.clientY];
      draw();
    }
  });
  const camUp = () => {
    cam.drag = 0;
    cam.o = null;
    draw();
  };
  cv.addEventListener("pointerup", camUp);
  cv.addEventListener("pointercancel", camUp);
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      cam.zoom = Math.max(0.3, Math.min(3, cam.zoom * (1 + e.deltaY * 0.001)));
      draw();
    },
    { passive: false },
  );
  fit();
}

/* ===== Halaman game (game.html) ===== */
function initGame() {
  const PL = ["Bumi", "Bulan", "Mars", "Jupiter"];
  const SK = {
    Bumi: ["#9fd0ff", "#e6f3ff", "#4d7a5a"],
    Bulan: ["#03040a", "#1b1d2e", "#777780"],
    Mars: ["#8c3f26", "#e6a577", "#a04e2e"],
    Jupiter: ["#3a2a20", "#c9955c", "#5b4331"],
  };
  const GM = {
    L: null,
    shots: 0,
    stars: Array(31).fill(0),
    ball: null,
    run: 0,
    w: 0,
    h: 0,
    last: 0,
    cam: { yaw: Math.PI + 0.45, pit: 0.4, zoom: 1 },
    fx: { t: 9, p: [], hit: 0, x: 0, z: 0 },
  };
  const cvg = $("#c3"),
    g = cvg.getContext("2d");
  function lvInfo(n) {
    const p = PL[Math.min(3, n >> 3)],
      i = n % 8,
      gg = G[p],
      tx = 20 + i * 12;
    return {
      n,
      p,
      g: gg,
      tx,
      tz: n < 3 ? 0 : (((n * 7) % 9) - 4) * 3,
      tr: Math.max(2, 4 - n * 0.06),
      wall: n % 4 == 3 ? { x: tx * 0.5, h: 6 + i * 1.2 } : null,
      vmax: Math.round(Math.sqrt(150 * gg)),
    };
  }
  try {
    const d = JSON.parse(localStorage.getItem("lab-game-v1") || "null");
    if (Array.isArray(d) && d.length == 31) GM.stars = d;
  } catch (e) {}
  const gsave = () => {
    try {
      localStorage.setItem("lab-game-v1", JSON.stringify(GM.stars));
    } catch (e) {}
  };
  function menu() {
    const gr = $("#lvgrid");
    gr.innerHTML = "";
    GM.stars.forEach((st, i) => {
      const b = document.createElement("button"),
        lock = i > 0 && !GM.stars[i - 1];
      b.className = "lv";
      b.disabled = lock;
      b.innerHTML = `${i}<small>${lock ? '<i class="fa-solid fa-lock" aria-hidden="true"></i>' : '<i class="fa-solid fa-star" aria-hidden="true"></i>'.repeat(st) + '<i class="fa-regular fa-star" aria-hidden="true"></i>'.repeat(3 - st)}</small>`;
      b.addEventListener("click", () => load(i));
      gr.append(b);
    });
    const t = GM.stars.reduce((a, b) => a + b, 0);
    $("#gp").value = t;
    $("#gpt").textContent = t + " / 93";
    $("#gtitle").textContent = "Game Meriam 3D";
    $("#gstat").textContent = "";
    $("#gmenu").hidden = false;
    $("#gplay").hidden = true;
    $("#gback").hidden = true;
    $("#lab").hidden = false;
  }
  function fitg() {
    const d = devicePixelRatio || 1,
      v = $("#v3");
    GM.w = v.clientWidth;
    GM.h = v.clientHeight;
    cvg.width = GM.w * d;
    cvg.height = GM.h * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  }
  function load(n) {
    const L = lvInfo(n);
    GM.L = L;
    GM.shots = 0;
    GM.ball = null;
    GM.fx.t = 9;
    $("#win").close();
    $("#gmenu").hidden = true;
    $("#gplay").hidden = false;
    $("#gback").hidden = false;
    $("#lab").hidden = true;
    $("#gv").max = L.vmax;
    $("#gv").value = Math.round(L.vmax * 0.6);
    $("#ga").value = 45;
    $("#gz").value = 0;
    Object.assign(GM.cam, { yaw: Math.PI + 0.45, pit: 0.4, zoom: 1 });
    $("#gtitle").textContent = `Level ${n} · ${L.p} (g ${f1(L.g)})`;
    $("#gstat").textContent = "Tembakan: 0";
    $("#gnext").hidden = true;
    $("#gfire").disabled = false;
    $("#gmsg").textContent =
      `Daratkan peluru di piringan target (radius ${f1(L.tr)} m). 3 bintang jika kena dalam 2 tembakan.`;
    gsync();
    fitg();
    if (!GM.run) {
      GM.run = 1;
      GM.last = performance.now();
      requestAnimationFrame(loop);
    }
  }
  function gsync() {
    $("#gvo").value = $("#gv").value + " m/s";
    $("#gao").value = $("#ga").value + "°";
    $("#gzo").value = $("#gz").value + "°";
  }
  ["gv", "ga", "gz"].forEach((k) => $("#" + k).addEventListener("input", gsync));
  function gfire() {
    if (GM.ball || !GM.L) return;
    GM.shots++;
    $("#gstat").textContent = "Tembakan: " + GM.shots;
    const v = +$("#gv").value,
      th = ($("#ga").value * Math.PI) / 180,
      ph = ($("#gz").value * Math.PI) / 180,
      vh = v * Math.cos(th),
      vy = v * Math.sin(th);
    GM.ball = {
      t: 0,
      vx: vh * Math.cos(ph),
      vz: vh * Math.sin(ph),
      vy,
      T: (2 * vy) / GM.L.g,
      x: 0,
      y: 0,
      z: 0,
    };
    GM.fx.t = 9;
    $("#gfire").disabled = true;
  }
  function gland(x, z, crash) {
    const L = GM.L,
      d = Math.hypot(x - L.tx, z - L.tz),
      hit = !crash && d <= L.tr,
      m = $("#gmsg"),
      f = GM.fx;
    GM.ball = null;
    $("#gfire").disabled = hit;
    Object.assign(f, {
      t: 0,
      hit,
      x,
      z,
      p: Array.from({ length: 40 }, () => ({
        x,
        y: 0.5,
        z,
        vx: (Math.random() - 0.5) * 14,
        vy: 3 + Math.random() * 12,
        vz: (Math.random() - 0.5) * 14,
      })),
    });
    if (hit) {
      const st = GM.shots <= 2 ? 3 : GM.shots <= 4 ? 2 : 1;
      GM.stars[L.n] = Math.max(GM.stars[L.n], st);
      gsave();
      const score = Math.max(0, Math.round((1 - d / L.tr) * 100));
      $("#win-stars").innerHTML =
        '<i class="fa-solid fa-star" aria-hidden="true"></i>'.repeat(st) +
        '<i class="fa-regular fa-star" aria-hidden="true"></i>'.repeat(3 - st);
      $("#win-score").textContent = `SKOR: ${score}`;
      $("#win-detail").textContent = `Kena dalam ${GM.shots} tembakan, Jarak dari target ${f1(d)} m`;
      $("#win-next").hidden = L.n >= 30;
      $("#win").showModal();
      m.textContent = `Kena! Dalam ${GM.shots} tembakan.`;
    } else
      m.textContent = crash
        ? "Menabrak tembok! Naikkan sudut angkat atau kecepatan."
        : `Meleset ${f1(d)} m dari pusat. ${x < L.tx - L.tr ? "Kurang jauh." : x > L.tx + L.tr ? "Terlalu jauh." : ""}${Math.abs(z - L.tz) > L.tr ? " Geser arah (azimut)." : ""}`;
  }
  function loop() {
    if ($("#gplay").hidden) {
      GM.run = 0;
      return;
    }
    requestAnimationFrame(loop);
    if (cvg.parentElement.clientWidth !== GM.w || cvg.parentElement.clientHeight !== GM.h) fitg();
    const now = performance.now(),
      dt = Math.min(0.05, (now - GM.last) / 1000),
      b = GM.ball,
      L = GM.L,
      f = GM.fx,
      c = GM.cam,
      p = SK[L.p];
    GM.last = now;
    if (b) {
      b.t = Math.min(b.T, b.t + dt * 1.5);
      b.x = b.vx * b.t;
      b.z = b.vz * b.t;
      b.y = Math.max(0, b.vy * b.t - 0.5 * L.g * b.t * b.t);
      const w = L.wall;
      if (w && Math.abs(b.x - w.x) < 1.4 && b.vy * b.t - 0.5 * L.g * b.t * b.t < w.h && Math.abs(b.z) < 20)
        gland(b.x, b.z, 1);
      else if (b.t >= b.T) gland(b.x, b.z, 0);
    }
    if (f.t < 1) {
      f.t += dt;
      f.p.forEach((q) => {
        q.x += q.vx * dt;
        q.y = Math.max(0, q.y + q.vy * dt);
        q.z += q.vz * dt;
        q.vy -= 25 * dt;
      });
    }
    const sh = f.t < 0.4 ? (1 - f.t / 0.4) * (f.hit ? 0.6 : 1.2) : 0,
      j = () => (Math.random() - 0.5) * sh;
    R3.draw(g, GM.w, GM.h, {
      sky: p[0],
      sky2: p[1],
      ground: p[2],
      grid: "rgba(255,255,255,.22)",
      stars: L.p === "Bulan",
      gx: L.tx * 1.3 + 30,
      lstep: 20,
      wallc: L.p === "Bumi" ? "#8a99a8" : "#d0d0d8",
      cam: {
        yaw: c.yaw,
        pit: c.pit,
        d: Math.max(50, L.tx * 1.15) * c.zoom,
        tx: L.tx / 2 + j(),
        ty: 3 + j(),
        tz: 0,
      },
      cannon: { h: 0, a: +$("#ga").value, az: +$("#gz").value, pil: 0 },
      target: { x: L.tx, z: L.tz, r: L.tr },
      wall: L.wall && { x: L.wall.x, h: L.wall.h, hw: 20 },
      ball: b ? [b.x, b.y + 0.9, b.z] : null,
      mark: f.t < 9 && f.x ? f.x : null,
      markz: f.z,
      ring:
        f.t < 0.8
          ? { x: f.x, z: f.z, k: 1 + f.t * 14, a: 1 - f.t / 0.8, c: f.hit ? "#3ecfb2" : "#ff5a4a" }
          : null,
      parts: f.t < 1 ? f.p.map((q) => [q.x, q.y, q.z]) : [],
      partc: f.hit ? "#3ecfb2" : "#d9c9a0",
    });
  }
  // kamera: seret = putar, scroll = zoom
  let dr = null;
  cvg.addEventListener("pointerdown", (e) => {
    dr = [e.clientX, e.clientY];
    cvg.setPointerCapture(e.pointerId);
  });
  cvg.addEventListener("pointermove", (e) => {
    if (!dr) return;
    const c = GM.cam;
    c.yaw -= (e.clientX - dr[0]) * 0.006;
    c.pit = Math.max(0.05, Math.min(1.4, c.pit + (e.clientY - dr[1]) * 0.006));
    dr = [e.clientX, e.clientY];
  });
  cvg.addEventListener("pointerup", () => (dr = null));
  cvg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      GM.cam.zoom = Math.max(0.3, Math.min(3, GM.cam.zoom * (1 + e.deltaY * 0.001)));
    },
    { passive: false },
  );
  $("#gfire").addEventListener("click", gfire);
  $("#gnext").addEventListener("click", () => load(GM.L.n + 1));
  $("#gback").addEventListener("click", menu);
  $("#win-menu").addEventListener("click", () => {
    $("#win").close();
    menu();
  });
  $("#win-retry").addEventListener("click", () => load(GM.L.n));
  $("#win-next").addEventListener("click", () => load(GM.L.n + 1));
  $("#win").addEventListener("cancel", (e) => e.preventDefault());
  addEventListener("resize", () => {
    if (!$("#gplay").hidden) fitg();
  });
  menu();
}

/* ===== Mulai: pilih halaman dari atribut data-page di <body> ===== */
document.body.dataset.page === "game" ? initGame() : initLab();
