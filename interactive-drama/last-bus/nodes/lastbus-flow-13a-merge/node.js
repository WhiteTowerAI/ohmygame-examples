import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "无法停车", "beats": [{"text": "阿姨仍坐在原位，布袋抱在膝上。"}, {"speaker": "阿姨", "text": "放心，我天天坐。"}, {"text": "她明白了——阿姨没有意识到危险。惊恐停在她脸上一拍。"}, {"text": "撞击声突然响起，画面猛然倾斜——"}, {"text": "黑屏。玻璃破裂声。随后，是水声。"}, {"text": "安静两秒。黑暗中，响起一声投币声。"}], "signal": "next"});
}
