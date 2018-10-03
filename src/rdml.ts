/* rdml.ts: core rdml loader */

/// <reference path="desc.ts" />
/// <reference path="xml.ts" />
/// <reference path="proc.ts" />

namespace rdml {

    /**
     * API
     */
    export function load(file: string) {
        if (!(file in files)) {
            // has not loaded yet
            files[file] = new File(file);
        }
    }

    export function hasLoaded(): boolean {
        let loaded = true;
        for (const name in files) {
            const file = files[name];
            loaded = loaded && file.loaded;
        }
        return loaded;
    }

    /**
     * Internal
     */
    let files: { [id: string]: File } = {};

    class File {
        xhr: XMLHttpRequest = new XMLHttpRequest();
        loaded: boolean = false;

        constructor(private name: string) {
            const path = "rdml/" + name;
            this.xhr.open("GET", path);
            this.xhr.onload = () => {
                if (this.xhr.status < 400) {
                    this.onload();
                    this.loaded = true;
                }
            };
            this.xhr.send();
        }

        // ファイルをパースし、得られた要素から変換する
        onload() {
            const nodes = xml.parseString(this.xhr.responseText);
            for (const node of nodes) {
                if (typeof node === "string") { continue; } // テキストノードは単に飛ばす
                switch (node.name) {
                    case "proc":
                        proc.procs[node.word("id", {}, null)] = new proc.Proc(node);
                        break;
                }
            }
        }
    }
}

(() => {

    const __pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(cmd: string, args: string[]) {
        __pluginCommand.call(this, cmd, args);

        if (cmd !== "rdml") { return; }

        const subcmd = args[0];
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
            const id = Number(args[1]);
            rdml.proc.conditionalChoices.setup(this, id);
            this.setWaitMode("message");
        }
    }

    const __updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === "rdml loading") {
            if (rdml.hasLoaded()) {
                this._waitMode = "";
                return false;
            }
            return true;
        }
        return __updateWaitMode.call(this);
    }
})();
