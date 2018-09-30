/* proc.ts: procedure (event commands) feature */

/// <reference path="xml.ts" />

declare function indexOfMap(name: string): number;
declare function indexOfVar(name: string): number;

namespace rdml {

    /**
     * Internal
     */

    type Param = string | number | boolean | number[];
    type Elem = xml.Element;

    interface MVCmd {
        code: number;
        indent: number;
        parameters: Param[];
    }

    class Proc {
        cmds: MVCmd[] = [];
        children: { [id: string]: Proc } = {};
    }

    /**
     * コマンド定義
     */
    // {{{ Command definitions
    interface CmdCreator {
        create(e: xml.Element, indent: number): MVCmd;
        hasBlock: boolean;
    }

    class CmdTemplate {
        constructor(
            public code: number,
            public hasBlock: boolean,
            public fn: (e: xml.Element) => Param[],
        ) { }

        create(e: Elem, indent: number): MVCmd {
            return {
                code: this.code,
                indent: indent,
                parameters: this.fn(e),
            };
        }
    }

    const noParam = (e: Elem) => [];

    const creators: { [id: string]: CmdCreator } = {

        // set options, to start message
        "message options": new CmdTemplate(
            101, false,
            (e: Elem) => ["", 0, 0, 2],
        ),

        // input a number
        input: new CmdTemplate(
            103, false,
            (e: Elem) => [
                indexOfVar(e.requireWord("var")),
                e.requireInt("digits")
            ]
        ),

        // select item
        "select-item": new CmdTemplate(
            104, false,
            (e: Elem) => [
                indexOfVar(e.requireWord("var")),
                e.requireInt("type", 0, 3)
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
                e.split("color", 4).map(c => check.int(c, 255, 0, 255)),
                e.int("duration", 60, 0),
                e.bool("wait", true),
            ]
        ),

        // flash screen
        flash: new CmdTemplate(
            224, false,
            (e: Elem) => [
                e.split("color", 4).map(c => check.int(c, 255, 0, 255)),
                e.int("duration", 60, 0),
                e.bool("wait", true),
            ]
        ),

        // shake screen
        shake: new CmdTemplate(
            225, false,
            (e: Elem) => [
                e.requireInt("power", 0, 9),
                e.requireInt("speed", 0, 9),
                e.bool("wait", true),
            ]
        ),

        wait: new CmdTemplate(
            230, false,
            (e: Elem) => [check.int(e.data, 0, 0)]
        ),

        "show-pict": new CmdTemplate(
            231, false,
            (e: Elem) => {
                let params: Param[] = [];

                params[0] = e.requireInt("id", 0, 100);
                params[1] = e.data.trim();

                const pos = e.split("pos", 3);
                const origin = check.word(pos[0], "lefttop");
                if (origin === "lefttop") {
                    params[2] = 0;
                } else if (origin === "center") {
                    params[2] = 1;
                } else {
                }

                params[4] = check.float(pos[1], 0);
                params[5] = check.float(pos[2], 0);

                const scale = e.split("scale", 2);
                params[6] = check.float(scale[0], 100);
                params[7] = check.float(scale[1], 100);

                params[8] = e.int("opacity", 255, 0, 255);

                params[9] = 0; // default
                const blend = e.word("blend", "normal");
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
                e.requireInt("id", 0, 100),
                e.requireFloat("speed"),
            ]
        ),

        "tint-pict": new CmdTemplate(
            234, false,
            (e: Elem) => {
                let params: Param[] = [];
                params[0] = e.requireInt("id", 0, 100);
                params[1] = e.split("color", 4).map(c => check.int(c, 255, 0, 255));
                params[2] = e.int("duration", 60, 0);
                params[3] = e.bool("wait", true);
                return params;
            }
        ),

        "erase-pict": new CmdTemplate(
            235, false,
            (e: Elem) => [e.requireInt("id", 0, 100)],
        ),

        weather: new CmdTemplate(
            236, false,
            (e: Elem) => [
                e.requireWord("type"),
                e.int("power", 5, 0, 9),
                e.int("duration", 60, 0),
                e.bool("wait", true),
            ]
        ),

        bgm: new CmdTemplate(
            241, false,
            (e: Elem) => [e.data.trim()],
        ),

        "fadeout-bgm": new CmdTemplate(
            242, false,
            (e: Elem) => [e.requireFloat("duration")]
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
            (e: Elem) => [e.requireFloat("duration")]
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
    // }}}
}
