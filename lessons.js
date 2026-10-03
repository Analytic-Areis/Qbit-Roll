/* Concept pop-ups: shown the first time each level with a new idea is loaded. */
(function () {
const C = { r:'#ef4444', b:'#3b82f6', g:'#10b981', o:'#f59e0b', m:'#d946ef', t:'#94a3b8' };

// ---------- tiny SVG helpers ----------
function bloch(pts = [], arrows = [], vec = null) {
  const R = 78, cx = 110, cy = 100;
  const P = (x, y, z) => [cx + R * (y - 0.35 * x), cy - R * (z - 0.35 * x)];
  let s = `<svg viewBox="0 0 220 200" class="lz-svg"><circle cx="${cx}" cy="${cy}" r="${R}" fill="rgba(255,255,255,0.03)" stroke="#475569"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="22" fill="none" stroke="#334155" stroke-dasharray="3 3"/>`;
  [['x',[1,0,0],'X'],['y',[0,1,0],'Y'],['z',[0,0,1],'Z']].forEach(([k,v,l]) => {
    const [a,b] = P(...v), [a2,b2] = P(-v[0],-v[1],-v[2]);
    s += `<line x1="${a2}" y1="${b2}" x2="${a}" y2="${b}" stroke="#334155"/><text x="${a+4}" y="${b-3}" fill="#64748b" font-size="9">${l}</text>`;
  });
  arrows.forEach(([from, to, label, col]) => {
    const [x1,y1] = P(...from), [x2,y2] = P(...to);
    const mx = (x1+x2)/2 + (cx-(x1+x2)/2)*-0.5 , my = (y1+y2)/2 + (cy-(y1+y2)/2)*-0.5;
    s += `<path d="M${x1} ${y1} Q${mx+ (x1+x2-2*cx)*0.15} ${my+(y1+y2-2*cy)*0.15} ${x2} ${y2}" fill="none" stroke="${col||'#fff'}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#ah)"/>`;
    if (label) s += `<text x="${(x1+x2)/2+ (x1+x2-2*cx)*0.2 + 4}" y="${(y1+y2)/2+(y1+y2-2*cy)*0.2}" fill="${col||'#fff'}" font-size="11" font-weight="700">${label}</text>`;
  });
  if (vec) { const [a,b] = P(...vec.p); s += `<line x1="${cx}" y1="${cy}" x2="${a}" y2="${b}" stroke="${vec.c}" stroke-width="3"/>`; }
  pts.forEach(([v,label,col,dx=6,dy=-6]) => { const [a,b] = P(...v);
    s += `<circle cx="${a}" cy="${b}" r="5" fill="${col}"/><text x="${a+dx}" y="${b+dy}" fill="${col}" font-size="12" font-weight="700">${label}</text>`; });
  return s + `<defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#fff"/></marker></defs></svg>`;
}
function bars(rows, w = 220) { // rows: [label, pct, color]
  let s = `<svg viewBox="0 0 ${w} ${rows.length*30+10}" class="lz-svg">`;
  rows.forEach(([l,p,c],i) => { const y = 8 + i*30;
    s += `<text x="4" y="${y+14}" fill="#cbd5e1" font-size="12">${l}</text><rect x="52" y="${y}" width="${w-100}" height="18" rx="5" fill="#1e293b"/>
    <rect x="52" y="${y}" width="${(w-100)*p/100}" height="18" rx="5" fill="${c}"/><text x="${w-42}" y="${y+14}" fill="#fff" font-size="12" font-weight="700">${p}%</text>`; });
  return s + '</svg>';
}
function circuit(items, w) { // items: strings or [label,color]
  const n = items.length, step = 56; w = w || (n*step + 70);
  let s = `<svg viewBox="0 0 ${w} 70" class="lz-svg"><line x1="8" y1="35" x2="${w-8}" y2="35" stroke="#64748b" stroke-width="2"/>`;
  items.forEach((it,i) => { const [l,c] = Array.isArray(it) ? it : [it,'#3b82f6']; const x = 20 + i*step;
    s += `<rect x="${x}" y="17" width="40" height="36" rx="7" fill="${c}"/><text x="${x+20}" y="40" text-anchor="middle" fill="#fff" font-size="15" font-weight="800">${l}</text>`; });
  return s + '</svg>';
}
function wave(kind) {
  const f = (a, ph) => { let d=''; for (let x=0;x<=200;x+=4) d += (x?'L':'M')+(10+x)+' '+(40 - a*Math.sin(x/200*6.283*2+ph)*28)+' '; return d; };
  let s = `<svg viewBox="0 0 220 130" class="lz-svg">`;
  if (kind === 'c') s += `<path d="${f(1,0)}" stroke="${C.b}" fill="none" stroke-width="2"/><path d="${f(1,0)}" transform="translate(0,45)" stroke="${C.g}" fill="none" stroke-width="2"/>
    <text x="10" y="120" fill="${C.g}" font-size="12" font-weight="700">in phase → amplitudes ADD</text>`;
  else s += `<path d="${f(1,0)}" stroke="${C.b}" fill="none" stroke-width="2"/><path d="${f(1,3.1416)}" transform="translate(0,45)" stroke="${C.r}" fill="none" stroke-width="2"/>
    <text x="10" y="120" fill="${C.r}" font-size="12" font-weight="700">opposite phase → CANCEL</text>`;
  return s + '</svg>';
}
function flow(kind) {
  const dot = (x,y,c,l) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="#fff" font-size="10" font-weight="800">${l||''}</text>`;
  const ln = (a,b,c,d,col='#94a3b8',dash='') => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="2" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  let s = `<svg viewBox="0 0 240 130" class="lz-svg">`;
  if (kind === 'split') s += ln(20,65,90,65)+ln(90,65,170,30)+ln(90,65,170,100)+dot(20,65,C.b,'1')+dot(170,30,C.b,'a')+dot(170,100,C.b,'b')+
    `<text x="100" y="125" fill="#cbd5e1" font-size="11">ONE qubit, two positions (no cloning)</text>`;
  if (kind === 'walk') s += ln(15,65,70,65)+ln(70,65,120,25)+ln(70,65,120,105)+ln(120,25,175,65)+ln(120,105,175,65)+ln(175,65,225,65)+
    dot(15,65,C.o)+dot(120,25,C.o,'A')+dot(120,105,C.m,'B')+dot(225,65,C.o)+
    `<text x="40" y="12" fill="#cbd5e1" font-size="11">fork → explore → merge</text>`;
  if (kind === 'par') s += ln(15,35,225,35,C.o)+ln(15,95,225,95,C.m)+dot(120,35,C.o,'you')+dot(120,95,C.m,'alt')+
    `<text x="15" y="62" fill="#cbd5e1" font-size="11">only the purple timeline moves</text><text x="15" y="124" fill="#94a3b8" font-size="10">different walls · button · H gate</text>`;
  if (kind === 'sync') s += ln(15,35,225,35,C.o)+ln(15,95,225,95,C.m)+ln(80,35,80,95,C.m,'4 3')+ln(170,35,170,95,C.m,'4 3')+dot(80,35,C.o,'↑')+dot(80,95,C.m,'↑')+dot(170,35,C.r,'✕')+dot(170,95,C.r,'✕')+
    `<text x="15" y="62" fill="#cbd5e1" font-size="11">both move together</text><text x="15" y="124" fill="#94a3b8" font-size="10">hit BOTH partners on the same move</text>`;
  if (kind === 'ent') s += ln(20,65,80,65)+ln(80,65,160,25)+ln(80,65,160,105)+ln(160,25,160,105,C.m,'4 3')+dot(160,25,C.r,'✕')+dot(160,105,C.r,'✕')+dot(20,65,C.b,'1')+
    `<text x="100" y="75" fill="${C.m}" font-size="11">linked</text>`;
  return s + '</svg>';
}
function states() {
  const b = (x,c,t,s) => `<rect x="${x}" y="8" width="50" height="30" rx="8" fill="${c}"/><text x="${x+25}" y="28" text-anchor="middle" fill="#fff" font-weight="800">${t}</text><text x="${x+25}" y="54" text-anchor="middle" fill="#94a3b8" font-size="10">${s}</text>`;
  return `<svg viewBox="0 0 230 62" class="lz-svg">${b(2,C.r,'|0⟩','RED')}${b(60,C.b,'|1⟩','BLUE')}${b(118,C.g,'|+⟩','GREEN')}${b(176,C.o,'|−⟩','ORANGE')}</svg>`;
}
const fig = (svg, cap) => `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;
const Z = [0,0,1], mZ = [0,0,-1], PX = [1,0,0], MX = [-1,0,0];

// ---------- lessons (key = level index, 0-based) ----------
const LESSONS = {
0: { title: 'Qubits, |0⟩ and the Bloch Sphere',
 body: `<p>A <b>qubit</b> is the quantum version of a bit. A bit is 0 <i>or</i> 1; a qubit can be |0⟩, |1⟩ <i>or any blend of both</i>. We write its state as <b>|ψ⟩ = α|0⟩ + β|1⟩</b>, where |α|² and |β|² are the probabilities of measuring 0 or 1.</p>
 <p>Every pure qubit state is a point on the <b>Bloch sphere</b>: |0⟩ at the north pole, |1⟩ at the south pole, and |+⟩, |−⟩ on the equator. In this game the cube's colour tells you which of four key states you are in.</p>`,
 figs: [fig(bloch([[Z,'|0⟩',C.r,8,-4],[mZ,'|1⟩',C.b,8,12],[PX,'|+⟩',C.g,-30,16],[MX,'|−⟩',C.o,-30,-4]],[],{p:Z,c:C.r}),'Bloch sphere: the vector points at the state.'), fig(states(),'Colour code used in the game.')],
 tip: 'In |0⟩ you can <b>Dash</b>: SPACE then a direction hops two tiles and smashes enemies.' },

1: { title: 'Pauli-X: the Bit Flip',
 body: `<p>A <b>gate</b> is a reversible operation on a qubit. <b>X</b> is the quantum NOT: it swaps |0⟩ ↔ |1⟩. On the Bloch sphere it is a half-turn (180°) about the X axis.</p>
 <p>A <b>detector</b> is a <i>measurement</i>. The Z-detector measures in the {|0⟩,|1⟩} basis: |0⟩ passes, |1⟩ is caught. Plan your path so you hit X the right number of times.</p>`,
 figs: [fig(bloch([[Z,'|0⟩',C.r,8,-4],[mZ,'|1⟩',C.b,8,12]],[[Z,mZ,'X','#f43f5e']]),'X rotates the sphere 180° about the X axis.'), fig(circuit([['X','#f43f5e']]),'X|0⟩ = |1⟩ and X|1⟩ = |0⟩')],
 tip: 'X twice = nothing. Odd number of X tiles flips you; even number does not.' },

2: { title: 'Hadamard & Measurement Bases',
 body: `<p>The <b>Hadamard (H)</b> gate creates <b>superposition</b>: H|0⟩ = |+⟩ = (|0⟩+|1⟩)/√2 and H|1⟩ = |−⟩ = (|0⟩−|1⟩)/√2. It swaps the Z axis with the X axis of the Bloch sphere.</p>
 <p>Measurement depends on the <b>basis</b>. A Z-detector asks "0 or 1?" and an X-detector asks "+ or −?". Ask the wrong question and the answer is a <b>50/50 coin flip</b> that destroys the old state.</p>`,
 figs: [fig(bloch([[Z,'|0⟩',C.r,8,-4],[PX,'|+⟩',C.g,-30,16]],[[Z,PX,'H',C.g]]),'H turns |0⟩ into |+⟩.'), fig(bars([['0',50,C.r],['1',50,C.b]]),'Z-measuring |+⟩ gives random 0 or 1.')],
 tip: 'Z-detector passes |0⟩ · X-detector passes |+⟩. Use H to switch between them.' },

3: { title: 'Pauli-Z & Relative Phase',
 body: `<p>Qubit amplitudes carry a <b>phase</b> (a sign or angle), not just a size. <b>Z</b> flips the sign of the |1⟩ part: α|0⟩+β|1⟩ → α|0⟩−β|1⟩.</p>
 <p>On |0⟩ or |1⟩ you can't see this, but it turns <b>|+⟩ into |−⟩</b> (a 180° turn about the Z axis, from one side of the equator to the other). Phase is invisible to Z-measurement but decisive for the X basis, and it is what powers interference.</p>`,
 figs: [fig(bloch([[PX,'|+⟩',C.g,-30,16],[MX,'|−⟩',C.o,-30,-4]],[[PX,MX,'Z','#d946ef']]),'Z spins the sphere 180° about the vertical axis.'), fig(circuit([['H',C.g],['Z',C.m]]),'|0⟩ → H → Z gives |−⟩')],
 tip: 'The boss only takes damage while you are |−⟩ (ORANGE). Build it with H then Z.' },

4: { title: 'Unitarity: Gates Are Reversible',
 body: `<p>Every quantum gate is <b>unitary</b>: it preserves total probability and can be <b>undone</b>. H, X and Z are each their own inverse:</p>
 <p style="text-align:center"><b>H·H = X·X = Z·Z = I</b> (identity)</p>
 <p>No information is lost by a gate, only measurement destroys it. To get back where you started, simply run the circuit <b>backwards</b>.</p>`,
 figs: [fig(circuit([['H',C.g],['H',C.g],['=','#475569'],['I','#64748b']]),'Two Hadamards cancel.'), fig(circuit([['H',C.g],['Z',C.m],['Z',C.m],['H',C.g]]),'Forward then reversed: back to |0⟩.')],
 tip: 'Reverse order matters: undo the LAST gate first (Z, then H).' },

5: { title: 'Superposition of Positions',
 body: `<p>With a |1⟩ qubit (BLUE) the <b>Two-Path Split</b> puts <i>one</i> qubit into a superposition of <i>two places at once</i>: |ψ⟩ = (|a⟩ + |b⟩)/√2.</p>
 <p>This is not copying. The <b>no-cloning theorem</b> forbids duplicating an unknown quantum state, so the two branches share a single qubit's amplitude. Both branches move together on every step.</p>`,
 figs: [fig(flow('split'),'One qubit, two branches.')],
 tip: 'Both branches must strike the entangled targets on the same move.' },

6: { title: 'Interference & Phase Matching',
 body: `<p>When two branches are <b>recombined</b>, their amplitudes add <i>including phase</i>. Same phase → <b>constructive</b> (the qubit survives). Opposite phase → <b>destructive</b> (it cancels to nothing).</p>
 <p style="text-align:center">P(constructive) = (1 + Re⟨ψ₁|ψ₂⟩) / 2</p>
 <p>A Z gate on |1⟩ gives −|1⟩, so if only <i>one</i> branch crosses a Z tile the branches disagree in sign and cancel. Make both cross one.</p>`,
 figs: [fig(wave('c'),'Constructive interference.'), fig(wave('d'),'Destructive interference.')],
 tip: 'Watch the live interference readout in the sidebar before pressing SPACE to merge.' },

7: { title: 'The |+⟩ State & Tunneling',
 body: `<p>|+⟩ (GREEN) is an equal superposition with <b>definite phase +</b>. It is 50/50 under a Z measurement but <b>100% "+"</b> under an X measurement, so an X-detector lets it through with certainty.</p>
 <p>In the game, |+⟩ lets you <b>tunnel</b> through a wall: like quantum tunnelling, the particle has some amplitude on the far side of a barrier.</p>`,
 figs: [fig(bloch([[PX,'|+⟩',C.g,-30,16]],[],{p:PX,c:C.g}),'|+⟩ sits on the +X axis.'), fig(bars([['X: +',100,C.g],['X: −',0,C.o]]),'X-measurement of |+⟩.')],
 tip: 'Reach |+⟩ with H, then SPACE + direction to tunnel the wall.' },

8: { title: 'Quantum Walk & Timelines',
 body: `<p>In a <b>quantum walk</b> a particle explores several paths in superposition and then <b>recombines</b>. Interference makes it spread very differently from a classical random walk (quadratically faster), the idea behind quantum search algorithms.</p>
 <p>Here, in |−⟩ (ORANGE) on an anchor, SPACE <b>forks a second timeline</b> on the other anchor. Explore with it, return, and SPACE again to <b>merge</b>.</p>`,
 figs: [fig(flow('walk'),'Fork, explore, merge.')],
 tip: 'After merging, reverse your gates (Z, then H) to get back to |0⟩.' },

9: { title: 'Parallel Timelines',
 body: `<p>Timelines can live in <b>different environments</b>. Once forked, only the second (purple) timeline moves, so you do things there that change the world your first timeline sees, such as pressing a button that removes a wall.</p>
 <p>Think of it as quantum parallelism: separate branches evaluate different "worlds" and their results are combined afterwards.</p>`,
 figs: [fig(flow('par'),'Only the alternate timeline moves.')],
 tip: 'The H gate in the purple wing is crossed twice, so it cancels and your state is unchanged.' },

10: { title: 'Entanglement Across Timelines',
 body: `<p><b>Entanglement</b> links parts of a system so they can't be described independently. Here, after the fork <i>both</i> timelines move in <b>lockstep</b>, and the two enemies are entangled: they only die if each timeline strikes its own partner on the <b>same move</b>.</p>
 <p>A lone hit does nothing, the correlation is what counts, just like measuring one half of an entangled pair.</p>`,
 figs: [fig(flow('sync'),'Synchronised timelines must hit together.')],
 tip: 'Each timeline has different walls, so the same key press can steer them differently.' },

11: { title: 'Entangled Paths (Split Branches)',
 body: `<p>The same idea applies to the Two-Path Split: the two branches of the |1⟩ qubit move in lockstep, but <b>obstacles bend each one differently</b>. Their positions become <b>correlated</b>, so the choice of split direction decides where both branches end up.</p>
 <p>Quantum algorithms do exactly this: steer a superposition so correlated branches land on the right answers together.</p>`,
 figs: [fig(flow('ent'),'Linked branches strike linked targets.')],
 tip: 'Think through where the wall will deflect the second branch before you split.' }
};

// ---------- modal UI ----------
const css = document.createElement('style');
css.textContent = `
#lz-overlay{position:fixed;inset:0;z-index:300;background:rgba(2,6,23,.8);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:1rem}
#lz-overlay.show{display:flex}
#lz-box{width:min(720px,100%);max-height:88vh;display:flex;flex-direction:column;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.7);overflow:hidden;font-family:'Outfit',sans-serif;color:#e2e8f0}
#lz-head{padding:1.1rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;gap:1rem}
#lz-head small{display:block;color:#60a5fa;letter-spacing:.2em;text-transform:uppercase;font-size:.7rem;font-weight:700}
#lz-head h2{margin:.15rem 0 0;font-size:1.4rem;font-weight:800;color:#fff}
#lz-x{background:none;border:0;color:#94a3b8;font-size:1.6rem;cursor:pointer}
#lz-scroll{overflow-y:auto;padding:1.2rem 1.5rem;line-height:1.6;font-size:.98rem}
#lz-scroll p{margin:0 0 .9rem}
#lz-figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin:.5rem 0 1rem}
#lz-figs figure{margin:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.7rem;text-align:center}
#lz-figs figcaption{font-size:.78rem;color:#94a3b8;margin-top:.3rem}
.lz-svg{width:100%;height:auto;max-height:210px}
#lz-tip{background:rgba(59,130,246,.12);border-left:3px solid #3b82f6;padding:.7rem 1rem;border-radius:8px;font-size:.9rem}
#lz-foot{padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.08);text-align:right}
#lz-go{background:#3b82f6;color:#fff;border:0;border-radius:10px;padding:.7rem 1.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;font-family:inherit}
#lz-go:hover{background:#60a5fa}
#lz-help{position:fixed;top:1rem;right:1rem;z-index:50;display:none;background:rgba(15,23,42,.85);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:.5rem .9rem;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif}
#lz-help.show{display:block}`;
document.head.appendChild(css);

const ov = document.createElement('div'); ov.id = 'lz-overlay';
ov.innerHTML = `<div id="lz-box"><div id="lz-head"><div><small>New Concept</small><h2 id="lz-title"></h2></div><button id="lz-x" aria-label="Close">×</button></div>
<div id="lz-scroll"><div id="lz-body"></div><div id="lz-figs"></div><div id="lz-tip"></div></div>
<div id="lz-foot"><button id="lz-go">Got it — Start (Enter)</button></div></div>`;
document.body.appendChild(ov);
const help = document.createElement('button'); help.id = 'lz-help'; help.textContent = '📖 Concept'; document.body.appendChild(help);

const $ = id => document.getElementById(id);
let current = null; const seen = new Set();
function open(i) {
  const L = LESSONS[i]; if (!L) return;
  current = i; seen.add(i);
  $('lz-title').textContent = L.title; $('lz-body').innerHTML = L.body;
  $('lz-figs').innerHTML = L.figs.join(''); $('lz-tip').innerHTML = '💡 ' + L.tip;
  $('lz-scroll').scrollTop = 0; ov.classList.add('show');
}
function close() { ov.classList.remove('show'); current = null; }
$('lz-go').onclick = close; $('lz-x').onclick = close;
ov.addEventListener('click', e => { if (e.target === ov) close(); });
help.onclick = () => open(game.levelIdx);

// While open, swallow game keys (capture phase); Enter/Esc close it.
window.addEventListener('keydown', e => {
  if (!ov.classList.contains('show')) return;
  if (e.key === 'Enter' || e.key === 'Escape') close();
  e.stopImmediatePropagation(); e.preventDefault();
}, true);

// Hook level loading
const orig = game.loadLevel.bind(game);
game.loadLevel = function (i) {
  orig(i);
  help.classList.toggle('show', !!LESSONS[i]);
  if (LESSONS[i] && !seen.has(i)) open(i);
};
const origMenu = game.showMenu.bind(game);
game.showMenu = function () { help.classList.remove('show'); close(); origMenu(); };
})();
