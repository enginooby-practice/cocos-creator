import { Node } from 'cc';
import { Gem } from './Gem';

/**
 * MATCH VALIDATOR
 * 
 * Handles all match detection and board validation logic.
 * Ensures the board has no initial matches and always has valid moves.
 * 
 * MATCH DETECTION ALGORITHM:
 * 1. Scan horizontally: Check each row for 3+ consecutive same-type gems
 * 2. Scan vertically: Check each column for 3+ consecutive same-type gems
 * 3. Use Set to avoid duplicate gems in result
 * 
 * VALID MOVE DETECTION ALGORITHM:
 * 1. Try every possible horizontal swap (adjacent gems in same row)
 * 2. Try every possible vertical swap (adjacent gems in same column)
 * 3. For each swap, temporarily swap and check if it creates a match
 * 4. If any swap creates a match, board has valid moves
 */

export class MatchValidator {
    private grid: Node[][];
    private playablePattern: number[][];
    private rows: number;
    private cols: number;
    
    constructor(grid: Node[][], playablePattern: number[][], rows: number, cols: number) {
        this.grid = grid;
        this.playablePattern = playablePattern;
        this.rows = rows;
        this.cols = cols;
    }
    
    /**
     * FIND ALL MATCHES
     * Returns all gems that are part of a match (3+ in a row/column)
     */
    findAllMatches(): Node[] {
        const matches = new Set<Node>();
        
        // Horizontal matches
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols - 2; col++) {
                if (!this.grid[row][col] || this.playablePattern[row][col] === 0) continue;
                
                const type = this.grid[row][col].getComponent(Gem).type;
                let matchLength = 1;
                
                // Count consecutive matches
                for (let i = col + 1; i < this.cols; i++) {
                    if (this.playablePattern[row][i] === 0) break;
                    if (this.grid[row][i] && this.grid[row][i].getComponent(Gem).type === type) {
                        matchLength++;
                    } else {
                        break;
                    }
                }
                
                // Add all matched gems
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
                if (!this.grid[row][col] || this.playablePattern[row][col] === 0) continue;
                
                const type = this.grid[row][col].getComponent(Gem).type;
                let matchLength = 1;
                
                for (let i = row + 1; i < this.rows; i++) {
                    if (this.playablePattern[i][col] === 0) break;
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
     * WOULD CREATE MATCH
     * Checks if placing a gem type at (row, col) would create a match
     * Used during board generation to avoid initial matches
     */
    wouldCreateMatch(row: number, col: number, gemType: number): boolean {
        // Check horizontal (look at 2 gems to the left)
        if (col >= 2) {
            const left1 = this.grid[row][col - 1];
            const left2 = this.grid[row][col - 2];
            if (left1 && left2) {
                const type1 = left1.getComponent(Gem)?.type;
                const type2 = left2.getComponent(Gem)?.type;
                if (type1 === gemType && type2 === gemType) {
                    return true;
                }
            }
        }
        
        // Check vertical (look at 2 gems above)
        if (row >= 2) {
            const up1 = this.grid[row - 1][col];
            const up2 = this.grid[row - 2][col];
            if (up1 && up2) {
                const type1 = up1.getComponent(Gem)?.type;
                const type2 = up2.getComponent(Gem)?.type;
                if (type1 === gemType && type2 === gemType) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * HAS VALID MOVES
     * Returns true if at least one valid swap exists on the board
     */
    hasValidMoves(): boolean {
        // Check all horizontal swaps
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols - 1; col++) {
                if (this.isValidSwap(row, col, row, col + 1)) {
                    return true;
                }
            }
        }
        
        // Check all vertical swaps
        for (let row = 0; row < this.rows - 1; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.isValidSwap(row, col, row + 1, col)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * IS VALID SWAP
     * Returns true if swapping two gems would create a match
     */
    private isValidSwap(row1: number, col1: number, row2: number, col2: number): boolean {
        const gem1 = this.grid[row1][col1];
        const gem2 = this.grid[row2][col2];
        
        if (!gem1 || !gem2) return false;
        if (this.playablePattern[row1][col1] === 0 || this.playablePattern[row2][col2] === 0) return false;
        
        const type1 = gem1.getComponent(Gem).type;
        const type2 = gem2.getComponent(Gem).type;
        
        // Temporarily swap
        this.grid[row1][col1] = gem2;
        this.grid[row2][col2] = gem1;
        
        // Check if either position creates a match
        const match1 = this.checkMatchAtPosition(row1, col1, type2);
        const match2 = this.checkMatchAtPosition(row2, col2, type1);
        
        // Swap back
        this.grid[row1][col1] = gem1;
        this.grid[row2][col2] = gem2;
        
        return match1 || match2;
    }
    
    /**
     * CHECK MATCH AT POSITION
     * Checks if a specific gem type at a position forms a match of 3+
     */
    private checkMatchAtPosition(row: number, col: number, gemType: number): boolean {
        // Check horizontal
        let hCount = 1;
        
        // Count left
        let c = col - 1;
        while (c >= 0 && this.grid[row][c] && this.playablePattern[row][c] === 1) {
            if (this.grid[row][c].getComponent(Gem).type === gemType) {
                hCount++;
                c--;
            } else {
                break;
            }
        }
        
        // Count right
        c = col + 1;
        while (c < this.cols && this.grid[row][c] && this.playablePattern[row][c] === 1) {
            if (this.grid[row][c].getComponent(Gem).type === gemType) {
                hCount++;
                c++;
            } else {
                break;
            }
        }
        
        if (hCount >= 3) return true;
        
        // Check vertical
        let vCount = 1;
        
        // Count up
        let r = row - 1;
        while (r >= 0 && this.grid[r][col] && this.playablePattern[r][col] === 1) {
            if (this.grid[r][col].getComponent(Gem).type === gemType) {
                vCount++;
                r--;
            } else {
                break;
            }
        }
        
        // Count down
        r = row + 1;
        while (r < this.rows && this.grid[r][col] && this.playablePattern[r][col] === 1) {
            if (this.grid[r][col].getComponent(Gem).type === gemType) {
                vCount++;
                r++;
            } else {
                break;
            }
        }
        
        return vCount >= 3;
    }
}