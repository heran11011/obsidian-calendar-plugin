import { App, PluginSettingTab, Setting } from "obsidian";
import { appHasDailyNotesPluginLoaded } from "obsidian-daily-notes-interface";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import { DEFAULT_WEEK_FORMAT, DEFAULT_WORDS_PER_DOT } from "src/constants";

import type CalendarPlugin from "./main";

export interface ISettings {
  useChineseWordCount: boolean;
  maxDots: number; // 满分是几颗星
  wordsPerDot: number;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;

  // Weekly Note settings
  showWeeklyNote: boolean;
  weeklyNoteFormat: string;
  weeklyNoteTemplate: string;
  weeklyNoteFolder: string;

  localeOverride: ILocaleOverride;

  // ... 其他设置
  moodColorHappy: string;
  moodColorSad: string;
  moodColorNeutral: string;
  moodColorAngry: string;
  moodColorEnergetic: string;
}

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const defaultSettings = Object.freeze({
  maxDots: 5, // 满分是5颗星
  shouldConfirmBeforeCreate: true,
  weekStart: "locale" as IWeekStartOption,

  wordsPerDot: DEFAULT_WORDS_PER_DOT,

  useChineseWordCount: false,

  showWeeklyNote: false,
  weeklyNoteFormat: "",
  weeklyNoteTemplate: "",
  weeklyNoteFolder: "",

  localeOverride: "system-default",

  // ... 其他默认值
  moodColorHappy: "#FFB7B2",
  moodColorSad: "#A0C4FF",
  moodColorNeutral: "#B5EAD7",
  moodColorAngry: "#FF6B6B",
  moodColorEnergetic: "#FDFFB6",
});

export function appHasPeriodicNotesPluginLoaded(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodicNotes = (<any>window.app).plugins.getPlugin("periodic-notes");
  return periodicNotes && periodicNotes.settings?.weekly?.enabled;
}

export class CalendarSettingsTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

// 🎨 辅助函数：把设置里的颜色应用到 CSS 变量
  applyMoodColors(): void {
    const { moodColorHappy, moodColorSad, moodColorNeutral, moodColorAngry, moodColorEnergetic } = this.plugin.options;
    
    // 获取文档根节点
    const root = document.body;
    
    // 设置 CSS 变量
    root.style.setProperty('--mood-color-happy', moodColorHappy);
    root.style.setProperty('--mood-color-sad', moodColorSad);
    root.style.setProperty('--mood-color-neutral', moodColorNeutral);
    root.style.setProperty('--mood-color-angry', moodColorAngry);
    root.style.setProperty('--mood-color-energetic', moodColorEnergetic);
  }


  display(): void {
    this.containerEl.empty();

    if (!appHasDailyNotesPluginLoaded()) {
      this.containerEl.createDiv("settings-banner", (banner) => {
        banner.createEl("h3", {
          text: "⚠️ Daily Notes plugin not enabled",
        });
        banner.createEl("p", {
          cls: "setting-item-description",
          text:
            "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
        });
      });
    }

    this.containerEl.createEl("h3", {
      text: "General Settings",
    });
    this.addDotThresholdSetting();
    // === 插入的新开关 ===
    new Setting(this.containerEl)
      .setName("开启中文精准计数 (Chinese Word Count)")
      .setDesc("启用混合统计逻辑：汉字算1词，英文按单词统计，不计标点。开启后建议调低'Words per dot'。")
      .addToggle((toggle) => {
        // 读取当前值 (注意：如果报错，请试着把 options 改成 settings)
        toggle.setValue(this.plugin.options.useChineseWordCount); 
        toggle.onChange(async (value) => {
          // 保存新值
          this.plugin.writeOptions((old) => {
    old.useChineseWordCount = value;
    return old; // 👈 关键在这里：要把修改后的对象返回去
});
          // 这一步是为了让日历刷新一下，虽然它通常会自动刷新
        });
      });
    // ==================
    // === 新增：满分点数设置 ===
    new Setting(this.containerEl)
      .setName("满分点数 (Max Dots)")
      .setDesc("设置日历格子下方最多显示多少颗圆点。")
      .addSlider((slider) => {
        slider
          .setLimits(1, 10, 1) // 最小值1，最大值10，步长1
          .setValue(this.plugin.options.maxDots)
          .setDynamicTooltip() // 拖动时显示数字
          .onChange(async (value) => {
            this.plugin.writeOptions((old) => {
              old.maxDots = value;
              return old;
            });
          });
      });
      this.containerEl.createEl("h3", { text: "🎨 心情配色 (Mood Colors)" });

    // 😊 开心颜色
    new Setting(this.containerEl)
      .setName("开心/哈哈哈哈 (Happy)")
      .addColorPicker((color) => {
        color.setValue(this.plugin.options.moodColorHappy)
             .onChange(async (value) => {
               this.plugin.writeOptions((old) => { old.moodColorHappy = value; return old; });
               this.applyMoodColors(); // 实时预览：一改颜色马上生效
             });
      });

    // 😔 难过颜色
    new Setting(this.containerEl)
      .setName("难过/宝宝不开心 (Sad)")
      .addColorPicker((color) => {
        color.setValue(this.plugin.options.moodColorSad)
             .onChange(async (value) => {
               this.plugin.writeOptions((old) => { old.moodColorSad = value; return old; });
               this.applyMoodColors();
             });
      });
      // 😐 平静颜色
    new Setting(this.containerEl)
      .setName("平静/心如止水 (Neutral)")
      .addColorPicker((color) => {
        color.setValue(this.plugin.options.moodColorNeutral)
             .onChange(async (value) => {
               this.plugin.writeOptions((old) => { old.moodColorNeutral = value; return old; });
               this.applyMoodColors();
             });
      });

    // 😡 生气颜色
    new Setting(this.containerEl)
      .setName("生气/特么的 (Angry)")
      .addColorPicker((color) => {
        color.setValue(this.plugin.options.moodColorAngry)
             .onChange(async (value) => {
               this.plugin.writeOptions((old) => { old.moodColorAngry = value; return old; });
               this.applyMoodColors();
             });
      });

    // ⚡ 活力颜色
    new Setting(this.containerEl)
      .setName("活力/冲冲冲 (Energetic)")
      .addColorPicker((color) => {
        color.setValue(this.plugin.options.moodColorEnergetic)
             .onChange(async (value) => {
               this.plugin.writeOptions((old) => { old.moodColorEnergetic = value; return old; });
               this.applyMoodColors();
             });
      });
    




    // ========================
    this.addWeekStartSetting();
    this.addConfirmCreateSetting();
    this.addShowWeeklyNoteSetting();

    if (
      this.plugin.options.showWeeklyNote &&
      !appHasPeriodicNotesPluginLoaded()
    ) {
      this.containerEl.createEl("h3", {
        text: "Weekly Note Settings",
      });
      this.containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
          "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
      });
      this.addWeeklyNoteFormatSetting();
      this.addWeeklyNoteTemplateSetting();
      this.addWeeklyNoteFolderSetting();
    }

    this.containerEl.createEl("h3", {
      text: "Advanced Settings",
    });
    this.addLocaleOverrideSetting();
  }

  addDotThresholdSetting(): void {
    new Setting(this.containerEl)
      .setName("Words per dot")
      .setDesc("How many words should be represented by a single dot?")
      .addText((textfield) => {
        textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
        textfield.inputEl.type = "number";
        textfield.setValue(String(this.plugin.options.wordsPerDot));
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            wordsPerDot: value !== "" ? Number(value) : undefined,
          }));
        });
      });
  }

  addWeekStartSetting(): void {
    const { moment } = window;

    const localizedWeekdays = moment.weekdays();
    const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
    const localeWeekStart = moment.weekdays()[localeWeekStartNum];

    new Setting(this.containerEl)
      .setName("Start week on:")
      .setDesc(
        "Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.options.weekStart);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            weekStart: value as IWeekStartOption,
          }));
        });
      });
  }

  addConfirmCreateSetting(): void {
    new Setting(this.containerEl)
      .setName("Confirm before creating new note")
      .setDesc("Show a confirmation modal before creating a new note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            shouldConfirmBeforeCreate: value,
          }));
        });
      });
  }

  addShowWeeklyNoteSetting(): void {
    new Setting(this.containerEl)
      .setName("Show week number")
      .setDesc("Enable this to add a column with the week number")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showWeeklyNote);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
          this.display(); // show/hide weekly settings
        });
      });
  }

  addWeeklyNoteFormatSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note format")
      .setDesc("For more syntax help, refer to format reference")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFormat);
        textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
        });
      });
  }

  addWeeklyNoteTemplateSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note template")
      .setDesc(
        "Choose the file you want to use as the template for your weekly notes"
      )
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteTemplate);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
        });
      });
  }

  addWeeklyNoteFolderSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note folder")
      .setDesc("New weekly notes will be placed here")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFolder);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
        });
      });
  }

  addLocaleOverrideSetting(): void {
    const { moment } = window;

    const sysLocale = navigator.language?.toLowerCase();

    new Setting(this.containerEl)
      .setName("Override locale:")
      .setDesc(
        "Set this if you want to use a locale different from the default"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("system-default", `Same as system (${sysLocale})`);
        moment.locales().forEach((locale) => {
          dropdown.addOption(locale, locale);
        });
        dropdown.setValue(this.plugin.options.localeOverride);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            localeOverride: value as ILocaleOverride,
          }));
        });
      });
  }
}