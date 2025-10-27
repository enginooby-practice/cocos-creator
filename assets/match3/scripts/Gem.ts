import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Gem')
export class Gem extends Component {
    
    /**
     * TYPE
     * The type/color of this gem (0-4)
     * Each type represents a different color:
     * 0 = Red, 1 = Green, 2 = Blue, 3 = Yellow, 4 = Purple
     */
    public type: number = 0;
    
    /**
     * ROW
     * The row position of this gem in the grid
     * Starts from 0 (bottom) to rows-1 (top)
     */
    public row: number = 0;
    
    /**
     * COL
     * The column position of this gem in the grid
     * Starts from 0 (left) to cols-1 (right)
     */
    public col: number = 0;
}