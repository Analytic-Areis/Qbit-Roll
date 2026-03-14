// levels.js

const GameLevels = [
    {
        title: "Level 1: Heisenberg's Dash",
        instruction: "Align the Red face on top, then press SPACE to select a direction and Dash. Slay the enemy.",
        hint: "Don't walk into the enemy normally! Roll around until the Red face is on top, get 2 squares away from the red sphere, and press SPACE then Arrow Key to dash through it.",
        width: 8,
        height: 8,
        player: { x: 3, y: 5 },
        enemies: [
            { x: 3, y: 1, entangled: false }
        ],
        walls: [],
        initialFaces: {
            top: 'INERT_1', front: 'RED', right: 'INERT_2', back: 'INERT_3', left: 'INERT_1', bottom: 'INERT_2'
        }
    },
    {
        title: "Level 2: The Curious Tunnel",
        instruction: "Align the Green face, press SPACE to Tunnel through the wall, then crush the enemy.",
        hint: "The gap is too narrow to reach the enemy in time. Roll until Green is on top, stand next to the gap, and press SPACE to tunnel through the wall to get the kill.",
        width: 10,
        height: 6,
        player: { x: 2, y: 3 },
        enemies: [
            { x: 8, y: 3, entangled: false },
        ],
        walls: [
            // Center wall that is 2 blocks thick
            [4, 1], [4, 2], [4, 4], // Top chunk of left column
            [5, 1], [5, 2],         // Top chunk of right column
            
            [4, 4], [4, 5],         // Bottom chunk of left column
            [5, 4], [5, 5],         // Bottom chunk of right column
            // The gap is at y=3
            
            [5, 3]                  // Additional block to force a split
        ],
        initialFaces: {
            top: 'INERT_1', front: 'RED', right: 'INERT_2', back: 'INERT_3', left: 'GREEN', bottom: 'INERT_2'
        }
    },
    {
        title: "Level 3: Ghost Protocol",
        instruction: "Align the Green face, press SPACE to pick a direction to Tunnel through the wall and then push through the enemy to kill him.",
        hint: "You share a very narrow space! Carefully roll the cube up and down to get the Green Face on top. Stand right next to the wall, press SPACE, and tunnel to the right to reach the enemy. And then rearrange your cube so that you get red while moving up or down to kill the enemy while dashing through him.",
        width: 7,
        height: 7,
        player: { x: 1, y: 3 },
        enemies: [
            { x: 5, y: 3, entangled: false }
        ],
        walls: [
            // A 1-block thick vertical wall column at x=4 separating player (x:1-3) from enemy (x:5)
            // It blocks the entire 5-tall playable height
            [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]
        ],
        initialFaces: {
            top: 'INERT_1', front: 'RED', right: 'INERT_2', back: 'INERT_3', left: 'GREEN', bottom: 'INERT_2'
        }
    },
    {
        title: "Level 4: Quantum Entanglement",
        instruction: "Cyan enemies are Entangled. You can ONLY kill them while you are Split (Blue mode).",
        hint: "Cyan enemies require you to be in two places at once cognitively. Get Blue on top, press SPACE to split. Then boldly charge one of your cubes into the Cyan enemy. Press SPACE again to collapse back when done.",
        width: 10,
        height: 7,
        player: { x: 4, y: 5 },
        enemies: [
            { x: 3, y: 2, entangled: true },
            { x: 6, y: 2, entangled: true }
        ],
        walls: [
            [4, 3], [5, 3]
        ],
        initialFaces: {
            top: 'INERT_1', front: 'RED', right: 'BLUE', back: 'INERT_3', left: 'GREEN', bottom: 'INERT_2'
        }
    },
    {
        title: "Level 5: The Quantum Enigma",
        instruction: "You know the rules. DIY: Split, Tunnel, and Dash your way to victory.",
        hint: "This is the final test! You'll need to combine all your skills: Dash (Red), Split (Blue), and Tunnel (Green) to navigate the maze and eliminate all enemies. Plan your moves carefully!",
        width: 12,
        height: 9,
        player: { x: 1, y: 4 },
        enemies: [
            { x: 6, y: 2, entangled: false },
            { x: 10, y: 2, entangled: true },
            { x: 10, y: 6, entangled: true }
        ],
        walls: [
            [3, 1], [3, 2], [3, 3], [3, 5], [3, 6], [3, 7], // Entry gate
            [5, 4], [6, 4], [7, 4], // Center divide
            [8, 2], [8, 3], [8, 5], [8, 6], // Inner chambers
            [9, 4]
        ],
        initialFaces: {
            top: 'INERT_1', front: 'RED', right: 'BLUE', back: 'INERT_3', left: 'GREEN', bottom: 'INERT_2'
        }
    }
];
