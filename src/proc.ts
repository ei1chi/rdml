/* proc.ts: procedure (event commands) feature */

/// <reference path="xml.ts" />

declare function indexOfMap(name: string): number;
declare function indexOfVar(name: string): number;

namespace rdml.proc {

    /**
     * API ?
     */

    /**
     * Internal
     */
    export function call(i: Game_Interpreter, id: string) {
        const cmds: MVCmd[] = procs[id].cmds;
        i.setupChild(cmds, 0);
    }

    export let procs: { [id: string]: Proc } = {};

    export class Proc {
        cmds: MVCmd[] = [];
        children: { [id: string]: Proc } = {};

        constructor(e: Elem) {
            this.parseBlock(e, 0);
        }

        parseBlock(parent: Elem, depth: number) {

            for (const e of parent.children) {

                // special cases
                switch (e.name) {
                    case "m":
                        this.parseMessage(e, depth);
                        continue;
                    case "choice":
                        this.parseChoices(e, depth);
                        continue;
                }

                // normal command
                // コマンド生成メソッド一覧から選択する
                const gen = generators[e.name];
                this.cmds.push(gen.generate(e, depth));
                if (gen.hasBlock) {
                    this.parseBlock(e, depth + 1);
                }

                // ブロックの末尾に閉じコマンドをさらに追加する
                const closer = closers[e.name];
                if (closer) {
                    this.cmds.push(closer.generate(e, depth));
                }
            }

            // 末尾に空のコマンドを追加
            this.cmds.push({
                code: 0,
                indent: depth,
                parameters: [],
            });
        }

        parseChoices(parent: Elem, depth: number) {

            const children = parent.children;

            // 子elementを選択肢として追加する
            let symbols: string[] = [];
            let texts: string[] = [];
            let conds: string[] = [];
            for (const e of children) {
                symbols.push(e.name);
                texts.push(e.word("text", {}, required));
                conds.push(e.word("cond", {}, ""));
            }

            // TODO parameter validation
            const id = conditionalChoices.push({
                symbols: symbols,
                texts: texts,
                conds: conds,
                defaultType: 0,
                cancelType: 0,
                positionType: 2,
                background: 0,
            });

            // 自身はプラグインコマンドとして追加する
            this.cmds.push({
                code: 356,
                indent: depth,
                parameters: ["rdml conditional-choices " + id],
            });

            for (let i = 0; i < symbols.length; i++) {
                this.cmds.push({
                    code: 402,
                    indent: depth,
                    parameters: [i, texts[i]],
                });
                this.parseBlock(children[i], depth + 1);
            }
        }

        parseMessage(parent: Elem, depth: number) {

            // メッセージ用のテキスト処理を行う
            // 空行は数を数えておいて、次にテキストがあれば空行分を追加
            // なければ無視する。
            let blanks = 0;
            let started = false;
            const lines = parent.data.split(/\r\n|\r|\n/);

            for (const line of lines) {
                const t = line.trim();
                if (t === "") {
                    blanks++;
                    continue;
                }

                const begin = t.slice(0, 1);
                const end = t.slice(-1);
                if (begin === ":" && end == ":" && t.length >= 2) {
                    // header inside of colons
                    const str = t.slice(1, t.length - 1);
                    this.pushMessageHeader(depth, str);
                    started = true;
                    blanks = 0;
                    continue;
                }

                if (!started) {
                    // 暗黙の地の文
                    this.pushMessageHeader(depth, "*");
                    started = true;
                    blanks = 0;
                }

                // push blank lines
                for (let i = 0; i < blanks; i++) {
                    this.cmds.push({
                        code: 401,
                        indent: depth,
                        parameters: [""],
                    });
                }
                blanks = 0;

                // push text
                this.cmds.push({
                    code: 401,
                    indent: depth,
                    parameters: [t],
                });
            }
        }

        pushMessageHeader(depth: number, str: string) {
            // TODO
            this.cmds.push({
                code: 101,
                indent: depth,
                parameters: ["", 0, 0, 2],
            });
        }
    }

    type Param = string | number | boolean | number[];
    type Elem = xml.Element;

    interface MVCmd {
        code: number;
        indent: number;
        parameters: Param[];
    }

    /**
     * コマンド定義
     */
    // {{{ Command definitions
    interface CmdGenerator {
        generate(e: xml.Element, indent: number): MVCmd;
        hasBlock: boolean;
    }

    class CmdTemplate {
        constructor(
            public code: number,
            public hasBlock: boolean,
            public fn: (e: xml.Element) => Param[],
        ) { }

        generate(e: Elem, indent: number): MVCmd {
            return {
                code: this.code,
                indent: indent,
                parameters: this.fn(e),
            };
        }
    }

    const noParam = (e: Elem) => [];
    const required = null;

    const generators: { [id: string]: CmdGenerator } = {

        // set options, to start message
        "message options": new CmdTemplate(
            101, false,
            (e: Elem) => ["", 0, 0, 2],
        ),

        // input a number
        input: new CmdTemplate(
            103, false,
            (e: Elem) => [
                indexOfVar(e.word("var", {}, required)),
                e.int("digits", 1, null, required),
            ]
        ),

        // select item
        "select-item": new CmdTemplate(
            104, false,
            (e: Elem) => [
                indexOfVar(e.word("var", {}, required)),
                e.int("type", 0, 3, required),
            ]
        ),

        // TODO scrolling message
        // TODO scrolling message content

        // TODO other condition types
        "if": new CmdTemplate(
            111, true,
            (e: Elem) => [
                e.attrs["js"],
            ]
        ),

        // infinite loop
        loop: new CmdTemplate(
            112, true, noParam
        ),

        // break loop
        "break": new CmdTemplate(
            113, false, noParam
        ),

        // exit event
        exit: new CmdTemplate(
            115, false, noParam
        ),

        // TODO call common event

        // set label
        label: new CmdTemplate(
            118, false,
            (e: Elem) => [e.data.trim()]
        ),

        // jump to label
        jump: new CmdTemplate(
            119, false,
            (e: Elem) => [e.data.trim()]
        ),

        // jump to label
        "goto": new CmdTemplate(
            119, false,
            (e: Elem) => [e.data.trim()]
        ),

        // switch on (single operation)
        "sw-on": new CmdTemplate(
            121, false,
            (e: Elem) => {
                const id = Number(e.data.trim());
                return [id, id, 0];
            }
        ),

        // switch off (single operation)
        "sw-off": new CmdTemplate(
            121, false,
            (e: Elem) => {
                const id = Number(e.data.trim());
                return [id, id, 1];
            }
        ),

        // TODO switch, var, timer operations
        // TODO many commands

        visibility: new CmdTemplate(
            211, false,
            (e: Elem) => [
                check.bool(e.data, false) ? 0 : 1,
            ]
        ),

        // tint screen
        tint: new CmdTemplate(
            223, false,
            (e: Elem) => [
                e.split("color", 4).map(c => check.int(c, 0, 255, 255)),
                e.int("duration", 1, null, 60),
                e.bool("wait", true),
            ]
        ),

        // flash screen
        flash: new CmdTemplate(
            224, false,
            (e: Elem) => [
                e.split("color", 4).map(c => check.int(c, 0, 255, 255)),
                e.int("duration", 1, null, 60),
                e.bool("wait", true),
            ]
        ),

        // shake screen
        shake: new CmdTemplate(
            225, false,
            (e: Elem) => [
                e.int("power", 0, 9, required),
                e.int("speed", 0, 9, required),
                e.bool("wait", true),
            ]
        ),

        wait: new CmdTemplate(
            230, false,
            (e: Elem) => [check.int(e.data, 1, null, required)]
        ),

        "show-pict": new CmdTemplate(
            231, false,
            (e: Elem) => {
                let params: Param[] = [];

                params[0] = e.int("id", 0, 100, required);
                params[1] = e.data.trim();

                const pos = e.split("pos", 3);
                const origin = check.word(pos[0], {}, "lefttop");
                if (origin === "lefttop") {
                    params[2] = 0;
                } else if (origin === "center") {
                    params[2] = 1;
                } else {
                }

                params[4] = check.float(pos[1], null, null, 0);
                params[5] = check.float(pos[2], null, null, 0);

                const scale = e.split("scale", 2);
                params[6] = check.float(scale[0], null, null, 100);
                params[7] = check.float(scale[1], null, null, 100);

                params[8] = e.int("opacity", 0, 255, 255);

                params[9] = 0; // default
                const blend = e.word("blend", {}, "normal");
                const modes: { [id: string]: number } = {
                    normal: 0,
                    add: 1,
                    multiply: 2,
                    screen: 3,
                    overlay: 4,
                    darken: 5,
                    lighten: 6,
                }
                if (blend in modes) {
                    params[9] = modes[blend];
                }

                return params;
            }
        ),

        "move-pict": new CmdTemplate(
            232, false,
            (e: Elem) => {
                return [];
            }
        ),

        "rotate-pict": new CmdTemplate(
            233, false,
            (e: Elem) => [
                e.int("id", 0, 100, required),
                e.float("speed", null, null, 0),
            ]
        ),

        "tint-pict": new CmdTemplate(
            234, false,
            (e: Elem) => {
                let params: Param[] = [];
                params[0] = e.int("id", 0, 100, required);
                params[1] = e.split("color", 4).map(c => check.int(c, 0, 255, 255));
                params[2] = e.int("duration", 1, null, 60);
                params[3] = e.bool("wait", true);
                return params;
            }
        ),

        "erase-pict": new CmdTemplate(
            235, false,
            (e: Elem) => [e.int("id", 0, 100, required)],
        ),

        weather: new CmdTemplate(
            236, false,
            (e: Elem) => [
                e.word("type", {}, required),
                e.int("power", 0, 9, 5),
                e.int("duration", 1, null, 60),
                e.bool("wait", true),
            ]
        ),

        bgm: new CmdTemplate(
            241, false,
            (e: Elem) => [e.data.trim()],
        ),

        "fadeout-bgm": new CmdTemplate(
            242, false,
            (e: Elem) => [e.float("duration", 0, null, required)]
        ),

        "save-bgm": new CmdTemplate(
            243, false, noParam
        ),

        "resume-bgm": new CmdTemplate(
            244, false, noParam
        ),

        bgs: new CmdTemplate(
            245, false,
            (e: Elem) => [e.data.trim()],
        ),

        "fadeout-bgs": new CmdTemplate(
            246, false,
            (e: Elem) => [e.float("duration", 0, null, required)]
        ),

        me: new CmdTemplate(
            249, false,
            (e: Elem) => [e.data.trim()],
        ),

        se: new CmdTemplate(
            250, false,
            (e: Elem) => [e.data.trim()],
        ),

        "stop-se": new CmdTemplate(
            251, false, noParam
        ),

        movie: new CmdTemplate(
            261, false,
            (e: Elem) => [e.data.trim()],
        ),

        menu: new CmdTemplate(
            351, false, noParam
        ),

        save: new CmdTemplate(
            352, false, noParam
        ),

        "game-over": new CmdTemplate(
            353, false, noParam
        ),

        title: new CmdTemplate(
            354, false, noParam
        ),

        script: new CmdTemplate(
            356, false,
            (e: Elem) => [e.data]
        ),

        // wrapped by fadeout and fadein
        hidden: new CmdTemplate(
            221, true, noParam
        ),
    };

    const closers: { [id: string]: CmdGenerator } = {};
    // }}}

    /**
     * 条件付き選択肢の実装
     */
    export namespace conditionalChoices {
        export interface Cmd {
            symbols: string[]; // 内部表現、被り禁止
            texts: string[]; // 表示名
            conds: string[]; // 条件文
            defaultType: number;
            cancelType: number;
            positionType: number;
            background: number;
        }

        let cmds: Cmd[] = [];

        export function push(cmd: Cmd): number {
            cmds.push(cmd);
            return cmds.length - 1;
        }

        export function setup(i: Game_Interpreter, id: number) {
            const cmd = cmds[id];

            // 呼ばれた時点で条件を満たす選択肢のみ集める
            // 選択肢(シンボル)と表示名は別
            let symbols: string[] = [];
            let texts: string[] = [];
            for (let j = 0; j < cmd.symbols.length; j++) {
                if (cmd.conds[j] === "" || !!eval(cmd.conds[j])) {
                    symbols.push(cmd.symbols[j]);
                    texts.push(cmd.texts[j]);
                }
            }

            const cancelType = cmd.cancelType >= symbols.length ? -2 : cmd.cancelType;
            $gameMessage.setChoices(texts, cmd.defaultType, cancelType);
            $gameMessage.setChoiceBackground(cmd.background);
            $gameMessage.setChoicePositionType(cmd.positionType);
            // コールバックの中身が重要
            $gameMessage.setChoiceCallback(function(this: Game_Interpreter, n: number) {
                // 有効な選択肢のみが表示されている
                // -> nとsymbolsから選択肢固有のシンボルを得る
                // -> シンボルと全体のシンボルリストを照らし合わせてインデックスを得る
                const sym = symbols[n];
                this._branch[this._indent] = cmd.symbols.indexOf(sym);
            }.bind(i));
        }
    }
}
