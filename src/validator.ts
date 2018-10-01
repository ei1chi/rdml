/* validator.ts: validate parameters */

namespace rdml.check {
    export class ValError implements Error {
        name: string = "ValidationError";
        constructor(public message: string) { }
        toString() {
            return this.name + ': ' + this.message;
        }
    }

    export function float(s: string, min: number | null, max: number | null, def: number | null): number {
        if (s === undefined) {
            if (def === null) { // required
                throw new ValError(`required`);
            } else {
                return def;
            }
        }
        const f = parseFloat(s);
        if (min !== null) {
            if (f < min) { throw new ValError(`check.int: ${s} must not smaller than ${min}`); }
        }
        if (max !== null) {
            if (max < f) { throw new ValError(`check.int: ${s} must not larger than ${max}`); }
        }
        return f;
    }

    export function int(s: string, min: number | null, max: number | null, def: number | null): number {
        if (s === undefined) {
            if (def === null) { // required
                throw new ValError(`required`);
            } else {
                return def;
            }
        }
        const f = check.float(s, def, min, max);
        const i = parseInt(s);
        if (i !== f) {
            throw new ValError(`check.int: ${s} must be int, not float`);
        }
        return i;
    }

    export function word(s: string, rules: stringRules, def: string | null): string {
        if (s === undefined) {
            if (def === null) { // required
                throw new ValError(`required`);
            } else {
                return def;
            }
        }
        s = s.trim();
        if (rules.re) {
            if (!rules.re.test(s)) { throw new ValError(`check.word: ${s} unmatches ${rules.re.toString()}`); }
        }
        if (rules.length) {
            if (s.length < rules.length[0]) { throw new ValError(`check.word: ${s} must not be shorter than ${rules.length[0]}`); }
            if (rules.length[1] < s.length) { throw new ValError(`check.word: ${s} must not be longer than ${rules.length[1]}`); }
        }
        return s;
    }

    export interface stringRules {
        re?: RegExp;
        length?: [number, number];
    }

    export function bool(s: string, def: boolean | null) {
        if (s === undefined) {
            if (def === null) { // required
                throw new ValError(`required`);
            } else {
                return def;
            }
        }
        s = s.trim();
        if (s === "on" || s === "true") {
            return true;
        } else if (s === "off" || s === "false") {
            return false;
        }
        throw new ValError(`check.bool: ${s} is invalid string as boolean`);
    }
}
