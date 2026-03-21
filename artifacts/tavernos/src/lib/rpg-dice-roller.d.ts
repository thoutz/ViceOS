declare module 'rpg-dice-roller' {
  export class DiceRoll {
    constructor(notation: string);
    readonly total: number;
    readonly output: string;
    readonly notation: string;
    toString(): string;
  }
}
