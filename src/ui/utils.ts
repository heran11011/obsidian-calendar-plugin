import type { TFile } from "obsidian";
import { getDateFromFile, getDateUID } from "obsidian-daily-notes-interface";

export const classList = (obj: Record<string, boolean>): string[] => {
  return Object.entries(obj)
    .filter(([_k, v]) => !!v)
    .map(([k, _k]) => k);
};

export function clamp(
  num: number,
  lowerBound: number,
  upperBound: number
): number {
  return Math.min(Math.max(lowerBound, num), upperBound);
}

export function partition(
  arr: string[],
  predicate: (elem: string) => boolean
): [string[], string[]] {
  const pass = [];
  const fail = [];

  arr.forEach((elem) => {
    if (predicate(elem)) {
      pass.push(elem);
    } else {
      fail.push(elem);
    }
  });

  return [pass, fail];
}

/**
 * Lookup the dateUID for a given file. It compares the filename
 * to the daily and weekly note formats to find a match.
 *
 * @param file
 */
export function getDateUIDFromFile(file: TFile | null): string {
  if (!file) {
    return null;
  }

  // TODO: I'm not checking the path!
  let date = getDateFromFile(file, "day");
  if (date) {
    return getDateUID(date, "day");
  }

  date = getDateFromFile(file, "week");
  if (date) {
    return getDateUID(date, "week");
  }
  return null;
}

/**
 * 计算字数
 * @param text 文本内容
 * @param useChinese 是否开启中文精准模式
 */
export function getWordCount(text: string, useChinese = false): number {
  
  // 模式 1：中文精准模式 (开启开关时)
  if (useChinese) {
    if (!text) return 0;
    // 1. 去掉 YAML 属性
    const cleanText = text.replace(/^---[\s\S]+?---/, '');
    // 2. 数汉字
    const cjkCount = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 3. 数英文单词 (把汉字换成空格后统计)
    const enCount = (cleanText.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
    
    return cjkCount + enCount;
  }

  // 模式 2：原版英文模式 (关闭开关时)
  // 这是原插件的默认逻辑，保留它以兼容老外习惯
  return (text.match(/\S+/g) || []).length;
}
