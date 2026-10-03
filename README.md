# Qubit Roll 🎲🌌
### 2.5D Quantum Puzzle Engine

**Qubit Roll** is an interactive, quantum-themed puzzle game combining 2.5D grid kinematics with genuine quantum computing concepts. Players control a state-shifting cube (a *Qubit*) across a series of handcrafted levels, applying unitary quantum logic gates, manipulating superpositions, and resolving quantum interference to neutralize entangled enemies and clear obstacles.

---

## 🚀 Key Features

* **Real Quantum State Vector Engine**: Computes single-qubit states $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$ with complex amplitudes and phase tracking.
* **Interactive Bloch Sphere**: Real-time 3D/2D vector projection and probability amplitude readouts ($P(|0\rangle)$, $P(|1\rangle)$, $P(|+\rangle)$, $P(|-\rangle)$) governed by the Born rule.
* **Unitary Quantum Gates on the Grid**:
  * **Pauli-X Gate ($X$)**: Bit-flip operation ($|0\rangle \longleftrightarrow |1\rangle$).
  * **Pauli-Z Gate ($Z$)**: Phase-flip operation ($|+\rangle \longleftrightarrow |-\rangle$).
  * **Hadamard Gate ($H$)**: Creates equal superpositions ($|0\rangle \longleftrightarrow |+\rangle$ and $|1\rangle \longleftrightarrow |-\rangle$).
* **Pedagogical Lesson Overlays**: Visual explanations featuring SVG quantum circuits, Bloch sphere trajectories, and wave interference diagrams when encountering new mechanics.
* **2.5D Isometric Three.js Renderer**: Fluid cube roll physics, neon glow shaders, and dynamic lighting.

---

## 🧠 Core Quantum States & Abilities

The orientation of your cube determines your active quantum state on the top face:

| State | Notation | Face Color | Mechanic / Ability |
| :--- | :---: | :---: | :--- |
| **Ground State** | $|0\rangle$ | 🔴 **Red** | **Heisenberg's Dash**: High-velocity slide that neutralizes red drones. |
| **Excited State** | $|1\rangle$ | 🔵 **Blue** | **Schrödinger's Split**: Entangles and branches into two simultaneous cubes. |
| **Superposition (+)** | $|+\rangle$ | 🟢 **Green** | **Quantum Tunneling**: Coherently phases through solid walls into adjacent cells. |
| **Superposition (-)** | $|-\rangle$ | 🟠 **Orange** | **Timeline Anchor**: Quantum walk manipulation along entangled histories. |

---

## 👾 Adversaries & Hazards

* **Red Drones**: Classical security sentinels that can only be shattered by striking them during a **Heisenberg Dash**.
* **Cyan Entangled Nodes**: Quantum-linked enemies that can only be cleared while in a **Split / Entangled** superposition state.
* **Laser Grids & Void Boundaries**: Lethal obstacles requiring careful state orientation and tunneling to bypass.

---

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **`W` `A` `S` `D`** / **Arrow Keys** | Roll the cube across the grid |
| **`SPACE`** + **Direction** | Activate Top-Face Quantum Ability (Dash / Tunnel) |
| **`SPACE`** (Blue Face) | Trigger Schrödinger's Split (Entanglement) |
| **`R`** | Restart current level |
| **`ESC`** | Return to Level Select / Pause Menu |

---

## 🛠️ Tech Stack

* **Rendering Engine**: [Three.js (r128)](https://threejs.org/) for WebGL 2.5D isometric view.
* **Kinematics & FX**: [GSAP 3.12](https://greensock.com/gsap/) for smooth cube roll physics and camera transitions.
* **User Interface**: HTML5 Canvas overlays, [Tailwind CSS](https://tailwindcss.com/), and glassmorphic styling.
* **Zero Dependencies / Build Step**: 100% vanilla client-side JavaScript. Runs out of the box in any modern browser.

---

## 📦 Project Structure

```
├── index.html        # Main HTML entry point and HUD interface
├── game.js           # Three.js scene, quantum state logic, level engine, and physics
├── lessons.js        # Interactive SVG quantum circuit diagrams and lesson popups
├── style.css         # Glassmorphism UI styling and animations
└── qubit-roll.zip    # Ready-to-upload bundle for itch.io / web deployment
```

---

## 💻 Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Analytic-Areis/Qbit-Roll.git
   cd Qbit-Roll
   ```

2. Open `index.html` directly in your browser, or start a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
3. Visit `http://localhost:8000` in your web browser.

---

## 🌐 Deploying to Itch.io

To deploy as a playable browser game on [itch.io](https://itch.io):
1. Create a new project and set **Kind of project** to **HTML**.
2. Upload the `qubit-roll.zip` package.
3. Check the box **"This file will be played in the browser"**.
4. Set the embed dimensions to **1280 × 720** and enable the **Fullscreen button**.
