import script from "../../stories/sponsor/free-chat.json";
import type { ChatMessage } from "./client";

type Pool = keyof typeof script.pools;
type Topic = (typeof script.topics)[number]["id"];
type Slot = "amount" | "time" | "place" | "food" | "topic";
type State = {
  waiting: Slot | "";
  topic: string;
  stopped: boolean;
  paused: boolean;
  time: string;
  place: string;
  food: string;
  dislikes: string[];
  amount: string;
  counts: Record<string, number>;
  previous: string;
};
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().trim();
const question = (text: string) =>
  /[?？]|吗|嗎|么|麼|多少|几点|幾點|什么|什麼|哪|为啥|为什么/.test(text);
const short = (text: string) => text.replace(/[。！!，,、~～]/g, "").trim();
const affirmative = (text: string) =>
  /^(好[的啊呀吧哦]?|可以[啊呀]?|行[啊吧]?|嗯[嗯哼]?|ok|okay|yes|没问题|沒問題|愿意|願意)$/.test(
    short(text),
  );
const hasKeyword = (text: string, keyword: string) => {
  if (!/^[a-z ]+$/.test(keyword)) return text.includes(keyword);
  return new RegExp(`\\b${keyword}\\b`, "i").test(text);
};

function step(text: string, state: State): string {
  const value = normalize(text);
  const say = (pool: Pool) => {
    const lines = script.pools[pool];
    const count = state.counts[pool] || 0;
    state.counts[pool] = count + 1;
    return lines[count % lines.length];
  };
  const ask = (pool: Pool, waiting: Slot | "" = "") => {
    state.topic = pool;
    state.waiting = waiting;
    return say(pool);
  };
  if (
    /别再联系|別再聯繫|不要联系|不要聯繫|别找我|別找我|别发了|別發了|别回了|不要回复|不要回覆|到此为止/.test(
      value,
    )
  ) {
    state.stopped = true;
    state.paused = true;
    state.waiting = "";
    return say("leave");
  }
  if (state.stopped) {
    if (/继续聊|繼續聊|重新聊|聊聊|在吗|在嗎|你好|hello|hey/.test(value)) {
      state.stopped = false;
      return ask("resume", "topic");
    }
    return say("quiet");
  }
  if (
    /不想见|不想見|先不见|先不見|不见面|不見面|不想约|不去见|不去見|取消见面|取消約|取消约|别来找|别过来/.test(
      value,
    )
  ) {
    state.time = "";
    state.place = "";
    return ask("cancelMeet", "topic");
  }
  if (
    /不需要.{0,4}(钱|錢|资助|資助)|不要.{0,4}(钱|錢|资助|資助)|不想.{0,4}(钱|錢|资助|資助)|不谈钱|不談錢|钱先不谈/.test(
      value,
    )
  ) {
    state.paused = true;
    return ask("noMoney", "topic");
  }
  if (
    /不喜欢你|不喜歡你|没兴趣|沒興趣|别撩|別撩|别调情|別調情|别叫我|別叫我/.test(
      value,
    )
  )
    return ask("distance", "topic");
  if (
    /不愿意|不願意|我拒绝|我拒絕|不接受|不想答应|不想答應|我不答应|我不答應|不想被包养|不要这种安排|算了吧|不考虑|不考慮/.test(
      value,
    ) ||
    /^(不要|拒绝|拒絕|不行|不用了)$/.test(short(value))
  ) {
    state.paused = true;
    return ask("refuse", "topic");
  }
  if (
    /考虑一下|考慮一下|想一想|再想想|慢慢来|慢慢來|还没决定|還沒決定|没想好|先不谈|先不談|先等等/.test(
      value,
    )
  ) {
    state.paused = true;
    return ask("pause", "topic");
  }
  if (/睡不着|睡不著|失眠|不想睡|还不睡|還不睡|还没睡|還沒睡/.test(value))
    return ask("awake", "topic");
  if (/晚安|睡了|去睡|先睡|good ?night|\bbye\b|拜拜|再见|再見/.test(value))
    return ask("goodnight");
  if (/你呢|你呐|你吶|你自己呢|what about you/.test(value)) {
    if (["food", "foodChoice", "dislike"].includes(state.topic))
      return (
        "我今晚想吃点热的，刚才在看附近的汤饭。" +
        (state.dislikes.length
          ? `\n\n你说过不吃${state.dislikes.join("、")}，我记着。`
          : "\n\n你有没有一直吃不腻的一道菜？")
      );
    if (
      ["time", "timeChoice", "place", "placeChoice", "meet"].includes(
        state.topic,
      )
    )
      return "我这边可以先留明晚八点。地点听你的，确定前都还能改。";
    if (["mood", "tired", "work", "busy"].includes(state.topic))
      return ask("busy", "topic");
    return ask("hobby", "topic");
  }
  if (
    /没听懂|沒聽懂|听不懂|看不懂|解释一下|解釋一下|哪一句|说清楚|說清楚/.test(
      value,
    )
  )
    return say("clarify");

  const dislike = value.match(
    /(?:不吃|不爱吃|不愛吃|不喜欢吃|不喜歡吃|不能吃|忌口[是：:]?|过敏|過敏)\s*([^。！？!?，,]{1,36})/,
  );
  if (dislike && !question(value)) {
    state.dislikes = [...new Set([...state.dislikes, dislike[1].trim()])].slice(
      -8,
    );
    state.topic = "dislike";
    state.waiting = "food";
    return `记住了，${dislike[1].trim()}先避开。真要一起吃饭，菜单也会先给你看。\n\n那你比较喜欢吃什么？`;
  }
  // Questions and negations must never be recorded as the player's decision.
  const amount = value.match(
    /(?:[\d一二三四五六七八九十两兩]+(?:[.,][\d]+)?\s*(?:万|萬|千|百)\s*(?:韩元|韓元|人民币|人民幣|美元|元|块|塊|美金)?|\d[\d,.]*\s*(?:韩元|韓元|人民币|人民幣|美元|元|块|塊|美金))/,
  )?.[0];
  const time = value
    .match(
      /(?:今天|明天|后天|後天|今晚|明晚|周[一二三四五六日天末]|週[一二三四五六日天末]|星期[一二三四五六日天])(?:\s*(?:早上|下午|中午|晚上))?(?:\s*(?:\d{1,2}|[一二三四五六七八九十两兩]{1,3})\s*(?::\d{2}|点半?|點半?))?|(?:早上|下午|中午|晚上)?\s*(?:\d{1,2}|[一二三四五六七八九十两兩]{1,3})\s*(?::\d{2}|点半?|點半?)/,
    )?.[0]
    ?.trim();
  const place = [
    ...new Set(
      value.match(
        /(?:咖啡(?:店|馆|館)|公共场所|公共場所|餐厅|餐廳|汉南(?:洞)?|漢南(?:洞)?|江南|清潭(?:洞)?|首尔|首爾|弘大|圣水|聖水)/g,
      ) || [],
    ),
  ].join("的");
  const food =
    value.match(
      /(?:想吃|喜欢吃|喜歡吃|爱吃|愛吃|吃个|吃個|吃点|吃點)\s*([^。！？!?，,]{1,24})/,
    )?.[1] ||
    (state.waiting === "food"
      ? value.match(
          /火锅|火鍋|烤肉|猪排|豬排|意面|面条|麵條|拉面|拉麵|牛排|汉堡|漢堡|汤饭|湯飯|日料|寿司|壽司|披萨|披薩|炸鸡|炸雞/,
        )?.[0]
      : undefined);
  const proposed = !question(value) && !/不|没|沒|别|別|取消/.test(value);
  if (
    amount &&
    proposed &&
    (state.waiting === "amount" ||
      /每月|每个月|一个月|钱|錢|预算|預算|金额|金額/.test(value))
  ) {
    state.amount = amount;
    state.topic = "amountChoice";
    state.waiting = "topic";
    return `你提的${amount}，我记下了。先当作讨论的范围，具体安排还要一起谈。\n\n除了金额，你最想先定下哪条界限？`;
  }
  if (
    time &&
    proposed &&
    !/练习|練習|工作|排练|通告|训练|忙|上班|有事/.test(value) &&
    (state.waiting === "time" || /见|見|空|方便|可以|定|就/.test(value))
  ) {
    state.time = time;
    if (place) state.place = place;
    state.topic = "timeChoice";
    state.waiting = place ? "topic" : "place";
    return `先按你说的${time}${place ? `，${place}` : ""}来考虑。${place ? "确定前都能再改。" : "你那天如果临时有行程，告诉我就好。"}\n\n${place ? "还有什么希望我提前注意的？" : "地点想选你熟悉的咖啡店，还是餐厅？"}`;
  }
  if (
    place &&
    proposed &&
    (state.waiting === "place" || /选|選|见|見|约|約|去|就|可以/.test(value))
  ) {
    state.place = place;
    state.topic = "placeChoice";
    state.waiting = state.time ? "food" : "time";
    return `${place}可以列作候选。${state.time ? `时间先按你提的${state.time}考虑。` : "时间还没定，你哪天方便？"}\n\n${state.time ? "要一起吃点东西的话，你有什么忌口？" : "你也可以随时改主意。"}`;
  }
  if (food && proposed) {
    state.food = food.trim();
    state.topic = "foodChoice";
    state.waiting = "topic";
    return `${food.trim()}，记住了。${state.dislikes.length ? `你说过不吃${state.dislikes.join("、")}，选的时候也一起注意。` : "以后选店可以从这个开始看。"}\n\n你吃饭时喜欢慢慢聊，还是先认真吃完？`;
  }
  if (/记得|記得|记住|記住|刚才说|剛才說|我说过|我說過/.test(value)) {
    const facts = [
      state.time && `你提过的时间是${state.time}`,
      state.place && `地点候选是${state.place}`,
      state.food && `你想吃${state.food}`,
      state.dislikes.length && `不吃${state.dislikes.join("、")}`,
      state.amount && `金额讨论到${state.amount}`,
    ].filter(Boolean);
    return facts.length
      ? `记得。${facts.join("；")}。\n\n这些都还可以改，哪一项想接着聊？`
      : "记得你还没有答应任何安排。具体的时间、地点和金额，我们都还没定。\n\n你想先谈哪一项？";
  }
  if (/头像|頭像/.test(value))
    return "你在看我头像？那张比活动照随意得多。\n\n本来没想太久，被你一提，我倒开始在意了。";
  if (/毕业照|畢業照/.test(value))
    return "那张毕业照看着太认真了。\n\n你喜欢那时候的样子，还是现在这样？";
  if (/生活照|游玩照|遊玩照/.test(value))
    return "那些生活照我没有发到 IG。\n\n比起活动照，我更喜欢拍照那天可以慢慢逛的感觉。你旅行时喜欢拍很多，还是随手留几张？";
  if (affirmative(value)) {
    if (state.waiting === "time")
      return "那你给我一个大概时间？哪一天、几点都可以先提，没必要现在就把整晚定下来。";
    if (state.waiting === "place")
      return "那地点听你的。你熟悉的咖啡店，或者方便到达的餐厅，先给我一个方向？";
    if (state.waiting === "food")
      return "你平时喜欢吃什么？有不吃的东西，也一起告诉我。";
    if (state.waiting === "amount")
      return "你可以先说一个范围。具体金额和界限，我们再一起确认。";
    return ask("continue", "topic");
  }
  if (
    /^(继续|繼續|然后呢|然後呢|你说|你說|说点什么|說點什麼|随便聊聊|隨便聊聊)[。.!！]*$/.test(
      value,
    )
  )
    return ask("continue", "topic");
  const topic = script.topics.find((t) =>
    t.keywords.some((k) => hasKeyword(value, k)),
  )?.id as Topic | undefined;
  if (topic) {
    if (topic === "terms" || topic === "money") state.paused = false;
    const waiting: Slot | "" =
      topic === "money"
        ? "amount"
        : topic === "meet" || topic === "time"
          ? "time"
          : topic === "place"
            ? "place"
            : topic === "food"
              ? "food"
              : "topic";
    return ask(topic as Pool, waiting);
  }
  state.waiting = "topic";
  return say("fallback");
}

/** Replay player messages to keep local story context in the existing save. */
export function demoReply(messages: ChatMessage[]): string {
  const state: State = {
    waiting: "",
    topic: "",
    stopped: false,
    paused: false,
    time: "",
    place: "",
    food: "",
    amount: "",
    dislikes: [],
    counts: {},
    previous: "",
  };
  let reply = "";
  for (const message of messages) {
    if (message.role !== "user" || !message.content.trim()) continue;
    reply = step(message.content.slice(0, 2000), state);
    // Avoid the same exact bubble twice in a row, including repeated questions.
    if (reply === state.previous && !state.stopped) {
      const count = state.counts.clarify || 0;
      reply = script.pools.clarify[count % script.pools.clarify.length];
      state.counts.clarify = count + 1;
    }
    state.previous = reply;
  }
  return reply || "我在。今天想聊什么？";
}
