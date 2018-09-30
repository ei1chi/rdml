/* validator.ts: validate parameters */

namespace rdml.check {
    export class ValError implements Error {
        name: string = "ValidationError";
        constructor(public message: string) { }
        toString() {
            return this.name + ': ' + this.message;
        }
    }

    export function float(s: string, def: number, min?: number, max?: number): number {
        if (s === undefined) { return def; }
        const f = parseFloat(s);
        if (min) {
            if (f < min) { throw new ValError(`check.int: ${s} must not smaller than ${min}`); }
        }
        if (max) {
            if (max < f) { throw new ValError(`check.int: ${s} must not larger than ${max}`); }
        }
        return f;
    }

    export function int(s: string, def: number, min?: number, max?: number): number {
        if (s === undefined) { return def; }
        const f = check.float(s, def, min, max);
        const i = parseInt(s);
        if (i !== f) {
            throw new ValError(`check.int: ${s} must be int, not be float`);
        }
        return i;
    }

    export function word(s: string | undefined, def: string, rules?: stringRules): string {
        if (s === undefined) { return def; }
        s = s.trim();
        if (rules) {
            if (rules.re) {
                if (!rules.re.test(s)) { throw new ValError(`check.word: ${s} unmatches ${rules.re.toString()}`); }
            }
            if (rules.length) {
                if (s.length < rules.length[0]) { throw new ValError(`check.word: ${s} must not be shorter than ${rules.length[0]}`); }
                if (rules.length[1] < s.length) { throw new ValError(`check.word: ${s} must not be longer than ${rules.length[1]}`); }
            }
        }
        return s;
    }

    export interface stringRules {
        re?: RegExp;
        length?: [number, number];
    }

    export function bool(s: string, def: boolean) {
        if (s === undefined) { return def; }
        s = s.trim();
        if (s === "on" || s === "true") {
            return true;
        } else if (s === "off" || s === "false") {
            return false;
        }
        throw new ValError(`check.bool: invalid string as boolean ${s}`);
    }
}
