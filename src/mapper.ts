/* mapper.ts: mapping object names to ids */

namespace rdml.mapper {
    type Mapper = { [name: string]: number };

    export let vars: Mapper = {};
    export let sws: Mapper = {};
    export let ssws: Mapper = {};
}

(() => {

    const __createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function() {
        __createGameObjects.call(this);

        for (let i = 0; i < $dataSystem.variables.length; i++) {
            const name = $dataSystem.variables[i];
            if (name === "") { continue; }
            rdml.mapper.vars[name] = i;
        }
    }
})();
