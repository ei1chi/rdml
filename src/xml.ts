/* xml.ts: pseudo, lightweight xml parser */

/// <reference path="desc.ts" />

namespace rdml.xml {

    /**
     * API
     */
    export function parseString(s: string): Node[] {
        const p = new Parser(s);
        return p.parse();
    }

    /**
     * Type definitions
     */
    export type Attrs = { [attr: string]: string };

    export type Node = Element | string;

    export class Element {
        name: string = "";
        attrs: Attrs = {};
        childNodes: Node[] = [];

        get children(): Element[] {
            return this.childNodes.filter<Element>((x): x is Element => typeof x !== "string");
        }

        get data(): string {
            let s = "";
            for (const n of this.childNodes) {
                if (typeof n === "string") {
                    s += n;
                }
            }
            return s;
        }

        // validators
        float(id: string, def: number | null, min: number | null, max: number | null): number {
            try {
                return check.float(this.attrs[id], def, min, max);
            } catch (e) {
                throw new AttrError(this.name, id, e);
            }
        }

        int(id: string, def: number | null, min: number | null, max: number | null) {
            try {
                return check.int(this.attrs[id], def, min, max);
            } catch (e) {
                throw new AttrError(this.name, id, e);
            }
        }

        word(id: string, def: string | null, rules: check.stringRules) {
            try {
                return check.word(this.attrs[id], def, rules);
            } catch (e) {
                throw new AttrError(this.name, id, e);
            }
        }

        bool(id: string, def: boolean | null) {
            try {
                return check.bool(this.attrs[id], def);
            } catch (e) {
                throw new AttrError(this.name, id, e);
            }
        }

        split(id: string, length: number): string[] {
            if (!(id in this.attrs)) { return []; }
            const s = this.attrs[id].split(" ");
            if (s.length !== length) { throw new check.ValError(`required ${length} parameters`); }
            return s;
        }
    }

    /**
     * Internal
     */
    const sp = " ";
    const spCc = sp.charCodeAt(0);
    const lt = "<";
    const ltCc = lt.charCodeAt(0);
    const gt = ">";
    const gtCc = gt.charCodeAt(0);
    const minus = "-";
    const minusCc = minus.charCodeAt(0);
    const slash = "/";
    const slashCc = slash.charCodeAt(0);
    const excl = "!";
    const exclCc = excl.charCodeAt(0);
    const equal = "=";
    const equalCc = equal.charCodeAt(0);
    const singleQt = "'";
    const singleQtCc = singleQt.charCodeAt(0);
    const doubleQt = '"';
    const doubleQtCc = doubleQt.charCodeAt(0);
    const nameSpacers = "\n\r\t>/= ";
    const whiteSpaces = "\n\r\t ";

    class Parser {

        pos: number = 0;
        errors: ParseError[] = [];

        constructor(private s: string) { }

        parse(): Node[] {
            const c = this.parseChildren("");
            if (this.errors.length > 0) {
                for (const e of this.errors) {
                    console.log(e.toString());
                }
                throw new ParserError(this.errors);
            }
            return c;
        }

        // parsing a list of nodes
        parseChildren(parentName: string): Node[] {

            let children: Node[] = [];

            while (!this.isEOF) {

                // found a tag
                if (this.curCc === ltCc) {
                    this.pos++;

                    // closing tag
                    if (this.curCc === slashCc) {
                        this.pos++;
                        const start = this.pos;
                        this.seekTo(gt);
                        const name = this.slice(start);
                        if (name !== parentName) {
                            this.pushError(`tag names mismatch, open='${parentName}', close='${name}'`);
                        }
                        return children;
                    }

                    // comment or doctype
                    // TODO
                    if (this.curCc === exclCc) {
                        this.pos++;
                        let isComment = this.curCc === minusCc;
                        this.pos++;
                        isComment = isComment && this.curCc === minusCc;
                        this.seekTo(gt);
                        this.pos++;
                        continue;
                    }

                    // opening tag
                    children.push(this.parseElement());
                    this.pos++;

                } else {

                    if (parentName === "script") {
                        // special case
                        children.push(this.parseScript());
                        continue;
                    }

                    // text node
                    const text = this.parseText();
                    if (text !== "") {
                        children.push(text);
                    }
                }
            }
            return children;
        }

        parseText() {
            const start = this.pos;
            this.seekTo(lt);
            return this.slice(start);
        }

        parseScript() {
            const start = this.pos;
            this.pos = this.s.indexOf("</script>", this.pos);
            return this.slice(start);
        }

        parseName() {
            const start = this.pos;
            while (nameSpacers.indexOf(this.cur) === -1 && !this.isEOF) {
                this.pos++;
            }
            return this.slice(start);
        }

        parseQuote() {
            const qt = this.cur;
            this.pos++;
            const start = this.pos;
            this.seekTo(qt);
            return this.slice(start);
        }

        parseElement() {
            let el: Element = new Element();
            el.name = this.parseName();
            if (el.name === "") {
                const start = this.pos;
                this.seekTo(gt);
                this.pushError(`invalid or empty tag name in string '${this.slice(start)}'`);
            }

            this.skipSp();

            // parsing attributes
            while (this.curCc !== gtCc && this.curCc !== slashCc && !this.isEOF) {

                // get name
                const attr = this.parseName();
                if (attr === "") {
                    this.pushError(`invalid or empty attr name of element '${el.name}'`);
                    this.seekTo(gt);
                    break;
                }

                // must be followed by =
                if (this.curCc !== equalCc) {
                    this.pushError(`attr must be followed by '=' in element '${el.name}'`);
                    this.seekTo(gt);
                    break;
                }

                this.pos++;

                // must be wrapped by quotations
                if (this.curCc !== singleQtCc && this.curCc !== doubleQtCc) {
                    this.pushError(`attr value must be wrapped by ' or " in element '${el.name}'`);
                    continue;
                }

                el.attrs[attr] = this.parseQuote();
                this.pos++;

                this.skipSp();
            }

            if (this.curCc === gtCc) {
                // parsing children
                this.pos++;
                el.childNodes = this.parseChildren(el.name);
            } else if (this.curCc === slashCc) {
                // empty tag
                this.seekTo(gt);
                this.pos++;
            }
            return el;
        }

        // helper functions
        get cur() {
            return this.s[this.pos];
        }

        get curCc() {
            return this.s.charCodeAt(this.pos);
        }

        get isEOF() {
            return this.cur === undefined;
        }

        slice(start: number) {
            return this.s.slice(start, this.pos);
        }

        seekTo(ch: string) {
            this.pos = this.s.indexOf(ch, this.pos);
            if (this.pos === -1) { this.pos = this.s.length; }
        }

        skipSp() {
            while (this.cur === sp && !this.isEOF) {
                this.pos++;
            }
        }

        pushError(message: string) {
            this.errors.push(new ParseError(message));
        }
    }

    class AttrError implements Error {
        public name = "AttributeError";
        public message = "";
        constructor(elem: string, attr: string, e: check.ValError) {
            this.message = `elem ${elem}, attr ${attr}: ${e.message}`;
        }
        toString() {
            return `${this.name}: ${this.message}`;
        }
    }

    class ParseError implements Error {
        public name = "XmlParseError";
        constructor(public message: string) { }

        toString() {
            return `${this.name}: ${this.message}`;
        }
    }

    class ParserError implements Error {
        public name = "XmlParserError";
        public message: string = "";
        constructor(errors: ParseError[]) {
            this.message = `${errors.length} error(s) thrown.`;
        }
        toString() {
            return `${this.name}: ${this.message}`;
        }
    }
}
