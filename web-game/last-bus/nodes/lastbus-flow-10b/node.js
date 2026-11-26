import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  const heard = context.state.get("heardNotice") === true;
  return mountCutscene(context, {
    hud: "第五场 · 留在灯下",
    beats: [
      { speaker: "女生", text: heard ? "停运通知还在，我还是打车吧。" : "算了，我还是打车吧。" },
      { text: "她抱紧工作包，后退了一步。" },
    ],
    signal: "next",
  });
}
