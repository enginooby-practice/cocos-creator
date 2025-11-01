import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween, Label, Color, Sprite, UITransform, SpriteFrame, Graphics } from 'cc';
import { Gem } from './Gem';
import { GravityManager } from './GravityManager';
import { MatchValidator } from './MatchValidator';
const { ccclass, property } = _decorator;

/**
 * MATCH-3 GAME - MAIN CONTROLLER
 * 
 * Coordinates all game systems: input, grid management, scoring, rotation
 * Uses utility classes for specific responsibilities:
 * - GravityManager: Handles gem falling logic
 * - MatchValidator: Detects matches and validates moves
 */

@ccclass('Match3Game')
export class Match3Game extends Component {
    
    @property(Prefab)
    gemPrefab: Prefab = null;
    
    @property(Node)
    gridContainer: Node = null;
    
    @property(Node)
    gridBackground: Node = null;
    
    @property(Label)
    scoreLabel: Label = null;
    
    @property(Label)
    rotationsLabel: Label = null;
    
    @property(Node)
    rotateLeftBtn: Node = null;
    
    @property(Node)
    rotateRightBtn: Node = null;
    
    @property([SpriteFrame])
    gemSpriteFrames: SpriteFrame[] = [];
    
    @property
    gemSize: number = 60;
    
    @property
    gemTypes: number = 5;
    
    @property
    maxRotations: number = 10;
    
    @property
    enableAutoShuffle: boolean = true;
    
    // @property({ multiline: true })
    boardPatternString: string =
    "0,0,0,1,1,1,1,0,0,0\n" +
    "0,0,1,1,1,1,1,1,0,0\n" +
    "0,1,1,1,1,1,1,1,1,0\n" +
    "1,1,1,1,1,1,1,1,1,1\n" +
    "1,1,1,1,0,0,1,1,1,1\n" +
    "1,1,1,1,0,0,1,1,1,1\n" +
    "1,1,1,1,1,1,1,1,1,1\n" +
    "0,1,1,1,1,1,1,1,1,0\n" +
    "0,0,1,1,1,1,1,1,0,0\n" +
    "0,0,0,1,1,1,1,0,0,0";
    
    private grid: Node[][] = [];
    private selectedGem: Node = null;
    private score: number = 0;
    private isProcessing: boolean = false;
    private rotationAngle: number = 0;
    private remainingRotations: number = 0;
    private playablePattern: number[][] = [];
    private rows: number = 0;
    private cols: number = 0;
    
    private gravityManager: GravityManager = null;
    private matchValidator: MatchValidator = null;
    
    private readonly GEM_COLORS = [
        new Color(255, 80, 80),
        new Color(80, 255, 80),
        new Color(80, 80, 255),
        new Color(255, 255, 80),
        new Color(255, 80, 255)
    ];
    
    start() {
        console.log('Match3Game starting...');
        
        this.remainingRotations = this.maxRotations;
        this.playablePattern = this.parsePatternString();
        
        this.rows = this.playablePattern.length;
        this.cols = this.playablePattern.length > 0 ? this.playablePattern[0].length : 0;
        
        console.log(`Grid size: ${this.rows} rows x ${this.cols} cols`);
        
        if (this.rows === 0 || this.cols === 0) {
            console.error('Invalid grid size!');
            return;
        }
        
        // Initialize utility classes
        this.gravityManager = new GravityManager(
            this.grid, 
            this.playablePattern, 
            this.rows, 
            this.cols,
            (gem, row, col) => this.animateGemToGridPosition(gem, row, col)
        );
        
        this.matchValidator = new MatchValidator(
            this.grid,
            this.playablePattern,
            this.rows,
            this.cols
        );
        
        this.createGridBackground();
        this.initializeGrid();
        this.updateScore();
        this.updateRotationsDisplay();
        this.setupRotationButtons();
        
        console.log('Match3Game initialization complete');
    }
    
    private parsePatternString(): number[][] {
        const pattern: number[][] = [];
        
        if (!this.boardPatternString || this.boardPatternString.trim() === '') {
            for (let i = 0; i < 8; i++) {
                pattern[i] = [];
                for (let j = 0; j < 8; j++) {
                    pattern[i][j] = 1;
                }
            }
            return pattern;
        }
        
        const rows = this.boardPatternString.trim().split('\n');
        
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i].trim().split(/[,\s]+/).map(val => {
                const parsed = parseInt(val.trim());
                return (isNaN(parsed) || parsed === 0) ? 0 : 1;
            });
            pattern[i] = cols;
        }
        
        const maxCols = Math.max(...pattern.map(row => row.length));
        for (let i = 0; i < pattern.length; i++) {
            while (pattern[i].length < maxCols) {
                pattern[i].push(1);
            }
        }
        
        return pattern;
    }
    
    /**
     * CREATE GRID BACKGROUND
     * Uses Graphics to draw solid colored rectangles
     */
    private createGridBackground() {
        if (!this.gridBackground) {
            console.error('Grid Background node not assigned!');
            return;
        }
        
        this.gridBackground.removeAllChildren();
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = new Node(`GridCell_${row}_${col}`);
                
                const transform = cell.addComponent(UITransform);
                transform.setContentSize(this.gemSize - 2, this.gemSize - 2);
                
                // Use Graphics to draw solid color
                const graphics = cell.addComponent(Graphics);
                const isPlayable = this.playablePattern[row][col] === 1;
                
                if (isPlayable) {
                    graphics.fillColor = new Color(200, 200, 200, 255);
                } else {
                    graphics.fillColor = new Color(40, 40, 40, 255);
                }
                
                const halfSize = (this.gemSize - 2) / 2;
                graphics.rect(-halfSize, -halfSize, this.gemSize - 2, this.gemSize - 2);
                graphics.fill();
                
                const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
                const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
                cell.setPosition(x, y, 0);
                
                this.gridBackground.addChild(cell);
            }
        }
        
        console.log(`Grid background created with ${this.gridBackground.children.length} cells`);
    }
    
    private setupRotationButtons() {
        if (this.rotateLeftBtn) {
            this.rotateLeftBtn.on(Node.EventType.TOUCH_END, () => this.rotateBoard(-90), this);
        }
        if (this.rotateRightBtn) {
            this.rotateRightBtn.on(Node.EventType.TOUCH_END, () => this.rotateBoard(90), this);
        }
    }
    
    private initializeGrid() {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            for (let row = 0; row < this.rows; row++) {
                this.grid[row] = [];
                for (let col = 0; col < this.cols; col++) {
                    if (this.playablePattern[row][col] === 0) {
                        this.grid[row][col] = null;
                        continue;
                    }
                    
                    let gemType: number;
                    let safetyCounter = 0;
                    do {
                        gemType = this.getRandomGemType();
                        safetyCounter++;
                        if (safetyCounter > 50) {
                            gemType = (gemType + 1) % this.gemTypes;
                            break;
                        }
                    } while (this.matchValidator.wouldCreateMatch(row, col, gemType));
                    
                    this.createGem(row, col, gemType);
                }
            }
            
            if (this.matchValidator.hasValidMoves()) {
                console.log(`✅ Valid board generated after ${attempts} attempts`);
                return;
            } else {
                console.log(`❌ No valid moves, regenerating...`);
                this.clearGrid();
            }
        }
    }
    
    private clearGrid() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col]) {
                    this.grid[row][col].destroy();
                    this.grid[row][col] = null;
                }
            }
        }
    }
    
    private createGem(row: number, col: number, gemType: number) {
        const gem = instantiate(this.gemPrefab);
        
        const gemComponent = gem.addComponent(Gem);
        gemComponent.type = gemType;
        gemComponent.row = row;
        gemComponent.col = col;
        
        // Always use sprite frames, no color tint
        const sprite = gem.getComponent(Sprite);
        if (sprite) {
            if (this.gemSpriteFrames && this.gemSpriteFrames.length > gemType && this.gemSpriteFrames[gemType]) {
                sprite.spriteFrame = this.gemSpriteFrames[gemType];
                sprite.color = Color.WHITE; // Pure sprite, no tint
            } else {
                // Fallback to solid color if no sprite
                sprite.color = this.GEM_COLORS[gemType];
            }
        }
        
        const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
        const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
        gem.setPosition(x, y, 0);
        
        // Counter-rotate gem to keep it upright relative to world
        gem.eulerAngles = new Vec3(0, 0, -this.gridContainer.eulerAngles.z);
        
        gem.on(Node.EventType.TOUCH_END, this.onGemClicked, this);
        
        this.gridContainer.addChild(gem);
        this.grid[row][col] = gem;
    }
    
    private onGemClicked(event: any) {
        if (this.isProcessing) return;
        
        const clickedGem = event.target;
        
        if (!this.selectedGem) {
            this.selectedGem = clickedGem;
            this.highlightGem(clickedGem, true);
            return;
        }
        
        if (this.selectedGem === clickedGem) {
            this.highlightGem(this.selectedGem, false);
            this.selectedGem = null;
            return;
        }
        
        const gem1 = this.selectedGem.getComponent(Gem);
        const gem2 = clickedGem.getComponent(Gem);
        
        if (this.areAdjacent(gem1.row, gem1.col, gem2.row, gem2.col)) {
            this.highlightGem(this.selectedGem, false);
            this.swapGems(this.selectedGem, clickedGem);
            this.selectedGem = null;
        } else {
            this.highlightGem(this.selectedGem, false);
            this.selectedGem = clickedGem;
            this.highlightGem(clickedGem, true);
        }
    }
    
    private areAdjacent(row1: number, col1: number, row2: number, col2: number): boolean {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    
    private async swapGems(gem1: Node, gem2: Node) {
        this.isProcessing = true;
        
        const comp1 = gem1.getComponent(Gem);
        const comp2 = gem2.getComponent(Gem);
        
        const tempRow = comp1.row;
        const tempCol = comp1.col;
        
        comp1.row = comp2.row;
        comp1.col = comp2.col;
        comp2.row = tempRow;
        comp2.col = tempCol;
        
        this.grid[comp1.row][comp1.col] = gem1;
        this.grid[comp2.row][comp2.col] = gem2;
        
        await this.animateSwap(gem1, gem2);
        
        const matches = this.matchValidator.findAllMatches();
        
        if (matches.length > 0) {
            await this.processMatches(matches);
            await this.checkAndShuffleIfNoMoves();
        } else {
            const tempRow2 = comp1.row;
            const tempCol2 = comp1.col;
            
            comp1.row = comp2.row;
            comp1.col = comp2.col;
            comp2.row = tempRow2;
            comp2.col = tempCol2;
            
            this.grid[comp1.row][comp1.col] = gem1;
            this.grid[comp2.row][comp2.col] = gem2;
            
            await this.animateSwap(gem1, gem2);
        }
        
        this.isProcessing = false;
    }
    
    private animateSwap(gem1: Node, gem2: Node): Promise<void> {
        return new Promise((resolve) => {
            const pos1 = gem1.position.clone();
            const pos2 = gem2.position.clone();
            
            let completed = 0;
            const onComplete = () => {
                completed++;
                if (completed === 2) resolve();
            };
            
            tween(gem1).to(0.3, { position: pos2 }).call(onComplete).start();
            tween(gem2).to(0.3, { position: pos1 }).call(onComplete).start();
        });
    }
    
    private async rotateBoard(degrees: number) {
        if (this.isProcessing || this.remainingRotations <= 0) return;
        
        this.isProcessing = true;
        this.remainingRotations--;
        this.updateRotationsDisplay();
        
        this.rotationAngle = (this.rotationAngle + degrees + 360) % 360;
        
        // Rotate container AND all gems
        await this.animateRotation(degrees);
        await this.applyGravity();
        
        const matches = this.matchValidator.findAllMatches();
        if (matches.length > 0) {
            await this.processMatches(matches);
        }
        
        await this.checkAndShuffleIfNoMoves();
        
        this.isProcessing = false;
    }
    
    private animateRotation(degrees: number): Promise<void> {
        return new Promise((resolve) => {
            const currentRotation = this.gridContainer.eulerAngles.clone();
            const targetRotation = currentRotation.clone();
            targetRotation.z += degrees;
            
            // Rotate container
            tween(this.gridContainer)
                .to(0.5, { eulerAngles: targetRotation })
                .call(() => {
                    // Counter-rotate all gems to keep them upright
                    for (let row = 0; row < this.rows; row++) {
                        for (let col = 0; col < this.cols; col++) {
                            if (this.grid[row][col]) {
                                this.grid[row][col].eulerAngles = new Vec3(0, 0, -targetRotation.z);
                            }
                        }
                    }
                    resolve();
                })
                .start();
        });
    }
    
    /**
     * APPLY GRAVITY
     * Single pass compact, then fill once
     * NO multiple passes - gems spawn in correct positions
     */
    private async applyGravity(): Promise<void> {
        console.log(`Starting gravity (angle: ${this.rotationAngle}°)`);
        
        // Step 1: Compact existing gems ONE TIME
        let moved = false;
        switch (this.rotationAngle) {
            case 0:
                moved = await this.gravityManager.applyDown();
                break;
            case 90:
                moved = await this.gravityManager.applyLeft();
                break;
            case 180:
                moved = await this.gravityManager.applyUp();
                break;
            case 270:
                moved = await this.gravityManager.applyRight();
                break;
        }
        
        console.log(`Compact complete: moved = ${moved}`);
        
        // Step 2: Fill empty spaces
        // New gems are created already in their final positions
        console.log(`Filling empty spaces...`);
        await this.fillEmptySpaces();
        
        console.log(`Gravity complete`);
    }
    
    private async processMatches(matches: Node[]) {
        this.score += matches.length * 10;
        this.updateScore();
        
        await this.removeGems(matches);
        await this.applyGravity();
        
        const newMatches = this.matchValidator.findAllMatches();
        if (newMatches.length > 0) {
            await this.processMatches(newMatches);
        }
    }
    
    private removeGems(gems: Node[]): Promise<void> {
        return new Promise((resolve) => {
            let completed = 0;
            
            for (const gem of gems) {
                const comp = gem.getComponent(Gem);
                this.grid[comp.row][comp.col] = null;
                
                tween(gem)
                    .to(0.3, { scale: new Vec3(0, 0, 0) })
                    .call(() => {
                        gem.destroy();
                        completed++;
                        if (completed === gems.length) resolve();
                    })
                    .start();
            }
        });
    }
    
    private async fillEmptySpaces(): Promise<void> {
        const promises = [];
        
        switch (this.rotationAngle) {
            case 0:
                promises.push(...this.fillFromTop());
                break;
            case 90:
                promises.push(...this.fillFromRight());
                break;
            case 180:
                promises.push(...this.fillFromBottom());
                break;
            case 270:
                promises.push(...this.fillFromLeft());
                break;
        }
        
        await Promise.all(promises);
    }
    
    private fillFromTop(): Promise<void>[] {
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            // Find all empty playable cells in this column
            const emptyCells: number[] = [];
            for (let row = 0; row < this.rows; row++) {
                if (this.isPlayableCell(row, col) && !this.grid[row][col]) {
                    emptyCells.push(row);
                }
            }
            
            // Create gems for each empty cell
            for (const row of emptyCells) {
                const gemType = this.getRandomGemType();
                this.createGem(row, col, gemType);
                
                const gem = this.grid[row][col];
                const targetY = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
                const startY = (this.rows / 2 + 3) * this.gemSize;
                gem.setPosition(gem.position.x, startY, 0);
                
                promises.push(this.animateGemToGridPosition(gem, row, col));
            }
        }
        
        return promises;
    }
    
    private fillFromRight(): Promise<void>[] {
        const promises = [];
        
        for (let row = 0; row < this.rows; row++) {
            const emptyCells: number[] = [];
            for (let col = 0; col < this.cols; col++) {
                if (this.isPlayableCell(row, col) && !this.grid[row][col]) {
                    emptyCells.push(col);
                }
            }
            
            for (const col of emptyCells) {
                const gemType = this.getRandomGemType();
                this.createGem(row, col, gemType);
                
                const gem = this.grid[row][col];
                const targetX = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
                const startX = (this.cols / 2 + 3) * this.gemSize;
                gem.setPosition(startX, gem.position.y, 0);
                
                promises.push(this.animateGemToGridPosition(gem, row, col));
            }
        }
        
        return promises;
    }
    
    private fillFromBottom(): Promise<void>[] {
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            const emptyCells: number[] = [];
            for (let row = 0; row < this.rows; row++) {
                if (this.isPlayableCell(row, col) && !this.grid[row][col]) {
                    emptyCells.push(row);
                }
            }
            
            for (const row of emptyCells) {
                const gemType = this.getRandomGemType();
                this.createGem(row, col, gemType);
                
                const gem = this.grid[row][col];
                const targetY = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
                const startY = -(this.rows / 2 + 3) * this.gemSize;
                gem.setPosition(gem.position.x, startY, 0);
                
                promises.push(this.animateGemToGridPosition(gem, row, col));
            }
        }
        
        return promises;
    }
    
    private fillFromLeft(): Promise<void>[] {
        const promises = [];
        
        for (let row = 0; row < this.rows; row++) {
            const emptyCells: number[] = [];
            for (let col = 0; col < this.cols; col++) {
                if (this.isPlayableCell(row, col) && !this.grid[row][col]) {
                    emptyCells.push(col);
                }
            }
            
            for (const col of emptyCells) {
                const gemType = this.getRandomGemType();
                this.createGem(row, col, gemType);
                
                const gem = this.grid[row][col];
                const targetX = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
                const startX = -(this.cols / 2 + 3) * this.gemSize;
                gem.setPosition(startX, gem.position.y, 0);
                
                promises.push(this.animateGemToGridPosition(gem, row, col));
            }
        }
        
        return promises;
    }
    
    private isPlayableCell(row: number, col: number): boolean {
        return this.playablePattern[row] && this.playablePattern[row][col] === 1;
    }
    
    private animateGemToGridPosition(gem: Node, row: number, col: number): Promise<void> {
        return new Promise((resolve) => {
            const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
            const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
            
            tween(gem)
                .to(0.2, { position: new Vec3(x, y, 0) })
                .call(() => resolve())
                .start();
        });
    }
    
    private async checkAndShuffleIfNoMoves() {
        if (this.enableAutoShuffle && !this.matchValidator.hasValidMoves()) {
            console.log('⚠️ No valid moves, shuffling...');
            await this.shuffleBoard();
        }
    }
    
    private async shuffleBoard() {
        console.log('🔀 Shuffling board...');
        
        const gems: { type: number }[] = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col] && this.playablePattern[row][col] === 1) {
                    gems.push({ type: this.grid[row][col].getComponent(Gem).type });
                }
            }
        }
        
        // Fisher-Yates shuffle
        for (let i = gems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gems[i], gems[j]] = [gems[j], gems[i]];
        }
        
        let attempts = 0;
        while (attempts < 50) {
            attempts++;
            let gemIndex = 0;
            let hasMatch = false;
            
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    if (this.grid[row][col]) {
                        this.grid[row][col].destroy();
                        this.grid[row][col] = null;
                    }
                }
            }
            
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    if (this.playablePattern[row][col] === 0 || gemIndex >= gems.length) continue;
                    
                    const gemType = gems[gemIndex].type;
                    
                    if (this.matchValidator.wouldCreateMatch(row, col, gemType)) {
                        hasMatch = true;
                        break;
                    }
                    
                    this.createGem(row, col, gemType);
                    gemIndex++;
                }
                if (hasMatch) break;
            }
            
            if (!hasMatch && this.matchValidator.hasValidMoves()) {
                console.log(`✅ Shuffled successfully`);
                return;
            }
            
            for (let i = gems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [gems[i], gems[j]] = [gems[j], gems[i]];
            }
        }
    }
    
    private highlightGem(gem: Node, highlight: boolean) {
        const targetScale = highlight ? 1.2 : 1;
        tween(gem).to(0.1, { scale: new Vec3(targetScale, targetScale, 1) }).start();
    }
    
    private getRandomGemType(): number {
        return Math.floor(Math.random() * this.gemTypes);
    }
    
    private updateScore() {
        if (this.scoreLabel) {
            this.scoreLabel.string = `Score: ${this.score}`;
        }
    }
    
    private updateRotationsDisplay() {
        if (this.rotationsLabel) {
            this.rotationsLabel.string = `Rotations: ${this.remainingRotations}`;
        }
    }
}