/**
 * ASCII Bonsai Tree Generator
 * Inspired by cbonsai (https://gitlab.com/jallbrit/cbonsai)
 * Grows rightward for left-side positioning
 */

const BranchType = {
    TRUNK: 'trunk',
    SHOOT_LEFT: 'shootLeft',
    SHOOT_RIGHT: 'shootRight',
    DYING: 'dying',
    DEAD: 'dead'
};

const defaultConfig = {
    lifeStart: 38,
    multiplier: 18,
    rows: 38,
    cols: 70,
    animationDelay: 40,
    leafChars: ['&', '*', '@', '#', '%', '^'],
};

class BonsaiCanvas {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = this.createEmptyGrid();
        this.colorGrid = this.createEmptyGrid();
    }

    createEmptyGrid() {
        return Array(this.rows).fill(null).map(() => Array(this.cols).fill(' '));
    }

    setChar(row, col, char, colorClass = 'branch') {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            this.grid[row][col] = char;
            this.colorGrid[row][col] = colorClass;
        }
    }

    render() {
        let html = '';
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const char = this.grid[row][col];
                const colorClass = this.colorGrid[row][col];
                if (char !== ' ') {
                    const escaped = char.replace(/&/g, '&amp;')
                                        .replace(/</g, '&lt;')
                                        .replace(/>/g, '&gt;');
                    html += `<span class="${colorClass}">${escaped}</span>`;
                } else {
                    html += ' ';
                }
            }
            html += '\n';
        }
        return html;
    }
}

class Branch {
    constructor(canvas, x, y, type, life, config) {
        this.canvas = canvas;
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = life;
        this.config = config;
        this.age = 0;
        this.dx = 0;
        this.dy = -1;
        this.shootCooldown = 0;
    }

    setDeltas() {
        const rand = Math.random();

        switch (this.type) {
            case BranchType.TRUNK:
                this.dy = -1;
                if (this.age < 4) {
                    // Start straight up, slight rightward bias
                    this.dx = rand < 0.3 ? 1 : 0;
                } else {
                    // Rightward bias: 55% right, 30% straight, 15% left
                    if (rand < 0.55) this.dx = 1;
                    else if (rand < 0.85) this.dx = 0;
                    else this.dx = -1;
                }
                break;

            case BranchType.SHOOT_LEFT:
                // Left shoots spread wide - more horizontal, less vertical
                this.dy = rand < 0.4 ? -1 : 0;
                this.dx = rand < 0.85 ? -1 : 0;
                break;

            case BranchType.SHOOT_RIGHT:
                // Right shoots spread wide - more horizontal, less vertical
                this.dy = rand < 0.4 ? -1 : 0;
                if (rand < 0.85) this.dx = 1;
                else this.dx = 0;
                break;

            case BranchType.DYING:
                this.dy = rand < 0.3 ? -1 : 0;
                // Spread out horizontally
                if (rand < 0.45) this.dx = 1;
                else if (rand < 0.9) this.dx = -1;
                else this.dx = 0;
                break;

            case BranchType.DEAD:
                this.dx = 0;
                this.dy = 0;
                break;
        }
    }

    chooseChar() {
        if (this.type === BranchType.DEAD || this.life < 4) {
            const chars = this.config.leafChars;
            return chars[Math.floor(Math.random() * chars.length)];
        }

        // Branch characters based on direction
        if (this.dx < 0 && this.dy < 0) return '\\';
        if (this.dx > 0 && this.dy < 0) return '/';
        if (this.dx < 0 && this.dy === 0) return '~';
        if (this.dx > 0 && this.dy === 0) return '~';
        if (this.dy < 0) return '|';
        return '|';
    }

    grow() {
        if (this.life <= 0) return null;

        this.setDeltas();
        const char = this.chooseChar();
        const colorClass = this.life < 4 ? 'leaf' : 'branch';

        this.canvas.setChar(this.y, this.x, char, colorClass);

        // Move
        this.x += this.dx;
        this.y += this.dy;
        this.life--;
        this.age++;
        if (this.shootCooldown > 0) this.shootCooldown--;

        const newBranches = [];

        // Spawn new branches from trunk
        if (this.type === BranchType.TRUNK && this.age > 5 && this.shootCooldown === 0) {
            const spawnChance = 0.15 * this.config.multiplier / 5;
            if (Math.random() < spawnChance && this.life > 8) {
                // Slightly favor right shoots (55% right, 45% left)
                const shootType = Math.random() < 0.55
                    ? BranchType.SHOOT_RIGHT
                    : BranchType.SHOOT_LEFT;
                const shootLife = Math.floor(this.life * (0.4 + Math.random() * 0.3));
                newBranches.push(new Branch(
                    this.canvas, this.x, this.y,
                    shootType, shootLife, this.config
                ));
                this.shootCooldown = 3;
            }
        }

        // Shoots can also branch
        if ((this.type === BranchType.SHOOT_LEFT || this.type === BranchType.SHOOT_RIGHT)
            && this.age > 3 && this.life > 6 && Math.random() < 0.1) {
            const shootLife = Math.floor(this.life * 0.5);
            newBranches.push(new Branch(
                this.canvas, this.x, this.y,
                this.type, shootLife, this.config
            ));
        }

        // Transition trunk to dying near end
        if (this.type === BranchType.TRUNK && this.life < 8 && Math.random() < 0.3) {
            this.type = BranchType.DYING;
        }

        // Spawn leaf clusters at branch ends
        if (this.life < 5 && this.type !== BranchType.DEAD) {
            for (let i = 0; i < 3; i++) {
                if (Math.random() < 0.5) {
                    const leafX = this.x + Math.floor(Math.random() * 3) - 1;
                    const leafY = this.y + Math.floor(Math.random() * 2) - 1;
                    newBranches.push(new Branch(
                        this.canvas, leafX, leafY,
                        BranchType.DEAD, 1, this.config
                    ));
                }
            }
        }

        return { alive: this.life > 0, newBranches };
    }
}

class BonsaiTree {
    constructor(container, options = {}) {
        this.container = container;
        this.config = { ...defaultConfig, ...options };
        this.canvas = new BonsaiCanvas(this.config.rows, this.config.cols);
        this.branches = [];
        this.isGrowing = false;
    }

    seed() {
        // Start trunk at bottom-left area, it will grow rightward
        const startX = 15;
        const startY = this.config.rows - 3;

        this.drawPot(startX, startY);

        const trunk = new Branch(
            this.canvas, startX, startY - 1,
            BranchType.TRUNK, this.config.lifeStart, this.config
        );
        this.branches.push(trunk);
    }

    drawPot(x, y) {
        // Simple pot at base
        const potChars = [
            '\\___/',
            ' |_| '
        ];
        for (let i = 0; i < potChars.length; i++) {
            for (let j = 0; j < potChars[i].length; j++) {
                if (potChars[i][j] !== ' ') {
                    this.canvas.setChar(y + i, x - 2 + j, potChars[i][j], 'pot');
                }
            }
        }
    }

    step() {
        if (this.branches.length === 0) return false;

        const nextBranches = [];

        for (const branch of this.branches) {
            const result = branch.grow();
            if (result) {
                if (result.alive) nextBranches.push(branch);
                nextBranches.push(...result.newBranches);
            }
        }

        this.branches = nextBranches;
        return this.branches.length > 0;
    }

    render() {
        this.container.innerHTML = this.canvas.render();
    }

    animate() {
        this.isGrowing = true;
        this.seed();

        const loop = () => {
            if (!this.isGrowing) return;

            const hasMore = this.step();
            this.render();

            if (hasMore) {
                setTimeout(() => {
                    requestAnimationFrame(loop);
                }, this.config.animationDelay);
            } else {
                this.isGrowing = false;
            }
        };

        requestAnimationFrame(loop);
    }

    reset() {
        this.isGrowing = false;
        this.branches = [];
        this.canvas = new BonsaiCanvas(this.config.rows, this.config.cols);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Only show on wide screens
    if (window.innerWidth < 1200) return;

    const container = document.querySelector('.bonsai-canvas');
    if (!container) return;

    const tree = new BonsaiTree(container);
    tree.animate();
});
