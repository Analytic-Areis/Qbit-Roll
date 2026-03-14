// game.js

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 60;
// Let grid dimensions be dynamic
let OFFSET_X = 0;
let OFFSET_Y = 0;

// Colors
const COLOR_BG = '#0f172a';
const COLOR_GRID_LINE = '#334155';
const COLOR_OBSTACLE = '#475569';
const COLOR_PLAYER = '#f1f5f9';
const COLOR_ENEMY = '#ef4444'; // Red
const COLOR_ENEMY_ENTANGLED = '#22d3ee'; // Cyan

const FaceType = {
    INERT_1: 'INERT_1',
    RED: 'RED',     // Heisenberg Dash
    BLUE: 'BLUE',   // Schrodinger Split
    GREEN: 'GREEN', // Quantum Tunnel
    INERT_2: 'INERT_2',
    INERT_3: 'INERT_3'
};

const FaceDisplayName = {
    'INERT_1': 'Inert',
    'RED': 'Heisenberg\'s Dash',
    'BLUE': 'Schrodinger\'s Split',
    'GREEN': 'Quantum Tunneling',
    'INERT_2': 'Inert',
    'INERT_3': 'Inert'
}

class GridManager {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.grid = new Map();
        
        // No hardcoded walls here. They will be spawned per-level using the walls array.
    }
    
    setMap(wallsArray) {
        this.grid.clear();
        const addWall = (x, y) => this.grid.set(`${x},${y}`, 1);
        
        // Map padding
        for(let x = 0; x < this.width; x++) {
            addWall(x, 0);
            addWall(x, this.height - 1);
        }
        for(let y = 0; y < this.height; y++) {
            addWall(0, y);
            addWall(this.width - 1, y);
        }
        
        if (wallsArray) {
            wallsArray.forEach(([wx, wy]) => addWall(wx, wy));
        }
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return !this.grid.has(`${x},${y}`);
    }

    draw(ctx, offsetX, offsetY) {
        ctx.strokeStyle = COLOR_GRID_LINE;
        ctx.lineWidth = 1;
        
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let px = offsetX + x * GRID_SIZE;
                let py = offsetY + y * GRID_SIZE;
                
                ctx.strokeRect(px, py, GRID_SIZE, GRID_SIZE);
                
                if (this.grid.has(`${x},${y}`)) {
                    ctx.fillStyle = COLOR_OBSTACLE;
                    ctx.fillRect(px + 1, py + 1, GRID_SIZE - 2, GRID_SIZE - 2);
                }
            }
        }
    }
}

class Player {
    constructor(x, y, gridManager, initialFaces) {
        this.gridX = x;
        this.gridY = y;
        this.gridManager = gridManager;
        
        this.pixelX = x * GRID_SIZE;
        this.pixelY = y * GRID_SIZE;
        
        this.targetPixelX = this.pixelX;
        this.targetPixelY = this.pixelY;
        this.isMoving = false;
        
        this.lastMoveDx = 0;
        this.lastMoveDy = 0;
        
        this.tunnelActive = false; // Green face active
        this.isDashing = false;
        this.isTunneling = false;
        this.isParent = true;
        
        this.yRotation = 0; // Visual track of cube rotation in UI
        
        this.faces = initialFaces || {
            top: FaceType.INERT_1,
            front: FaceType.RED,
            right: FaceType.BLUE,
            back: FaceType.INERT_2,
            left: FaceType.GREEN,
            bottom: FaceType.INERT_3
        };
    }

    canMove(dx, dy) {
        const tx = this.gridX + dx;
        const ty = this.gridY + dy;
        
        if (tx < 0 || tx >= this.gridManager.width || ty < 0 || ty >= this.gridManager.height) return false;
        
        if (!this.gridManager.isWalkable(tx, ty)) {
            if (this.tunnelActive) return true; // Allowed to phase
            return false;
        }
        return true;
    }

    startMove(dx, dy) {
        this.gridX += dx;
        this.gridY += dy;
        this.targetPixelX = this.gridX * GRID_SIZE;
        this.targetPixelY = this.gridY * GRID_SIZE;
        this.isMoving = true;
        this.lastMoveDx = dx;
        this.lastMoveDy = dy;
        
        if (this.tunnelActive) {
            this.tunnelActive = false;
        }
        
        this.updateFaces(dx, dy);
    }

    updateFaces(dx, dy) {
        const old = { ...this.faces };
        if (dx === 1) { // Right
            this.faces.top = old.left;
            this.faces.right = old.top;
            this.faces.bottom = old.right;
            this.faces.left = old.bottom;
        } else if (dx === -1) { // Left
            this.faces.top = old.right;
            this.faces.left = old.top;
            this.faces.bottom = old.left;
            this.faces.right = old.bottom;
        } else if (dy === -1) { // Up
            this.faces.top = old.front;
            this.faces.back = old.top;
            this.faces.bottom = old.back;
            this.faces.front = old.bottom;
        } else if (dy === 1) { // Down
            this.faces.top = old.back;
            this.faces.front = old.top;
            this.faces.bottom = old.front;
            this.faces.back = old.bottom;
        }
    }

    rotateY(direction) {
        // direction: 1 for CW (E), -1 for CCW (Q)
        const old = { ...this.faces };
        if (direction === 1) { // Rotate Right (Top stays same)
            this.faces.front = old.left;
            this.faces.right = old.front;
            this.faces.back = old.right;
            this.faces.left = old.back;
            this.yRotation -= 90;
        } else { // Rotate Left
            this.faces.front = old.right;
            this.faces.right = old.back;
            this.faces.back = old.left;
            this.faces.left = old.front;
            this.yRotation += 90;
        }
    }

    update(dt, particles) {
        if (this.isMoving) {
            const speed = (this.isDashing || this.isTunneling) ? 1200 * dt : 400 * dt; // px per second
            const dx = this.targetPixelX - this.pixelX;
            const dy = this.targetPixelY - this.pixelY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (this.isDashing && particles) {
                particles.spawn(OFFSET_X + this.pixelX + GRID_SIZE/2, OFFSET_Y + this.pixelY + GRID_SIZE/2, 2, '#f87171');
            } else if (this.isTunneling && particles) {
                particles.spawn(OFFSET_X + this.pixelX + GRID_SIZE/2, OFFSET_Y + this.pixelY + GRID_SIZE/2, 2, '#4ade80');
            }
            
            if (dist < speed) {
                this.pixelX = this.targetPixelX;
                this.pixelY = this.targetPixelY;
                this.isMoving = false;
                this.isDashing = false;
                this.isTunneling = false;
            } else {
                this.pixelX += (dx / dist) * speed;
                this.pixelY += (dy / dist) * speed;
            }
        }
    }

    updatePixelPos() {
        this.pixelX = this.gridX * GRID_SIZE;
        this.pixelY = this.gridY * GRID_SIZE;
        this.targetPixelX = this.pixelX;
        this.targetPixelY = this.pixelY;
        this.isMoving = false;
    }

    draw(ctx, offsetX, offsetY, isSelected = true, playerCount = 1) {
        const px = offsetX + this.pixelX + 4;
        const py = offsetY + this.pixelY + 4;
        const size = GRID_SIZE - 8;
        
        // Base
        ctx.fillStyle = isSelected ? COLOR_PLAYER : '#64748b';
        
        // Draw rounded rect
        ctx.beginPath();
        ctx.roundRect(px, py, size, size, 8);
        ctx.fill();
        
        if (this.tunnelActive) {
            ctx.strokeStyle = '#4ade80'; // Green outline
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        
        // Face Indicator
        let faceCol = '#cbd5e1';
        switch (this.faces.top) {
            case FaceType.RED: faceCol = '#f87171'; break;
            case FaceType.BLUE: faceCol = '#60a5fa'; break;
            case FaceType.GREEN: faceCol = '#4ade80'; break;
        }
        
        ctx.fillStyle = faceCol;
        ctx.beginPath();
        ctx.arc(px + size / 2, py + size / 2, size / 3, 0, Math.PI * 2);
        ctx.fill();
        
        // If tunnel or dash moving, add a trail effect maybe? (Handled simply by smooth movement for now)
        
        if (this.isParent && playerCount > 1) {
            // Draw star in the center over the color circle to indicate parent cube
            // +1 to Y for minor visual font baseline adjustment
            ctx.fillStyle = '#0f172a'; // Black
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', px + size / 2, py + size / 2 + 1);
        }
    }
}

class Enemy {
    constructor(x, y, isEntangled = false) {
        this.gridX = x;
        this.gridY = y;
        this.pixelX = x * GRID_SIZE;
        this.pixelY = y * GRID_SIZE;
        this.isEntangled = isEntangled;
    }

    draw(ctx, offsetX, offsetY) {
        const px = offsetX + this.pixelX + 8;
        const py = offsetY + this.pixelY + 8;
        const size = GRID_SIZE - 16;
        
        ctx.fillStyle = this.isEntangled ? COLOR_ENEMY_ENTANGLED : COLOR_ENEMY;
        
        ctx.beginPath();
        ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(px + size / 3, py + size / 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px + 2 * size / 3, py + size / 3, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Entangled Symbol or Ring
        if (this.isEntangled) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px + size / 2, py + size / 2, size / 2 + 4, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw link symbol
            ctx.beginPath();
            ctx.moveTo(px + size/2 - 6, py + size/2 + 6);
            ctx.lineTo(px + size/2 + 6, py + size/2 + 6);
            ctx.stroke();
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 400;
        this.vy = (Math.random() - 0.5) * 400;
        this.size = Math.random() * 8 + 4;
        this.color = color;
        this.life = 1.0; // 1 second
        this.decay = Math.random() * 0.5 + 0.5;
    }
    
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }
    
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    spawn(x, y, count, color) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    draw(ctx) {
        for (let p of this.particles) {
            p.draw(ctx);
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        
        this.uiFaceName = document.getElementById('face-name');
        this.uiFaceIcon = document.getElementById('face-icon');
        this.uiInstructions = document.getElementById('instructions');
        this.powerupContainer = document.getElementById('powerup-container');
        
        // Prediction text elements
        this.predUp = document.getElementById('pred-up');
        this.predDown = document.getElementById('pred-down');
        this.predLeft = document.getElementById('pred-left');
        this.predRight = document.getElementById('pred-right');
        
        this.levelMenu = document.getElementById('level-menu');
        this.levelGrid = document.getElementById('level-grid');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.winScreen = document.getElementById('win-screen');
        this.levelNameDisplay = document.getElementById('level-name-display');
        
        // Sidebar UI
        this.menuBtn = document.getElementById('menu-btn');
        this.rulesSidebar = document.getElementById('rules-sidebar');
        this.closeSidebarBtn = document.getElementById('close-sidebar');
        this.toggleHintBtn = document.getElementById('toggle-hint-btn');
        this.levelHint = document.getElementById('level-hint');
        
        this.currentLevelIndex = 0;
        this.unlockedLevels = 1; // Unlocks as you win
        this.inMenu = true;
        
        this.initSidebar();
        
        this.particles = new ParticleSystem();
        this.keys = {};
        this.prevKeys = {}; // For one-shot press tracking
        
        window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        
        this.buildMenu();
        
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    initSidebar() {
        this.menuBtn.addEventListener('click', () => {
            this.rulesSidebar.classList.remove('hidden');
        });
        
        this.closeSidebarBtn.addEventListener('click', () => {
            this.rulesSidebar.classList.add('hidden');
            // Reset hint when closing sidebar
            this.levelHint.classList.add('hidden');
            this.toggleHintBtn.innerText = "Show Tactical Hint";
        });
        
        this.toggleHintBtn.addEventListener('click', () => {
            if (this.levelHint.classList.contains('hidden')) {
                this.levelHint.classList.remove('hidden');
                this.toggleHintBtn.innerText = "Hide Tactical Hint";
            } else {
                this.levelHint.classList.add('hidden');
                this.toggleHintBtn.innerText = "Show Tactical Hint";
            }
        });
    }

    buildMenu() {
        this.inMenu = true;
        this.levelMenu.classList.remove('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.winScreen.classList.add('hidden');
        this.levelNameDisplay.classList.add('hidden');
        this.levelGrid.innerHTML = '';
        
        GameLevels.forEach((level, idx) => {
            const btn = document.createElement('button');
            btn.className = 'level-button';
            
            const isUnlocked = idx < this.unlockedLevels;
            if (!isUnlocked) {
                btn.disabled = true;
            }
            
            btn.innerHTML = `
                <span class="title">Level ${idx + 1}</span>
                <span class="subtitle">${isUnlocked ? level.title : "LOCKED"}</span>
            `;
            
            btn.onclick = () => {
                if (isUnlocked) {
                    this.loadLevel(idx);
                }
            };
            this.levelGrid.appendChild(btn);
        });
    }

    loadLevel(idx) {
        this.currentLevelIndex = idx;
        this.inMenu = false;
        this.levelMenu.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.winScreen.classList.add('hidden');
        
        const lvlData = GameLevels[idx];
        
        // Update level name display
        this.levelNameDisplay.innerText = lvlData.title;
        this.levelNameDisplay.classList.remove('hidden');
        
        // Recalculate grid offset
        OFFSET_X = (CANVAS_WIDTH - (lvlData.width * GRID_SIZE)) / 2;
        OFFSET_Y = (CANVAS_HEIGHT - (lvlData.height * GRID_SIZE)) / 2;
        
        this.grid = new GridManager(lvlData.width, lvlData.height);
        this.grid.setMap(lvlData.walls);
        
        this.players = [new Player(lvlData.player.x, lvlData.player.y, this.grid, lvlData.initialFaces)];
        this.enemies = [];
        this.particles.particles = [];
        
        if (lvlData.enemies) {
            lvlData.enemies.forEach(e => {
                this.spawnEnemy(e.x, e.y, e.entangled);
            });
        }
        
        this.collapseMode = false;
        this.dashSelectionMode = false;
        this.tunnelSelectionMode = false;
        this.collapseSelectionIndex = 0;
        
        this.gameOver = false;
        this.gameWin = false;
        this.gameOverTimer = 0;
        this.recentlyKilledEntangled = [];
        
        this.gameOverScreen.classList.add('hidden');
        this.winScreen.classList.add('hidden');
        
        // Setup the specific hint for this level
        this.levelHint.innerText = lvlData.hint || "No specific hints for this level. Good luck!";
        this.levelHint.classList.add('hidden');
        this.toggleHintBtn.innerText = "Show Tactical Hint";
        
        this.updateUI();
    }

    spawnEnemy(x, y, entangled) {
        this.enemies.push(new Enemy(x, y, entangled));
    }

    showPowerupText(text, cssClass) {
        const el = document.createElement('div');
        el.className = `powerup-text ${cssClass}`;
        el.innerText = text;
        this.powerupContainer.appendChild(el);
        
        // Remove after animation completes
        setTimeout(() => {
            if (this.powerupContainer.contains(el)) {
                this.powerupContainer.removeChild(el);
            }
        }, 1500);
    }

    isPressed(key) {
        const p = this.keys[key];
        const prev = this.prevKeys[key];
        if (p && !prev) {
            this.prevKeys[key] = true;
            return true;
        }
        return false;
    }

    handleEvents() {
        if (this.inMenu) return;

        if (this.gameOver || this.gameWin) {
            if (this.isPressed('r')) {
                if (this.gameWin) {
                    // Next Level or return to menu
                    if (this.currentLevelIndex < GameLevels.length - 1) {
                        this.loadLevel(this.currentLevelIndex + 1);
                    } else {
                        this.buildMenu();
                    }
                } else {
                    // Retry
                    this.loadLevel(this.currentLevelIndex);
                }
            } else if (this.isPressed('escape')) {
                this.buildMenu();
            }
            return;
        }

        if (this.isPressed('r')) {
            this.loadLevel(this.currentLevelIndex);
            return;
        }
        
        if (this.isPressed('escape') && !this.dashSelectionMode && !this.tunnelSelectionMode && !this.collapseMode) {
            this.buildMenu();
            return;
        }

        if (this.collapseMode) {
            // Deprecated: user wants an automatic collapse back to parent
            // We'll leave the mode block here just in case, but it shouldn't be reached
            this.collapseMode = false;
        } else if (this.dashSelectionMode) {
            this.handleDashInput();
        } else if (this.tunnelSelectionMode) {
            this.handleTunnelInput();
        } else {
            // Normal Ability Trigger
            if (this.isPressed(' ')) {
                if (this.players.some(p => p.isMoving)) return;
                
                const face = this.players[0].faces.top;
                if (this.players.length > 1) {
            
                    if (face === FaceType.RED) this.dashSelectionMode = true;
                    else if (face === FaceType.GREEN) this.tunnelSelectionMode = true;
                    else if (face === FaceType.BLUE) {
                        // Automatic Collapse to Parent
                        const parent = this.players.find(pl => pl.isParent);
                        if (parent) {
                            // Kill clones
                            this.players.forEach(pl => {
                                if (!pl.isParent) {
                                    this.particles.spawn(OFFSET_X + pl.pixelX + GRID_SIZE/2, OFFSET_Y + pl.pixelY + GRID_SIZE/2, 20, '#60a5fa');
                                }
                            });
                            this.players = [parent];
                        }
                    }
                    
                } else {
                    const p = this.players[0];
                    if (face === FaceType.RED) {
                        this.dashSelectionMode = true;
                    } else if (face === FaceType.GREEN) {
                        this.tunnelSelectionMode = true;
                    } else if (face === FaceType.BLUE) {
                        // Activate split immediately
                        let spawned = this.spawnClone(p);
                        if(spawned) {
                            this.showPowerupText("SCHRODINGER'S SPLIT", 'powerup-blue');
                        }
                    }
                }
            } else if (this.isPressed('escape')) {
                // Do nothing in normal mode
            }
        }

        // Q/E Rotation
        if (!this.collapseMode && !this.dashSelectionMode && !this.tunnelSelectionMode) {
            if (this.isPressed('q')) {
                this.players.forEach(p => p.rotateY(-1));
            } else if (this.isPressed('e')) {
                this.players.forEach(p => p.rotateY(1));
            }
        }

        // Movement (if not in a menu and not moving)
        if (!this.collapseMode && !this.dashSelectionMode && !this.tunnelSelectionMode) {
            if (!this.players.some(p => p.isMoving)) {
                let dx = 0, dy = 0;
                if (this.isPressed('w') || this.isPressed('arrowup')) dy = -1;
                else if (this.isPressed('s') || this.isPressed('arrowdown')) dy = 1;
                else if (this.isPressed('a') || this.isPressed('arrowleft')) dx = -1;
                else if (this.isPressed('d') || this.isPressed('arrowright')) dx = 1;
                
                if (dx !== 0 || dy !== 0) {
                    this.players.sort((a, b) => {
                        if (dx > 0) return b.gridX - a.gridX;
                        if (dx < 0) return a.gridX - b.gridX;
                        if (dy > 0) return b.gridY - a.gridY;
                        if (dy < 0) return a.gridY - b.gridY;
                        return 0;
                    });
                    
                    let parentMoved = false;
                    let pDx = 0, pDy = 0;
                    
                    // Track parent movement specifically to pass to clones
                    const parent = this.players.find(p => p.isParent);
                    if (parent && parent.canMove(dx, dy) && !this.players.some(other => other !== parent && other.gridX === (parent.gridX + dx) && other.gridY === (parent.gridY + dy))) {
                        parentMoved = true;
                        pDx = dx;
                        pDy = dy;
                    }
                    
                    this.players.forEach(p => {
                        if (p.canMove(dx, dy) && !this.players.some(other => other !== p && other.gridX === (p.gridX + dx) && other.gridY === (p.gridY + dy))) {
                            p.startMove(dx, dy);
                        } else if (!p.isParent) {
                            // If clone is blocked, still force its faces to mimic the parent IF the parent moved
                            // Or if the parent didn't move but the clone DID move, we still need them to sync
                            // Instead of complex logic here, we'll brute-force sync the faces in update()
                        }
                    });
                }
            }
        }
    }

    handleTunnelInput() {
        let dx = 0, dy = 0;
        if (this.isPressed('w') || this.isPressed('arrowup')) dy = -1;
        else if (this.isPressed('s') || this.isPressed('arrowdown')) dy = 1;
        else if (this.isPressed('a') || this.isPressed('arrowleft')) dx = -1;
        else if (this.isPressed('d') || this.isPressed('arrowright')) dx = 1;
        else if (this.isPressed(' ') || this.isPressed('escape')) {
            this.tunnelSelectionMode = false;
            return;
        }
        
        if (dx !== 0 || dy !== 0) {
            let tunneled = false;
            
            this.players.sort((a, b) => {
                if (dx > 0) return b.gridX - a.gridX;
                if (dx < 0) return a.gridX - b.gridX;
                if (dy > 0) return b.gridY - a.gridY;
                if (dy < 0) return a.gridY - b.gridY;
                return 0;
            });
            
            this.players.forEach(p => {
                if (this.executeTunnel(p, dx, dy)) tunneled = true;
            });
            if (tunneled) this.showPowerupText("QUANTUM TUNNELING", 'powerup-green');
            this.tunnelSelectionMode = false;
        }
    }

    executeTunnel(p, dx, dy) {
        const tx = p.gridX + (dx * 2);
        const ty = p.gridY + (dy * 2);
        const mx = p.gridX + dx;
        const my = p.gridY + dy;
        
        if (!this.grid.isWalkable(mx, my)) {
            if (this.grid.isWalkable(tx, ty) && !this.players.some(other => other !== p && other.gridX === tx && other.gridY === ty)) {
                p.gridX = tx;
                p.gridY = ty;
                p.targetPixelX = tx * GRID_SIZE;
                p.targetPixelY = ty * GRID_SIZE;
                p.isMoving = true;
                p.isTunneling = true;
                return true;
            }
        }
        return false;
    }

    handleDashInput() {
        let dx = 0, dy = 0;
        if (this.isPressed('w') || this.isPressed('arrowup')) dy = -1;
        else if (this.isPressed('s') || this.isPressed('arrowdown')) dy = 1;
        else if (this.isPressed('a') || this.isPressed('arrowleft')) dx = -1;
        else if (this.isPressed('d') || this.isPressed('arrowright')) dx = 1;
        else if (this.isPressed(' ') || this.isPressed('escape')) {
            this.dashSelectionMode = false;
            return;
        }
        
        if (dx !== 0 || dy !== 0) {
            this.recentlyKilledEntangled = [];
            let dashed = false;
            
            this.players.sort((a, b) => {
                if (dx > 0) return b.gridX - a.gridX;
                if (dx < 0) return a.gridX - b.gridX;
                if (dy > 0) return b.gridY - a.gridY;
                if (dy < 0) return a.gridY - b.gridY;
                return 0;
            });
            
            this.players.forEach(p => {
                if (this.executeDash(p, dx, dy)) dashed = true;
            });
            
            if (dashed) this.showPowerupText("HEISENBERG'S DASH", 'powerup-red');
            
            // Entanglement logic
            const aliveEntangled = this.enemies.filter(e => e.isEntangled);
            
            if (this.recentlyKilledEntangled.length > 0) {
                if (aliveEntangled.length > 0) {
                    console.log("Failed to kill all entangled! Respawning...");
                    this.recentlyKilledEntangled.forEach(e => {
                        this.enemies.push(e);
                        // Respawn particles
                        this.particles.spawn(OFFSET_X + e.pixelX + GRID_SIZE/2, OFFSET_Y + e.pixelY + GRID_SIZE/2, 10, COLOR_ENEMY_ENTANGLED);
                    });
                }
                this.recentlyKilledEntangled = [];
            }
            
            
            // Win condition is now checked in update() after all movement stops
            
            this.dashSelectionMode = false;
        }
    }

    executeDash(p, dx, dy) {
        const tx = p.gridX + (dx * 2);
        const ty = p.gridY + (dy * 2);
        const mx = p.gridX + dx;
        const my = p.gridY + dy;
        
        if (!this.grid.isWalkable(mx, my)) return false;
        
        if (this.grid.isWalkable(tx, ty) && !this.players.some(other => other !== p && other.gridX === tx && other.gridY === ty)) {
            const enemyDest = this.enemies.find(e => e.gridX === tx && e.gridY === ty);
            const enemyMid = this.enemies.find(e => e.gridX === mx && e.gridY === my);
            
            if (enemyDest) {
                if (!enemyDest.isEntangled && this.players.length > 1) {
                    // Cannot kill red enemies while split
                } else {
                    this.removeEnemyAt(tx, ty);
                }
            }
            if (enemyMid) {
                if (!enemyMid.isEntangled && this.players.length > 1) {
                    // Cannot kill red enemies while split
                } else {
                    this.removeEnemyAt(mx, my);
                }
            }
            
            p.gridX = tx;
            p.gridY = ty;
            p.targetPixelX = tx * GRID_SIZE;
            p.targetPixelY = ty * GRID_SIZE;
            p.isMoving = true;
            p.isDashing = true;
            
            // Shift the face in the direction of the dash
            p.updateFaces(dx, dy);
            
            return true;
        }
        return false;
    }

    spawnClone(p) {
        const offsets = [[1,0], [-1,0], [0,1], [0,-1]];
        for (let [dx, dy] of offsets) {
            let sx = p.gridX + dx;
            let sy = p.gridY + dy;
            
            if (this.grid.isWalkable(sx, sy) && !this.players.some(other => other.gridX === sx && other.gridY === sy)) {
                const clone = new Player(sx, sy, this.grid);
                // Child inherits EXACT faces and states
                clone.faces = { ...p.faces };
                clone.yRotation = p.yRotation;
                clone.isParent = false;
                
                this.players.push(clone);
                this.particles.spawn(OFFSET_X + clone.pixelX + GRID_SIZE/2, OFFSET_Y + clone.pixelY + GRID_SIZE/2, 20, '#60a5fa');
                return true;
            }
        }
        return false;
    }

    removeEnemyAt(x, y) {
        const idx = this.enemies.findIndex(e => e.gridX === x && e.gridY === y);
        if (idx !== -1) {
            const e = this.enemies[idx];
            this.enemies.splice(idx, 1);
            
            // Spawn kill particles
            const color = e.isEntangled ? COLOR_ENEMY_ENTANGLED : COLOR_ENEMY;
            this.particles.spawn(OFFSET_X + e.pixelX + GRID_SIZE/2, OFFSET_Y + e.pixelY + GRID_SIZE/2, 30, color);
            
            if (e.isEntangled) {
                this.recentlyKilledEntangled.push(e);
            }
        }
    }

    checkCollisions() {
        if (this.gameOver || this.gameWin) return;
        
        this.players.forEach(p => {
            const idx = this.enemies.findIndex(e => p.gridX === e.gridX && p.gridY === e.gridY);
            if (idx !== -1) {
                this.triggerGameOver(p);
            }
        });
    }

    triggerGameOver(p) {
        this.gameOver = true;
        this.gameOverScreen.querySelector('h1').innerText = "YOU DIED";
        this.gameOverScreen.querySelector('p').innerText = "Press R to Retry, ESC to Quit";
        
        if (p) this.particles.spawn(OFFSET_X + p.pixelX + GRID_SIZE/2, OFFSET_Y + p.pixelY + GRID_SIZE/2, 50, COLOR_PLAYER);
        this.players = [];
        
        // Delay the game over screen so the death particles play out fully (1 second)
        setTimeout(() => {
            this.gameOverScreen.classList.remove('hidden');
        }, 1000);
    }

    triggerWin() {
        this.gameWin = true;
        if (this.currentLevelIndex + 1 >= this.unlockedLevels && this.currentLevelIndex + 1 < GameLevels.length) {
            this.unlockedLevels = this.currentLevelIndex + 2; // Unlock next level
        }
        
        let promptText = "Press R for Next Level, ESC for Menu";
        if (this.currentLevelIndex === GameLevels.length - 1) {
            promptText = "GAME BEATEN! Press ESC for Menu";
        }
        
        this.winScreen.querySelector('p').innerText = promptText;
        
        // Delay the win screen so the kill particles play out fully
        setTimeout(() => {
            this.winScreen.classList.remove('hidden');
        }, 600);
    }

    getFaceClass(fType) {
        switch(fType) {
            case FaceType.RED: return 'face-red';
            case FaceType.BLUE: return 'face-blue';
            case FaceType.GREEN: return 'face-green';
            default: return 'face-inert';
        }
    }

    updateUI() {
        if (this.players.length > 0) {
            const p = this.players[0]; // Take parent essentially
            const face = p.faces.top;
            this.uiFaceName.innerText = FaceDisplayName[face];
            
            // Update color and icon
            let color = '#e2e8f0';
            let iconSvg = '';
            
            if (face === FaceType.RED) {
                color = '#f87171';
                iconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="%23f87171" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>`;
            } else if (face === FaceType.BLUE) {
                color = '#60a5fa';
                iconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="%2360a5fa" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>`;
            } else if (face === FaceType.GREEN) {
                color = '#4ade80';
                iconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="%234ade80" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>`;
            } else {
                iconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="%23e2e8f0" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>`;
            }
            
            this.uiFaceName.style.color = color;
            this.uiFaceIcon.style.backgroundImage = `url('${iconSvg}')`;
            
            // Generate Predictions
            // What face is on top if we move in a direction?
            const predUp = { ...p.faces };
            predUp.top = p.faces.front;

            const predDown = { ...p.faces };
            predDown.top = p.faces.back;

            const predLeft = { ...p.faces };
            predLeft.top = p.faces.right;

            const predRight = { ...p.faces };
            predRight.top = p.faces.left;

            if (this.predUp) {
                this.predUp.innerText = FaceDisplayName[predUp.top];
                this.predUp.className = this.getFaceClass(predUp.top);
            }
            if (this.predDown) {
                this.predDown.innerText = FaceDisplayName[predDown.top];
                this.predDown.className = this.getFaceClass(predDown.top);
            }
            if (this.predLeft) {
                this.predLeft.innerText = FaceDisplayName[predLeft.top];
                this.predLeft.className = this.getFaceClass(predLeft.top);
            }
            if (this.predRight) {
                this.predRight.innerText = FaceDisplayName[predRight.top];
                this.predRight.className = this.getFaceClass(predRight.top);
            }

            // Update 3D static visual (Fixed isometric perspective)
            const cubeEl = document.getElementById('cube');
            if (cubeEl) {
                // Set face colors dynamically based on the current logical state
                document.querySelector('.cube-top').className = `cube-face cube-top ${this.getFaceClass(p.faces.top)}`;
                document.querySelector('.cube-front').className = `cube-face cube-front ${this.getFaceClass(p.faces.front)}`;
                document.querySelector('.cube-right').className = `cube-face cube-right ${this.getFaceClass(p.faces.right)}`;
            }
        }
        
        let msg = GameLevels[this.currentLevelIndex] 
            ? GameLevels[this.currentLevelIndex].instruction 
            : "WASD/ARROWS: Roll | SPACE: Ability";
            
        if (this.collapseMode) msg = "COLLAPSE: Select Real Cube (Arrows) -> SPACE";
        else if (this.dashSelectionMode) msg = "DASH: Select Direction (Arrows) | SPACE/ESC to Cancel";
        else if (this.tunnelSelectionMode) msg = "TUNNEL: Select Direction (Arrows) | SPACE/ESC to Cancel";
        else if (this.players.length > 1) msg = "ENTANGLED: SPACE to Collapse";
        
        this.uiInstructions.innerText = msg;
    }

    update(dt) {
        if (this.inMenu) return;
        this.handleEvents();
        
        // Sync clones directly to the parent's exact logic state
        const parent = this.players.find(p => p.isParent);
        if (parent) {
            this.players.forEach(p => {
                if (!p.isParent) {
                    p.faces = { ...parent.faces };
                    p.yRotation = parent.yRotation;
                }
            });
        }
        
        if (!this.gameOver && !this.gameWin) {
            this.players.forEach(p => p.update(dt, this.particles));
            
            // Only check collisions when not moving (arrived at tile)
            if (!this.players.some(p => p.isMoving)) {
                this.checkCollisions();
                
                // Win check: If all enemies are dead AFTER movement is complete
                if (this.enemies.length === 0 && !this.gameWin && !this.gameOver) {
                    this.triggerWin();
                }
            }
        }
        
        this.particles.update(dt);
        this.updateUI();
        
        // Reset hit keys
        for(let k in this.keys) {
            if (!this.keys[k]) this.prevKeys[k] = false;
        }
    }

    draw() {
        this.ctx.fillStyle = COLOR_BG;
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        if (this.inMenu) return;
        
        this.grid.draw(this.ctx, OFFSET_X, OFFSET_Y);
        
        this.enemies.forEach(e => e.draw(this.ctx, OFFSET_X, OFFSET_Y));
        
        this.players.forEach((p, idx) => {
            p.draw(this.ctx, OFFSET_X, OFFSET_Y, true, this.players.length);
        });
        
        this.particles.draw(this.ctx);
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        // Cap dt to avoid large jumps if tab is inactive
        this.update(Math.min(dt, 0.1)); 
        this.draw();
        
        requestAnimationFrame((t) => this.loop(t));
    }
}

// Start Game
window.onload = () => {
    new Game();
};
