
import { PolyMod, MixinType } from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/0.6.0/PolyTypes.js";

const DEFAULT_STEPS = [
    { key: "W", ms: 1000 },
    { key: "A", ms: 125 },
    { key: "D", ms: 125 }
];

class PolyTrackTAS extends PolyMod {
    input = null;
    running = false;
    stopRequested = false;
    steps = DEFAULT_STEPS.map(x => ({...x}));
    panel = null;

    init = (pml) => {
        this.pml = pml;

        /*
         * PolyTrack 0.6.0 creates its vehicle-input object with:
         *   wP(this, JC, new S_(c), "f"),
         * where S_ is the internal W/A/S/D state object.
         *
         * This global mixin exposes that INTERNAL object instead of
         * synthesizing KeyboardEvents. That is the important difference
         * from the browser extension version.
         */
        pml.registerGlobalMixin({
            type: MixinType.INSERT,
            token: 'wP(this, JC, new S_(c), "f"),',
            func: 'window.__polytrackTASInput = yP(this, JC, "f");'
        });
    };

    postInit = () => {
        this.makePanel();

        // Emergency stop.
        window.addEventListener("keydown", (e) => {
            if (e.code === "Escape") this.stop();
        });
    };

    async play() {
        if (this.running) return;
        if (!window.__polytrackTASInput) {
            alert("TAS input hook was not found. This build is not compatible with the 0.6.0 TAS hook.");
            return;
        }

        this.running = true;
        this.stopRequested = false;

        try {
            for (const step of this.steps) {
                if (this.stopRequested) break;

                const k = String(step.key).toUpperCase();
                const input = window.__polytrackTASInput;

                this.setInput(input, k, true);
                await this.sleep(Math.max(0, Number(step.ms) || 0));
                this.setInput(input, k, false);
            }
        } finally {
            this.clearInput();
            this.running = false;
        }
    }

    stop() {
        this.stopRequested = true;
        this.clearInput();
    }

    setInput(input, key, value) {
        if (key === "W") input.up = value;
        else if (key === "A") input.left = value;
        else if (key === "D") input.right = value;
        else if (key === "S") input.down = value;
    }

    clearInput() {
        const input = window.__polytrackTASInput;
        if (!input) return;
        input.up = false;
        input.left = false;
        input.right = false;
        input.down = false;
    }

    sleep(ms) {
        return new Promise(resolve => {
            const start = performance.now();

            const tick = () => {
                if (this.stopRequested || performance.now() - start >= ms) {
                    resolve();
                } else {
                    requestAnimationFrame(tick);
                }
            };

            requestAnimationFrame(tick);
        });
    }

    makePanel() {
        if (this.panel) return;

        const panel = document.createElement("div");
        this.panel = panel;

        panel.style.cssText = `
            position:fixed;
            right:12px;
            top:12px;
            z-index:2147483647;
            width:300px;
            background:#111;
            color:#fff;
            border:1px solid #555;
            border-radius:8px;
            padding:10px;
            font:13px Arial,sans-serif;
            box-shadow:0 4px 18px rgba(0,0,0,.45);
        `;

        const title = document.createElement("div");
        title.textContent = "PolyTrack TAS";
        title.style.cssText = "font-weight:bold;font-size:16px;margin-bottom:8px;";
        panel.appendChild(title);

        const help = document.createElement("div");
        help.textContent = "Internal input mode • Esc = stop";
        help.style.cssText = "opacity:.7;margin-bottom:8px;";
        panel.appendChild(help);

        const rows = document.createElement("div");
        panel.appendChild(rows);

        const render = () => {
            rows.innerHTML = "";

            this.steps.forEach((step, i) => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:5px;margin:4px 0;";

                const key = document.createElement("select");
                for (const k of ["W","A","D","S"]) {
                    const opt = document.createElement("option");
                    opt.value = k;
                    opt.textContent = k;
                    if (step.key === k) opt.selected = true;
                    key.appendChild(opt);
                }
                key.onchange = () => step.key = key.value;

                const ms = document.createElement("input");
                ms.type = "number";
                ms.min = "0";
                ms.step = "1";
                ms.value = step.ms;
                ms.style.width = "90px";
                ms.onchange = () => step.ms = Math.max(0, Number(ms.value) || 0);

                const del = document.createElement("button");
                del.textContent = "×";
                del.onclick = () => {
                    this.steps.splice(i, 1);
                    render();
                };

                row.append(key, ms, del);
                rows.appendChild(row);
            });
        };

        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:5px;margin-top:8px;";

        const add = document.createElement("button");
        add.textContent = "+ Step";
        add.onclick = () => {
            this.steps.push({key:"W", ms:100});
            render();
        };

        const play = document.createElement("button");
        play.textContent = "START";
        play.onclick = () => this.play();

        const stop = document.createElement("button");
        stop.textContent = "STOP";
        stop.onclick = () => this.stop();

        buttons.append(add, play, stop);
        panel.appendChild(buttons);

        const note = document.createElement("div");
        note.textContent = "Timing uses performance.now() + animation frames; it controls the game's internal input state, not fake key events.";
        note.style.cssText = "opacity:.6;font-size:11px;margin-top:8px;";
        panel.appendChild(note);

        document.body.appendChild(panel);
        render();
    }
}

export let polyMod = new PolyTrackTAS();
