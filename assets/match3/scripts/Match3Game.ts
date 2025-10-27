import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween, Label, Color, Sprite } from 'cc';
import { Gem } from './Gem';
const { ccclass, property } = _decorator;

@ccclass('Match3Game')
export class Match3Game extends Component {
    
    @property(Prefab)
    gemPrefab: Prefab = null; // Template for creating gems
    
    @property(Node)
    gridContainer: Node = null; // Parent node that holds all gems
    
    @property(Label)
    scoreLabel: Label = null; // UI text to display score
    
    @property
    rows: number = 8; // Number of rows in the grid
    
    @property
    cols: number = 8; // Number of columns in the grid
    
    @property
    gemSize: number = 60; // Size of each gem in pixels
    
    @property
    gemTypes: number = 5; // Number of different gem colors (1-5)
    
    // PRIVATE VARIABLES - Internal game state
    
    private grid: Node[][] = []; // 2D array storing all gem nodes
    private selectedGem: Node = null; // The gem the player clicked first
    private score: number = 0; // Current score
    private isProcessing: boolean = false; // Prevents input during animations
    
    /**
     * COLORS FOR GEMS
     * Each number (0-4) represents a different gem type
     * We use colors to distinguish them visually
     */
    private readonly GEM_COLORS = [
        new Color(255, 0, 0),     // 0 = Red
        new Color(0, 255, 0),     // 1 = Green
        new Color(0, 0, 255),     // 2 = Blue
        new Color(255, 255, 0),   // 3 = Yellow
        new Color(255, 0, 255)    // 4 = Purple
    ];
    
    start() {
        this.initializeGrid();
        this.updateScore();
    }
    
    /**
     * INITIALIZE GRID
     * Creates the initial game board with random gems
     * Makes sure there are no matches at the start
     */
    private initializeGrid() {
        // Loop through each row
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = []; // Create a new array for this row
            
            // Loop through each column
            for (let col = 0; col < this.cols; col++) {
                let gemType: number;
                
                // Keep generating random gem types until we find one that doesn't create a match
                do {
                    gemType = this.getRandomGemType();
                } while (this.wouldCreateMatch(row, col, gemType));
                
                // Create the gem at this position
                this.createGem(row, col, gemType);
            }
        }
    }
    
    /**
     * WOULD CREATE MATCH
     * Checks if placing a gem type at a position would create a match of 3 or more
     * 
     * @param row - The row position
     * @param col - The column position  
     * @param gemType - The type of gem to check
     * @returns true if it would create a match, false otherwise
     */
    private wouldCreateMatch(row: number, col: number, gemType: number): boolean {
        // Check horizontal - look at the 2 gems to the left
        if (col >= 2) {
            const left1Type = this.grid[row][col - 1]?.getComponent(Gem)?.type;
            const left2Type = this.grid[row][col - 2]?.getComponent(Gem)?.type;
            if (left1Type === gemType && left2Type === gemType) {
                return true; // Would create horizontal match
            }
        }
        
        // Check vertical - look at the 2 gems above
        if (row >= 2) {
            const up1Type = this.grid[row - 1][col]?.getComponent(Gem)?.type;
            const up2Type = this.grid[row - 2][col]?.getComponent(Gem)?.type;
            if (up1Type === gemType && up2Type === gemType) {
                return true; // Would create vertical match
            }
        }
        
        return false; // Safe to place
    }
    
    /**
     * CREATE GEM
     * Creates a new gem node at the specified grid position
     * 
     * @param row - Grid row (0 to rows-1)
     * @param col - Grid column (0 to cols-1)
     * @param gemType - Type of gem (0 to gemTypes-1)
     */
    private createGem(row: number, col: number, gemType: number) {
        // Instantiate creates a copy of the prefab
        const gem = instantiate(this.gemPrefab);
        
        // Add the Gem component script to this node
        const gemComponent = gem.addComponent('Gem') as Gem;
        gemComponent.type = gemType;
        gemComponent.row = row;
        gemComponent.col = col;
        
        // Set the visual appearance (color)
        const sprite = gem.getComponent(Sprite);
        if (sprite) {
            sprite.color = this.GEM_COLORS[gemType];
        }
        
        // Calculate world position based on grid position
        // We center the grid by offsetting it
        const x = (col - this.cols / 2) * this.gemSize + this.gemSize / 2;
        const y = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
        gem.setPosition(x, y, 0);
        
        // Add click handler so player can select this gem
        gem.on(Node.EventType.TOUCH_END, this.onGemClicked, this);
        
        // Add to the scene and our grid array
        this.gridContainer.addChild(gem);
        this.grid[row][col] = gem;
    }
    
    /**
     * ON GEM CLICKED
     * Called when player clicks/touches a gem
     * Handles the selection and swapping logic
     */
    private onGemClicked(event: any) {
        // Ignore clicks while animations are playing
        if (this.isProcessing) return;
        
        const clickedGem = event.target;
        
        // If no gem is selected yet, select this one
        if (!this.selectedGem) {
            this.selectedGem = clickedGem;
            this.highlightGem(clickedGem, true);
            return;
        }
        
        // If clicking the same gem, deselect it
        if (this.selectedGem === clickedGem) {
            this.highlightGem(this.selectedGem, false);
            this.selectedGem = null;
            return;
        }
        
        // Check if gems are adjacent (next to each other)
        const gem1 = this.selectedGem.getComponent(Gem);
        const gem2 = clickedGem.getComponent(Gem);
        
        if (this.areAdjacent(gem1.row, gem1.col, gem2.row, gem2.col)) {
            // Try to swap the gems
            this.highlightGem(this.selectedGem, false);
            this.swapGems(this.selectedGem, clickedGem);
            this.selectedGem = null;
        } else {
            // Not adjacent, select the new gem instead
            this.highlightGem(this.selectedGem, false);
            this.selectedGem = clickedGem;
            this.highlightGem(clickedGem, true);
        }
    }
    
    /**
     * ARE ADJACENT
     * Checks if two grid positions are next to each other (horizontally or vertically)
     * 
     * @returns true if positions are adjacent, false otherwise
     */
    private areAdjacent(row1: number, col1: number, row2: number, col2: number): boolean {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);
        
        // Adjacent means either:
        // - Same row, 1 column apart (horizontal neighbors)
        // - Same column, 1 row apart (vertical neighbors)
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    
    /**
     * SWAP GEMS
     * Swaps two gems and checks if it creates a match
     * If no match, swaps them back
     */
    private async swapGems(gem1: Node, gem2: Node) {
        this.isProcessing = true;
        
        const comp1 = gem1.getComponent(Gem);
        const comp2 = gem2.getComponent(Gem);
        
        // Swap positions in grid array
        const tempRow = comp1.row;
        const tempCol = comp1.col;
        
        comp1.row = comp2.row;
        comp1.col = comp2.col;
        comp2.row = tempRow;
        comp2.col = tempCol;
        
        this.grid[comp1.row][comp1.col] = gem1;
        this.grid[comp2.row][comp2.col] = gem2;
        
        // Animate the swap
        await this.animateSwap(gem1, gem2);
        
        // Check for matches
        const matches = this.findAllMatches();
        
        if (matches.length > 0) {
            // Valid move - process matches
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
     * Smoothly moves two gems to each other's positions
     * Uses tweens for smooth animation
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
            
            // Tween is smooth animation from current value to target value
            tween(gem1)
                .to(0.3, { position: pos2 })
                .call(onComplete)
                .start();
                
            tween(gem2)
                .to(0.3, { position: pos1 })
                .call(onComplete)
                .start();
        });
    }
    
    /**
     * FIND ALL MATCHES
     * Scans the entire grid to find all matches of 3 or more
     * Returns an array of all gems that are part of a match
     */
    private findAllMatches(): Node[] {
        const matches = new Set<Node>(); // Set prevents duplicates
        
        // Check horizontal matches (left to right)
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols - 2; col++) {
                const type = this.grid[row][col].getComponent(Gem).type;
                
                // Count consecutive gems of same type
                let matchLength = 1;
                for (let i = col + 1; i < this.cols; i++) {
                    if (this.grid[row][i].getComponent(Gem).type === type) {
                        matchLength++;
                    } else {
                        break;
                    }
                }
                
                // If 3 or more, add all to matches
                if (matchLength >= 3) {
                    for (let i = col; i < col + matchLength; i++) {
                        matches.add(this.grid[row][i]);
                    }
                }
            }
        }
        
        // Check vertical matches (bottom to top)
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows - 2; row++) {
                const type = (this.grid[row][col].getComponent('Gem') as Gem).type;
                
                let matchLength = 1;
                for (let i = row + 1; i < this.rows; i++) {
                    if ((this.grid[i][col].getComponent('Gem') as Gem).type === type) {
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
        
        return Array.from(matches); // Convert Set to Array
    }
    
    /**
     * PROCESS MATCHES
     * Removes matched gems, adds score, and fills the grid
     * This creates the chain reaction effect
     */
    private async processMatches(matches: Node[]) {
        // Add score (10 points per gem)
        this.score += matches.length * 10;
        this.updateScore();
        
        // Remove matched gems
        await this.removeGems(matches);
        
        // Drop gems down to fill empty spaces
        await this.dropGems();
        
        // Fill empty spaces at top with new gems
        await this.fillEmptySpaces();
        
        // Check if new matches were created (chain reaction)
        const newMatches = this.findAllMatches();
        if (newMatches.length > 0) {
            // Recursively process new matches
            await this.processMatches(newMatches);
        }
    }
    
    /**
     * REMOVE GEMS
     * Destroys matched gems with a fade-out animation
     */
    private removeGems(gems: Node[]): Promise<void> {
        return new Promise((resolve) => {
            let completed = 0;
            
            for (const gem of gems) {
                const comp = gem.getComponent('Gem') as Gem;
                this.grid[comp.row][comp.col] = null; // Clear from grid
                
                // Fade out and scale down
                tween(gem)
                    .to(0.3, { 
                        scale: new Vec3(0, 0, 0),
                    })
                    .call(() => {
                        gem.destroy(); // Remove from scene
                        completed++;
                        if (completed === gems.length) resolve();
                    })
                    .start();
            }
        });
    }
    
    /**
     * DROP GEMS
     * Moves gems down to fill empty spaces below them
     */
    private async dropGems(): Promise<void> {
        const promises = [];
        
        // Process each column from bottom to top
        for (let col = 0; col < this.cols; col++) {
            let emptyRow = -1;
            
            // Find empty spaces and drop gems down
            for (let row = 0; row < this.rows; row++) {
                if (!this.grid[row][col]) {
                    // Found empty space
                    if (emptyRow === -1) emptyRow = row;
                } else if (emptyRow !== -1) {
                    // Found gem above empty space - drop it down
                    const gem = this.grid[row][col];
                    const comp = gem.getComponent('Gem') as Gem;
                    
                    // Update grid
                    this.grid[emptyRow][col] = gem;
                    this.grid[row][col] = null;
                    
                    // Update gem component
                    comp.row = emptyRow;
                    
                    // Animate drop
                    const newY = (emptyRow - this.rows / 2) * this.gemSize + this.gemSize / 2;
                    promises.push(this.animateDrop(gem, newY));
                    
                    emptyRow++;
                }
            }
        }
        
        await Promise.all(promises);
    }
    
    /**
     * ANIMATE DROP
     * Smoothly moves a gem to a new Y position
     */
    private animateDrop(gem: Node, targetY: number): Promise<void> {
        return new Promise((resolve) => {
            const currentPos = gem.position.clone();
            currentPos.y = targetY;
            
            tween(gem)
                .to(0.3, { position: currentPos })
                .call(() => resolve())
                .start();
        });
    }
    
    /**
     * FILL EMPTY SPACES
     * Creates new gems at the top to fill any remaining empty spaces
     */
    private async fillEmptySpaces(): Promise<void> {
        const promises = [];
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (!this.grid[row][col]) {
                    // Create new gem
                    const gemType = this.getRandomGemType();
                    this.createGem(row, col, gemType);
                    
                    // Start above screen and animate down
                    const gem = this.grid[row][col];
                    const startY = (this.rows / 2 + 2) * this.gemSize;
                    gem.setPosition(gem.position.x, startY, 0);
                    
                    const targetY = (row - this.rows / 2) * this.gemSize + this.gemSize / 2;
                    promises.push(this.animateDrop(gem, targetY));
                }
            }
        }
        
        await Promise.all(promises);
    }
    
    /**
     * HIGHLIGHT GEM
     * Shows visual feedback when a gem is selected
     */
    private highlightGem(gem: Node, highlight: boolean) {
        const targetScale = highlight ? 1.2 : 1;
        tween(gem)
            .to(0.1, { scale: new Vec3(targetScale, targetScale, 1) })
            .start();
    }
    
    /**
     * GET RANDOM GEM TYPE
     * Returns a random gem type number
     */
    private getRandomGemType(): number {
        return Math.floor(Math.random() * this.gemTypes);
    }
    
    /**
     * UPDATE SCORE
     * Updates the score display on screen
     */
    private updateScore() {
        if (this.scoreLabel) {
            this.scoreLabel.string = `Score: ${this.score}`;
        }
    }
}