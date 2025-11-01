import { Node } from 'cc';
import { Gem } from './Gem';

/**
 * GRAVITY MANAGER
 * 
 * Handles all gravity-related operations for the Match-3 game.
 * Manages how gems fall in different directions based on board rotation.
 * 
 * ALGORITHM:
 * 1. Collect all existing gems in a row/column (only from playable cells)
 * 2. Clear the row/column temporarily
 * 3. Place gems compacted toward the gravity direction (only in playable cells)
 * 4. Animate gems to new positions
 * 
 * This "collect and place" approach ensures gems move in exactly ONE pass,
 * avoiding multiple iterations and visual glitches.
 */

export class GravityManager {
    private grid: Node[][];
    private playablePattern: number[][];
    private rows: number;
    private cols: number;
    private animateCallback: (gem: Node, row: number, col: number) => Promise<void>;
    
    constructor(
        grid: Node[][], 
        playablePattern: number[][], 
        rows: number, 
        cols: number,
        animateCallback: (gem: Node, row: number, col: number) => Promise<void>
    ) {
        this.grid = grid;
        this.playablePattern = playablePattern;
        this.rows = rows;
        this.cols = cols;
        this.animateCallback = animateCallback;
    }
    
    private isPlayableCell(row: number, col: number): boolean {
        return this.playablePattern[row][col] === 1;
    }
    
    private isBlockedCell(row: number, col: number): boolean {
        return this.playablePattern[row][col] === 0;
    }
    
    /**
     * APPLY DOWN GRAVITY (0°)
     * Gems fall toward row 0 (bottom of screen)
     */
    async applyDown(): Promise<boolean> {
        let anyMoved = false;
        const promises: Promise<void>[] = [];
        
        for (let col = 0; col < this.cols; col++) {
            // Step 1: Collect all gems from PLAYABLE cells only
            const gems: { gem: Node, originalRow: number }[] = [];
            for (let row = 0; row < this.rows; row++) {
                if (this.grid[row][col] && this.isPlayableCell(row, col)) {
                    gems.push({ gem: this.grid[row][col], originalRow: row });
                }
            }
            
            if (gems.length === 0) continue;
            
            // Step 2: Clear all PLAYABLE cells in this column
            for (let row = 0; row < this.rows; row++) {
                if (this.isPlayableCell(row, col)) {
                    this.grid[row][col] = null;
                }
            }
            
            // Step 3: Find first playable cell from bottom
            let writeRow = -1;
            for (let row = 0; row < this.rows; row++) {
                if (this.isPlayableCell(row, col)) {
                    writeRow = row;
                    break;
                }
            }
            
            if (writeRow === -1) continue;
            
            // Step 4: Place gems bottom-up in PLAYABLE cells only
            for (const { gem, originalRow } of gems) {
                if (writeRow === -1 || writeRow >= this.rows) break;
                
                this.grid[writeRow][col] = gem;
                const gemComp = gem.getComponent(Gem);
                gemComp.row = writeRow;
                gemComp.col = col;
                
                if (writeRow !== originalRow) {
                    anyMoved = true;
                    promises.push(this.animateCallback(gem, writeRow, col));
                }
                
                // Find next playable cell
                writeRow++;
                while (writeRow < this.rows && this.isBlockedCell(writeRow, col)) {
                    writeRow++;
                }
            }
        }
        
        if (promises.length > 0) await Promise.all(promises);
        return anyMoved;
    }
    
    /**
     * APPLY LEFT GRAVITY (90°)
     * Gems fall toward col 0 (left side)
     */
    async applyLeft(): Promise<boolean> {
        let anyMoved = false;
        const promises: Promise<void>[] = [];
        
        for (let row = 0; row < this.rows; row++) {
            const gems: { gem: Node, originalCol: number }[] = [];
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col] && this.isPlayableCell(row, col)) {
                    gems.push({ gem: this.grid[row][col], originalCol: col });
                }
            }
            
            if (gems.length === 0) continue;
            
            for (let col = 0; col < this.cols; col++) {
                if (this.isPlayableCell(row, col)) {
                    this.grid[row][col] = null;
                }
            }
            
            let writeCol = -1;
            for (let col = 0; col < this.cols; col++) {
                if (this.isPlayableCell(row, col)) {
                    writeCol = col;
                    break;
                }
            }
            
            if (writeCol === -1) continue;
            
            for (const { gem, originalCol } of gems) {
                if (writeCol === -1 || writeCol >= this.cols) break;
                
                this.grid[row][writeCol] = gem;
                const gemComp = gem.getComponent(Gem);
                gemComp.row = row;
                gemComp.col = writeCol;
                
                if (writeCol !== originalCol) {
                    anyMoved = true;
                    promises.push(this.animateCallback(gem, row, writeCol));
                }
                
                writeCol++;
                while (writeCol < this.cols && this.isBlockedCell(row, writeCol)) {
                    writeCol++;
                }
            }
        }
        
        if (promises.length > 0) await Promise.all(promises);
        return anyMoved;
    }
    
    /**
     * APPLY UP GRAVITY (180°)
     * Gems fall toward row (rows-1) (top of screen)
     * 
     * Algorithm: Compact all gems toward the TOP of each column
     */
    async applyUp(): Promise<boolean> {
        let anyMoved = false;
        const promises: Promise<void>[] = [];
        
        for (let col = 0; col < this.cols; col++) {
            // Collect all playable cell indices in this column (top to bottom)
            const playableCells: number[] = [];
            for (let row = 0; row < this.rows; row++) {
                if (this.isPlayableCell(row, col)) {
                    playableCells.push(row);
                }
            }
            
            if (playableCells.length === 0) continue;
            
            // Collect all gems from these playable cells
            const gems: { gem: Node, originalRow: number }[] = [];
            for (const row of playableCells) {
                if (this.grid[row][col]) {
                    gems.push({ gem: this.grid[row][col], originalRow: row });
                    this.grid[row][col] = null; // Clear temporarily
                }
            }
            
            if (gems.length === 0) continue;
            
            // Place gems at the TOP of playable cells
            // Start from highest playable cell and work down
            const startIndex = playableCells.length - 1; // Highest cell
            for (let i = 0; i < gems.length; i++) {
                const targetCellIndex = startIndex - i;
                if (targetCellIndex < 0) break; // No more space
                
                const targetRow = playableCells[targetCellIndex];
                const { gem, originalRow } = gems[i];
                
                this.grid[targetRow][col] = gem;
                const gemComp = gem.getComponent(Gem);
                gemComp.row = targetRow;
                gemComp.col = col;
                
                if (targetRow !== originalRow) {
                    anyMoved = true;
                    promises.push(this.animateCallback(gem, targetRow, col));
                }
            }
        }
        
        if (promises.length > 0) await Promise.all(promises);
        return anyMoved;
    }
    
    /**
     * APPLY RIGHT GRAVITY (270°)
     * Gems fall toward col (cols-1) (right side)
     * 
     * Algorithm: Compact all gems toward the RIGHT of each row
     */
    async applyRight(): Promise<boolean> {
        let anyMoved = false;
        const promises: Promise<void>[] = [];
        
        for (let row = 0; row < this.rows; row++) {
            // Collect all playable cell indices in this row (left to right)
            const playableCells: number[] = [];
            for (let col = 0; col < this.cols; col++) {
                if (this.isPlayableCell(row, col)) {
                    playableCells.push(col);
                }
            }
            
            if (playableCells.length === 0) continue;
            
            // Collect all gems from these playable cells
            const gems: { gem: Node, originalCol: number }[] = [];
            for (const col of playableCells) {
                if (this.grid[row][col]) {
                    gems.push({ gem: this.grid[row][col], originalCol: col });
                    this.grid[row][col] = null;
                }
            }
            
            if (gems.length === 0) continue;
            
            // Place gems at the RIGHT of playable cells
            // Start from rightmost playable cell and work left
            const startIndex = playableCells.length - 1; // Rightmost cell
            for (let i = 0; i < gems.length; i++) {
                const targetCellIndex = startIndex - i;
                if (targetCellIndex < 0) break;
                
                const targetCol = playableCells[targetCellIndex];
                const { gem, originalCol } = gems[i];
                
                this.grid[row][targetCol] = gem;
                const gemComp = gem.getComponent(Gem);
                gemComp.row = row;
                gemComp.col = targetCol;
                
                if (targetCol !== originalCol) {
                    anyMoved = true;
                    promises.push(this.animateCallback(gem, row, targetCol));
                }
            }
        }
        
        if (promises.length > 0) await Promise.all(promises);
        return anyMoved;
    }
}