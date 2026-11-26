import { mountReveal } from "../../shared/story/reveal.js";

export function mount(context) {
  return mountReveal(context, {"hud": "便利店", "prompt": "她的视线停在桌上那份报纸上。", "gate": {"label": "报纸", "x": 26, "y": 62}, "revealAsset": "newspaper", "beats": [{"text": "报纸头版：「17路公交坠河事故追踪」"}, {"text": "「三名失联人员已确认遇难」"}, {"text": "她慢慢转头，看向窗外已经空了的站台。"}], "signal": "next"});
}
