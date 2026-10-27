import { mountChoice } from "../../shared/story/choice.js";

export function mount(context) {
  return mountChoice(context, {"hud": "最终选择", "prompt": "司机轻轻敲了一下方向盘。「走不走？」", "options": [{"label": "上车", "signal": "board"}, {"label": "留在站台", "signal": "stay"}]});
}
