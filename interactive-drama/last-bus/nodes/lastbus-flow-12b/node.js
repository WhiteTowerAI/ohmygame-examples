import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "便利店", "beats": [{"text": "门铃响起。冷柜运转声、店内广播、店员整理货架的声音，重新填满画面。"}, {"text": "她在临窗的桌边坐下，打开打车软件，点击「继续等待」。屏幕重新显示：正在寻找司机……"}, {"speaker": "店员", "text": "外面挺冷的吧？热水在那边，可以接。"}, {"speaker": "女生", "text": "谢谢。"}, {"text": "她接了热水，在窗边坐下，把工作包放在桌边。"}, {"text": "桌上摊着一份报纸，一行熟悉的线路名称吸引了她的目光。"}], "signal": "next"});
}
