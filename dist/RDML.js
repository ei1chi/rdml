"use strict";
/* ============================================================
 *  RDML.js
 * ------------------------------------------------------------
 *  Copyright (c) 2018 ei1chi
 *  This plugin is released under the MIT License.
 * ============================================================

/*:ja
 * @plugindesc HTML/XML風汎用構文でRPGツクールのデータを記述するためのプラグイン
 * @author ei1chi
 *
 * @help
 * HTML/XML風汎用構文でRPGツクールのデータを記述することを可能とします。
 *
 * 高速なツクール開発を支援したり、エディタによる制限を取り払うことを目的とした
 * 上級者向けのプラグインです。
 *
 * 使用例:
 * rdml load sample.html
 * rdml proc sample.html hello-world
 * rdml apply db.html
 */
/* mapper.ts: mapping object names to ids */
var rdml;
(function (rdml) {
    var mapper;
    (function (mapper) {
        mapper.vars = {};
        mapper.sws = {};
        mapper.ssws = {};
        mapper.maps = {};
    })(mapper = rdml.mapper || (rdml.mapper = {}));
})(rdml || (rdml = {}));
(function () {
    var __createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function () {
        __createGameObjects.call(this);
        for (var i = 0; i < $dataSystem.variables.length; i++) {
            var name_1 = $dataSystem.variables[i];
            if (name_1 === "") {
                continue;
            }
            rdml.mapper.vars[name_1] = i;
        }
        for (var _i = 0, $dataMapInfos_1 = $dataMapInfos; _i < $dataMapInfos_1.length; _i++) {
            var m = $dataMapInfos_1[_i];
            if (m === null) {
                continue;
            }
            rdml.mapper.maps[m.name] = m.id;
        }
    };
})();
/* xml.ts: pseudo, lightweight xml parser */
/// <reference path="desc.ts" />
var rdml;
(function (rdml) {
    var xml;
    (function (xml) {
        /**
         * API
         */
        function parseString(s) {
            var p = new Parser(s);
            return p.parse();
        }
        xml.parseString = parseString;
        var Element = /** @class */ (function () {
            function Element() {
                this.name = "";
                this.attrs = {};
                this.childNodes = [];
            }
            Object.defineProperty(Element.prototype, "children", {
                get: function () {
                    return this.childNodes.filter(function (x) { return typeof x !== "string"; });
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Element.prototype, "data", {
                get: function () {
                    var s = "";
                    for (var _i = 0, _a = this.childNodes; _i < _a.length; _i++) {
                        var n = _a[_i];
                        if (typeof n === "string") {
                            s += n;
                        }
                    }
                    return s;
                },
                enumerable: true,
                configurable: true
            });
            // validators
            Element.prototype.float = function (id, min, max, def) {
                try {
                    return rdml.check.float(this.attrs[id], min, max, def);
                }
                catch (e) {
                    throw new AttrError(this.name, id, e);
                }
            };
            Element.prototype.int = function (id, min, max, def) {
                try {
                    return rdml.check.int(this.attrs[id], min, max, def);
                }
                catch (e) {
                    throw new AttrError(this.name, id, e);
                }
            };
            Element.prototype.word = function (id, rules, def) {
                try {
                    return rdml.check.word(this.attrs[id], rules, def);
                }
                catch (e) {
                    throw new AttrError(this.name, id, e);
                }
            };
            Element.prototype.bool = function (id, def) {
                try {
                    return rdml.check.bool(this.attrs[id], def);
                }
                catch (e) {
                    throw new AttrError(this.name, id, e);
                }
            };
            Element.prototype.split = function (id, length) {
                if (!(id in this.attrs)) {
                    return [];
                }
                var s = this.attrs[id].split(" ");
                if (s.length !== length) {
                    throw new rdml.check.ValError("required " + length + " parameters");
                }
                return s;
            };
            return Element;
        }());
        xml.Element = Element;
        /**
         * Internal
         */
        var sp = " ";
        var spCc = sp.charCodeAt(0);
        var lt = "<";
        var ltCc = lt.charCodeAt(0);
        var gt = ">";
        var gtCc = gt.charCodeAt(0);
        var minus = "-";
        var minusCc = minus.charCodeAt(0);
        var slash = "/";
        var slashCc = slash.charCodeAt(0);
        var excl = "!";
        var exclCc = excl.charCodeAt(0);
        var equal = "=";
        var equalCc = equal.charCodeAt(0);
        var singleQt = "'";
        var singleQtCc = singleQt.charCodeAt(0);
        var doubleQt = '"';
        var doubleQtCc = doubleQt.charCodeAt(0);
        var nameSpacers = "\n\r\t>/= ";
        var whiteSpaces = "\n\r\t ";
        var Parser = /** @class */ (function () {
            function Parser(s) {
                this.s = s;
                this.pos = 0;
                this.errors = [];
            }
            Parser.prototype.parse = function () {
                var c = this.parseChildren("");
                if (this.errors.length > 0) {
                    for (var _i = 0, _a = this.errors; _i < _a.length; _i++) {
                        var e = _a[_i];
                        console.log(e.toString());
                    }
                    throw new ParserError(this.errors);
                }
                return c;
            };
            // parsing a list of nodes
            Parser.prototype.parseChildren = function (parentName) {
                var children = [];
                while (!this.isEOF) {
                    // found a tag
                    if (this.curCc === ltCc) {
                        this.pos++;
                        // closing tag
                        if (this.curCc === slashCc) {
                            this.pos++;
                            var start = this.pos;
                            this.seekTo(gt);
                            var name_2 = this.slice(start);
                            if (name_2 !== parentName) {
                                this.pushError("tag names mismatch, open='" + parentName + "', close='" + name_2 + "'");
                            }
                            return children;
                        }
                        // comment or doctype
                        // TODO
                        if (this.curCc === exclCc) {
                            this.pos++;
                            var isComment = this.curCc === minusCc;
                            this.pos++;
                            isComment = isComment && this.curCc === minusCc;
                            this.seekTo(gt);
                            this.pos++;
                            continue;
                        }
                        // opening tag
                        children.push(this.parseElement());
                        this.pos++;
                    }
                    else {
                        if (parentName === "script") {
                            // special case
                            children.push(this.parseScript());
                            continue;
                        }
                        // text node
                        var text = this.parseText();
                        if (text !== "") {
                            children.push(text);
                        }
                    }
                }
                return children;
            };
            Parser.prototype.parseText = function () {
                var start = this.pos;
                this.seekTo(lt);
                return this.slice(start);
            };
            Parser.prototype.parseScript = function () {
                var start = this.pos;
                this.pos = this.s.indexOf("</script>", this.pos);
                return this.slice(start);
            };
            Parser.prototype.parseName = function () {
                var start = this.pos;
                while (nameSpacers.indexOf(this.cur) === -1 && !this.isEOF) {
                    this.pos++;
                }
                return this.slice(start);
            };
            Parser.prototype.parseQuote = function () {
                var qt = this.cur;
                this.pos++;
                var start = this.pos;
                this.seekTo(qt);
                return this.slice(start);
            };
            Parser.prototype.parseElement = function () {
                var el = new Element();
                el.name = this.parseName();
                if (el.name === "") {
                    var start = this.pos;
                    this.seekTo(gt);
                    this.pushError("invalid or empty tag name in string '" + this.slice(start) + "'");
                }
                this.skipSp();
                // parsing attributes
                while (this.curCc !== gtCc && this.curCc !== slashCc && !this.isEOF) {
                    // get name
                    var attr = this.parseName();
                    if (attr === "") {
                        this.pushError("invalid or empty attr name of element '" + el.name + "'");
                        this.seekTo(gt);
                        break;
                    }
                    // must be followed by =
                    if (this.curCc !== equalCc) {
                        this.pushError("attr must be followed by '=' in element '" + el.name + "'");
                        this.seekTo(gt);
                        break;
                    }
                    this.pos++;
                    // must be wrapped by quotations
                    if (this.curCc !== singleQtCc && this.curCc !== doubleQtCc) {
                        this.pushError("attr value must be wrapped by ' or \" in element '" + el.name + "'");
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
                }
                else if (this.curCc === slashCc) {
                    // empty tag
                    this.seekTo(gt);
                    this.pos++;
                }
                return el;
            };
            Object.defineProperty(Parser.prototype, "cur", {
                // helper functions
                get: function () {
                    return this.s[this.pos];
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Parser.prototype, "curCc", {
                get: function () {
                    return this.s.charCodeAt(this.pos);
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Parser.prototype, "isEOF", {
                get: function () {
                    return this.cur === undefined;
                },
                enumerable: true,
                configurable: true
            });
            Parser.prototype.slice = function (start) {
                return this.s.slice(start, this.pos);
            };
            Parser.prototype.seekTo = function (ch) {
                this.pos = this.s.indexOf(ch, this.pos);
                if (this.pos === -1) {
                    this.pos = this.s.length;
                }
            };
            Parser.prototype.skipSp = function () {
                while (this.cur === sp && !this.isEOF) {
                    this.pos++;
                }
            };
            Parser.prototype.pushError = function (message) {
                this.errors.push(new ParseError(message));
            };
            return Parser;
        }());
        var AttrError = /** @class */ (function () {
            function AttrError(elem, attr, e) {
                this.name = "AttributeError";
                this.message = "";
                this.message = "elem " + elem + ", attr " + attr + ": " + e.message;
            }
            AttrError.prototype.toString = function () {
                return this.name + ": " + this.message;
            };
            return AttrError;
        }());
        var ParseError = /** @class */ (function () {
            function ParseError(message) {
                this.message = message;
                this.name = "XmlParseError";
            }
            ParseError.prototype.toString = function () {
                return this.name + ": " + this.message;
            };
            return ParseError;
        }());
        var ParserError = /** @class */ (function () {
            function ParserError(errors) {
                this.name = "XmlParserError";
                this.message = "";
                this.message = errors.length + " error(s) thrown.";
            }
            ParserError.prototype.toString = function () {
                return this.name + ": " + this.message;
            };
            return ParserError;
        }());
    })(xml = rdml.xml || (rdml.xml = {}));
})(rdml || (rdml = {}));
/* proc.ts: procedure (event commands) feature */
/// <reference path="xml.ts" />
var rdml;
(function (rdml) {
    var proc;
    (function (proc) {
        /**
         * API ?
         */
        /**
         * Internal
         */
        function call(i, id) {
            var cmds = proc.procs[id].cmds;
            i.setupChild(cmds, 0);
        }
        proc.call = call;
        proc.procs = {};
        var Proc = /** @class */ (function () {
            function Proc(e) {
                this.cmds = [];
                this.lastCmd = null;
                this.children = {};
                this.parseBlock(e, 0);
            }
            Proc.prototype.parseBlock = function (parent, depth) {
                for (var _i = 0, _a = parent.children; _i < _a.length; _i++) {
                    var e = _a[_i];
                    // special cases
                    switch (e.name) {
                        case "m":
                            this.parseMessage(e, depth);
                            continue;
                        case "choice":
                            this.parseChoices(e, depth);
                            continue;
                        case "else":
                            this.parseElse(e, depth);
                            continue;
                    }
                    // normal command
                    // コマンド生成メソッド一覧から選択する
                    var gen = generators[e.name];
                    this.cmds.push(gen.generate(e, depth));
                    if (gen.hasBlock) {
                        this.parseBlock(e, depth + 1);
                        // ブロックの末尾に閉じコマンドをさらに追加する
                        if (e.name in closers) {
                            this.cmds.push(closers[e.name].generate(e, depth));
                        }
                    }
                }
                // 末尾に空のコマンドを追加
                this.cmds.push({
                    code: 0,
                    indent: depth,
                    parameters: [],
                });
            };
            Proc.prototype.parseChoices = function (parent, depth) {
                var children = parent.children;
                // 子elementを選択肢として追加する
                var symbols = [];
                var texts = [];
                var conds = [];
                for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                    var e = children_1[_i];
                    symbols.push(e.name);
                    texts.push(e.word("text", {}, required));
                    conds.push(e.word("cond", {}, ""));
                }
                // TODO parameter validation
                var id = conditionalChoices.push({
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
                for (var i = 0; i < symbols.length; i++) {
                    this.cmds.push({
                        code: 402,
                        indent: depth,
                        parameters: [i, texts[i]],
                    });
                    this.parseBlock(children[i], depth + 1);
                }
            };
            Proc.prototype.parseMessage = function (parent, depth) {
                // メッセージ用のテキスト処理を行う
                // 空行は数を数えておいて、次にテキストがあれば空行分を追加
                // なければ無視する。
                var blanks = 0;
                var started = false;
                var lines = parent.data.split(/\r\n|\r|\n/);
                for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                    var line = lines_1[_i];
                    var t = line.trim();
                    if (t === "") {
                        blanks++;
                        continue;
                    }
                    var begin = t.slice(0, 1);
                    var end = t.slice(-1);
                    if (begin === ":" && end == ":" && t.length >= 2) {
                        // header inside of colons
                        var str = t.slice(1, t.length - 1);
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
                    for (var i = 0; i < blanks; i++) {
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
            };
            Proc.prototype.pushMessageHeader = function (depth, str) {
                // TODO
                this.cmds.push({
                    code: 101,
                    indent: depth,
                    parameters: ["", 0, 0, 2],
                });
            };
            Proc.prototype.parseElse = function (parent, depth) {
                if (this.lastCmd === null || this.lastCmd.code !== 111) {
                    return;
                }
                this.cmds.push({
                    code: 110,
                    indent: depth,
                    parameters: [],
                });
            };
            return Proc;
        }());
        proc.Proc = Proc;
        var CmdTemplate = /** @class */ (function () {
            function CmdTemplate(code, hasBlock, fn) {
                this.code = code;
                this.hasBlock = hasBlock;
                this.fn = fn;
            }
            CmdTemplate.prototype.generate = function (e, indent) {
                return {
                    code: this.code,
                    indent: indent,
                    parameters: this.fn(e),
                };
            };
            return CmdTemplate;
        }());
        var noParam = function (e) { return []; };
        var required = null;
        var generators = {
            // set options, to start message
            "message options": new CmdTemplate(101, false, function (e) { return ["", 0, 0, 2]; }),
            // input a number
            input: new CmdTemplate(103, false, function (e) { return [
                indexOfVar(e.word("var", {}, required)),
                e.int("digits", 1, null, required),
            ]; }),
            // select item
            "select-item": new CmdTemplate(104, false, function (e) { return [
                indexOfVar(e.word("var", {}, required)),
                e.int("type", 0, 3, required),
            ]; }),
            // TODO scrolling message
            // TODO scrolling message content
            // TODO other condition types
            "if": new CmdTemplate(111, true, function (e) { return [
                e.attrs["js"],
            ]; }),
            // infinite loop
            loop: new CmdTemplate(112, true, noParam),
            // break loop
            "break": new CmdTemplate(113, false, noParam),
            // exit event
            exit: new CmdTemplate(115, false, noParam),
            // TODO call common event
            // set label
            label: new CmdTemplate(118, false, function (e) { return [e.data.trim()]; }),
            // jump to label
            jump: new CmdTemplate(119, false, function (e) { return [e.data.trim()]; }),
            // jump to label
            "goto": new CmdTemplate(119, false, function (e) { return [e.data.trim()]; }),
            // switch on (single operation)
            "sw-on": new CmdTemplate(121, false, function (e) {
                var id = Number(e.data.trim());
                return [id, id, 0];
            }),
            // switch off (single operation)
            "sw-off": new CmdTemplate(121, false, function (e) {
                var id = Number(e.data.trim());
                return [id, id, 1];
            }),
            // TODO switch, var, timer operations
            // TODO many commands
            transfer: new CmdTemplate(201, false, function (e) { return [
                0,
                rdml.mapper.maps[e.word("map", {}, required)],
                0,
                0,
                0,
                0,
            ]; }),
            visibility: new CmdTemplate(211, false, function (e) { return [
                rdml.check.bool(e.data, false) ? 0 : 1,
            ]; }),
            // tint screen
            tint: new CmdTemplate(223, false, function (e) { return [
                e.split("color", 4).map(function (c) { return rdml.check.int(c, 0, 255, 255); }),
                e.int("duration", 1, null, 60),
                e.bool("wait", true),
            ]; }),
            // flash screen
            flash: new CmdTemplate(224, false, function (e) { return [
                e.split("color", 4).map(function (c) { return rdml.check.int(c, 0, 255, 255); }),
                e.int("duration", 1, null, 60),
                e.bool("wait", true),
            ]; }),
            // shake screen
            shake: new CmdTemplate(225, false, function (e) { return [
                e.int("power", 0, 9, required),
                e.int("speed", 0, 9, required),
                e.bool("wait", true),
            ]; }),
            wait: new CmdTemplate(230, false, function (e) { return [rdml.check.int(e.data, 1, null, required)]; }),
            "show-pict": new CmdTemplate(231, false, function (e) {
                var params = [];
                params[0] = e.int("id", 0, 100, required);
                params[1] = e.data.trim();
                var pos = e.split("pos", 3);
                var origin = rdml.check.word(pos[0], {}, "lefttop");
                if (origin === "lefttop") {
                    params[2] = 0;
                }
                else if (origin === "center") {
                    params[2] = 1;
                }
                else {
                }
                params[4] = rdml.check.float(pos[1], null, null, 0);
                params[5] = rdml.check.float(pos[2], null, null, 0);
                var scale = e.split("scale", 2);
                params[6] = rdml.check.float(scale[0], null, null, 100);
                params[7] = rdml.check.float(scale[1], null, null, 100);
                params[8] = e.int("opacity", 0, 255, 255);
                params[9] = 0; // default
                var blend = e.word("blend", {}, "normal");
                var modes = {
                    normal: 0,
                    add: 1,
                    multiply: 2,
                    screen: 3,
                    overlay: 4,
                    darken: 5,
                    lighten: 6,
                };
                if (blend in modes) {
                    params[9] = modes[blend];
                }
                return params;
            }),
            "move-pict": new CmdTemplate(232, false, function (e) {
                return [];
            }),
            "rotate-pict": new CmdTemplate(233, false, function (e) { return [
                e.int("id", 0, 100, required),
                e.float("speed", null, null, 0),
            ]; }),
            "tint-pict": new CmdTemplate(234, false, function (e) {
                var params = [];
                params[0] = e.int("id", 0, 100, required);
                params[1] = e.split("color", 4).map(function (c) { return rdml.check.int(c, 0, 255, 255); });
                params[2] = e.int("duration", 1, null, 60);
                params[3] = e.bool("wait", true);
                return params;
            }),
            "erase-pict": new CmdTemplate(235, false, function (e) { return [e.int("id", 0, 100, required)]; }),
            weather: new CmdTemplate(236, false, function (e) { return [
                e.word("type", {}, required),
                e.int("power", 0, 9, 5),
                e.int("duration", 1, null, 60),
                e.bool("wait", true),
            ]; }),
            bgm: new CmdTemplate(241, false, function (e) { return [e.data.trim()]; }),
            "fadeout-bgm": new CmdTemplate(242, false, function (e) { return [e.float("duration", 0, null, required)]; }),
            "save-bgm": new CmdTemplate(243, false, noParam),
            "resume-bgm": new CmdTemplate(244, false, noParam),
            bgs: new CmdTemplate(245, false, function (e) { return [e.data.trim()]; }),
            "fadeout-bgs": new CmdTemplate(246, false, function (e) { return [e.float("duration", 0, null, required)]; }),
            me: new CmdTemplate(249, false, function (e) { return [e.data.trim()]; }),
            se: new CmdTemplate(250, false, function (e) { return [e.data.trim()]; }),
            "stop-se": new CmdTemplate(251, false, noParam),
            movie: new CmdTemplate(261, false, function (e) { return [e.data.trim()]; }),
            menu: new CmdTemplate(351, false, noParam),
            save: new CmdTemplate(352, false, noParam),
            "game-over": new CmdTemplate(353, false, noParam),
            title: new CmdTemplate(354, false, noParam),
            script: new CmdTemplate(356, false, function (e) { return [e.data]; }),
            // wrapped by fadeout and fadein
            hidden: new CmdTemplate(221, true, noParam),
        };
        var closers = {};
        // }}}
        /**
         * 条件付き選択肢の実装
         */
        var conditionalChoices;
        (function (conditionalChoices) {
            var cmds = [];
            function push(cmd) {
                cmds.push(cmd);
                return cmds.length - 1;
            }
            conditionalChoices.push = push;
            function setup(i, id) {
                var cmd = cmds[id];
                // 呼ばれた時点で条件を満たす選択肢のみ集める
                // 選択肢(シンボル)と表示名は別
                var symbols = [];
                var texts = [];
                for (var j = 0; j < cmd.symbols.length; j++) {
                    if (cmd.conds[j] === "" || !!eval(cmd.conds[j])) {
                        symbols.push(cmd.symbols[j]);
                        texts.push(cmd.texts[j]);
                    }
                }
                var cancelType = cmd.cancelType >= symbols.length ? -2 : cmd.cancelType;
                $gameMessage.setChoices(texts, cmd.defaultType, cancelType);
                $gameMessage.setChoiceBackground(cmd.background);
                $gameMessage.setChoicePositionType(cmd.positionType);
                // コールバックの中身が重要
                $gameMessage.setChoiceCallback(function (n) {
                    // 有効な選択肢のみが表示されている
                    // -> nとsymbolsから選択肢固有のシンボルを得る
                    // -> シンボルと全体のシンボルリストを照らし合わせてインデックスを得る
                    var sym = symbols[n];
                    this._branch[this._indent] = cmd.symbols.indexOf(sym);
                }.bind(i));
            }
            conditionalChoices.setup = setup;
        })(conditionalChoices = proc.conditionalChoices || (proc.conditionalChoices = {}));
    })(proc = rdml.proc || (rdml.proc = {}));
})(rdml || (rdml = {}));
/* rdml.ts: core rdml loader */
/// <reference path="desc.ts" />
/// <reference path="xml.ts" />
/// <reference path="proc.ts" />
var rdml;
(function (rdml) {
    /**
     * API
     */
    function load(file) {
        if (!(file in files)) {
            // has not loaded yet
            files[file] = new File(file);
        }
    }
    rdml.load = load;
    function hasLoaded() {
        var loaded = true;
        for (var name_3 in files) {
            var file = files[name_3];
            loaded = loaded && file.loaded;
        }
        return loaded;
    }
    rdml.hasLoaded = hasLoaded;
    /**
     * Internal
     */
    var files = {};
    var File = /** @class */ (function () {
        function File(name) {
            var _this = this;
            this.name = name;
            this.xhr = new XMLHttpRequest();
            this.loaded = false;
            var path = "rdml/" + name;
            this.xhr.open("GET", path);
            this.xhr.onload = function () {
                if (_this.xhr.status < 400) {
                    _this.onload();
                    _this.loaded = true;
                }
            };
            this.xhr.send();
        }
        // ファイルをパースし、得られた要素から変換する
        File.prototype.onload = function () {
            var nodes = rdml.xml.parseString(this.xhr.responseText);
            for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                var node = nodes_1[_i];
                if (typeof node === "string") {
                    continue;
                } // テキストノードは単に飛ばす
                switch (node.name) {
                    case "proc":
                        rdml.proc.procs[node.word("id", {}, null)] = new rdml.proc.Proc(node);
                        break;
                }
            }
        };
        return File;
    }());
})(rdml || (rdml = {}));
(function () {
    var __pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (cmd, args) {
        __pluginCommand.call(this, cmd, args);
        if (cmd !== "rdml") {
            return;
        }
        var subcmd = args[0];
        if (subcmd === "load") {
            rdml.load(args[1]);
            if (!rdml.hasLoaded()) {
                this.setWaitMode("rdml loading");
            }
        }
        if (subcmd === "proc") {
            rdml.proc.call(this, args[1]);
        }
        if (subcmd === "conditional-choices") {
            var id = Number(args[1]);
            rdml.proc.conditionalChoices.setup(this, id);
            this.setWaitMode("message");
        }
    };
    var __updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === "rdml loading") {
            if (rdml.hasLoaded()) {
                this._waitMode = "";
                return false;
            }
            return true;
        }
        return __updateWaitMode.call(this);
    };
})();
/* validator.ts: validate parameters */
var rdml;
(function (rdml) {
    var check;
    (function (check) {
        var ValError = /** @class */ (function () {
            function ValError(message) {
                this.message = message;
                this.name = "ValidationError";
            }
            ValError.prototype.toString = function () {
                return this.name + ': ' + this.message;
            };
            return ValError;
        }());
        check.ValError = ValError;
        function float(s, min, max, def) {
            if (s === undefined) {
                if (def === null) { // required
                    throw new ValError("required");
                }
                else {
                    return def;
                }
            }
            var f = parseFloat(s);
            if (min !== null) {
                if (f < min) {
                    throw new ValError("check.int: " + s + " must not smaller than " + min);
                }
            }
            if (max !== null) {
                if (max < f) {
                    throw new ValError("check.int: " + s + " must not larger than " + max);
                }
            }
            return f;
        }
        check.float = float;
        function int(s, min, max, def) {
            if (s === undefined) {
                if (def === null) { // required
                    throw new ValError("required");
                }
                else {
                    return def;
                }
            }
            var f = check.float(s, def, min, max);
            var i = parseInt(s);
            if (i !== f) {
                throw new ValError("check.int: " + s + " must be int, not float");
            }
            return i;
        }
        check.int = int;
        function word(s, rules, def) {
            if (s === undefined) {
                if (def === null) { // required
                    throw new ValError("required");
                }
                else {
                    return def;
                }
            }
            s = s.trim();
            if (rules.re) {
                if (!rules.re.test(s)) {
                    throw new ValError("check.word: " + s + " unmatches " + rules.re.toString());
                }
            }
            if (rules.length) {
                if (s.length < rules.length[0]) {
                    throw new ValError("check.word: " + s + " must not be shorter than " + rules.length[0]);
                }
                if (rules.length[1] < s.length) {
                    throw new ValError("check.word: " + s + " must not be longer than " + rules.length[1]);
                }
            }
            return s;
        }
        check.word = word;
        function bool(s, def) {
            if (s === undefined) {
                if (def === null) { // required
                    throw new ValError("required");
                }
                else {
                    return def;
                }
            }
            s = s.trim();
            if (s === "on" || s === "true") {
                return true;
            }
            else if (s === "off" || s === "false") {
                return false;
            }
            throw new ValError("check.bool: " + s + " is invalid string as boolean");
        }
        check.bool = bool;
    })(check = rdml.check || (rdml.check = {}));
})(rdml || (rdml = {}));
