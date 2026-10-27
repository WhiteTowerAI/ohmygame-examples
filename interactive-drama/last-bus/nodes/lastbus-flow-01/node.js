import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "第一场 · 今晚加班", "beats": [{"text": "办公室的灯大多已经熄灭。"}, {"text": "00:08。她发完文件，工作群弹出一条消息：「辛苦，明早9:00会议室讨论下。」"}, {"speaker": "女生", "text": "……好。"}, {"text": "她合上电脑，拿起工作包。"}, {"text": "写字楼门口，雨还在下。打车软件显示「正在寻找司机……」"}, {"text": "暂未找到车辆。街对面，一家便利店还亮着灯，旁边是公交站。"}, {"speaker": "女生", "text": "应该还来得及……过了桥再走几百米，也还行。"}, {"text": "站牌：17路，末班发车 00:00。她收起伞，坐进候车亭。手机显示 00:14。"}], "signal": "next"});
}
