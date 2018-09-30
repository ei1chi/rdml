/* rdml.ts: core rdml loader */

/// <reference path="desc.ts" />
/// <reference path="xml.ts" />

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
                    this.create();
                    this.loaded = true;
                }
            };
            this.xhr.send();
        }

        create() { }
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
