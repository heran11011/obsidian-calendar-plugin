import type { Moment } from "moment";
import type { TFile } from "obsidian";
import type { ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { getDailyNote, getWeeklyNote } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { DEFAULT_WORDS_PER_DOT } from "src/constants";

import { dailyNotes, settings, weeklyNotes } from "../stores";
import { clamp, getWordCount } from "../utils";


export async function getWordLengthAsDots(note: TFile): Promise<number> {
  // 1. 【修改】解构出 useChineseWordCount
  // (如果 useChineseWordCount 报红线，就在分号前加个 " as any" )
const { wordsPerDot = DEFAULT_WORDS_PER_DOT, useChineseWordCount, maxDots = 5 } = get(settings) as any;

  if (!note || wordsPerDot <= 0) {
    return 0;
  }
  const fileContents = await window.app.vault.cachedRead(note);

  // 2. 【修改】把开关状态传给 getWordCount
  const wordCount = getWordCount(fileContents, useChineseWordCount);
  
  const numDots = wordCount / wordsPerDot;
  return clamp(Math.floor(numDots), 1, maxDots);
}

export async function getDotsForDailyNote(
  dailyNote: TFile | null
): Promise<IDot[]> {
  if (!dailyNote) {
    return [];
  }
  const numSolidDots = await getWordLengthAsDots(dailyNote);

  const dots = [];
  for (let i = 0; i < numSolidDots; i++) {
    dots.push({
      color: "default",
      isFilled: true,
      className:"",
    });
  }
  return dots;
}

export const wordCountSource: ICalendarSource = {
getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getDailyNote(date, get(dailyNotes));
    
    // 1. 获取小圆点 (原逻辑)
    const dots = await getDotsForDailyNote(file);
    
    // 2. 【新增】获取心情 CSS 类
    const classes = getMoodClass(file);

    // 3. 返回给日历
    return {
      dots,
      classes, // <--- 把这个加进去！
    };
  },

  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getWeeklyNote(date, get(weeklyNotes));
    const dots = await getDotsForDailyNote(file);

    return {
      dots,
    };
  },
};

/**
 * 读取日记的 Frontmatter，判断心情，并返回对应的 CSS 类名
 */
export function getMoodClass(file: TFile | null): string[] {
  if (!file) return [];

  // 1. 获取文件的元数据缓存
  const cache = window.app.metadataCache.getFileCache(file);
  
  // 2. 如果没有 Frontmatter (文档属性)，直接返回空
  if (!cache || !cache.frontmatter) return [];

  // 3. 读取 'mood' 字段
  const mood = cache.frontmatter.mood;

  if (!mood) return [];

  // 4. 简单的关键词匹配 (您可以根据喜好自由添加！)
  // 支持中文和英文
  if (mood === '开心' || mood === 'happy' || mood === 'good'|| mood ==='快乐' || mood ==='棒极了'|| mood ==='非常好'|| mood ==='超级棒'|| mood ==='美滋滋'|| mood ==='妥妥的'|| mood ==='兴奋'|| mood ==='激动'|| mood ==='满足'|| mood ==='幸福'|| mood ==='喜悦') {
    return ['mood-happy'];
  }
  if (mood === '难过' || mood === 'sad' || mood === 'bad' || mood ==='宝宝不开心' || mood ==='不开心'|| mood ==='伤心'|| mood ==='心情不好'|| mood ==='郁闷'|| mood ==='崩溃'|| mood ==='难受'|| mood ==='惨了') {
    return ['mood-sad'];
  }
  if (mood === '平静' || mood === 'neutral' || mood === 'normal' || mood ==='一般' || mood ==='还行' || mood ==='马马虎虎' || mood ==='凑合'|| mood ==='无感'|| mood ==='淡定'|| mood ==='随意'|| mood ==='无所谓'|| mood ==='中立'|| mood ==='普通') {
    return ['mood-neutral'];
  }
  if (mood === '生气' || mood === 'angry' || mood === 'mad' || mood === 'terrible' || mood ==='特么的' || mood ==='他妈的' || mood ==='操你妈' || mood ==='去你妈的' || mood ==='滚你妈的') {
    return ['mood-angry'];
  }
  if (mood === '活力' || mood === 'energetic' || mood ==='冲' || mood ==='冲冲冲'|| mood ==='加油' || mood ==='加把劲' || mood ==='奋斗' || mood ==='努力'|| mood ==='拼搏') {
    return ['mood-energetic'];
  }

  return [];
}
