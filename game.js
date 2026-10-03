const COLORS = {
    BG: 0x0f172a,
    GRID: 0x1e293b,
    GRID_LINE: 0x334155,
    WALL: 0x475569,
    INERT: 0x94a3b8,
    RED: 0xef4444,     // Dash
    BLUE: 0x3b82f6,    // Split
    GREEN: 0x10b981,   // Tunnel
    ORANGE: 0xf59e0b,  // Quantum Walk
    ZGATE: 0xd946ef,   // Pauli-Z Phase Flip (Magenta)
    HGATE: 0x06b6d4,   // Hadamard Gate (Cyan)
    XGATE: 0xf43f5e,   // Pauli-X Bit Flip (Rose/Red)
    CYAN: 0x06b6d4,    // Entangled positive
    ENEMY: 0xef4444
};

// Tile IDs:
// 0: Floor
// 1: Wall
// 2: Pauli-Z Gate [Z] (Phase Flip: |+> <-> |->)
// 3: Void / Boundary
// 4: Orange Timeline Anchor [Orange]
// 5: Hadamard Gate [H] (Basis Switch: Z <-> X)
// 6: Pauli-X Gate [X] (Bit Flip: |0> <-> |1>)

const S2 = Math.SQRT1_2;
const STATE_LABEL = { RED: '|0⟩', BLUE: '|1⟩', GREEN: '|+⟩', ORANGE: '|−⟩', INERT: '?' };

// A genuine single-qubit state  |ψ⟩ = α|0⟩ + β|1⟩  with complex amplitudes (global phase is tracked too,
// because it becomes physically meaningful when two branches of a superposition are recombined).
class QState {
    constructor(ar, ai, br, bi) { this.ar = ar; this.ai = ai; this.br = br; this.bi = bi; }
    static snap(v) {
        const a = Math.abs(v), s = v < 0 ? -1 : 1;
        for (const t of [0, S2, 1]) if (Math.abs(a - t) < 1e-9) return t === 0 ? 0 : s * t;
        return v;
    }
    static named(n) {
        return ({ ZERO: new QState(1, 0, 0, 0), ONE: new QState(0, 0, 1, 0),
                  PLUS: new QState(S2, 0, S2, 0), MINUS: new QState(S2, 0, -S2, 0) })[n] || new QState(1, 0, 0, 0);
    }
    clone() { return new QState(this.ar, this.ai, this.br, this.bi); }
    apply(m) {            // m = real 2x2 unitary
        const S = QState.snap;
        return new QState(
            S(m[0][0] * this.ar + m[0][1] * this.br), S(m[0][0] * this.ai + m[0][1] * this.bi),
            S(m[1][0] * this.ar + m[1][1] * this.br), S(m[1][0] * this.ai + m[1][1] * this.bi));
    }
    pZero() { return this.ar * this.ar + this.ai * this.ai; }                       // Born rule, Z basis
    pPlus() { return ((this.ar + this.br) ** 2 + (this.ai + this.bi) ** 2) / 2; }   // Born rule, X basis
    bloch() {             // standard Bloch vector: z = |α|²−|β|², x = 2Re(α*β), y = 2Im(α*β)
        return new THREE.Vector3(2 * (this.ar * this.br + this.ai * this.bi),
                                 2 * (this.ar * this.bi - this.ai * this.br),
                                 this.ar * this.ar + this.ai * this.ai - this.br * this.br - this.bi * this.bi);
    }
    cardinal() {
        const v = this.bloch(), t = 1e-6;
        if (v.z > 1 - t) return 'RED';
        if (v.z < -1 + t) return 'BLUE';
        if (v.x > 1 - t) return 'GREEN';
        if (v.x < -1 + t) return 'ORANGE';
        return 'INERT';
    }
    sign() { return ((this.ar * this.ar + this.ai * this.ai) >= 0.5 - 1e-9 ? this.ar : this.br) < 0 ? -1 : 1; }
    innerRe(o) { return this.ar * o.ar + this.ai * o.ai + this.br * o.br + this.bi * o.bi; }   // Re⟨ψ|φ⟩
    plus(o) {             // normalised (ψ+φ): the state that exits the bright port of a recombiner
        const a = this.ar + o.ar, b = this.ai + o.ai, c = this.br + o.br, d = this.bi + o.bi;
        const n = Math.hypot(a, b, c, d) || 1, S = QState.snap;
        return new QState(S(a / n), S(b / n), S(c / n), S(d / n));
    }
    fmt() {
        const n = v => String(parseFloat(Math.abs(v).toFixed(3)));
        const c = (re, im) => {
            if (Math.abs(im) < 1e-9) return [re < 0, n(re)];
            if (Math.abs(re) < 1e-9) return [im < 0, n(im) + 'i'];
            return [false, `(${re.toFixed(2)}${im < 0 ? '−' : '+'}${Math.abs(im).toFixed(2)}i)`];
        };
        const t = [];
        if (this.ar * this.ar + this.ai * this.ai > 1e-12) t.push([...c(this.ar, this.ai), '|0⟩']);
        if (this.br * this.br + this.bi * this.bi > 1e-12) t.push([...c(this.br, this.bi), '|1⟩']);
        return t.map(([neg, s, k], i) => (i ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + (s === '1' ? '' : s) + k).join('');
    }
}

// Real unitary matrices. Each is a π rotation of the Bloch sphere about `axis`.
const GATES = {
    H: { m: [[S2, S2], [S2, -S2]], axis: new THREE.Vector3(1, 0, 1).normalize() },
    X: { m: [[0, 1], [1, 0]],      axis: new THREE.Vector3(1, 0, 0) },
    Z: { m: [[1, 0], [0, -1]],     axis: new THREE.Vector3(0, 0, 1) }
};

const FACE_NAMES = ['RIGHT', 'LEFT', 'TOP', 'BOTTOM', 'FRONT', 'BACK'];
const MAT_INDEX = { RIGHT:0, LEFT:1, TOP:2, BOTTOM:3, FRONT:4, BACK:5 };

// Material assignments for the Qubit faces
const QUBIT_FACES = {
    [MAT_INDEX.TOP]: 'INERT',
    [MAT_INDEX.FRONT]: 'RED',
    [MAT_INDEX.RIGHT]: 'BLUE',
    [MAT_INDEX.LEFT]: 'GREEN',
    [MAT_INDEX.BACK]: 'ORANGE',
    [MAT_INDEX.BOTTOM]: 'INERT'
};

const LEVELS = [
    {
        title: "1. The Computational Basis & the Dash",
        desc: "Your qubit starts in |0⟩ (RED), the north pole of the Bloch sphere. In |0⟩, press SPACE then a direction to Heisenberg-Dash two tiles and shatter the enemy. Walking into it is fatal!",
        width: 7, height: 3, player: {x: 1, y: 1}, start: 'ZERO',
        enemies: [{x: 5, y: 1, type: 'basic'}],
        layout: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "2. Pauli-X: the Bit Flip",
        desc: "You start in |1⟩ (BLUE). The Z-detector measures in the {|0⟩,|1⟩} basis and only lets |0⟩ through. X swaps |0⟩↔|1⟩ — but a second X flips you back, so choose your route!",
        width: 7, height: 3, player: {x: 0, y: 1}, start: 'ONE',
        enemies: [{x: 6, y: 1, type: 'detector_z'}],
        layout: [[0,0,0,0,0,0,0],[0,6,0,1,0,6,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "3. Hadamard & Basis Scrambling",
        desc: "Z-detectors measure |0⟩/|1⟩; X-detectors measure |+⟩/|−⟩. Measure a state in the wrong basis and it is a 50/50 coin flip that destroys the old state. H rotates |0⟩↔|+⟩ and |1⟩↔|−⟩ — use it to pass both safely.",
        width: 8, height: 3, player: {x: 0, y: 1}, start: 'ZERO',
        enemies: [{x: 4, y: 1, type: 'detector_x'}, {x: 7, y: 1, type: 'detector_z'}],
        layout: [[0,0,5,0,0,6,0,0],[0,0,0,0,0,0,0,0],[0,0,6,0,0,5,0,0]]
    },
    {
        title: "4. Pauli-Z: Relative Phase",
        desc: "Z flips the sign of the |1⟩ amplitude: |+⟩↔|−⟩. On |0⟩ or |1⟩ it changes nothing you can see — phase only shows up in superpositions! The boss can only be hit while you are in |−⟩ (ORANGE).",
        width: 7, height: 3, player: {x: 0, y: 1}, start: 'ZERO',
        enemies: [{x: 6, y: 1, type: 'phase_shifted', phase: -1}],
        layout: [[0,0,0,0,0,0,0],[0,2,5,2,0,0,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "5. Unitarity: Every Gate is Reversible",
        desc: "H·H = Z·Z = X·X = I. Reach |−⟩ to defeat the boss, then walk the circuit backwards (Z, then H) to return to |0⟩ before the Z-detector — no information was lost along the way.",
        width: 7, height: 3, player: {x: 0, y: 1}, start: 'ZERO',
        enemies: [{x: 3, y: 0, type: 'phase_shifted', phase: -1}, {x: 6, y: 1, type: 'detector_z'}],
        layout: [[0,5,2,0,0,0,0],[0,0,0,1,0,0,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "6. Superposition: Two Paths, One Qubit",
        desc: "Step on X to reach |1⟩ (BLUE), then SPACE + a direction puts ONE qubit in a superposition of two places (no cloning!). Both branches must strike the entangled targets in the same move — they sit in neighbouring rows.",
        width: 7, height: 5, player: {x: 0, y: 2}, start: 'ZERO',
        enemies: [{x: 6, y: 2, type: 'entangled'}, {x: 6, y: 3, type: 'entangled'}],
        layout: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,6,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "7. Interference & Phase Matching",
        desc: "Recombine branches with SPACE (needs a branch in |1⟩, branches adjacent). P(constructive) = (1+Re⟨ψ₁|ψ₂⟩)/2 is shown live. Z on |1⟩ gives −|1⟩, so ONE branch crossing a Z wipes the amplitude out — make both cross one.",
        width: 7, height: 5, player: {x: 0, y: 2}, start: 'ZERO',
        enemies: [{x: 6, y: 2, type: 'basic'}],
        layout: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,6,0,0,0,2,0],[0,0,0,2,0,0,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "8. Dash, Tunnel & the Hadamard",
        desc: "Dash (|0⟩) smashes the basic enemy. Step on H to reach |+⟩ (GREEN): now SPACE + direction tunnels through the wall straight into the X-detector, which |+⟩ passes with certainty.",
        width: 7, height: 3, player: {x: 0, y: 1}, start: 'ZERO',
        enemies: [{x: 3, y: 1, type: 'basic'}, {x: 6, y: 1, type: 'detector_x'}],
        layout: [[0,0,0,0,0,0,0],[0,0,0,0,5,1,0],[0,0,0,0,0,0,0]]
    },
    {
        title: "9. Quantum Walk: Explore & Rewind",
        desc: "Build |−⟩ (H then Z) and stand on the orange anchor, then SPACE: a second timeline appears on the other orange anchor. Press the button over there, return, SPACE to merge, then reverse your gates (Z, then H) to reach |0⟩ for the Z-detector.",
        width: 17, height: 5, player: {x: 1, y: 2}, start: 'ZERO',
        enemies: [{x: 6, y: 2, type: 'detector_z'}],
        items: [{x: 14, y: 3, type: 'button'}],
        layout: [
            [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
            [3,5,2,0,1,1,0,0,0,3,3,0,0,0,0,0,3],
            [3,0,0,0,1,1,0,0,0,3,3,0,0,0,0,0,3],
            [3,4,0,0,1,1,0,0,0,3,3,0,4,0,0,0,3],
            [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
        ]
    },
    {
        title: "10. Parallel Timelines",
        desc: "Stand on the orange anchor in |−⟩ and press SPACE: a second timeline opens in the purple wing, and ONLY it moves. That wing looks nothing like this one — it has a button that deletes the wall here, and an H gate you'll cross twice. Come back in |−⟩ on the far anchor and SPACE to merge, then kill the boss.",
        width: 17, height: 5, player: {x: 2, y: 2}, start: 'MINUS', altFrom: 11,
        enemies: [{x: 7, y: 2, type: 'phase_shifted', phase: -1}],
        items: [{x: 15, y: 2, type: 'button'}],
        layout: [
            [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
            [3,0,0,0,1,1,0,0,0,3,3,0,0,0,0,0,3],
            [3,0,0,0,1,1,0,0,0,3,3,1,1,5,1,0,3],
            [3,4,0,0,1,1,0,0,0,3,3,0,4,0,1,0,3],
            [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
        ]
    },
    {
        title: "11. Entangled Timelines (Orange)",
        desc: "You begin in |−⟩ on the anchor. SPACE splits the timeline and now BOTH timelines move together, but the purple wing has different walls. The two entangled enemies die only if each timeline strikes its own partner on the SAME move — a lone hit is fatal.",
        width: 17, height: 5, player: {x: 1, y: 3}, start: 'MINUS', altFrom: 11, sync: true,
        enemies: [{x: 4, y: 1, type: 'entangled'}, {x: 15, y: 1, type: 'entangled'}],
        layout: [
            [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
            [3,0,0,1,0,0,0,0,0,3,3,0,0,1,0,0,3],
            [3,0,1,0,0,0,0,0,0,3,3,0,1,0,1,0,3],
            [3,4,0,0,0,0,0,0,0,3,3,0,4,0,0,0,3],
            [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
        ]
    },
    {
        title: "12. Entangled Paths (Blue)",
        desc: "You start in |1⟩ (BLUE). SPACE + direction splits you into two paths that move in lockstep, but the wall steers one branch differently. Both entangled enemies die only when both branches strike them on the same move. Pick your split direction wisely!",
        width: 9, height: 5, player: {x: 1, y: 2}, start: 'ONE',
        enemies: [{x: 5, y: 1, type: 'entangled'}, {x: 6, y: 3, type: 'entangled'}],
        layout: [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]]
    },
    {
        title: "13. The Quantum Citadel",
        desc: "Final circuit! Z-detector (|0⟩ passes), X-detector (|+⟩ passes), boss (needs |−⟩). Hint: Dash can hop over a gate tile without applying it, and X only adds a global phase to |−⟩.",
        width: 9, height: 5, player: {x: 0, y: 2}, start: 'ZERO',
        enemies: [{x: 4, y: 0, type: 'detector_z'}, {x: 4, y: 4, type: 'detector_x'}, {x: 8, y: 2, type: 'phase_shifted', phase: -1}],
        layout: [
            [0,0,6,0,0,0,2,0,0],
            [0,1,1,1,0,1,1,1,0],
            [0,5,0,0,0,0,5,0,0],
            [0,1,1,1,0,1,1,1,0],
            [0,0,2,0,0,0,6,0,0]
        ]
    }
];

// True 3D Bloch sphere: Z up, |+⟩ on +X, |i⟩ on +Y. Gates animate as exact π-rotations about their axis.
class BlochSphere {
    constructor() {
        this.canvas = document.getElementById('bloch-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.vec = new THREE.Vector3(0, 0, 1);
        this.goal = new THREE.Vector3(0, 0, 1);
        this.ghosts = []; this.trail = []; this.tween = null; this.yaw = 0.55;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width; this.canvas.height = rect.height;
        this.cx = this.canvas.width / 2; this.cy = this.canvas.height / 2;
        this.r = this.canvas.width * 0.33;
    }
    snap(state) {
        if (this.tween) { this.tween.kill(); this.tween = null; }
        this.goal.copy(state.bloch()); this.vec.copy(this.goal); this.trail = [];
    }
    sync(state, others = []) { this.goal.copy(state.bloch()); this.ghosts = others.map(s => s.bloch()); }
    playGate(axis, angle, from) {
        if (this.tween) this.tween.kill();
        const start = from.clone(), o = { t: 0 };
        this.trail = [];
        this.tween = gsap.to(o, {
            t: angle, duration: 0.55, ease: 'power2.inOut',
            onUpdate: () => { this.vec.copy(start).applyAxisAngle(axis, o.t); this.trail.push(this.vec.clone()); },
            onComplete: () => { this.tween = null; this.vec.copy(this.goal); }
        });
    }
    update(delta) {
        if (!this.tween) {
            if (this.vec.distanceTo(this.goal) > 1e-4) {
                this.vec.lerp(this.goal, Math.min(1, delta * 7)); this.trail.push(this.vec.clone());
            } else { this.vec.copy(this.goal); if (this.trail.length) this.trail.shift(); }
        }
        while (this.trail.length > 50) this.trail.shift();
        this.yaw += delta * 0.25;

        const p0 = Math.min(1, Math.max(0, (1 + this.vec.z) / 2)), pP = Math.min(1, Math.max(0, (1 + this.vec.x) / 2));
        const set = (id, p) => {
            const b = document.getElementById(id), t = document.getElementById(id + '-val');
            if (b) b.style.width = `${p * 100}%`; if (t) t.innerText = `${Math.round(p * 100)}%`;
        };
        set('prob-0', p0); set('prob-1', 1 - p0); set('prob-plus', pP); set('prob-minus', 1 - pP);
    }
    proj(v) {
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw), e = 0.5;
        const x1 = v.x * c - v.y * s, y1 = v.x * s + v.y * c;
        return { x: this.cx + x1 * this.r, y: this.cy - (v.z * Math.cos(e) + y1 * Math.sin(e)) * this.r,
                 d: y1 * Math.cos(e) - v.z * Math.sin(e) };
    }
    curve(fn, rgb) {
        const ctx = this.ctx, N = 72;
        let prev = this.proj(fn(0));
        for (let i = 1; i <= N; i++) {
            const cur = this.proj(fn(i / N * Math.PI * 2));
            ctx.strokeStyle = `rgba(${rgb},${(prev.d + cur.d) / 2 < 0 ? 0.3 : 0.09})`;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(cur.x, cur.y); ctx.stroke();
            prev = cur;
        }
    }
    draw() {
        const ctx = this.ctx, V = (x, y, z) => new THREE.Vector3(x, y, z);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(this.cx, this.cy, this.r, 0, Math.PI * 2); ctx.stroke();
        this.curve(t => V(Math.cos(t), Math.sin(t), 0), '148,163,184');       // equator (XY)
        this.curve(t => V(Math.cos(t), 0, Math.sin(t)), '96,165,250');        // XZ great circle
        this.curve(t => V(0, Math.cos(t), Math.sin(t)), '96,165,250');        // YZ great circle

        const axes = [[V(0,0,1),'|0⟩','#60a5fa'],[V(0,0,-1),'|1⟩','#60a5fa'],[V(1,0,0),'|+⟩','#34d399'],
                      [V(-1,0,0),'|−⟩','#f59e0b'],[V(0,1,0),'|i⟩','#94a3b8'],[V(0,-1,0),'|−i⟩','#94a3b8']];
        const o = this.proj(V(0, 0, 0));
        ctx.font = 'bold 12px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        axes.forEach(([v, label, col]) => {
            const e = this.proj(v), far = e.d > 0;
            ctx.strokeStyle = far ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)';
            ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(e.x, e.y); ctx.stroke();
            const l = this.proj(v.clone().multiplyScalar(1.22));
            ctx.globalAlpha = far ? 0.45 : 1; ctx.fillStyle = col; ctx.fillText(label, l.x, l.y); ctx.globalAlpha = 1;
        });

        // gate trail
        if (this.trail.length > 1) {
            ctx.lineWidth = 2;
            for (let i = 1; i < this.trail.length; i++) {
                const a = this.proj(this.trail[i - 1]), b = this.proj(this.trail[i]);
                ctx.strokeStyle = `rgba(147,197,253,${i / this.trail.length * 0.7})`;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
        }
        // other branches (faint)
        this.ghosts.forEach(g => {
            const t = this.proj(g);
            ctx.strokeStyle = 'rgba(217,70,239,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(217,70,239,0.8)'; ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI * 2); ctx.fill();
        });
        // state vector + drop line to equatorial plane
        const tip = this.proj(this.vec), foot = this.proj(V(this.vec.x, this.vec.y, 0));
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(foot.x, foot.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.shadowBlur = 12; ctx.shadowColor = '#3b82f6'; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
}

class Engine3D {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a1128); // Darker atmospheric blue
        this.scene.fog = new THREE.FogExp2(0x0a1128, 0.035); // Atmospheric fog
        
        // Perspective Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.setupLighting();
        window.addEventListener('resize', () => this.resize());
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xaaccff, 0.9);
        dirLight.position.set(5, 20, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024; 
        dirLight.shadow.mapSize.height = 1024;
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.5); // Cyan fill
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);
        
        const bottomLight = new THREE.DirectionalLight(0x3b82f6, 0.3);
        bottomLight.position.set(0, -10, 0);
        this.scene.add(bottomLight);
    }
    
    resize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    centerOnGrid(w, h) {
        this.cameraTargetX = (w > 10) ? 3.5 : (w - 1) / 2;
        this.cameraTargetZ = (h - 1) / 2;
        this.camera.position.set(this.cameraTargetX, 14, this.cameraTargetZ + 16);
        this.camera.lookAt(this.cameraTargetX, 0, this.cameraTargetZ - 2);
        
        if (w > 10 && !this.wheelBound) {
            window.addEventListener('wheel', (e) => {
                const maxPan = w - 4;
                if (e.deltaY > 0 || e.deltaX > 0) this.cameraTargetX = Math.min(this.cameraTargetX + 1.5, maxPan);
                else this.cameraTargetX = Math.max(this.cameraTargetX - 1.5, 3.5);
            });
            this.wheelBound = true;
        }
    }
    
    updateCamera() {
        if(this.cameraTargetX !== undefined) {
            this.camera.position.x += (this.cameraTargetX - this.camera.position.x) * 0.1;
            this.camera.lookAt(this.camera.position.x, 0, this.cameraTargetZ - 2);
        }
    }
}

class AssetManager {
    static getMaterial(colorKey) {
        if(!this.mats) this.mats = {};
        if(this.mats[colorKey]) return this.mats[colorKey];
        
        const hex = COLORS[colorKey];
        const colorStr = '#' + hex.toString(16).padStart(6, '0');
        const isGlowing = ['RED','BLUE','GREEN','ORANGE'].includes(colorKey);
        
        // Canvas texture for the face icon
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base bg
        ctx.fillStyle = '#0a0f1a'; 
        ctx.fillRect(0,0,512,512);
        
        // Glow effect
        if (isGlowing) {
            ctx.shadowColor = colorStr;
            ctx.shadowBlur = 40;
            ctx.strokeStyle = colorStr;
            ctx.lineWidth = 24;
            ctx.strokeRect(12, 12, 488, 488);
            
            // Inner bright core for border
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            ctx.strokeRect(12, 12, 488, 488);
        } else {
            // White glowing structural edges for INERT faces
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 12;
            ctx.strokeRect(8, 8, 496, 496);
            
            ctx.shadowBlur = 5;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.strokeRect(8, 8, 496, 496);
        }
        
        // Center Icon based on color
        ctx.shadowBlur = isGlowing ? 30 : 0;
        ctx.shadowColor = colorStr;
        ctx.fillStyle = colorStr;
        ctx.beginPath();
        if(colorKey === 'RED') { // Triangle
            ctx.moveTo(256, 120); ctx.lineTo(376, 320); ctx.lineTo(136, 320);
        } else if(colorKey === 'BLUE') { // Two circles
            ctx.arc(176, 256, 60, 0, Math.PI*2); ctx.fill(); ctx.beginPath();
            ctx.arc(336, 256, 60, 0, Math.PI*2);
        } else if(colorKey === 'GREEN') { // Diamond
            ctx.moveTo(256, 120); ctx.lineTo(376, 256); ctx.lineTo(256, 392); ctx.lineTo(136, 256);
        } else if(colorKey === 'ORANGE') { // Rewind
            ctx.moveTo(320, 160); ctx.lineTo(160, 256); ctx.lineTo(320, 352);
        } else {
            ctx.arc(256, 256, 60, 0, Math.PI*2);
            ctx.fillStyle = '#475569';
        }
        ctx.fill();

        // Inner bright core for symbol
        if (isGlowing) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            if(colorKey === 'RED') {
                ctx.moveTo(256, 150); ctx.lineTo(346, 300); ctx.lineTo(166, 300);
            } else if(colorKey === 'BLUE') {
                ctx.arc(176, 256, 30, 0, Math.PI*2); ctx.fill(); ctx.beginPath();
                ctx.arc(336, 256, 30, 0, Math.PI*2);
            } else if(colorKey === 'GREEN') {
                ctx.moveTo(256, 160); ctx.lineTo(336, 256); ctx.lineTo(256, 352); ctx.lineTo(176, 256);
            } else if(colorKey === 'ORANGE') {
                ctx.moveTo(290, 190); ctx.lineTo(190, 256); ctx.lineTo(290, 322);
            }
            ctx.fill();
        } else {
            // Give the inert center icon a subtle highlight
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 84px Outfit, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(STATE_LABEL[colorKey] || '', 256, 440);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.2,
            metalness: 0.8,
            emissiveMap: tex,
            emissive: 0xffffff,
            emissiveIntensity: isGlowing ? 2.5 : 0.6
        });
        
        this.mats[colorKey] = mat;
        return mat;
    }

    static getTileMaterial(type) {
        if(!this.tileMats) this.tileMats = {};
        if(this.tileMats[type]) return this.tileMats[type];

        let hex = COLORS.GRID;
        let letter = '';
        let subtitle = '';
        let glowColor = '#38bdf8';

        if (type === 2) { // Pauli-Z Gate
            hex = COLORS.ZGATE;
            letter = 'Z';
            subtitle = '|+⟩ ↔ |−⟩';
            glowColor = '#d946ef';
        } else if (type === 5) { // Hadamard Gate
            hex = COLORS.HGATE;
            letter = 'H';
            subtitle = '|0⟩ ↔ |+⟩';
            glowColor = '#06b6d4';
        } else if (type === 6) { // Pauli-X Gate
            hex = COLORS.XGATE;
            letter = 'X';
            subtitle = '|0⟩ ↔ |1⟩';
            glowColor = '#f43f5e';
        }

        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Dark tech base
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, 512, 512);

        // Neon border
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 20;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 30;
        ctx.strokeRect(16, 16, 480, 480);

        // Subtle circuit grid markings
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(128, 40); ctx.lineTo(128, 472);
        ctx.moveTo(384, 40); ctx.lineTo(384, 472);
        ctx.moveTo(40, 256); ctx.lineTo(472, 256);
        ctx.stroke();

        // Main gate letter
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 40;
        ctx.fillStyle = glowColor;
        ctx.font = 'bold 220px Orbitron, Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 256, 230);

        // White core on letter
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(letter, 256, 230);

        // Subtitle badge
        ctx.shadowBlur = 15;
        ctx.font = 'bold 36px Outfit, sans-serif';
        ctx.fillStyle = glowColor;
        ctx.fillText(subtitle, 256, 380);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            emissiveMap: tex,
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            roughness: 0.3,
            metalness: 0.5
        });

        this.tileMats[type] = mat;
        return mat;
    }
}

class Qubit {
    constructor(x, z, scene, start = 'ZERO', state = null) {
        this.x = x; this.z = z; this.scene = scene;
        this.isClone = false; this.history = []; this.isMoving = false;
        this.state = state ? state.clone() : QState.named(start);
        this.buildMesh();
    }
    get topColorKey() { return this.state.cardinal(); }
    set topColorKey(v) {}

    faceMats() { const m = AssetManager.getMaterial(this.topColorKey); return [m, m, m, m, m, m]; }

    buildMesh() {
        const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        this.mesh = new THREE.Mesh(geo, this.faceMats());
        this.mesh.castShadow = true;
        this.mesh.position.set(this.x, 0.45, this.z);
        const edges = new THREE.EdgesGeometry(geo);
        this.mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true })));
        this.scene.add(this.mesh);
    }

    roll(dx, dz, distance = 1, onComplete = null, kind = 'walk') {
        if (this.isMoving) return;
        this.isMoving = true;
        if (!game.isRewinding) this.history.push({ dx, dz, distance, kind });

        const targetX = this.x + dx * distance, targetZ = this.z + dz * distance;
        this.x = targetX; this.z = targetZ;

        const axis = new THREE.Vector3(dz, 0, -dx).normalize();
        const startQuat = this.mesh.quaternion.clone();
        const endQuat = startQuat.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(axis, (Math.PI / 2) * distance));
        const fast = distance > 1;
        const duration = game.isRewinding ? 0.15 : (fast ? 0.18 : 0.22);

        gsap.to(this.mesh.position, { x: targetX, z: targetZ, duration, ease: fast ? "power2.out" : "power1.inOut" });
        gsap.to(this.mesh.position, { y: fast ? 0.75 : 0.6, duration: duration / 2, yoyo: true, repeat: 1, ease: fast ? "power2.out" : "sine.inOut" });
        const dummy = { t: 0 };
        gsap.to(dummy, {
            t: 1, duration, ease: fast ? "power2.out" : "power1.inOut",
            onUpdate: () => { this.mesh.quaternion.slerpQuaternions(startQuat, endQuat, dummy.t); },
            onComplete: () => {
                this.mesh.position.set(targetX, 0.45, targetZ);
                this.mesh.quaternion.copy(endQuat);
                const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion);
                euler.x = Math.round(euler.x / (Math.PI / 2)) * (Math.PI / 2);
                euler.y = Math.round(euler.y / (Math.PI / 2)) * (Math.PI / 2);
                euler.z = Math.round(euler.z / (Math.PI / 2)) * (Math.PI / 2);
                this.mesh.quaternion.setFromEuler(euler);
                this.isMoving = false;
                if (onComplete) onComplete();
            }
        });
    }

    // Ring colour = sign of this branch's amplitude (cyan +, magenta −). Only shown while branches exist,
    // because a lone qubit's global phase is unobservable.
    syncRing(show) {
        if (!show) { if (this.ring) { this.scene.remove(this.ring); this.ring = null; } return; }
        if (!this.ring) {
            this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 16, 32), new THREE.MeshBasicMaterial({ color: COLORS.CYAN }));
            this.ring.rotation.x = Math.PI / 2;
            this.scene.add(this.ring);
        }
        this.ring.material.color.setHex(this.state.sign() >= 0 ? COLORS.CYAN : COLORS.ZGATE);
    }

    refreshMaterials() { if (this.mesh) this.mesh.material = this.faceMats(); }

    animateGateSpin(angle = Math.PI * 2) {
        const targetRot = this.mesh.rotation.y - Math.abs(angle), originalY = 0.45;
        gsap.to(this.mesh.position, { y: originalY + 0.35, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" });
        gsap.to(this.mesh.rotation, { y: targetRot, duration: 0.36, ease: "back.out(1.4)",
            onComplete: () => { this.mesh.position.y = originalY; } });
    }

    // Applies a REAL unitary to the state vector and animates the Bloch sphere as the matching π rotation.
    applyGate(name) {
        const g = GATES[name], old = this.state, before = old.bloch();
        this.state = old.apply(g.m);
        this.animateGateSpin(name === 'Z' ? Math.PI * 2 : Math.PI);
        if (game.players[0] === this) game.bloch.playGate(g.axis, Math.PI, before);
        this.refreshMaterials();
        return old;
    }

    destroy() {
        this.scene.remove(this.mesh);
        if (this.ring) { this.scene.remove(this.ring); this.ring = null; }
    }
}

class Game {
    constructor() {
        this.engine = new Engine3D();
        this.bloch = new BlochSphere();
        
        this.levelIdx = 0;
        this.state = 'MENU'; 
        this.players = [];
        this.enemies = [];
        this.items = [];
        this.envMeshes = [];
        
        this.gridW = 0; this.gridH = 0;
        this.layout = [];
        this.isRewinding = false;
        
        this.inputMode = 'MOVE'; // MOVE, DASH_SELECT, TUNNEL_SELECT
        
        this.bindInputs();
        this.buildMenu();
        
        this.clock = new THREE.Clock();
        this.loop();
    }

    bindInputs() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (this.state === 'GAMEOVER' || this.state === 'WIN') {
                if (k === 'r') { this.state === 'WIN' ? this.nextLevel() : this.restartLevel(); }
                else if (k === 'escape') this.showMenu();
                return;
            }
            if (this.state !== 'PLAY') return;
            if (k === 'r') { this.restartLevel(); return; }
            if (k === 'escape') { if (this.inputMode !== 'MOVE') this.resetInputMode(); else this.showMenu(); return; }
            if (this.players.some(p => p.isMoving)) return;

            let dx = 0, dz = 0;
            if (k === 'w' || k === 'arrowup') dz = -1;
            else if (k === 's' || k === 'arrowdown') dz = 1;
            else if (k === 'a' || k === 'arrowleft') dx = -1;
            else if (k === 'd' || k === 'arrowright') dx = 1;

            if (dx !== 0 || dz !== 0) {
                e.preventDefault();
                if (this.inputMode === 'DASH_SELECT') this.executeDash(dx, dz);
                else if (this.inputMode === 'TUNNEL_SELECT') this.executeTunnel(dx, dz);
                else if (this.inputMode === 'SPLIT_SELECT') this.executeSplit(dx, dz);
                else this.tryMove(dx, dz);
            } else if (k === ' ') { e.preventDefault(); this.triggerAbility(); }
        });
    }

    buildMenu() {
        const c = document.getElementById('level-buttons');
        c.innerHTML = '';
        LEVELS.forEach((lvl, i) => {
            const b = document.createElement('button');
            b.className = 'btn text-left flex flex-col items-start gap-1 w-full';
            b.innerHTML = `<span class="text-white">${lvl.title}</span><span class="text-slate-400 text-xs normal-case tracking-normal">${lvl.desc}</span>`;
            b.onclick = () => {
                document.getElementById('menu-screen').classList.add('hidden');
                this.loadLevel(i);
            };
            c.appendChild(b);
        });
    }

    showMenu() {
        this.state = 'MENU';
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('win-screen').classList.add('hidden');
        document.getElementById('prediction-panel').classList.add('hidden');
    }

    showToast(text, colorClass) {
        const c = document.getElementById('toast-container');
        const div = document.createElement('div');
        div.className = `toast ${colorClass}`;
        div.innerText = text;
        if(colorClass === 'red') div.style.background = 'var(--neon-red)';
        if(colorClass === 'blue') div.style.background = 'var(--neon-blue)';
        if(colorClass === 'green') div.style.background = 'var(--neon-green)';
        if(colorClass === 'orange') div.style.background = 'var(--neon-orange)';
        if(colorClass === 'magenta') div.style.background = 'var(--neon-magenta)';
        
        c.appendChild(div);
        setTimeout(() => { if(div.parentNode) div.parentNode.removeChild(div); }, 2500);
    }

    clearScene() {
        this.players.forEach(p => p.destroy());
        this.enemies.forEach(e => this.engine.scene.remove(e.mesh));
        this.items.forEach(i => this.engine.scene.remove(i.mesh));
        this.envMeshes.forEach(m => this.engine.scene.remove(m));
        if (this.particles) {
            this.particles.forEach(p => this.engine.scene.remove(p.mesh));
        }
        this.players = []; this.enemies = []; this.items = []; this.envMeshes = []; this.particles = [];
    }

    spawnParticles(x, y, z, colorHex, count = 15) {
        if(!this.particles) this.particles = [];
        const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.5, transparent: true });
        for(let i=0; i<count; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x + (Math.random()-0.5)*0.5, y + (Math.random()-0.5)*0.5, z + (Math.random()-0.5)*0.5);
            this.engine.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                vx: (Math.random()-0.5)*4,
                vy: Math.random()*4 + 2,
                vz: (Math.random()-0.5)*4,
                life: 1.0 + Math.random()*0.5
            });
        }
    }

    loadLevel(idx) {
        this.clearScene();
        this.levelIdx = idx;
        const data = LEVELS[idx];
        this.gridW = data.width; this.gridH = data.height;
        this.layout = JSON.parse(JSON.stringify(data.layout));
        this.timelineSplitActive = false;
        this.syncTimelines = !!data.sync;
        this.isRewinding = false;
        this.resetInputMode();

        // Build Floor & Walls
        const floorGeo = new THREE.BoxGeometry(0.95, 0.2, 0.95);
        const wallGeo = new THREE.BoxGeometry(0.95, 1.2, 0.95); // slightly taller
        
        // Use darker glass-like materials with emissive hints
        const matGrid1 = new THREE.MeshStandardMaterial({color: 0x0f172a, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.9});
        const matGrid2 = new THREE.MeshStandardMaterial({color: 0x1e293b, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.9});
        const matWall = new THREE.MeshStandardMaterial({color: 0x082f49, roughness: 0.4, emissive: 0x0284c7, emissiveIntensity: 0.2});
        const matZGate = new THREE.MeshStandardMaterial({color: COLORS.ZGATE, emissive: COLORS.ZGATE, emissiveIntensity: 0.3});
        const matAlt1 = new THREE.MeshStandardMaterial({color: 0x2e1065, roughness: 0.2, metalness: 0.8, emissive: 0x6d28d9, emissiveIntensity: 0.25, transparent: true, opacity: 0.92});
        const matAlt2 = new THREE.MeshStandardMaterial({color: 0x4c1d95, roughness: 0.2, metalness: 0.8, emissive: 0x7c3aed, emissiveIntensity: 0.25, transparent: true, opacity: 0.92});
        const matWallAlt = new THREE.MeshStandardMaterial({color: 0x581c87, roughness: 0.4, emissive: 0xc026d3, emissiveIntensity: 0.35});

        const edgeGeoF = new THREE.EdgesGeometry(floorGeo);
        const edgeMatF = new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.8, linewidth: 2 });
        const edgeGeoW = new THREE.EdgesGeometry(wallGeo);
        const edgeMatW = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });

        for(let z=0; z<this.gridH; z++) {
            for(let x=0; x<this.gridW; x++) {
                const type = this.layout[z][x];
                const alt = data.altFrom !== undefined && x >= data.altFrom;
                if(type === 1) { // Wall
                    const w = new THREE.Mesh(wallGeo, alt ? matWallAlt : matWall);
                    w.position.set(x, 0.5, z); w.castShadow = true; w.receiveShadow = true;
                    w.add(new THREE.LineSegments(edgeGeoW, edgeMatW));
                    this.engine.scene.add(w); this.envMeshes.push(w);
                } else if(type !== 3) {
                    const matOrange = new THREE.MeshStandardMaterial({color: COLORS.ORANGE, roughness: 0.2, metalness: 0.8, emissive: COLORS.ORANGE, emissiveIntensity: 0.6, transparent: true, opacity: 0.9});
                    // Types: 2=[Z], 5=[H], 6=[X], 4=Orange Pad, 0=Standard Grid
                    const isGate = [2, 5, 6].includes(type);
                    const mat = isGate ? AssetManager.getTileMaterial(type) : (type === 4 ? matOrange : (alt ? ((x+z)%2===0 ? matAlt1 : matAlt2) : ((x+z)%2===0 ? matGrid1 : matGrid2)));
                    const f = new THREE.Mesh(floorGeo, mat);
                    f.position.set(x, -0.1, z); f.receiveShadow = true;
                    f.add(new THREE.LineSegments(edgeGeoF, edgeMatF));
                    this.engine.scene.add(f); this.envMeshes.push(f);
                }
            }
        }

        // Entities
        this.players.push(new Qubit(data.player.x, data.player.y, this.engine.scene, data.start || 'ZERO'));
        
        if(data.enemies) {
            data.enemies.forEach(e => {
                const group = new THREE.Group();
                group.position.set(e.x, 0.5, e.y);

                // Enemies have a quantum phase (default: -1 for phase_shifted, or explicitly provided e.phase, otherwise 1)
                const enemyPhase = e.phase !== undefined ? e.phase : (e.type === 'phase_shifted' ? -1 : 1);

                let mainMesh;
                if (e.type === 'entangled') {
                    const geo = new THREE.IcosahedronGeometry(0.35, 0);
                    const mat = new THREE.MeshStandardMaterial({ color: COLORS.CYAN, emissive: COLORS.CYAN, emissiveIntensity: 0.8, roughness: 0.2 });
                    mainMesh = new THREE.Mesh(geo, mat);
                } else if (e.type === 'phase_shifted') {
                    const geo = new THREE.TorusKnotGeometry(0.25, 0.08, 64, 8);
                    const mat = new THREE.MeshStandardMaterial({ color: COLORS.ZGATE, emissive: COLORS.ZGATE, emissiveIntensity: 0.9, roughness: 0.3 });
                    mainMesh = new THREE.Mesh(geo, mat);
                } else if (e.type === 'detector_x') {
                    // X-Basis diagonal measurement barrier: Octahedron with emerald ring
                    const geo = new THREE.OctahedronGeometry(0.35, 0);
                    const mat = new THREE.MeshStandardMaterial({ color: COLORS.GREEN, emissive: COLORS.GREEN, emissiveIntensity: 0.7, roughness: 0.2 });
                    mainMesh = new THREE.Mesh(geo, mat);
                    const haloGeo = new THREE.TorusGeometry(0.48, 0.03, 16, 32);
                    const haloMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 });
                    const halo = new THREE.Mesh(haloGeo, haloMat);
                    halo.rotation.x = Math.PI / 2;
                    group.add(halo);
                } else if (e.type === 'detector_z') {
                    // Z-Basis computational measurement barrier: Cylindrical core + laser ring
                    const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.55, 16);
                    const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, roughness: 0.2 });
                    mainMesh = new THREE.Mesh(geo, mat);
                    const haloGeo = new THREE.TorusGeometry(0.48, 0.03, 16, 32);
                    const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
                    const halo = new THREE.Mesh(haloGeo, haloMat);
                    halo.rotation.x = Math.PI / 2;
                    group.add(halo);
                } else {
                    const geo = new THREE.SphereGeometry(0.35, 32, 32);
                    const mat = new THREE.MeshStandardMaterial({ color: COLORS.RED, emissive: COLORS.RED, emissiveIntensity: 0.6 });
                    mainMesh = new THREE.Mesh(geo, mat);
                }

                // Add phase indicator ring only if the enemy explicitly has a quantum phase requirement
                if (e.phase !== undefined || e.type === 'phase_shifted') {
                    const phaseRingGeo = new THREE.TorusGeometry(0.42, 0.025, 16, 32);
                    const phaseRingMat = new THREE.MeshBasicMaterial({ 
                        color: enemyPhase === -1 ? COLORS.ZGATE : COLORS.CYAN,
                        transparent: true,
                        opacity: 0.85
                    });
                    const phaseRing = new THREE.Mesh(phaseRingGeo, phaseRingMat);
                    phaseRing.rotation.x = Math.PI / 2;
                    phaseRing.position.y = 0.35;
                    group.add(phaseRing);
                }

                mainMesh.castShadow = true;
                group.add(mainMesh);
                this.engine.scene.add(group);
                this.enemies.push({ x: e.x, z: e.y, mesh: group, type: e.type, phase: e.phase, req: e.type === 'phase_shifted' ? 'ORANGE' : null, alive: true });
            });
        }
        
        if(data.items) {
            data.items.forEach(i => {
                const geo = new THREE.OctahedronGeometry(0.3, 0);
                const mat = new THREE.MeshStandardMaterial({ color: COLORS.ORANGE, emissive: COLORS.ORANGE, emissiveIntensity: 0.8 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(i.x, 0.5, i.y);
                this.engine.scene.add(mesh);
                this.items.push({ x: i.x, z: i.y, type: i.type, mesh, active: true });
            });
        }

        this.engine.centerOnGrid(this.gridW, this.gridH);
        
        document.getElementById('level-title').innerText = data.title;
        document.getElementById('action-hint').innerText = data.desc;
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('win-screen').classList.add('hidden');
        document.getElementById('prediction-panel').classList.remove('hidden');
        
        this.state = 'PLAY';
        this.bloch.snap(this.players[0].state);
        this.updateUI();
    }

    restartLevel() { this.loadLevel(this.levelIdx); }
    nextLevel() {
        if(this.levelIdx + 1 < LEVELS.length) this.loadLevel(this.levelIdx + 1);
        else this.showMenu();
    }

    isWalkable(x, z) {
        if(x<0 || x>=this.gridW || z<0 || z>=this.gridH) return false;
        return this.layout[z][x] !== 1 && this.layout[z][x] !== 3;
    }

    tryMove(dx, dz) {
        let moved = false;
        const order = [...this.players].sort((a, b) => dx > 0 ? b.x - a.x : (dx < 0 ? a.x - b.x : (dz > 0 ? b.z - a.z : a.z - b.z)));
        order.forEach(p => {
            if (this.timelineSplitActive && !p.isClone && !this.syncTimelines) return;
            if (this.isWalkable(p.x + dx, p.z + dz)) {
                p.roll(dx, dz, 1, () => this.onMoveComplete(p));
                moved = true;
            }
        });
        if (moved) this.updateUI();
    }

    resetInputMode() {
        this.inputMode = 'MOVE';
        document.getElementById('action-hint').innerText = LEVELS[this.levelIdx].desc;
        document.getElementById('action-hint').style.color = '#cbd5e1';
    }

    triggerAbility() {
        const split = this.players.length > 1 && !this.timelineSplitActive;
        if (split && this.players.some(q => q.topColorKey === 'BLUE')) { this.attemptCollapse(); return; }

        const act = this.timelineSplitActive ? this.players.find(q => q.isClone) : this.players[0];
        const key = act.topColorKey, h = document.getElementById('action-hint');
        if (key === 'RED') {
            this.inputMode = 'DASH_SELECT'; h.innerText = "DASH (|0⟩): press a direction"; h.style.color = 'var(--neon-red)';
        } else if (key === 'GREEN') {
            this.inputMode = 'TUNNEL_SELECT'; h.innerText = "TUNNEL (|+⟩): press a direction toward a wall"; h.style.color = 'var(--neon-green)';
        } else if (key === 'BLUE') {
            if (this.players.length > 1) { this.showToast("ALREADY SPLIT", "inert"); return; }
            this.inputMode = 'SPLIT_SELECT'; h.innerText = "SPLIT (|1⟩): press a direction for the second branch"; h.style.color = 'var(--neon-blue)';
        } else if (key === 'ORANGE') {
            if (split) { this.showToast("RECOMBINE BRANCHES FIRST", "orange"); return; }
            this.executeTimelineSplit();
        } else {
            this.showToast("NO ABILITY IN THIS STATE", "inert");
        }
    }

    executeDash(dx, dz) {
        let dashed = false;
        this.players.forEach(p => {
            if (this.timelineSplitActive && !p.isClone && !this.syncTimelines) return;
            if (this.isWalkable(p.x + dx, p.z + dz) && this.isWalkable(p.x + dx * 2, p.z + dz * 2)) {
                p.roll(dx, dz, 2, () => this.onMoveComplete(p), 'dash');
                dashed = true;
            }
        });
        if (dashed) this.showToast("HEISENBERG DASH", "red");
        this.resetInputMode();
    }

    executeTunnel(dx, dz) {
        let tunneled = false;
        this.players.forEach(p => {
            if (this.timelineSplitActive && !p.isClone && !this.syncTimelines) return;
            if (!this.isWalkable(p.x + dx, p.z + dz) && this.isWalkable(p.x + dx * 2, p.z + dz * 2)) {
                p.roll(dx, dz, 2, () => this.onMoveComplete(p), 'tunnel');
                tunneled = true;
            }
        });
        if (tunneled) this.showToast("QUANTUM TUNNEL", "green");
        this.resetInputMode();
    }

    executeTimelineSplit() {
        if (this.gridW <= 10) { this.showToast("NO ALTERNATE TIMELINE DETECTED", "orange"); return; }

        if (this.players.length === 1) {
            const p = this.players[0];
            if (this.layout[p.z][p.x] !== 4) { this.showToast("MUST BE ON AN ORANGE TILE TO SPLIT", "orange"); return; }
            const targetX = p.x + 11;
            if (!this.isWalkable(targetX, p.z)) { this.showToast("TIMELINE BLOCKED", "orange"); return; }

            this.timelineSplitActive = true;
            const clone = new Qubit(p.x, p.z, this.engine.scene, null, p.state);
            clone.mesh.quaternion.copy(p.mesh.quaternion);
            clone.isClone = true;
            clone.x = targetX;
            this.players.push(clone);
            clone.isMoving = true;
            gsap.to(clone.mesh.position, {
                x: targetX, duration: 0.8, ease: "power3.inOut",
                onUpdate: () => { if (Math.random() > 0.4) this.spawnParticles(clone.mesh.position.x, 0.5, clone.mesh.position.z, COLORS.ORANGE, 3); },
                onComplete: () => {
                    this.spawnParticles(targetX, 0.5, p.z, COLORS.ORANGE, 25);
                    clone.isMoving = false;
                    this.showToast("TIMELINE SPLIT ACTIVE", "orange");
                    this.updateUI();
                }
            });
        } else {
            const p1 = this.players.find(p => !p.isClone), clone = this.players.find(p => p.isClone);
            if (clone && clone.topColorKey === 'ORANGE' && this.layout[clone.z][clone.x] === 4) {
                clone.isMoving = true;
                gsap.to(clone.mesh.position, {
                    x: p1.mesh.position.x, z: p1.mesh.position.z, duration: 0.8, ease: "power3.inOut",
                    onUpdate: () => { if (Math.random() > 0.4) this.spawnParticles(clone.mesh.position.x, 0.5, clone.mesh.position.z, COLORS.ORANGE, 3); },
                    onComplete: () => { clone.isMoving = false; this.timelineSplitActive = false; this.resolveInterference(p1, clone, false); }
                });
            } else {
                this.showToast("CLONE MUST RETURN TO AN ORANGE TILE IN |−⟩", "orange");
            }
        }
    }

    executeSplit(dx, dz) {
        const p = this.players[0];
        this.resetInputMode();
        if (this.players.length > 1) return;
        if (!this.isWalkable(p.x + dx, p.z + dz)) { this.showToast("BLOCKED: NO ROOM FOR SECOND PATH", "inert"); return; }
        // One qubit, two spatial paths: the internal state is shared, nothing is cloned.
        const clone = new Qubit(p.x + dx, p.z + dz, this.engine.scene, null, p.state);
        clone.mesh.quaternion.copy(p.mesh.quaternion);
        clone.isClone = true;
        this.players.push(clone);
        this.spawnParticles(clone.x, 0.5, clone.z, COLORS.BLUE, 20);
        this.showToast("SUPERPOSITION: TWO PATHS", "blue");
        this.updateUI();
    }

    attemptCollapse() {
        const a = this.players[0], b = this.players[1];
        if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) > 1) { this.showToast("BRANCHES MUST BE ADJACENT", "inert"); return; }
        this.resolveInterference(a, b, true);
    }

    // Two branches |L⟩|ψ₁⟩ + |R⟩|ψ₂⟩ are recombined. Probability the amplitude exits the "bright" port:
    // P = (1 + Re⟨ψ₁|ψ₂⟩) / 2.  Equal states -> 1 (constructive), opposite sign -> 0 (destructive).
    resolveInterference(a, b, burst) {
        const P = (1 + a.state.innerRe(b.state)) / 2;
        if (Math.random() < P) {
            a.state = a.state.plus(b.state);
            a.refreshMaterials();
            if (burst) {
                this.enemies.forEach(e => {
                    if (e.alive && Math.abs(e.x - a.x) <= 1 && Math.abs(e.z - a.z) <= 1) {
                        e.alive = false; this.engine.scene.remove(e.mesh);
                        this.spawnParticles(e.x, 0.5, e.z, COLORS.CYAN, 30);
                    }
                });
            }
            b.destroy();
            this.players = [a];
            this.spawnParticles(a.x, 0.5, a.z, COLORS.CYAN, 25);
            this.showToast(`CONSTRUCTIVE INTERFERENCE (P=${Math.round(P * 100)}%)`, "blue");
            this.updateUI();
            this.checkWin();
        } else {
            this.spawnParticles(a.x, 0.5, a.z, COLORS.ZGATE, 40);
            this.players.forEach(q => { q.mesh.visible = false; });
            this.showToast(`DESTRUCTIVE INTERFERENCE (P=${Math.round(P * 100)}%)`, "magenta");
            this.gameOver("The branches arrived out of phase. Their amplitudes cancelled in the bright port.");
        }
    }

    // Projective measurement with the Born rule; the state collapses to the outcome eigenstate.
    measure(p, basis) {
        const pr = basis === 'Z' ? p.state.pZero() : p.state.pPlus();
        const first = pr > 1 - 1e-9 ? true : (pr < 1e-9 ? false : Math.random() < pr);
        const names = basis === 'Z' ? ['|0⟩', '|1⟩'] : ['|+⟩', '|−⟩'];
        p.state = QState.named(basis === 'Z' ? (first ? 'ZERO' : 'ONE') : (first ? 'PLUS' : 'MINUS'));
        p.refreshMaterials();
        const certain = pr < 1e-9 || pr > 1 - 1e-9;
        this.showToast(certain ? `${basis}-MEASURE: CERTAIN ${first ? names[0] : names[1]}`
                               : `${basis}-MEASURE: ${Math.round(pr * 100)}% ${names[0]} → COLLAPSED TO ${first ? names[0] : names[1]}`,
                       first ? "blue" : "red");
        return { pass: first };
    }

    onMoveComplete(p) {
        // ── Gate tiles act on the real state vector
        const g = { 2: 'Z', 5: 'H', 6: 'X' }[this.layout[p.z][p.x]];
        if (g) {
            const old = p.applyGate(g);
            const L = STATE_LABEL, a = L[old.cardinal()], b = L[p.state.cardinal()];
            const colors = { Z: COLORS.ZGATE, H: COLORS.HGATE, X: COLORS.XGATE };
            this.spawnParticles(p.x, 0.2, p.z, colors[g], 20);
            const same = old.cardinal() === p.state.cardinal();
            this.showToast(same ? `[${g}] ${a} UNCHANGED (global phase only)` : `[${g}] ${a} → ${b}`, { Z: 'magenta', H: 'blue', X: 'red' }[g]);
            this.updateUI();
        }

        // ── Items
        this.items.forEach(i => {
            if (!i.active || p.x !== i.x || p.z !== i.z) return;
            i.active = false; this.engine.scene.remove(i.mesh);
            if (i.type === 'button') {
                const gy = 2, floorGeo = new THREE.BoxGeometry(0.95, 0.2, 0.95);
                const mat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.9 });
                [4, 5].forEach(gx => {
                    this.layout[gy][gx] = 0;
                    this.envMeshes = this.envMeshes.filter(m => {
                        if (m.position.x === gx && m.position.z === gy && m.position.y > 0.3) {
                            this.engine.scene.remove(m); this.spawnParticles(gx, 0.5, gy, COLORS.ORANGE, 30); return false;
                        }
                        return true;
                    });
                    const floor = new THREE.Mesh(floorGeo, mat);
                    floor.position.set(gx, -0.1, gy); floor.receiveShadow = true;
                    this.engine.scene.add(floor); this.envMeshes.push(floor);
                });
                this.showToast("TIMELINE SYNC: WALL DESTROYED", "orange");
            }
            this.updateUI();
        });

        // ── Enemies
        let died = false;
        const lastOf = pl => pl.history[pl.history.length - 1];
        const hitting = (pl, en) => {
            if (pl.x === en.x && pl.z === en.z) return true;
            const l = lastOf(pl);
            return !!(l && l.kind === 'dash' && en.x === pl.x - l.dx && en.z === pl.z - l.dz);
        };
        const kill = (e, color) => { e.alive = false; this.engine.scene.remove(e.mesh); this.spawnParticles(e.x, 0.5, e.z, color, 30); };
        const isDash = lastOf(p) && lastOf(p).kind === 'dash';

        this.enemies.forEach(e => {
            if (!e.alive || !hitting(p, e)) return;

            if (e.req && p.topColorKey !== e.req) {
                died = true;
                this.showToast(`NEEDS ${STATE_LABEL[e.req]} — YOU ARE ${STATE_LABEL[p.topColorKey]}`, "magenta");
                return;
            }
            if (e.type === 'entangled') {
                const group = this.enemies.filter(en => en.type === 'entangled');
                const allHitting = this.players.length > 1 && this.players.every(pl => group.some(en => hitting(pl, en)));
                if (allHitting) group.forEach(en => { if (en.alive && this.players.some(pl => hitting(pl, en))) kill(en, COLORS.CYAN); });
                else died = true;
            } else if (e.type === 'detector_z' || e.type === 'detector_x') {
                const r = this.measure(p, e.type === 'detector_z' ? 'Z' : 'X');
                if (r.pass) kill(e, e.type === 'detector_z' ? COLORS.BLUE : COLORS.GREEN); else died = true;
            } else if (e.type === 'phase_shifted') {
                kill(e, COLORS.ZGATE); this.showToast("BOSS DEFEATED IN |−⟩!", "magenta");
            } else if (isDash) {
                kill(e, COLORS.RED);
            } else {
                died = true;
            }
        });

        if (died) {
            this.spawnParticles(p.x, 0.5, p.z, COLORS.RED, 40);
            p.mesh.visible = false;
            this.gameOver("State corrupted by an invalid collision or measurement.");
        } else if (this.state !== 'GAMEOVER') this.checkWin();
        this.updateUI();
    }

    startRewind(p) {
        this.isRewinding = true;
        this.showToast("UNITARY REVERSAL INITIATED", "orange");
        
        const stepRewind = () => {
            if(p.history.length === 0) {
                this.isRewinding = false;
                this.checkWin();
                return;
            }
            const move = p.history.pop();
            p.roll(-move.dx, -move.dz, move.distance, stepRewind);
        };
        setTimeout(stepRewind, 500);
    }

    checkWin() {
        if(this.state === 'PLAY' && !this.isRewinding && this.enemies.every(e => !e.alive)) {
            this.state = 'WIN';
            setTimeout(() => document.getElementById('win-screen').classList.remove('hidden'), 500);
        }
    }

    gameOver(reason) {
        this.state = 'GAMEOVER';
        document.getElementById('death-reason').innerText = reason;
        setTimeout(() => document.getElementById('gameover-screen').classList.remove('hidden'), 300);
    }

    updateUI() {
        const p = this.players[0];
        if (!p) return;
        const L = STATE_LABEL, key = p.topColorKey;

        const badge = document.getElementById('ui-top-state');
        badge.innerText = L[key];
        badge.className = `badge ${key.toLowerCase()}`;
        this.bloch.sync(p.state, this.players.slice(1).map(q => q.state));

        const psi = document.getElementById('psi-readout');
        if (psi) psi.innerText = `|ψ⟩ = ${p.state.fmt()}`;
        const inter = document.getElementById('interf-readout');
        if (inter) {
            const other = this.players.find(q => q !== p);
            inter.innerText = other ? `Recombine: P(constructive) = ${Math.round((1 + p.state.innerRe(other.state)) / 2 * 100)}%  (branch |ψ₂⟩ = ${other.state.fmt()})` : '';
        }
        this.players.forEach(q => q.syncRing(this.players.length > 1));

        // Predict what the neighbouring tile would do to the qubit
        const preview = (id, dx, dz) => {
            const el = document.getElementById(id);
            if (!el) return;
            const x = p.x + dx, z = p.z + dz;
            let label, cls = 'inert';
            if (!this.isWalkable(x, z)) label = 'Wall';
            else {
                const gate = { 2: 'Z', 5: 'H', 6: 'X' }[this.layout[z][x]];
                if (gate) {
                    const k2 = p.state.apply(GATES[gate].m).cardinal();
                    label = k2 === key ? `${gate} · no visible change` : `${gate} → ${L[k2]}`;
                    cls = k2.toLowerCase();
                } else { label = `Floor · stay ${L[key]}`; cls = key.toLowerCase(); }
            }
            el.innerText = label;
            el.className = `pred-badge ${cls} flex-1 text-center py-2 rounded-lg transition-colors`;
        };
        preview('pred-up', 0, -1); preview('pred-down', 0, 1); preview('pred-left', -1, 0); preview('pred-right', 1, 0);
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        const delta = Math.min(this.clock.getDelta(), 0.1);
        
        if(this.state !== 'MENU') {
            if (this.gridW > 10 && this.players.length) {   // camera follows whichever timeline is active
                let fx;
                if (this.syncTimelines && this.timelineSplitActive) fx = this.players.reduce((a, q) => a + q.mesh.position.x, 0) / this.players.length;
                else fx = (this.timelineSplitActive ? this.players.find(q => q.isClone) : this.players[0]).mesh.position.x;
                this.engine.cameraTargetX = Math.min(Math.max(fx, 3.5), this.gridW - 4);
            }
            this.engine.updateCamera();
            this.enemies.forEach(e => {
                if(e.alive) {
                    e.mesh.rotation.y += delta;
                    e.mesh.position.y = 0.5 + Math.sin(Date.now()*0.003)*0.1;
                }
            });
            this.items.forEach(i => {
                if(i.active) i.mesh.rotation.y -= delta * 2;
            });
            this.players.forEach(p => {
                if(p.ring) {
                    p.ring.rotation.z += delta * 3;
                    p.ring.position.set(
                        p.mesh.position.x, 
                        p.mesh.position.y + 0.6, 
                        p.mesh.position.z
                    );
                }
            });
            this.bloch.update(delta);
            this.bloch.draw();
            
            if (this.particles) {
                for (let i = this.particles.length - 1; i >= 0; i--) {
                    let p = this.particles[i];
                    p.mesh.position.x += p.vx * delta;
                    p.mesh.position.y += p.vy * delta;
                    p.mesh.position.z += p.vz * delta;
                    p.vy -= 9.8 * delta; // gravity
                    p.mesh.rotation.x += p.vx * delta;
                    p.mesh.rotation.y += p.vy * delta;
                    p.life -= delta * 1.5;
                    p.mesh.scale.setScalar(Math.max(0, p.life));
                    if(p.life <= 0) {
                        this.engine.scene.remove(p.mesh);
                        this.particles.splice(i, 1);
                    }
                }
            }
        }
        
        this.engine.renderer.render(this.engine.scene, this.engine.camera);
    }
}

// Init game globally
const game = new Game();