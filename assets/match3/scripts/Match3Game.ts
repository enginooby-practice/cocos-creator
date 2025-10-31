import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween, Label, Color, Sprite, UITransform } from 'cc';
import { Gem } from './Gem';
const { ccclass, property } = _decorator;

/**
 * MATCH-3 GAME CONTROLLER WITH ROTATING BOARD
 * 
 * Enhanced match-3 game with gravity direction changes via board rotation.
 * Players can rotate the entire board 90 degrees to change where gems fall.
 * 
 * NEW FEATURES:
 * - Rotating board mechanic (Left/Right rotation buttons)
 * - Dynamic gravity based on rotation angle
 * - Visual grid board background
 * - Limited rotations per level for strategy
 * 
 * ROTATION ANGLES:
 * 0° = Down gravity (normal)
 * 90° = Left gravity
 * 180° = Up gravity
 * 270° = Right gravity
 */

@ccclass('Match3Game')
export class Match3Game extends Component {
    
    // PROPERTIES - Visible in Cocos Creator editor
    
    @property(Prefab)
    gemPrefab: Prefab = null;
    
    @property(Node)
    gridContainer: Node = null; // Container that rotates
    
    @property(Node)
    gridBackground: Node = null; // Visual grid (doesn't rotate)
    
    @property(Label)
    scoreLabel: Label = null;
    
    @property(Label)
    rotationsLabel: Label = null; // Shows remaining rotations
    
    @property(Node)
    rotateLeftBtn: Node = null; // Button to rotate left
    
    @property(Node)
    rotateRightBtn: Node = null; // Button to rotate right
    
    @property
    rows: number = 8;
    
    @property
    cols: number = 8;
    
    @property
    gemSize: number = 60;
    
    @property
    gemTypes: number = 5;
    
    @property
    maxRotations: number = 10; // Limited rotations per game
    
    // PRIVATE VARIABLES
    
    private grid: Node[][] = [];
    private selectedGem: Node = null;
    private score: number = 0;
    private isProcessing: boolean = false;
    private rotationAngle: number = 0; // Current board rotation (0, 90, 180, 270)
    private remainingRotations: number = 0;
    
    /**
     * GEM COLORS - 5 distinct colors for visual clarity
     */
    private readonly GEM_COLORS = [
        new Color(255, 80, 80),     // 0 = Red
        new Color(80, 255, 80),     // 1 = Green
        new Color(80, 80, 255),     // 2 = Blue
        new Color(255, 255, 80),    // 3 = Yellow
        new Color(255, 80, 255)     // 4 = Purple
    ];
    
    /**
     * START - Initialize the game
     */
    start() {
        this.remainingRotations = this.maxRotations;
        this.createGridBackground();
        this.initializeGrid();
        this.updateScore();
        this.updateRotationsDisplay();
        this.setupRotationButtons();
    }
    
    /**
     * CREATE GRID BACKGROUND
     * Creates a visual grid with lines to show the playing field
     */
    private createGridBackground() {
        if (!this.gridBackground) return;
        
        // Create a simple colored background for each cell
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = new Node('GridCell');
                const sprite = cell.addComponent(Sprite);
                
                // Checkerboard pattern
                const isDark = (row + col) % 2 === 0;
                sprite.color = isDark ? new Color(40, 40, 40) : new Color(60, 60, 60);
                
                // Set size
                const transform = cell.addComponent(UITransform);
                transform.setContentSize(this.gemSize - 2, this.gemSize - 2);
                
                // Position in grid
                const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
                const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
                cell.setPosition(x, y, 0);
                
                this.gridBackground.addChild(cell);
            }
        }
    }
    
    /**
     * SETUP ROTATION BUTTONS
     * Add click handlers to rotation buttons
     */
    private setupRotationButtons() {
        if (this.rotateLeftBtn) {
            this.rotateLeftBtn.on(Node.EventType.TOUCH_END, () => this.rotateBoard(-90), this);
        }
        
        if (this.rotateRightBtn) {
            this.rotateRightBtn.on(Node.EventType.TOUCH_END, () => this.rotateBoard(90), this);
        }
    }
    
    /**
     * ROTATE BOARD
     * Rotates the entire board by 90 degrees and changes gravity direction
     * 
     * @param degrees - Rotation amount (+90 for right, -90 for left)
     */
    private async rotateBoard(degrees: number) {
        // Check if we can rotate
        if (this.isProcessing || this.remainingRotations <= 0) return;
        
        this.isProcessing = true;
        this.remainingRotations--;
        this.updateRotationsDisplay();
        
        // Update rotation angle (keep between 0-359)
        this.rotationAngle = (this.rotationAngle + degrees + 360) % 360;
        
        // Animate the rotation
        await this.animateRotation(degrees);
        
        // Apply gravity in the new direction
        await this.applyGravity();
        
        // Check for matches after gravity settles
        const matches = this.findAllMatches();
        if (matches.length > 0) {
            await this.processMatches(matches);
        }
        
        this.isProcessing = false;
    }
    
    /**
     * ANIMATE ROTATION
     * Smoothly rotates the grid container visually
     */
    private animateRotation(degrees: number): Promise<void> {
        return new Promise((resolve) => {
            const currentRotation = this.gridContainer.eulerAngles.clone();
            const targetRotation = currentRotation.clone();
            targetRotation.z += degrees;
            
            tween(this.gridContainer)
                .to(0.5, { eulerAngles: targetRotation })
                .call(() => resolve())
                .start();
        });
    }
    
    /**
     * APPLY GRAVITY
     * Makes gems fall in the direction determined by current rotation
     * 
     * GRAVITY DIRECTIONS:
     * 0° = Down (normal)
     * 90° = Left
     * 180° = Up
     * 270° = Right
     */
    private async applyGravity(): Promise<void> {
        let moved = false;
        
        // Determine gravity direction based on rotation
        switch (this.rotationAngle) {
            case 0:   // Down gravity
                moved = await this.applyDownGravity();
                break;
            case 90:  // Left gravity
                moved = await this.applyLeftGravity();
                break;
            case 180: // Up gravity
                moved = await this.applyUpGravity();
                break;
            case 270: // Right gravity
                moved = await this.applyRightGravity();
                break;
        }
        
        // If gems moved, fill empty spaces and check again
        if (moved) {
            await this.fillEmptySpaces();
            // Recursively apply gravity until no more movement
            await this.applyGravity();
        }
    }
    
    /**
     * APPLY DOWN GRAVITY (Normal - 0°)
     * Gems fall downward (decreasing row index)
     */
    private async applyDownGravity(): Promise<boolean> {
        let moved = false;
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = 1; row < this.rows; row++) {
                if (!this.grid[row][col]) continue;
                
                // Find lowest empty space below
                let targetRow = row - 1;
                while (targetRow >= 0 && !this.grid[targetRow][col]) {
                    targetRow--;
                }
                targetRow++;
                
                if (targetRow !== row) {
                    // Move gem down
                    const gem = this.grid[row][col];
                    const gemComp = gem.getComponent(Gem);
                    
                    this.grid[row][col] = null;
                    this.grid[targetRow][col] = gem;
                    gemComp.row = targetRow;
                    
                    promises.push(this.animateGemToGridPosition(gem, targetRow, col));
                    moved = true;
                }
            }
        }
        
        await Promise.all(promises);
        return moved;
    }
    
    /**
     * APPLY LEFT GRAVITY (90°)
     * Gems fall to the left (decreasing col index)
     */
    private async applyLeftGravity(): Promise<boolean> {
        let moved = false;
        const promises = [];
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 1; col < this.cols; col++) {
                if (!this.grid[row][col]) continue;
                
                // Find leftmost empty space
                let targetCol = col - 1;
                while (targetCol >= 0 && !this.grid[row][targetCol]) {
                    targetCol--;
                }
                targetCol++;
                
                if (targetCol !== col) {
                    const gem = this.grid[row][col];
                    const gemComp = gem.getComponent(Gem);
                    
                    this.grid[row][col] = null;
                    this.grid[row][targetCol] = gem;
                    gemComp.col = targetCol;
                    
                    promises.push(this.animateGemToGridPosition(gem, row, targetCol));
                    moved = true;
                }
            }
        }
        
        await Promise.all(promises);
        return moved;
    }
    
    /**
     * APPLY UP GRAVITY (180°)
     * Gems fall upward (increasing row index)
     */
    private async applyUpGravity(): Promise<boolean> {
        let moved = false;
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = this.rows - 2; row >= 0; row--) {
                if (!this.grid[row][col]) continue;
                
                // Find highest empty space above
                let targetRow = row + 1;
                while (targetRow < this.rows && !this.grid[targetRow][col]) {
                    targetRow++;
                }
                targetRow--;
                
                if (targetRow !== row) {
                    const gem = this.grid[row][col];
                    const gemComp = gem.getComponent(Gem);
                    
                    this.grid[row][col] = null;
                    this.grid[targetRow][col] = gem;
                    gemComp.row = targetRow;
                    
                    promises.push(this.animateGemToGridPosition(gem, targetRow, col));
                    moved = true;
                }
            }
        }
        
        await Promise.all(promises);
        return moved;
    }
    
    /**
     * APPLY RIGHT GRAVITY (270°)
     * Gems fall to the right (increasing col index)
     */
    private async applyRightGravity(): Promise<boolean> {
        let moved = false;
        const promises = [];
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = this.cols - 2; col >= 0; col--) {
                if (!this.grid[row][col]) continue;
                
                // Find rightmost empty space
                let targetCol = col + 1;
                while (targetCol < this.cols && !this.grid[row][targetCol]) {
                    targetCol++;
                }
                targetCol--;
                
                if (targetCol !== col) {
                    const gem = this.grid[row][col];
                    const gemComp = gem.getComponent(Gem);
                    
                    this.grid[row][col] = null;
                    this.grid[row][targetCol] = gem;
                    gemComp.col = targetCol;
                    
                    promises.push(this.animateGemToGridPosition(gem, row, targetCol));
                    moved = true;
                }
            }
        }
        
        await Promise.all(promises);
        return moved;
    }
    
    /**
     * ANIMATE GEM TO GRID POSITION
     * Smoothly moves a gem to its grid coordinates
     */
    private animateGemToGridPosition(gem: Node, row: number, col: number): Promise<void> {
        return new Promise((resolve) => {
            const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
            const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
            
            tween(gem)
                .to(0.3, { position: new Vec3(x, y, 0) })
                .call(() => resolve())
                .start();
        });
    }
    
    /**
     * INITIALIZE GRID
     * Creates the initial board with no matches
     */
    private initializeGrid() {
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                let gemType: number;
                do {
                    gemType = this.getRandomGemType();
                } while (this.wouldCreateMatch(row, col, gemType));
                
                this.createGem(row, col, gemType);
            }
        }
    }
    
    /**
     * WOULD CREATE MATCH
     * Checks if placing a gem would create a match of 3+
     */
    private wouldCreateMatch(row: number, col: number, gemType: number): boolean {
        // Check horizontal
        if (col >= 2) {
            const left1Type = this.grid[row][col - 1]?.getComponent(Gem)?.type;
            const left2Type = this.grid[row][col - 2]?.getComponent(Gem)?.type;
            if (left1Type === gemType && left2Type === gemType) {
                return true;
            }
        }
        
        // Check vertical
        if (row >= 2) {
            const up1Type = this.grid[row - 1][col]?.getComponent(Gem)?.type;
            const up2Type = this.grid[row - 2][col]?.getComponent(Gem)?.type;
            if (up1Type === gemType && up2Type === gemType) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * CREATE GEM
     * Instantiates a new gem at the specified grid position
     */
    private createGem(row: number, col: number, gemType: number) {
        const gem = instantiate(this.gemPrefab);
        
        const gemComponent = gem.addComponent(Gem);
        gemComponent.type = gemType;
        gemComponent.row = row;
        gemComponent.col = col;
        
        const sprite = gem.getComponent(Sprite);
        if (sprite) {
            sprite.color = this.GEM_COLORS[gemType];
        }
        
        const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
        const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
        gem.setPosition(x, y, 0);
        
        gem.on(Node.EventType.TOUCH_END, this.onGemClicked, this);
        
        this.gridContainer.addChild(gem);
        this.grid[row][col] = gem;
    }
    
    /**
     * ON GEM CLICKED
     * Handles gem selection and swapping
     */
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
    
    /**
     * ARE ADJACENT
     * Checks if two grid positions are next to each other
     */
    private areAdjacent(row1: number, col1: number, row2: number, col2: number): boolean {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    
    /**
     * SWAP GEMS
     * Swaps two gems and checks for matches
     */
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
        
        const matches = this.findAllMatches();
        
        if (matches.length > 0) {
            await this.processMatches(matches);
        } else {
            // Invalid move - swap back
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
    
    /**
     * ANIMATE SWAP
     * Smoothly swaps positions of two gems
     */
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
    
    /**
     * FIND ALL MATCHES
     * Scans grid for all matches of 3 or more
     */
    private findAllMatches(): Node[] {
        const matches = new Set<Node>();
        
        // Horizontal matches
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols - 2; col++) {
                if (!this.grid[row][col]) continue;
                
                const type = this.grid[row][col].getComponent(Gem).type;
                let matchLength = 1;
                
                for (let i = col + 1; i < this.cols; i++) {
                    if (this.grid[row][i] && this.grid[row][i].getComponent(Gem).type === type) {
                        matchLength++;
                    } else {
                        break;
                    }
                }
                
                if (matchLength >= 3) {
                    for (let i = col; i < col + matchLength; i++) {
                        matches.add(this.grid[row][i]);
                    }
                }
            }
        }
        
        // Vertical matches
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows - 2; row++) {
                if (!this.grid[row][col]) continue;
                
                const type = this.grid[row][col].getComponent(Gem).type;
                let matchLength = 1;
                
                for (let i = row + 1; i < this.rows; i++) {
                    if (this.grid[i][col] && this.grid[i][col].getComponent(Gem).type === type) {
                        matchLength++;
                    } else {
                        break;
                    }
                }
                
                if (matchLength >= 3) {
                    for (let i = row; i < row + matchLength; i++) {
                        matches.add(this.grid[i][col]);
                    }
                }
            }
        }
        
        return Array.from(matches);
    }
    
    /**
     * PROCESS MATCHES
     * Removes matched gems and triggers chain reactions
     */
    private async processMatches(matches: Node[]) {
        this.score += matches.length * 10;
        this.updateScore();
        
        await this.removeGems(matches);
        await this.applyGravity();
        
        const newMatches = this.findAllMatches();
        if (newMatches.length > 0) {
            await this.processMatches(newMatches);
        }
    }
    
    /**
     * REMOVE GEMS
     * Destroys matched gems with animation
     */
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
    
    /**
     * FILL EMPTY SPACES
     * Creates new gems based on current gravity direction
     */
    private async fillEmptySpaces(): Promise<void> {
        const promises = [];
        
        // Fill based on rotation angle
        switch (this.rotationAngle) {
            case 0:   // Down - spawn at top
                promises.push(...this.fillFromTop());
                break;
            case 90:  // Left - spawn at right
                promises.push(...this.fillFromRight());
                break;
            case 180: // Up - spawn at bottom
                promises.push(...this.fillFromBottom());
                break;
            case 270: // Right - spawn at left
                promises.push(...this.fillFromLeft());
                break;
        }
        
        await Promise.all(promises);
    }
    
    /**
     * FILL FROM TOP (Down gravity)
     */
    private fillFromTop(): Promise<void>[] {
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = this.rows - 1; row >= 0; row--) {
                if (!this.grid[row][col]) {
                    const gemType = this.getRandomGemType();
                    this.createGem(row, col, gemType);
                    
                    const gem = this.grid[row][col];
                    const startY = (this.rows / 2 + 2) * this.gemSize;
                    gem.setPosition(gem.position.x, startY, 0);
                    
                    promises.push(this.animateGemToGridPosition(gem, row, col));
                }
            }
        }
        
        return promises;
    }
    
    /**
     * FILL FROM RIGHT (Left gravity)
     */
    private fillFromRight(): Promise<void>[] {
        const promises = [];
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = this.cols - 1; col >= 0; col--) {
                if (!this.grid[row][col]) {
                    const gemType = this.getRandomGemType();
                    this.createGem(row, col, gemType);
                    
                    const gem = this.grid[row][col];
                    const startX = (this.cols / 2 + 2) * this.gemSize;
                    gem.setPosition(startX, gem.position.y, 0);
                    
                    promises.push(this.animateGemToGridPosition(gem, row, col));
                }
            }
        }
        
        return promises;
    }
    
    /**
     * FILL FROM BOTTOM (Up gravity)
     */
    private fillFromBottom(): Promise<void>[] {
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (!this.grid[row][col]) {
                    const gemType = this.getRandomGemType();
                    this.createGem(row, col, gemType);
                    
                    const gem = this.grid[row][col];
                    const startY = -(this.rows / 2 + 2) * this.gemSize;
                    gem.setPosition(gem.position.x, startY, 0);
                    
                    promises.push(this.animateGemToGridPosition(gem, row, col));
                }
            }
        }
        
        return promises;
    }
    
    /**
     * FILL FROM LEFT (Right gravity)
     */
    private fillFromLeft(): Promise<void>[] {
        const promises = [];
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.grid[row][col]) {
                    const gemType = this.getRandomGemType();
                    this.createGem(row, col, gemType);
                    
                    const gem = this.grid[row][col];
                    const startX = -(this.cols / 2 + 2) * this.gemSize;
                    gem.setPosition(startX, gem.position.y, 0);
                    
                    promises.push(this.animateGemToGridPosition(gem, row, col));
                }
            }
        }
        
        return promises;
    }
    
    /**
     * HIGHLIGHT GEM
     * Visual feedback for selected gem
     */
    private highlightGem(gem: Node, highlight: boolean) {
        const targetScale = highlight ? 1.2 : 1;
        tween(gem).to(0.1, { scale: new Vec3(targetScale, targetScale, 1) }).start();
    }
    
    /**
     * GET RANDOM GEM TYPE
     */
    private getRandomGemType(): number {
        return Math.floor(Math.random() * this.gemTypes);
    }
    
    /**
     * UPDATE SCORE
     */
    private updateScore() {
        if (this.scoreLabel) {
            this.scoreLabel.string = `Score: ${this.score}`;
        }
    }
    
    /**
     * UPDATE ROTATIONS DISPLAY
     */
    private updateRotationsDisplay() {
        if (this.rotationsLabel) {
            this.rotationsLabel.string = `Rotations: ${this.remainingRotations}`;
        }
    }
}