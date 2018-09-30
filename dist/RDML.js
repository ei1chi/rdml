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
            Element.prototype.require = function (id) {
                if (!(id in this.attrs)) {
                    throw new rdml.check.ValError("element " + this.name + ": requires attribute " + id);
                }
            };
            Element.prototype.requireInt = function (id, min, max) {
                this.require(id);
                return rdml.check.int(this.attrs[id], 0, min, max);
            };
            Element.prototype.int = function (id, def, min, max) {
                return rdml.check.int(this.attrs[id], def, min, max);
            };
            Element.prototype.requireFloat = function (id, min, max) {
                this.require(id);
                return rdml.check.float(this.attrs[id], 0, min, max);
            };
            Element.prototype.float = function (id, def, min, max) {
                return rdml.check.float(this.attrs[id], def, min, max);
            };
            Element.prototype.requireWord = function (id, rules) {
                this.require(id);
                return rdml.check.word(this.attrs[id], "", rules);
            };
            Element.prototype.word = function (id, def, rules) {
                return rdml.check.word(this.attrs[id], def, rules);
            };
            Element.prototype.requireBool = function (id) {
                this.require(id);
                return rdml.check.bool(this.attrs[id], false);
            };
            Element.prototype.bool = function (id, def) {
                return rdml.check.bool(this.attrs[id], def);
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
                            var name_1 = this.slice(start);
                            if (name_1 !== parentName) {
                                this.pushError("tag names mismatch, open='" + parentName + "', close='" + name_1 + "'");
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
/* rdml.ts: core rdml loader */
/// <reference path="desc.ts" />
/// <reference path="xml.ts" />
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
        for (var name_2 in files) {
            var file = files[name_2];
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
                    _this.create();
                    _this.loaded = true;
                }
            };
            this.xhr.send();
        }
        File.prototype.create = function () { };
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
        function float(s, def, min, max) {
            if (s === undefined) {
                return def;
            }
            var f = parseFloat(s);
            if (min) {
                if (f < min) {
                    throw new ValError("check.int: " + s + " must not smaller than " + min);
                }
            }
            if (max) {
                if (max < f) {
                    throw new ValError("check.int: " + s + " must not larger than " + max);
                }
            }
            return f;
        }
        check.float = float;
        function int(s, def, min, max) {
            if (s === undefined) {
                return def;
            }
            var f = check.float(s, def, min, max);
            var i = parseInt(s);
            if (i !== f) {
                throw new ValError("check.int: " + s + " must be int, not be float");
            }
            return i;
        }
        check.int = int;
        function word(s, def, rules) {
            if (s === undefined) {
                return def;
            }
            s = s.trim();
            if (rules) {
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
            }
            return s;
        }
        check.word = word;
        function bool(s, def) {
            if (s === undefined) {
                return def;
            }
            s = s.trim();
            if (s === "on" || s === "true") {
                return true;
            }
            else if (s === "off" || s === "false") {
                return false;
            }
            throw new ValError("check.bool: invalid string as boolean " + s);
        }
        check.bool = bool;
    })(check = rdml.check || (rdml.check = {}));
})(rdml || (rdml = {}));
