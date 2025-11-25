'use strict';

var require$$0 = require('obsidian');

const DEFAULT_WEEK_FORMAT = "gggg-[W]ww";
const DEFAULT_WORDS_PER_DOT = 250;
const VIEW_TYPE_CALENDAR = "calendar";
const TRIGGER_ON_OPEN = "calendar:open";

var main = {};

var hasRequiredMain;

function requireMain () {
	if (hasRequiredMain) return main;
	hasRequiredMain = 1;

	Object.defineProperty(main, '__esModule', { value: true });

	var obsidian = require$$0;

	const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";
	const DEFAULT_WEEKLY_NOTE_FORMAT = "gggg-[W]ww";
	const DEFAULT_MONTHLY_NOTE_FORMAT = "YYYY-MM";

	function shouldUsePeriodicNotesSettings(periodicity) {
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    const periodicNotes = window.app.plugins.getPlugin("periodic-notes");
	    return periodicNotes && periodicNotes.settings?.[periodicity]?.enabled;
	}
	/**
	 * Read the user settings for the `daily-notes` plugin
	 * to keep behavior of creating a new note in-sync.
	 */
	function getDailyNoteSettings() {
	    try {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        const { internalPlugins, plugins } = window.app;
	        if (shouldUsePeriodicNotesSettings("daily")) {
	            const { format, folder, template } = plugins.getPlugin("periodic-notes")?.settings?.daily || {};
	            return {
	                format: format || DEFAULT_DAILY_NOTE_FORMAT,
	                folder: folder?.trim() || "",
	                template: template?.trim() || "",
	            };
	        }
	        const { folder, format, template } = internalPlugins.getPluginById("daily-notes")?.instance?.options || {};
	        return {
	            format: format || DEFAULT_DAILY_NOTE_FORMAT,
	            folder: folder?.trim() || "",
	            template: template?.trim() || "",
	        };
	    }
	    catch (err) {
	        console.info("No custom daily note settings found!", err);
	    }
	}
	/**
	 * Read the user settings for the `weekly-notes` plugin
	 * to keep behavior of creating a new note in-sync.
	 */
	function getWeeklyNoteSettings() {
	    try {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        const pluginManager = window.app.plugins;
	        const calendarSettings = pluginManager.getPlugin("calendar")?.options;
	        const periodicNotesSettings = pluginManager.getPlugin("periodic-notes")
	            ?.settings?.weekly;
	        if (shouldUsePeriodicNotesSettings("weekly")) {
	            return {
	                format: periodicNotesSettings.format || DEFAULT_WEEKLY_NOTE_FORMAT,
	                folder: periodicNotesSettings.folder?.trim() || "",
	                template: periodicNotesSettings.template?.trim() || "",
	            };
	        }
	        const settings = calendarSettings || {};
	        return {
	            format: settings.weeklyNoteFormat || DEFAULT_WEEKLY_NOTE_FORMAT,
	            folder: settings.weeklyNoteFolder?.trim() || "",
	            template: settings.weeklyNoteTemplate?.trim() || "",
	        };
	    }
	    catch (err) {
	        console.info("No custom weekly note settings found!", err);
	    }
	}
	/**
	 * Read the user settings for the `periodic-notes` plugin
	 * to keep behavior of creating a new note in-sync.
	 */
	function getMonthlyNoteSettings() {
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    const pluginManager = window.app.plugins;
	    try {
	        const settings = (shouldUsePeriodicNotesSettings("monthly") &&
	            pluginManager.getPlugin("periodic-notes")?.settings?.monthly) ||
	            {};
	        return {
	            format: settings.format || DEFAULT_MONTHLY_NOTE_FORMAT,
	            folder: settings.folder?.trim() || "",
	            template: settings.template?.trim() || "",
	        };
	    }
	    catch (err) {
	        console.info("No custom monthly note settings found!", err);
	    }
	}

	/**
	 * dateUID is a way of weekly identifying daily/weekly/monthly notes.
	 * They are prefixed with the granularity to avoid ambiguity.
	 */
	function getDateUID(date, granularity = "day") {
	    const ts = date.clone().startOf(granularity).format();
	    return `${granularity}-${ts}`;
	}
	function removeEscapedCharacters(format) {
	    return format.replace(/\[[^\]]*\]/g, ""); // remove everything within brackets
	}
	/**
	 * XXX: When parsing dates that contain both week numbers and months,
	 * Moment choses to ignore the week numbers. For the week dateUID, we
	 * want the opposite behavior. Strip the MMM from the format to patch.
	 */
	function isFormatAmbiguous(format, granularity) {
	    if (granularity === "week") {
	        const cleanFormat = removeEscapedCharacters(format);
	        return (/w{1,2}/i.test(cleanFormat) &&
	            (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat)));
	    }
	    return false;
	}
	function getDateFromFile(file, granularity) {
	    const getSettings = {
	        day: getDailyNoteSettings,
	        week: getWeeklyNoteSettings,
	        month: getMonthlyNoteSettings,
	    };
	    const format = getSettings[granularity]().format.split("/").pop();
	    const noteDate = window.moment(file.basename, format, true);
	    if (!noteDate.isValid()) {
	        return null;
	    }
	    if (isFormatAmbiguous(format, granularity)) {
	        if (granularity === "week") {
	            const cleanFormat = removeEscapedCharacters(format);
	            if (/w{1,2}/i.test(cleanFormat)) {
	                return window.moment(file.basename, 
	                // If format contains week, remove day & month formatting
	                format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""), false);
	            }
	        }
	    }
	    return noteDate;
	}

	// Credit: @creationix/path.js
	function join(...partSegments) {
	    // Split the inputs into a list of path commands.
	    let parts = [];
	    for (let i = 0, l = partSegments.length; i < l; i++) {
	        parts = parts.concat(partSegments[i].split("/"));
	    }
	    // Interpret the path commands to get the new resolved path.
	    const newParts = [];
	    for (let i = 0, l = parts.length; i < l; i++) {
	        const part = parts[i];
	        // Remove leading and trailing slashes
	        // Also remove "." segments
	        if (!part || part === ".")
	            continue;
	        // Push new path segments.
	        else
	            newParts.push(part);
	    }
	    // Preserve the initial slash if there was one.
	    if (parts[0] === "")
	        newParts.unshift("");
	    // Turn back into a single string path.
	    return newParts.join("/");
	}
	async function ensureFolderExists(path) {
	    const dirs = path.replace(/\\/g, "/").split("/");
	    dirs.pop(); // remove basename
	    if (dirs.length) {
	        const dir = join(...dirs);
	        if (!window.app.vault.getAbstractFileByPath(dir)) {
	            await window.app.vault.createFolder(dir);
	        }
	    }
	}
	async function getNotePath(directory, filename) {
	    if (!filename.endsWith(".md")) {
	        filename += ".md";
	    }
	    const path = obsidian.normalizePath(join(directory, filename));
	    await ensureFolderExists(path);
	    return path;
	}
	async function getTemplateInfo(template) {
	    const { metadataCache, vault } = window.app;
	    const templatePath = obsidian.normalizePath(template);
	    if (templatePath === "/") {
	        return Promise.resolve(["", null]);
	    }
	    try {
	        const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
	        const contents = await vault.cachedRead(templateFile);
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        const IFoldInfo = window.app.foldManager.load(templateFile);
	        return [contents, IFoldInfo];
	    }
	    catch (err) {
	        console.error(`Failed to read the daily note template '${templatePath}'`, err);
	        new obsidian.Notice("Failed to read the daily note template");
	        return ["", null];
	    }
	}

	class DailyNotesFolderMissingError extends Error {
	}
	/**
	 * This function mimics the behavior of the daily-notes plugin
	 * so it will replace {{date}}, {{title}}, and {{time}} with the
	 * formatted timestamp.
	 *
	 * Note: it has an added bonus that it's not 'today' specific.
	 */
	async function createDailyNote(date) {
	    const app = window.app;
	    const { vault } = app;
	    const moment = window.moment;
	    const { template, format, folder } = getDailyNoteSettings();
	    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
	    const filename = date.format(format);
	    const normalizedPath = await getNotePath(folder, filename);
	    try {
	        const createdFile = await vault.create(normalizedPath, templateContents
	            .replace(/{{\s*date\s*}}/gi, filename)
	            .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
	            .replace(/{{\s*title\s*}}/gi, filename)
	            .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
	            const now = moment();
	            const currentDate = date.clone().set({
	                hour: now.get("hour"),
	                minute: now.get("minute"),
	                second: now.get("second"),
	            });
	            if (calc) {
	                currentDate.add(parseInt(timeDelta, 10), unit);
	            }
	            if (momentFormat) {
	                return currentDate.format(momentFormat.substring(1).trim());
	            }
	            return currentDate.format(format);
	        })
	            .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
	            .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(format)));
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        app.foldManager.save(createdFile, IFoldInfo);
	        return createdFile;
	    }
	    catch (err) {
	        console.error(`Failed to create file: '${normalizedPath}'`, err);
	        new obsidian.Notice("Unable to create new file.");
	    }
	}
	function getDailyNote(date, dailyNotes) {
	    return dailyNotes[getDateUID(date, "day")] ?? null;
	}
	function getAllDailyNotes() {
	    /**
	     * Find all daily notes in the daily note folder
	     */
	    const { vault } = window.app;
	    const { folder } = getDailyNoteSettings();
	    const dailyNotesFolder = vault.getAbstractFileByPath(obsidian.normalizePath(folder));
	    if (!dailyNotesFolder) {
	        throw new DailyNotesFolderMissingError("Failed to find daily notes folder");
	    }
	    const dailyNotes = {};
	    obsidian.Vault.recurseChildren(dailyNotesFolder, (note) => {
	        if (note instanceof obsidian.TFile) {
	            const date = getDateFromFile(note, "day");
	            if (date) {
	                const dateString = getDateUID(date, "day");
	                dailyNotes[dateString] = note;
	            }
	        }
	    });
	    return dailyNotes;
	}

	class WeeklyNotesFolderMissingError extends Error {
	}
	function getDaysOfWeek() {
	    const { moment } = window;
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    let weekStart = moment.localeData()._week.dow;
	    const daysOfWeek = [
	        "sunday",
	        "monday",
	        "tuesday",
	        "wednesday",
	        "thursday",
	        "friday",
	        "saturday",
	    ];
	    while (weekStart) {
	        daysOfWeek.push(daysOfWeek.shift());
	        weekStart--;
	    }
	    return daysOfWeek;
	}
	function getDayOfWeekNumericalValue(dayOfWeekName) {
	    return getDaysOfWeek().indexOf(dayOfWeekName.toLowerCase());
	}
	async function createWeeklyNote(date) {
	    const { vault } = window.app;
	    const { template, format, folder } = getWeeklyNoteSettings();
	    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
	    const filename = date.format(format);
	    const normalizedPath = await getNotePath(folder, filename);
	    try {
	        const createdFile = await vault.create(normalizedPath, templateContents
	            .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
	            const now = window.moment();
	            const currentDate = date.clone().set({
	                hour: now.get("hour"),
	                minute: now.get("minute"),
	                second: now.get("second"),
	            });
	            if (calc) {
	                currentDate.add(parseInt(timeDelta, 10), unit);
	            }
	            if (momentFormat) {
	                return currentDate.format(momentFormat.substring(1).trim());
	            }
	            return currentDate.format(format);
	        })
	            .replace(/{{\s*title\s*}}/gi, filename)
	            .replace(/{{\s*time\s*}}/gi, window.moment().format("HH:mm"))
	            .replace(/{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi, (_, dayOfWeek, momentFormat) => {
	            const day = getDayOfWeekNumericalValue(dayOfWeek);
	            return date.weekday(day).format(momentFormat.trim());
	        }));
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        window.app.foldManager.save(createdFile, IFoldInfo);
	        return createdFile;
	    }
	    catch (err) {
	        console.error(`Failed to create file: '${normalizedPath}'`, err);
	        new obsidian.Notice("Unable to create new file.");
	    }
	}
	function getWeeklyNote(date, weeklyNotes) {
	    return weeklyNotes[getDateUID(date, "week")] ?? null;
	}
	function getAllWeeklyNotes() {
	    const { vault } = window.app;
	    const { folder } = getWeeklyNoteSettings();
	    const weeklyNotesFolder = vault.getAbstractFileByPath(obsidian.normalizePath(folder));
	    if (!weeklyNotesFolder) {
	        throw new WeeklyNotesFolderMissingError("Failed to find weekly notes folder");
	    }
	    const weeklyNotes = {};
	    obsidian.Vault.recurseChildren(weeklyNotesFolder, (note) => {
	        if (note instanceof obsidian.TFile) {
	            const date = getDateFromFile(note, "week");
	            if (date) {
	                const dateString = getDateUID(date, "week");
	                weeklyNotes[dateString] = note;
	            }
	        }
	    });
	    return weeklyNotes;
	}

	class MonthlyNotesFolderMissingError extends Error {
	}
	/**
	 * This function mimics the behavior of the daily-notes plugin
	 * so it will replace {{date}}, {{title}}, and {{time}} with the
	 * formatted timestamp.
	 *
	 * Note: it has an added bonus that it's not 'today' specific.
	 */
	async function createMonthlyNote(date) {
	    const { vault } = window.app;
	    const { template, format, folder } = getMonthlyNoteSettings();
	    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
	    const filename = date.format(format);
	    const normalizedPath = await getNotePath(folder, filename);
	    try {
	        const createdFile = await vault.create(normalizedPath, templateContents
	            .replace(/{{\s*(date|time)\s*:(.*?)}}/gi, (_, _timeOrDate, momentFormat) => {
	            const now = window.moment();
	            return date
	                .set({
	                hour: now.get("hour"),
	                minute: now.get("minute"),
	                second: now.get("second"),
	            })
	                .format(momentFormat.trim());
	        })
	            .replace(/{{\s*date\s*}}/gi, filename)
	            .replace(/{{\s*time\s*}}/gi, window.moment().format("HH:mm"))
	            .replace(/{{\s*title\s*}}/gi, filename));
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        window.app.foldManager.save(createdFile, IFoldInfo);
	        return createdFile;
	    }
	    catch (err) {
	        console.error(`Failed to create file: '${normalizedPath}'`, err);
	        new obsidian.Notice("Unable to create new file.");
	    }
	}
	function getMonthlyNote(date, monthlyNotes) {
	    return monthlyNotes[getDateUID(date, "month")] ?? null;
	}
	function getAllMonthlyNotes() {
	    const { vault } = window.app;
	    const { folder } = getMonthlyNoteSettings();
	    const monthlyNotesFolder = vault.getAbstractFileByPath(obsidian.normalizePath(folder));
	    if (!monthlyNotesFolder) {
	        throw new MonthlyNotesFolderMissingError("Failed to find monthly notes folder");
	    }
	    const monthlyNotes = {};
	    obsidian.Vault.recurseChildren(monthlyNotesFolder, (note) => {
	        if (note instanceof obsidian.TFile) {
	            const date = getDateFromFile(note, "month");
	            if (date) {
	                const dateString = getDateUID(date, "month");
	                monthlyNotes[dateString] = note;
	            }
	        }
	    });
	    return monthlyNotes;
	}

	function appHasDailyNotesPluginLoaded() {
	    const { app } = window;
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    const dailyNotesPlugin = app.internalPlugins.plugins["daily-notes"];
	    if (dailyNotesPlugin && dailyNotesPlugin.enabled) {
	        return true;
	    }
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    const periodicNotes = app.plugins.getPlugin("periodic-notes");
	    return periodicNotes && periodicNotes.settings?.daily?.enabled;
	}
	/**
	 * XXX: "Weekly Notes" live in either the Calendar plugin or the periodic-notes plugin.
	 * Check both until the weekly notes feature is removed from the Calendar plugin.
	 */
	function appHasWeeklyNotesPluginLoaded() {
	    const { app } = window;
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    if (app.plugins.getPlugin("calendar")) {
	        return true;
	    }
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    const periodicNotes = app.plugins.getPlugin("periodic-notes");
	    return periodicNotes && periodicNotes.settings?.weekly?.enabled;
	}
	function appHasMonthlyNotesPluginLoaded() {
	    const { app } = window;
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    const periodicNotes = app.plugins.getPlugin("periodic-notes");
	    return periodicNotes && periodicNotes.settings?.monthly?.enabled;
	}

	main.DEFAULT_DAILY_NOTE_FORMAT = DEFAULT_DAILY_NOTE_FORMAT;
	main.DEFAULT_MONTHLY_NOTE_FORMAT = DEFAULT_MONTHLY_NOTE_FORMAT;
	main.DEFAULT_WEEKLY_NOTE_FORMAT = DEFAULT_WEEKLY_NOTE_FORMAT;
	main.appHasDailyNotesPluginLoaded = appHasDailyNotesPluginLoaded;
	main.appHasMonthlyNotesPluginLoaded = appHasMonthlyNotesPluginLoaded;
	main.appHasWeeklyNotesPluginLoaded = appHasWeeklyNotesPluginLoaded;
	main.createDailyNote = createDailyNote;
	main.createMonthlyNote = createMonthlyNote;
	main.createWeeklyNote = createWeeklyNote;
	main.getAllDailyNotes = getAllDailyNotes;
	main.getAllMonthlyNotes = getAllMonthlyNotes;
	main.getAllWeeklyNotes = getAllWeeklyNotes;
	main.getDailyNote = getDailyNote;
	main.getDailyNoteSettings = getDailyNoteSettings;
	main.getDateFromFile = getDateFromFile;
	main.getDateUID = getDateUID;
	main.getMonthlyNote = getMonthlyNote;
	main.getMonthlyNoteSettings = getMonthlyNoteSettings;
	main.getTemplateInfo = getTemplateInfo;
	main.getWeeklyNote = getWeeklyNote;
	main.getWeeklyNoteSettings = getWeeklyNoteSettings;
	return main;
}

var mainExports = requireMain();

var DEV = false;

// Store the references to globals in case someone tries to monkey patch these, causing the below
// to de-opt (this occurs often when using popular extensions).
var is_array = Array.isArray;
var index_of = Array.prototype.indexOf;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
var get_descriptors = Object.getOwnPropertyDescriptors;
var object_prototype = Object.prototype;
var array_prototype = Array.prototype;
var get_prototype_of = Object.getPrototypeOf;

const noop$1 = () => {};

/** @param {Function} fn */
function run$1(fn) {
	return fn();
}

/** @param {Array<() => void>} arr */
function run_all$1(arr) {
	for (var i = 0; i < arr.length; i++) {
		arr[i]();
	}
}

/**
 * TODO replace with Promise.withResolvers once supported widely enough
 * @template T
 */
function deferred() {
	/** @type {(value: T) => void} */
	var resolve;

	/** @type {(reason: any) => void} */
	var reject;

	/** @type {Promise<T>} */
	var promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	// @ts-expect-error
	return { promise, resolve, reject };
}

// General flags
const DERIVED = 1 << 1;
const EFFECT = 1 << 2;
const RENDER_EFFECT = 1 << 3;
const BLOCK_EFFECT = 1 << 4;
const BRANCH_EFFECT = 1 << 5;
const ROOT_EFFECT = 1 << 6;
const BOUNDARY_EFFECT = 1 << 7;
/**
 * Indicates that a reaction is connected to an effect root — either it is an effect,
 * or it is a derived that is depended on by at least one effect. If a derived has
 * no dependents, we can disconnect it from the graph, allowing it to either be
 * GC'd or reconnected later if an effect comes to depend on it again
 */
const CONNECTED = 1 << 9;
const CLEAN = 1 << 10;
const DIRTY = 1 << 11;
const MAYBE_DIRTY = 1 << 12;
const INERT = 1 << 13;
const DESTROYED = 1 << 14;

// Flags exclusive to effects
/** Set once an effect that should run synchronously has run */
const EFFECT_RAN = 1 << 15;
/**
 * 'Transparent' effects do not create a transition boundary.
 * This is on a block effect 99% of the time but may also be on a branch effect if its parent block effect was pruned
 */
const EFFECT_TRANSPARENT = 1 << 16;
const EAGER_EFFECT = 1 << 17;
const HEAD_EFFECT = 1 << 18;
const EFFECT_PRESERVED = 1 << 19;
const USER_EFFECT = 1 << 20;

// Flags exclusive to deriveds
/**
 * Tells that we marked this derived and its reactions as visited during the "mark as (maybe) dirty"-phase.
 * Will be lifted during execution of the derived and during checking its dirty state (both are necessary
 * because a derived might be checked but not executed).
 */
const WAS_MARKED = 1 << 15;

// Flags used for async
const REACTION_IS_UPDATING = 1 << 21;
const ASYNC = 1 << 22;

const ERROR_VALUE = 1 << 23;

const STATE_SYMBOL = Symbol('$state');
const LEGACY_PROPS = Symbol('legacy props');

/** allow users to ignore aborted signal errors if `reason.name === 'StaleReactionError` */
const STALE_REACTION = new (class StaleReactionError extends Error {
	name = 'StaleReactionError';
	message = 'The reaction that called `getAbortSignal()` was re-run or destroyed';
})();

/** @import { Equals } from '#client' */

/** @type {Equals} */
function equals(value) {
	return value === this.v;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function safe_not_equal$1(a, b) {
	return a != a
		? b == b
		: a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
}

/** @type {Equals} */
function safe_equals(value) {
	return !safe_not_equal$1(value, this.v);
}

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * `%name%(...)` can only be used during component initialisation
 * @param {string} name
 * @returns {never}
 */
function lifecycle_outside_component(name) {
	{
		throw new Error(`https://svelte.dev/e/lifecycle_outside_component`);
	}
}

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * `%rune%` cannot be used inside an effect cleanup function
 * @param {string} rune
 * @returns {never}
 */
function effect_in_teardown(rune) {
	{
		throw new Error(`https://svelte.dev/e/effect_in_teardown`);
	}
}

/**
 * Effect cannot be created inside a `$derived` value that was not itself created inside an effect
 * @returns {never}
 */
function effect_in_unowned_derived() {
	{
		throw new Error(`https://svelte.dev/e/effect_in_unowned_derived`);
	}
}

/**
 * `%rune%` can only be used inside an effect (e.g. during component initialisation)
 * @param {string} rune
 * @returns {never}
 */
function effect_orphan(rune) {
	{
		throw new Error(`https://svelte.dev/e/effect_orphan`);
	}
}

/**
 * Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
 * @returns {never}
 */
function effect_update_depth_exceeded() {
	{
		throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
	}
}

/**
 * Cannot do `bind:%key%={undefined}` when `%key%` has a fallback value
 * @param {string} key
 * @returns {never}
 */
function props_invalid_value(key) {
	{
		throw new Error(`https://svelte.dev/e/props_invalid_value`);
	}
}

/**
 * Property descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.
 * @returns {never}
 */
function state_descriptors_fixed() {
	{
		throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
	}
}

/**
 * Cannot set prototype of `$state` object
 * @returns {never}
 */
function state_prototype_fixed() {
	{
		throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
	}
}

/**
 * Updating state inside `$derived(...)`, `$inspect(...)` or a template expression is forbidden. If the value should not be reactive, declare it without `$state`
 * @returns {never}
 */
function state_unsafe_mutation() {
	{
		throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
	}
}

/** True if experimental.async=true */
/** True if we're not certain that we only have Svelte 5 code in the compilation */
let legacy_mode_flag = false;
/** True if $inspect.trace is used */
let tracing_mode_flag = false;

function enable_legacy_mode_flag() {
	legacy_mode_flag = true;
}

const PROPS_IS_IMMUTABLE = 1;
const PROPS_IS_RUNES = 1 << 1;
const PROPS_IS_UPDATED = 1 << 2;
const PROPS_IS_BINDABLE = 1 << 3;
const PROPS_IS_LAZY_INITIAL = 1 << 4;

const UNINITIALIZED = Symbol();

/** @import { ComponentContext, DevStackEntry, Effect } from '#client' */

/** @type {ComponentContext | null} */
let component_context = null;

/** @param {ComponentContext | null} context */
function set_component_context(context) {
	component_context = context;
}

/**
 * @param {Record<string, unknown>} props
 * @param {any} runes
 * @param {Function} [fn]
 * @returns {void}
 */
function push(props, runes = false, fn) {
	component_context = {
		p: component_context,
		i: false,
		c: null,
		e: null,
		s: props,
		x: null,
		l: legacy_mode_flag && !runes ? { s: null, u: null, $: [] } : null
	};
}

/**
 * @template {Record<string, any>} T
 * @param {T} [component]
 * @returns {T}
 */
function pop(component) {
	var context = /** @type {ComponentContext} */ (component_context);
	var effects = context.e;

	if (effects !== null) {
		context.e = null;

		for (var fn of effects) {
			create_user_effect(fn);
		}
	}

	if (component !== undefined) {
		context.x = component;
	}

	context.i = true;

	component_context = context.p;

	return component ?? /** @type {T} */ ({});
}

/** @returns {boolean} */
function is_runes() {
	return !legacy_mode_flag || (component_context !== null && component_context.l === null);
}

/** @type {Array<() => void>} */
let micro_tasks = [];

function run_micro_tasks() {
	var tasks = micro_tasks;
	micro_tasks = [];
	run_all$1(tasks);
}

/**
 * @param {() => void} fn
 */
function queue_micro_task(fn) {
	if (micro_tasks.length === 0 && true) {
		var tasks = micro_tasks;
		queueMicrotask(() => {
			// If this is false, a flushSync happened in the meantime. Do _not_ run new scheduled microtasks in that case
			// as the ordering of microtasks would be broken at that point - consider this case:
			// - queue_micro_task schedules microtask A to flush task X
			// - synchronously after, flushSync runs, processing task X
			// - synchronously after, some other microtask B is scheduled, but not through queue_micro_task but for example a Promise.resolve() in user code
			// - synchronously after, queue_micro_task schedules microtask C to flush task Y
			// - one tick later, microtask A now resolves, flushing task Y before microtask B, which is incorrect
			// This if check prevents that race condition (that realistically will only happen in tests)
			if (tasks === micro_tasks) run_micro_tasks();
		});
	}

	micro_tasks.push(fn);
}

/** @import { Source } from '#client' */

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function proxy(value) {
	// if non-proxyable, or is already a proxy, return `value`
	if (typeof value !== 'object' || value === null || STATE_SYMBOL in value) {
		return value;
	}

	const prototype = get_prototype_of(value);

	if (prototype !== object_prototype && prototype !== array_prototype) {
		return value;
	}

	/** @type {Map<any, Source<any>>} */
	var sources = new Map();
	var is_proxied_array = is_array(value);
	var version = state(0);
	var parent_version = update_version;

	/**
	 * Executes the proxy in the context of the reaction it was originally created in, if any
	 * @template T
	 * @param {() => T} fn
	 */
	var with_parent = (fn) => {
		if (update_version === parent_version) {
			return fn();
		}

		// child source is being created after the initial proxy —
		// prevent it from being associated with the current reaction
		var reaction = active_reaction;
		var version = update_version;

		set_active_reaction(null);
		set_update_version(parent_version);

		var result = fn();

		set_active_reaction(reaction);
		set_update_version(version);

		return result;
	};

	if (is_proxied_array) {
		// We need to create the length source eagerly to ensure that
		// mutations to the array are properly synced with our proxy
		sources.set('length', state(/** @type {any[]} */ (value).length));
	}

	return new Proxy(/** @type {any} */ (value), {
		defineProperty(_, prop, descriptor) {
			if (
				!('value' in descriptor) ||
				descriptor.configurable === false ||
				descriptor.enumerable === false ||
				descriptor.writable === false
			) {
				// we disallow non-basic descriptors, because unless they are applied to the
				// target object — which we avoid, so that state can be forked — we will run
				// afoul of the various invariants
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/getOwnPropertyDescriptor#invariants
				state_descriptors_fixed();
			}
			var s = sources.get(prop);
			if (s === undefined) {
				s = with_parent(() => {
					var s = state(descriptor.value);
					sources.set(prop, s);
					return s;
				});
			} else {
				set(s, descriptor.value, true);
			}

			return true;
		},

		deleteProperty(target, prop) {
			var s = sources.get(prop);

			if (s === undefined) {
				if (prop in target) {
					const s = with_parent(() => state(UNINITIALIZED));
					sources.set(prop, s);
					increment(version);
				}
			} else {
				set(s, UNINITIALIZED);
				increment(version);
			}

			return true;
		},

		get(target, prop, receiver) {
			if (prop === STATE_SYMBOL) {
				return value;
			}

			var s = sources.get(prop);
			var exists = prop in target;

			// create a source, but only if it's an own property and not a prototype property
			if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
				s = with_parent(() => {
					var p = proxy(exists ? target[prop] : UNINITIALIZED);
					var s = state(p);

					return s;
				});

				sources.set(prop, s);
			}

			if (s !== undefined) {
				var v = get$1(s);
				return v === UNINITIALIZED ? undefined : v;
			}

			return Reflect.get(target, prop, receiver);
		},

		getOwnPropertyDescriptor(target, prop) {
			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			if (descriptor && 'value' in descriptor) {
				var s = sources.get(prop);
				if (s) descriptor.value = get$1(s);
			} else if (descriptor === undefined) {
				var source = sources.get(prop);
				var value = source?.v;

				if (source !== undefined && value !== UNINITIALIZED) {
					return {
						enumerable: true,
						configurable: true,
						value,
						writable: true
					};
				}
			}

			return descriptor;
		},

		has(target, prop) {
			if (prop === STATE_SYMBOL) {
				return true;
			}

			var s = sources.get(prop);
			var has = (s !== undefined && s.v !== UNINITIALIZED) || Reflect.has(target, prop);

			if (
				s !== undefined ||
				(active_effect !== null && (!has || get_descriptor(target, prop)?.writable))
			) {
				if (s === undefined) {
					s = with_parent(() => {
						var p = has ? proxy(target[prop]) : UNINITIALIZED;
						var s = state(p);

						return s;
					});

					sources.set(prop, s);
				}

				var value = get$1(s);
				if (value === UNINITIALIZED) {
					return false;
				}
			}

			return has;
		},

		set(target, prop, value, receiver) {
			var s = sources.get(prop);
			var has = prop in target;

			// variable.length = value -> clear all signals with index >= value
			if (is_proxied_array && prop === 'length') {
				for (var i = value; i < /** @type {Source<number>} */ (s).v; i += 1) {
					var other_s = sources.get(i + '');
					if (other_s !== undefined) {
						set(other_s, UNINITIALIZED);
					} else if (i in target) {
						// If the item exists in the original, we need to create an uninitialized source,
						// else a later read of the property would result in a source being created with
						// the value of the original item at that index.
						other_s = with_parent(() => state(UNINITIALIZED));
						sources.set(i + '', other_s);
					}
				}
			}

			// If we haven't yet created a source for this property, we need to ensure
			// we do so otherwise if we read it later, then the write won't be tracked and
			// the heuristics of effects will be different vs if we had read the proxied
			// object property before writing to that property.
			if (s === undefined) {
				if (!has || get_descriptor(target, prop)?.writable) {
					s = with_parent(() => state(undefined));
					set(s, proxy(value));

					sources.set(prop, s);
				}
			} else {
				has = s.v !== UNINITIALIZED;

				var p = with_parent(() => proxy(value));
				set(s, p);
			}

			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			// Set the new value before updating any signals so that any listeners get the new value
			if (descriptor?.set) {
				descriptor.set.call(receiver, value);
			}

			if (!has) {
				// If we have mutated an array directly, we might need to
				// signal that length has also changed. Do it before updating metadata
				// to ensure that iterating over the array as a result of a metadata update
				// will not cause the length to be out of sync.
				if (is_proxied_array && typeof prop === 'string') {
					var ls = /** @type {Source<number>} */ (sources.get('length'));
					var n = Number(prop);

					if (Number.isInteger(n) && n >= ls.v) {
						set(ls, n + 1);
					}
				}

				increment(version);
			}

			return true;
		},

		ownKeys(target) {
			get$1(version);

			var own_keys = Reflect.ownKeys(target).filter((key) => {
				var source = sources.get(key);
				return source === undefined || source.v !== UNINITIALIZED;
			});

			for (var [key, source] of sources) {
				if (source.v !== UNINITIALIZED && !(key in target)) {
					own_keys.push(key);
				}
			}

			return own_keys;
		},

		setPrototypeOf() {
			state_prototype_fixed();
		}
	});
}

/** @import { Effect, TemplateNode } from '#client' */
/** @type {() => Node | null} */
var next_sibling_getter;

/**
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
/*@__NO_SIDE_EFFECTS__*/
function get_next_sibling(node) {
	return next_sibling_getter.call(node);
}

/** @import { Derived, Effect } from '#client' */
/** @import { Boundary } from './dom/blocks/boundary.js' */

/**
 * @param {unknown} error
 */
function handle_error(error) {
	var effect = active_effect;

	// for unowned deriveds, don't throw until we read the value
	if (effect === null) {
		/** @type {Derived} */ (active_reaction).f |= ERROR_VALUE;
		return error;
	}

	if ((effect.f & EFFECT_RAN) === 0) {
		// if the error occurred while creating this subtree, we let it
		// bubble up until it hits a boundary that can handle it
		if ((effect.f & BOUNDARY_EFFECT) === 0) {

			throw error;
		}

		/** @type {Boundary} */ (effect.b).error(error);
	} else {
		// otherwise we bubble up the effect tree ourselves
		invoke_error_boundary(error, effect);
	}
}

/**
 * @param {unknown} error
 * @param {Effect | null} effect
 */
function invoke_error_boundary(error, effect) {
	while (effect !== null) {
		if ((effect.f & BOUNDARY_EFFECT) !== 0) {
			try {
				/** @type {Boundary} */ (effect.b).error(error);
				return;
			} catch (e) {
				error = e;
			}
		}

		effect = effect.parent;
	}

	throw error;
}

/** @import { Fork } from 'svelte' */
/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

/**
 * @typedef {{
 *   parent: EffectTarget | null;
 *   effect: Effect | null;
 *   effects: Effect[];
 *   render_effects: Effect[];
 *   block_effects: Effect[];
 * }} EffectTarget
 */

/** @type {Set<Batch>} */
const batches = new Set();

/** @type {Batch | null} */
let current_batch = null;

/**
 * When time travelling (i.e. working in one batch, while other batches
 * still have ongoing work), we ignore the real values of affected
 * signals in favour of their values within the batch
 * @type {Map<Value, any> | null}
 */
let batch_values = null;

// TODO this should really be a property of `batch`
/** @type {Effect[]} */
let queued_root_effects = [];

/** @type {Effect | null} */
let last_scheduled_effect = null;

let is_flushing = false;

class Batch {
	committed = false;

	/**
	 * The current values of any sources that are updated in this batch
	 * They keys of this map are identical to `this.#previous`
	 * @type {Map<Source, any>}
	 */
	current = new Map();

	/**
	 * The values of any sources that are updated in this batch _before_ those updates took place.
	 * They keys of this map are identical to `this.#current`
	 * @type {Map<Source, any>}
	 */
	previous = new Map();

	/**
	 * When the batch is committed (and the DOM is updated), we need to remove old branches
	 * and append new ones by calling the functions added inside (if/each/key/etc) blocks
	 * @type {Set<() => void>}
	 */
	#commit_callbacks = new Set();

	/**
	 * If a fork is discarded, we need to destroy any effects that are no longer needed
	 * @type {Set<(batch: Batch) => void>}
	 */
	#discard_callbacks = new Set();

	/**
	 * The number of async effects that are currently in flight
	 */
	#pending = 0;

	/**
	 * The number of async effects that are currently in flight, _not_ inside a pending boundary
	 */
	#blocking_pending = 0;

	/**
	 * A deferred that resolves when the batch is committed, used with `settled()`
	 * TODO replace with Promise.withResolvers once supported widely enough
	 * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
	 */
	#deferred = null;

	/**
	 * Deferred effects (which run after async work has completed) that are DIRTY
	 * @type {Effect[]}
	 */
	#dirty_effects = [];

	/**
	 * Deferred effects that are MAYBE_DIRTY
	 * @type {Effect[]}
	 */
	#maybe_dirty_effects = [];

	/**
	 * A set of branches that still exist, but will be destroyed when this batch
	 * is committed — we skip over these during `process`
	 * @type {Set<Effect>}
	 */
	skipped_effects = new Set();

	is_fork = false;

	is_deferred() {
		return this.is_fork || this.#blocking_pending > 0;
	}

	/**
	 *
	 * @param {Effect[]} root_effects
	 */
	process(root_effects) {
		queued_root_effects = [];

		this.apply();

		/** @type {EffectTarget} */
		var target = {
			parent: null,
			effect: null,
			effects: [],
			render_effects: [],
			block_effects: []
		};

		for (const root of root_effects) {
			this.#traverse_effect_tree(root, target);
			// Note: #traverse_effect_tree runs block effects eagerly, which can schedule effects,
			// which means queued_root_effects now may be filled again.
		}

		if (!this.is_fork) {
			this.#resolve();
		}

		if (this.is_deferred()) {
			this.#defer_effects(target.effects);
			this.#defer_effects(target.render_effects);
			this.#defer_effects(target.block_effects);
		} else {
			current_batch = null;

			flush_queued_effects(target.render_effects);
			flush_queued_effects(target.effects);

			this.#deferred?.resolve();
		}

		batch_values = null;
	}

	/**
	 * Traverse the effect tree, executing effects or stashing
	 * them for later execution as appropriate
	 * @param {Effect} root
	 * @param {EffectTarget} target
	 */
	#traverse_effect_tree(root, target) {
		root.f ^= CLEAN;

		var effect = root.first;

		while (effect !== null) {
			var flags = effect.f;
			var is_branch = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
			var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;

			var skip = is_skippable_branch || (flags & INERT) !== 0 || this.skipped_effects.has(effect);

			if ((effect.f & BOUNDARY_EFFECT) !== 0 && effect.b?.is_pending()) {
				target = {
					parent: target,
					effect,
					effects: [],
					render_effects: [],
					block_effects: []
				};
			}

			if (!skip && effect.fn !== null) {
				if (is_branch) {
					effect.f ^= CLEAN;
				} else if ((flags & EFFECT) !== 0) {
					target.effects.push(effect);
				} else if (is_dirty(effect)) {
					if ((effect.f & BLOCK_EFFECT) !== 0) target.block_effects.push(effect);
					update_effect(effect);
				}

				var child = effect.first;

				if (child !== null) {
					effect = child;
					continue;
				}
			}

			var parent = effect.parent;
			effect = effect.next;

			while (effect === null && parent !== null) {
				if (parent === target.effect) {
					// TODO rather than traversing into pending boundaries and deferring the effects,
					// could we just attach the effects _to_ the pending boundary and schedule them
					// once the boundary is ready?
					this.#defer_effects(target.effects);
					this.#defer_effects(target.render_effects);
					this.#defer_effects(target.block_effects);

					target = /** @type {EffectTarget} */ (target.parent);
				}

				effect = parent.next;
				parent = parent.parent;
			}
		}
	}

	/**
	 * @param {Effect[]} effects
	 */
	#defer_effects(effects) {
		for (const e of effects) {
			const target = (e.f & DIRTY) !== 0 ? this.#dirty_effects : this.#maybe_dirty_effects;
			target.push(e);

			// Since we're not executing these effects now, we need to clear any WAS_MARKED flags
			// so that other batches can correctly reach these effects during their own traversal
			this.#clear_marked(e.deps);

			// mark as clean so they get scheduled if they depend on pending async state
			set_signal_status(e, CLEAN);
		}
	}

	/**
	 * @param {Value[] | null} deps
	 */
	#clear_marked(deps) {
		if (deps === null) return;

		for (const dep of deps) {
			if ((dep.f & DERIVED) === 0 || (dep.f & WAS_MARKED) === 0) {
				continue;
			}

			dep.f ^= WAS_MARKED;

			this.#clear_marked(/** @type {Derived} */ (dep).deps);
		}
	}

	/**
	 * Associate a change to a given source with the current
	 * batch, noting its previous and current values
	 * @param {Source} source
	 * @param {any} value
	 */
	capture(source, value) {
		if (!this.previous.has(source)) {
			this.previous.set(source, value);
		}

		// Don't save errors in `batch_values`, or they won't be thrown in `runtime.js#get`
		if ((source.f & ERROR_VALUE) === 0) {
			this.current.set(source, source.v);
			batch_values?.set(source, source.v);
		}
	}

	activate() {
		current_batch = this;
		this.apply();
	}

	deactivate() {
		// If we're not the current batch, don't deactivate,
		// else we could create zombie batches that are never flushed
		if (current_batch !== this) return;

		current_batch = null;
		batch_values = null;
	}

	flush() {
		this.activate();

		if (queued_root_effects.length > 0) {
			flush_effects();

			if (current_batch !== null && current_batch !== this) {
				// this can happen if a new batch was created during `flush_effects()`
				return;
			}
		} else if (this.#pending === 0) {
			this.process([]); // TODO this feels awkward
		}

		this.deactivate();
	}

	discard() {
		for (const fn of this.#discard_callbacks) fn(this);
		this.#discard_callbacks.clear();
	}

	#resolve() {
		if (this.#blocking_pending === 0) {
			// append/remove branches
			for (const fn of this.#commit_callbacks) fn();
			this.#commit_callbacks.clear();
		}

		if (this.#pending === 0) {
			this.#commit();
		}
	}

	#commit() {
		// If there are other pending batches, they now need to be 'rebased' —
		// in other words, we re-run block/async effects with the newly
		// committed state, unless the batch in question has a more
		// recent value for a given source
		if (batches.size > 1) {
			this.previous.clear();

			var previous_batch_values = batch_values;
			var is_earlier = true;

			/** @type {EffectTarget} */
			var dummy_target = {
				parent: null,
				effect: null,
				effects: [],
				render_effects: [],
				block_effects: []
			};

			for (const batch of batches) {
				if (batch === this) {
					is_earlier = false;
					continue;
				}

				/** @type {Source[]} */
				const sources = [];

				for (const [source, value] of this.current) {
					if (batch.current.has(source)) {
						if (is_earlier && value !== batch.current.get(source)) {
							// bring the value up to date
							batch.current.set(source, value);
						} else {
							// same value or later batch has more recent value,
							// no need to re-run these effects
							continue;
						}
					}

					sources.push(source);
				}

				if (sources.length === 0) {
					continue;
				}

				// Re-run async/block effects that depend on distinct values changed in both batches
				const others = [...batch.current.keys()].filter((s) => !this.current.has(s));
				if (others.length > 0) {
					// Avoid running queued root effects on the wrong branch
					var prev_queued_root_effects = queued_root_effects;
					queued_root_effects = [];

					/** @type {Set<Value>} */
					const marked = new Set();
					/** @type {Map<Reaction, boolean>} */
					const checked = new Map();
					for (const source of sources) {
						mark_effects(source, others, marked, checked);
					}

					if (queued_root_effects.length > 0) {
						current_batch = batch;
						batch.apply();

						for (const root of queued_root_effects) {
							batch.#traverse_effect_tree(root, dummy_target);
						}

						// TODO do we need to do anything with `target`? defer block effects?

						batch.deactivate();
					}

					queued_root_effects = prev_queued_root_effects;
				}
			}

			current_batch = null;
			batch_values = previous_batch_values;
		}

		this.committed = true;
		batches.delete(this);
	}

	/**
	 *
	 * @param {boolean} blocking
	 */
	increment(blocking) {
		this.#pending += 1;
		if (blocking) this.#blocking_pending += 1;
	}

	/**
	 *
	 * @param {boolean} blocking
	 */
	decrement(blocking) {
		this.#pending -= 1;
		if (blocking) this.#blocking_pending -= 1;

		this.revive();
	}

	revive() {
		for (const e of this.#dirty_effects) {
			set_signal_status(e, DIRTY);
			schedule_effect(e);
		}

		for (const e of this.#maybe_dirty_effects) {
			set_signal_status(e, MAYBE_DIRTY);
			schedule_effect(e);
		}

		this.#dirty_effects = [];
		this.#maybe_dirty_effects = [];

		this.flush();
	}

	/** @param {() => void} fn */
	oncommit(fn) {
		this.#commit_callbacks.add(fn);
	}

	/** @param {(batch: Batch) => void} fn */
	ondiscard(fn) {
		this.#discard_callbacks.add(fn);
	}

	settled() {
		return (this.#deferred ??= deferred()).promise;
	}

	static ensure() {
		if (current_batch === null) {
			const batch = (current_batch = new Batch());
			batches.add(current_batch);

			{
				Batch.enqueue(() => {
					if (current_batch !== batch) {
						// a flushSync happened in the meantime
						return;
					}

					batch.flush();
				});
			}
		}

		return current_batch;
	}

	/** @param {() => void} task */
	static enqueue(task) {
		queue_micro_task(task);
	}

	apply() {
		return;
	}
}

function flush_effects() {
	var was_updating_effect = is_updating_effect;
	is_flushing = true;

	var source_stacks = null;

	try {
		var flush_count = 0;
		set_is_updating_effect(true);

		while (queued_root_effects.length > 0) {
			var batch = Batch.ensure();

			if (flush_count++ > 1000) {
				var updates, entry; if (DEV) ;

				infinite_loop_guard();
			}

			batch.process(queued_root_effects);
			old_values.clear();

			if (DEV) ;
		}
	} finally {
		is_flushing = false;
		set_is_updating_effect(was_updating_effect);

		last_scheduled_effect = null;
	}
}

function infinite_loop_guard() {
	try {
		effect_update_depth_exceeded();
	} catch (error) {

		// Best effort: invoke the boundary nearest the most recent
		// effect and hope that it's relevant to the infinite loop
		invoke_error_boundary(error, last_scheduled_effect);
	}
}

/** @type {Set<Effect> | null} */
let eager_block_effects = null;

/**
 * @param {Array<Effect>} effects
 * @returns {void}
 */
function flush_queued_effects(effects) {
	var length = effects.length;
	if (length === 0) return;

	var i = 0;

	while (i < length) {
		var effect = effects[i++];

		if ((effect.f & (DESTROYED | INERT)) === 0 && is_dirty(effect)) {
			eager_block_effects = new Set();

			update_effect(effect);

			// Effects with no dependencies or teardown do not get added to the effect tree.
			// Deferred effects (e.g. `$effect(...)`) _are_ added to the tree because we
			// don't know if we need to keep them until they are executed. Doing the check
			// here (rather than in `update_effect`) allows us to skip the work for
			// immediate effects.
			if (effect.deps === null && effect.first === null && effect.nodes_start === null) {
				// if there's no teardown or abort controller we completely unlink
				// the effect from the graph
				if (effect.teardown === null && effect.ac === null) {
					// remove this effect from the graph
					unlink_effect(effect);
				} else {
					// keep the effect in the graph, but free up some memory
					effect.fn = null;
				}
			}

			// If update_effect() has a flushSync() in it, we may have flushed another flush_queued_effects(),
			// which already handled this logic and did set eager_block_effects to null.
			if (eager_block_effects?.size > 0) {
				old_values.clear();

				for (const e of eager_block_effects) {
					// Skip eager effects that have already been unmounted
					if ((e.f & (DESTROYED | INERT)) !== 0) continue;

					// Run effects in order from ancestor to descendant, else we could run into nullpointers
					/** @type {Effect[]} */
					const ordered_effects = [e];
					let ancestor = e.parent;
					while (ancestor !== null) {
						if (eager_block_effects.has(ancestor)) {
							eager_block_effects.delete(ancestor);
							ordered_effects.push(ancestor);
						}
						ancestor = ancestor.parent;
					}

					for (let j = ordered_effects.length - 1; j >= 0; j--) {
						const e = ordered_effects[j];
						// Skip eager effects that have already been unmounted
						if ((e.f & (DESTROYED | INERT)) !== 0) continue;
						update_effect(e);
					}
				}

				eager_block_effects.clear();
			}
		}
	}

	eager_block_effects = null;
}

/**
 * This is similar to `mark_reactions`, but it only marks async/block effects
 * depending on `value` and at least one of the other `sources`, so that
 * these effects can re-run after another batch has been committed
 * @param {Value} value
 * @param {Source[]} sources
 * @param {Set<Value>} marked
 * @param {Map<Reaction, boolean>} checked
 */
function mark_effects(value, sources, marked, checked) {
	if (marked.has(value)) return;
	marked.add(value);

	if (value.reactions !== null) {
		for (const reaction of value.reactions) {
			const flags = reaction.f;

			if ((flags & DERIVED) !== 0) {
				mark_effects(/** @type {Derived} */ (reaction), sources, marked, checked);
			} else if (
				(flags & (ASYNC | BLOCK_EFFECT)) !== 0 &&
				(flags & DIRTY) === 0 && // we may have scheduled this one already
				depends_on(reaction, sources, checked)
			) {
				set_signal_status(reaction, DIRTY);
				schedule_effect(/** @type {Effect} */ (reaction));
			}
		}
	}
}

/**
 * @param {Reaction} reaction
 * @param {Source[]} sources
 * @param {Map<Reaction, boolean>} checked
 */
function depends_on(reaction, sources, checked) {
	const depends = checked.get(reaction);
	if (depends !== undefined) return depends;

	if (reaction.deps !== null) {
		for (const dep of reaction.deps) {
			if (sources.includes(dep)) {
				return true;
			}

			if ((dep.f & DERIVED) !== 0 && depends_on(/** @type {Derived} */ (dep), sources, checked)) {
				checked.set(/** @type {Derived} */ (dep), true);
				return true;
			}
		}
	}

	checked.set(reaction, false);

	return false;
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function schedule_effect(signal) {
	var effect = (last_scheduled_effect = signal);

	while (effect.parent !== null) {
		effect = effect.parent;
		var flags = effect.f;

		// if the effect is being scheduled because a parent (each/await/etc) block
		// updated an internal source, bail out or we'll cause a second flush
		if (
			is_flushing &&
			effect === active_effect &&
			(flags & BLOCK_EFFECT) !== 0 &&
			(flags & HEAD_EFFECT) === 0
		) {
			return;
		}

		if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
			if ((flags & CLEAN) === 0) return;
			effect.f ^= CLEAN;
		}
	}

	queued_root_effects.push(effect);
}

/** @import { Derived, Effect, Source } from '#client' */
/** @import { Batch } from './batch.js'; */

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived(fn) {
	var flags = DERIVED | DIRTY;
	var parent_derived =
		active_reaction !== null && (active_reaction.f & DERIVED) !== 0
			? /** @type {Derived} */ (active_reaction)
			: null;

	if (active_effect !== null) {
		// Since deriveds are evaluated lazily, any effects created inside them are
		// created too late to ensure that the parent effect is added to the tree
		active_effect.f |= EFFECT_PRESERVED;
	}

	/** @type {Derived<V>} */
	const signal = {
		ctx: component_context,
		deps: null,
		effects: null,
		equals,
		f: flags,
		fn,
		reactions: null,
		rv: 0,
		v: /** @type {V} */ (UNINITIALIZED),
		wv: 0,
		parent: parent_derived ?? active_effect,
		ac: null
	};

	return signal;
}

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived_safe_equal(fn) {
	const signal = derived(fn);
	signal.equals = safe_equals;
	return signal;
}

/**
 * @param {Derived} derived
 * @returns {void}
 */
function destroy_derived_effects(derived) {
	var effects = derived.effects;

	if (effects !== null) {
		derived.effects = null;

		for (var i = 0; i < effects.length; i += 1) {
			destroy_effect(/** @type {Effect} */ (effects[i]));
		}
	}
}

/**
 * @param {Derived} derived
 * @returns {Effect | null}
 */
function get_derived_parent_effect(derived) {
	var parent = derived.parent;
	while (parent !== null) {
		if ((parent.f & DERIVED) === 0) {
			// The original parent effect might've been destroyed but the derived
			// is used elsewhere now - do not return the destroyed effect in that case
			return (parent.f & DESTROYED) === 0 ? /** @type {Effect} */ (parent) : null;
		}
		parent = parent.parent;
	}
	return null;
}

/**
 * @template T
 * @param {Derived} derived
 * @returns {T}
 */
function execute_derived(derived) {
	var value;
	var prev_active_effect = active_effect;

	set_active_effect(get_derived_parent_effect(derived));

	{
		try {
			derived.f &= ~WAS_MARKED;
			destroy_derived_effects(derived);
			value = update_reaction(derived);
		} finally {
			set_active_effect(prev_active_effect);
		}
	}

	return value;
}

/**
 * @param {Derived} derived
 * @returns {void}
 */
function update_derived(derived) {
	var value = execute_derived(derived);

	if (!derived.equals(value)) {
		// in a fork, we don't update the underlying value, just `batch_values`.
		// the underlying value will be updated when the fork is committed.
		// otherwise, the next time we get here after a 'real world' state
		// change, `derived.equals` may incorrectly return `true`
		if (!current_batch?.is_fork) {
			derived.v = value;
		}

		derived.wv = increment_write_version();
	}

	// don't mark derived clean if we're reading it inside a
	// cleanup function, or it will cache a stale value
	if (is_destroying_effect) {
		return;
	}

	// During time traveling we don't want to reset the status so that
	// traversal of the graph in the other batches still happens
	if (batch_values !== null) {
		// only cache the value if we're in a tracking context, otherwise we won't
		// clear the cache in `mark_reactions` when dependencies are updated
		if (effect_tracking()) {
			batch_values.set(derived, value);
		}
	} else {
		var status = (derived.f & CONNECTED) === 0 ? MAYBE_DIRTY : CLEAN;
		set_signal_status(derived, status);
	}
}

/** @import { Derived, Effect, Source, Value } from '#client' */

/** @type {Set<any>} */
let eager_effects = new Set();

/** @type {Map<Source, any>} */
const old_values = new Map();

let eager_effects_deferred = false;

/**
 * @template V
 * @param {V} v
 * @param {Error | null} [stack]
 * @returns {Source<V>}
 */
// TODO rename this to `state` throughout the codebase
function source(v, stack) {
	/** @type {Value} */
	var signal = {
		f: 0, // TODO ideally we could skip this altogether, but it causes type errors
		v,
		reactions: null,
		equals,
		rv: 0,
		wv: 0
	};

	return signal;
}

/**
 * @template V
 * @param {V} v
 * @param {Error | null} [stack]
 */
/*#__NO_SIDE_EFFECTS__*/
function state(v, stack) {
	const s = source(v);

	push_reaction_value(s);

	return s;
}

/**
 * @template V
 * @param {V} initial_value
 * @param {boolean} [immutable]
 * @returns {Source<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function mutable_source(initial_value, immutable = false, trackable = true) {
	const s = source(initial_value);
	if (!immutable) {
		s.equals = safe_equals;
	}

	// bind the signal to the component context, in case we need to
	// track updates to trigger beforeUpdate/afterUpdate callbacks
	if (legacy_mode_flag && trackable && component_context !== null && component_context.l !== null) {
		(component_context.l.s ??= []).push(s);
	}

	return s;
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @param {boolean} [should_proxy]
 * @returns {V}
 */
function set(source, value, should_proxy = false) {
	if (
		active_reaction !== null &&
		// since we are untracking the function inside `$inspect.with` we need to add this check
		// to ensure we error if state is set inside an inspect effect
		(!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) &&
		is_runes() &&
		(active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 &&
		!current_sources?.includes(source)
	) {
		state_unsafe_mutation();
	}

	let new_value = should_proxy ? proxy(value) : value;

	return internal_set(source, new_value);
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @returns {V}
 */
function internal_set(source, value) {
	if (!source.equals(value)) {
		var old_value = source.v;

		if (is_destroying_effect) {
			old_values.set(source, value);
		} else {
			old_values.set(source, old_value);
		}

		source.v = value;

		var batch = Batch.ensure();
		batch.capture(source, old_value);

		if ((source.f & DERIVED) !== 0) {
			// if we are assigning to a dirty derived we set it to clean/maybe dirty but we also eagerly execute it to track the dependencies
			if ((source.f & DIRTY) !== 0) {
				execute_derived(/** @type {Derived} */ (source));
			}

			set_signal_status(source, (source.f & CONNECTED) !== 0 ? CLEAN : MAYBE_DIRTY);
		}

		source.wv = increment_write_version();

		mark_reactions(source, DIRTY);

		// It's possible that the current reaction might not have up-to-date dependencies
		// whilst it's actively running. So in the case of ensuring it registers the reaction
		// properly for itself, we need to ensure the current effect actually gets
		// scheduled. i.e: `$effect(() => x++)`
		if (
			is_runes() &&
			active_effect !== null &&
			(active_effect.f & CLEAN) !== 0 &&
			(active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0
		) {
			if (untracked_writes === null) {
				set_untracked_writes([source]);
			} else {
				untracked_writes.push(source);
			}
		}

		if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
			flush_eager_effects();
		}
	}

	return value;
}

function flush_eager_effects() {
	eager_effects_deferred = false;
	var prev_is_updating_effect = is_updating_effect;
	set_is_updating_effect(true);

	const inspects = Array.from(eager_effects);

	try {
		for (const effect of inspects) {
			// Mark clean inspect-effects as maybe dirty and then check their dirtiness
			// instead of just updating the effects - this way we avoid overfiring.
			if ((effect.f & CLEAN) !== 0) {
				set_signal_status(effect, MAYBE_DIRTY);
			}

			if (is_dirty(effect)) {
				update_effect(effect);
			}
		}
	} finally {
		set_is_updating_effect(prev_is_updating_effect);
	}

	eager_effects.clear();
}

/**
 * Silently (without using `get`) increment a source
 * @param {Source<number>} source
 */
function increment(source) {
	set(source, source.v + 1);
}

/**
 * @param {Value} signal
 * @param {number} status should be DIRTY or MAYBE_DIRTY
 * @returns {void}
 */
function mark_reactions(signal, status) {
	var reactions = signal.reactions;
	if (reactions === null) return;

	var runes = is_runes();
	var length = reactions.length;

	for (var i = 0; i < length; i++) {
		var reaction = reactions[i];
		var flags = reaction.f;

		// In legacy mode, skip the current effect to prevent infinite loops
		if (!runes && reaction === active_effect) continue;

		var not_dirty = (flags & DIRTY) === 0;

		// don't set a DIRTY reaction to MAYBE_DIRTY
		if (not_dirty) {
			set_signal_status(reaction, status);
		}

		if ((flags & DERIVED) !== 0) {
			var derived = /** @type {Derived} */ (reaction);

			batch_values?.delete(derived);

			if ((flags & WAS_MARKED) === 0) {
				// Only connected deriveds can be reliably unmarked right away
				if (flags & CONNECTED) {
					reaction.f |= WAS_MARKED;
				}

				mark_reactions(derived, MAYBE_DIRTY);
			}
		} else if (not_dirty) {
			if ((flags & BLOCK_EFFECT) !== 0) {
				if (eager_block_effects !== null) {
					eager_block_effects.add(/** @type {Effect} */ (reaction));
				}
			}

			schedule_effect(/** @type {Effect} */ (reaction));
		}
	}
}

/**
 * @template T
 * @param {() => T} fn
 */
function without_reactive_context(fn) {
	var previous_reaction = active_reaction;
	var previous_effect = active_effect;
	set_active_reaction(null);
	set_active_effect(null);
	try {
		return fn();
	} finally {
		set_active_reaction(previous_reaction);
		set_active_effect(previous_effect);
	}
}

/** @import { Derived, Effect, Reaction, Signal, Source, Value } from '#client' */

let is_updating_effect = false;

/** @param {boolean} value */
function set_is_updating_effect(value) {
	is_updating_effect = value;
}

let is_destroying_effect = false;

/** @param {boolean} value */
function set_is_destroying_effect(value) {
	is_destroying_effect = value;
}

/** @type {null | Reaction} */
let active_reaction = null;

let untracking = false;

/** @param {null | Reaction} reaction */
function set_active_reaction(reaction) {
	active_reaction = reaction;
}

/** @type {null | Effect} */
let active_effect = null;

/** @param {null | Effect} effect */
function set_active_effect(effect) {
	active_effect = effect;
}

/**
 * When sources are created within a reaction, reading and writing
 * them within that reaction should not cause a re-run
 * @type {null | Source[]}
 */
let current_sources = null;

/** @param {Value} value */
function push_reaction_value(value) {
	if (active_reaction !== null && (true)) {
		if (current_sources === null) {
			current_sources = [value];
		} else {
			current_sources.push(value);
		}
	}
}

/**
 * The dependencies of the reaction that is currently being executed. In many cases,
 * the dependencies are unchanged between runs, and so this will be `null` unless
 * and until a new dependency is accessed — we track this via `skipped_deps`
 * @type {null | Value[]}
 */
let new_deps = null;

let skipped_deps = 0;

/**
 * Tracks writes that the effect it's executed in doesn't listen to yet,
 * so that the dependency can be added to the effect later on if it then reads it
 * @type {null | Source[]}
 */
let untracked_writes = null;

/** @param {null | Source[]} value */
function set_untracked_writes(value) {
	untracked_writes = value;
}

/**
 * @type {number} Used by sources and deriveds for handling updates.
 * Version starts from 1 so that unowned deriveds differentiate between a created effect and a run one for tracing
 **/
let write_version = 1;

/** @type {number} Used to version each read of a source of derived to avoid duplicating depedencies inside a reaction */
let read_version = 0;

let update_version = read_version;

/** @param {number} value */
function set_update_version(value) {
	update_version = value;
}

function increment_write_version() {
	return ++write_version;
}

/**
 * Determines whether a derived or effect is dirty.
 * If it is MAYBE_DIRTY, will set the status to CLEAN
 * @param {Reaction} reaction
 * @returns {boolean}
 */
function is_dirty(reaction) {
	var flags = reaction.f;

	if ((flags & DIRTY) !== 0) {
		return true;
	}

	if (flags & DERIVED) {
		reaction.f &= ~WAS_MARKED;
	}

	if ((flags & MAYBE_DIRTY) !== 0) {
		var dependencies = reaction.deps;

		if (dependencies !== null) {
			var length = dependencies.length;

			for (var i = 0; i < length; i++) {
				var dependency = dependencies[i];

				if (is_dirty(/** @type {Derived} */ (dependency))) {
					update_derived(/** @type {Derived} */ (dependency));
				}

				if (dependency.wv > reaction.wv) {
					return true;
				}
			}
		}

		if (
			(flags & CONNECTED) !== 0 &&
			// During time traveling we don't want to reset the status so that
			// traversal of the graph in the other batches still happens
			batch_values === null
		) {
			set_signal_status(reaction, CLEAN);
		}
	}

	return false;
}

/**
 * @param {Value} signal
 * @param {Effect} effect
 * @param {boolean} [root]
 */
function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
	var reactions = signal.reactions;
	if (reactions === null) return;

	if (current_sources?.includes(signal)) {
		return;
	}

	for (var i = 0; i < reactions.length; i++) {
		var reaction = reactions[i];

		if ((reaction.f & DERIVED) !== 0) {
			schedule_possible_effect_self_invalidation(/** @type {Derived} */ (reaction), effect, false);
		} else if (effect === reaction) {
			if (root) {
				set_signal_status(reaction, DIRTY);
			} else if ((reaction.f & CLEAN) !== 0) {
				set_signal_status(reaction, MAYBE_DIRTY);
			}
			schedule_effect(/** @type {Effect} */ (reaction));
		}
	}
}

/** @param {Reaction} reaction */
function update_reaction(reaction) {
	var previous_deps = new_deps;
	var previous_skipped_deps = skipped_deps;
	var previous_untracked_writes = untracked_writes;
	var previous_reaction = active_reaction;
	var previous_sources = current_sources;
	var previous_component_context = component_context;
	var previous_untracking = untracking;
	var previous_update_version = update_version;

	var flags = reaction.f;

	new_deps = /** @type {null | Value[]} */ (null);
	skipped_deps = 0;
	untracked_writes = null;
	active_reaction = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;

	current_sources = null;
	set_component_context(reaction.ctx);
	untracking = false;
	update_version = ++read_version;

	if (reaction.ac !== null) {
		without_reactive_context(() => {
			/** @type {AbortController} */ (reaction.ac).abort(STALE_REACTION);
		});

		reaction.ac = null;
	}

	try {
		reaction.f |= REACTION_IS_UPDATING;
		var fn = /** @type {Function} */ (reaction.fn);
		var result = fn();
		var deps = reaction.deps;

		if (new_deps !== null) {
			var i;

			remove_reactions(reaction, skipped_deps);

			if (deps !== null && skipped_deps > 0) {
				deps.length = skipped_deps + new_deps.length;
				for (i = 0; i < new_deps.length; i++) {
					deps[skipped_deps + i] = new_deps[i];
				}
			} else {
				reaction.deps = deps = new_deps;
			}

			if (is_updating_effect && effect_tracking() && (reaction.f & CONNECTED) !== 0) {
				for (i = skipped_deps; i < deps.length; i++) {
					(deps[i].reactions ??= []).push(reaction);
				}
			}
		} else if (deps !== null && skipped_deps < deps.length) {
			remove_reactions(reaction, skipped_deps);
			deps.length = skipped_deps;
		}

		// If we're inside an effect and we have untracked writes, then we need to
		// ensure that if any of those untracked writes result in re-invalidation
		// of the current effect, then that happens accordingly
		if (
			is_runes() &&
			untracked_writes !== null &&
			!untracking &&
			deps !== null &&
			(reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0
		) {
			for (i = 0; i < /** @type {Source[]} */ (untracked_writes).length; i++) {
				schedule_possible_effect_self_invalidation(
					untracked_writes[i],
					/** @type {Effect} */ (reaction)
				);
			}
		}

		// If we are returning to an previous reaction then
		// we need to increment the read version to ensure that
		// any dependencies in this reaction aren't marked with
		// the same version
		if (previous_reaction !== null && previous_reaction !== reaction) {
			read_version++;

			if (untracked_writes !== null) {
				if (previous_untracked_writes === null) {
					previous_untracked_writes = untracked_writes;
				} else {
					previous_untracked_writes.push(.../** @type {Source[]} */ (untracked_writes));
				}
			}
		}

		if ((reaction.f & ERROR_VALUE) !== 0) {
			reaction.f ^= ERROR_VALUE;
		}

		return result;
	} catch (error) {
		return handle_error(error);
	} finally {
		reaction.f ^= REACTION_IS_UPDATING;
		new_deps = previous_deps;
		skipped_deps = previous_skipped_deps;
		untracked_writes = previous_untracked_writes;
		active_reaction = previous_reaction;
		current_sources = previous_sources;
		set_component_context(previous_component_context);
		untracking = previous_untracking;
		update_version = previous_update_version;
	}
}

/**
 * @template V
 * @param {Reaction} signal
 * @param {Value<V>} dependency
 * @returns {void}
 */
function remove_reaction(signal, dependency) {
	let reactions = dependency.reactions;
	if (reactions !== null) {
		var index = index_of.call(reactions, signal);
		if (index !== -1) {
			var new_length = reactions.length - 1;
			if (new_length === 0) {
				reactions = dependency.reactions = null;
			} else {
				// Swap with last element and then remove.
				reactions[index] = reactions[new_length];
				reactions.pop();
			}
		}
	}

	// If the derived has no reactions, then we can disconnect it from the graph,
	// allowing it to either reconnect in the future, or be GC'd by the VM.
	if (
		reactions === null &&
		(dependency.f & DERIVED) !== 0 &&
		// Destroying a child effect while updating a parent effect can cause a dependency to appear
		// to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
		// allows us to skip the expensive work of disconnecting and immediately reconnecting it
		(new_deps === null || !new_deps.includes(dependency))
	) {
		set_signal_status(dependency, MAYBE_DIRTY);
		// If we are working with a derived that is owned by an effect, then mark it as being
		// disconnected and remove the mark flag, as it cannot be reliably removed otherwise
		if ((dependency.f & CONNECTED) !== 0) {
			dependency.f ^= CONNECTED;
			dependency.f &= ~WAS_MARKED;
		}
		// Disconnect any reactions owned by this reaction
		destroy_derived_effects(/** @type {Derived} **/ (dependency));
		remove_reactions(/** @type {Derived} **/ (dependency), 0);
	}
}

/**
 * @param {Reaction} signal
 * @param {number} start_index
 * @returns {void}
 */
function remove_reactions(signal, start_index) {
	var dependencies = signal.deps;
	if (dependencies === null) return;

	for (var i = start_index; i < dependencies.length; i++) {
		remove_reaction(signal, dependencies[i]);
	}
}

/**
 * @param {Effect} effect
 * @returns {void}
 */
function update_effect(effect) {
	var flags = effect.f;

	if ((flags & DESTROYED) !== 0) {
		return;
	}

	set_signal_status(effect, CLEAN);

	var previous_effect = active_effect;
	var was_updating_effect = is_updating_effect;

	active_effect = effect;
	is_updating_effect = true;

	try {
		if ((flags & BLOCK_EFFECT) !== 0) {
			destroy_block_effect_children(effect);
		} else {
			destroy_effect_children(effect);
		}

		execute_effect_teardown(effect);
		var teardown = update_reaction(effect);
		effect.teardown = typeof teardown === 'function' ? teardown : null;
		effect.wv = write_version;

		// In DEV, increment versions of any sources that were written to during the effect,
		// so that they are correctly marked as dirty when the effect re-runs
		var dep; if (DEV && tracing_mode_flag && (effect.f & DIRTY) !== 0 && effect.deps !== null) ;
	} finally {
		is_updating_effect = was_updating_effect;
		active_effect = previous_effect;
	}
}

/**
 * @template V
 * @param {Value<V>} signal
 * @returns {V}
 */
function get$1(signal) {
	var flags = signal.f;
	var is_derived = (flags & DERIVED) !== 0;

	// Register the dependency on the current reaction signal.
	if (active_reaction !== null && !untracking) {
		// if we're in a derived that is being read inside an _async_ derived,
		// it's possible that the effect was already destroyed. In this case,
		// we don't add the dependency, because that would create a memory leak
		var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;

		if (!destroyed && !current_sources?.includes(signal)) {
			var deps = active_reaction.deps;

			if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
				// we're in the effect init/update cycle
				if (signal.rv < read_version) {
					signal.rv = read_version;

					// If the signal is accessing the same dependencies in the same
					// order as it did last time, increment `skipped_deps`
					// rather than updating `new_deps`, which creates GC cost
					if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
						skipped_deps++;
					} else if (new_deps === null) {
						new_deps = [signal];
					} else if (!new_deps.includes(signal)) {
						new_deps.push(signal);
					}
				}
			} else {
				// we're adding a dependency outside the init/update cycle
				// (i.e. after an `await`)
				(active_reaction.deps ??= []).push(signal);

				var reactions = signal.reactions;

				if (reactions === null) {
					signal.reactions = [active_reaction];
				} else if (!reactions.includes(active_reaction)) {
					reactions.push(active_reaction);
				}
			}
		}
	}

	if (is_destroying_effect) {
		if (old_values.has(signal)) {
			return old_values.get(signal);
		}

		if (is_derived) {
			var derived = /** @type {Derived} */ (signal);

			var value = derived.v;

			// if the derived is dirty and has reactions, or depends on the values that just changed, re-execute
			// (a derived can be maybe_dirty due to the effect destroy removing its last reaction)
			if (
				((derived.f & CLEAN) === 0 && derived.reactions !== null) ||
				depends_on_old_values(derived)
			) {
				value = execute_derived(derived);
			}

			old_values.set(derived, value);

			return value;
		}
	} else if (is_derived && !batch_values?.has(signal)) {
		derived = /** @type {Derived} */ (signal);

		if (is_dirty(derived)) {
			update_derived(derived);
		}

		if (is_updating_effect && effect_tracking() && (derived.f & CONNECTED) === 0) {
			reconnect(derived);
		}
	}

	if (batch_values?.has(signal)) {
		return batch_values.get(signal);
	}

	if ((signal.f & ERROR_VALUE) !== 0) {
		throw signal.v;
	}

	return signal.v;
}

/**
 * (Re)connect a disconnected derived, so that it is notified
 * of changes in `mark_reactions`
 * @param {Derived} derived
 */
function reconnect(derived) {
	if (derived.deps === null) return;

	derived.f ^= CONNECTED;

	for (const dep of derived.deps) {
		(dep.reactions ??= []).push(derived);

		if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
			reconnect(/** @type {Derived} */ (dep));
		}
	}
}

/** @param {Derived} derived */
function depends_on_old_values(derived) {
	if (derived.v === UNINITIALIZED) return true; // we don't know, so assume the worst
	if (derived.deps === null) return false;

	for (const dep of derived.deps) {
		if (old_values.has(dep)) {
			return true;
		}

		if ((dep.f & DERIVED) !== 0 && depends_on_old_values(/** @type {Derived} */ (dep))) {
			return true;
		}
	}

	return false;
}

/**
 * When used inside a [`$derived`](https://svelte.dev/docs/svelte/$derived) or [`$effect`](https://svelte.dev/docs/svelte/$effect),
 * any state read inside `fn` will not be treated as a dependency.
 *
 * ```ts
 * $effect(() => {
 *   // this will run when `data` changes, but not when `time` changes
 *   save(data, {
 *     timestamp: untrack(() => time)
 *   });
 * });
 * ```
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function untrack(fn) {
	var previous_untracking = untracking;
	try {
		untracking = true;
		return fn();
	} finally {
		untracking = previous_untracking;
	}
}

const STATUS_MASK = -7169;

/**
 * @param {Signal} signal
 * @param {number} status
 * @returns {void}
 */
function set_signal_status(signal, status) {
	signal.f = (signal.f & STATUS_MASK) | status;
}

/**
 * Possibly traverse an object and read all its properties so that they're all reactive in case this is `$state`.
 * Does only check first level of an object for performance reasons (heuristic should be good for 99% of all cases).
 * @param {any} value
 * @returns {void}
 */
function deep_read_state(value) {
	if (typeof value !== 'object' || !value || value instanceof EventTarget) {
		return;
	}

	if (STATE_SYMBOL in value) {
		deep_read(value);
	} else if (!Array.isArray(value)) {
		for (let key in value) {
			const prop = value[key];
			if (typeof prop === 'object' && prop && STATE_SYMBOL in prop) {
				deep_read(prop);
			}
		}
	}
}

/**
 * Deeply traverse an object and read all its properties
 * so that they're all reactive in case this is `$state`
 * @param {any} value
 * @param {Set<any>} visited
 * @returns {void}
 */
function deep_read(value, visited = new Set()) {
	if (
		typeof value === 'object' &&
		value !== null &&
		// We don't want to traverse DOM elements
		!(value instanceof EventTarget) &&
		!visited.has(value)
	) {
		visited.add(value);
		// When working with a possible SvelteDate, this
		// will ensure we capture changes to it.
		if (value instanceof Date) {
			value.getTime();
		}
		for (let key in value) {
			try {
				deep_read(value[key], visited);
			} catch (e) {
				// continue
			}
		}
		const proto = get_prototype_of(value);
		if (
			proto !== Object.prototype &&
			proto !== Array.prototype &&
			proto !== Map.prototype &&
			proto !== Set.prototype &&
			proto !== Date.prototype
		) {
			const descriptors = get_descriptors(proto);
			for (let key in descriptors) {
				const get = descriptors[key].get;
				if (get) {
					try {
						get.call(value);
					} catch (e) {
						// continue
					}
				}
			}
		}
	}
}

/** @import { ComponentContext, ComponentContextLegacy, Derived, Effect, TemplateNode, TransitionManager } from '#client' */

/**
 * @param {'$effect' | '$effect.pre' | '$inspect'} rune
 */
function validate_effect(rune) {
	if (active_effect === null) {
		if (active_reaction === null) {
			effect_orphan();
		}

		effect_in_unowned_derived();
	}

	if (is_destroying_effect) {
		effect_in_teardown();
	}
}

/**
 * @param {Effect} effect
 * @param {Effect} parent_effect
 */
function push_effect(effect, parent_effect) {
	var parent_last = parent_effect.last;
	if (parent_last === null) {
		parent_effect.last = parent_effect.first = effect;
	} else {
		parent_last.next = effect;
		effect.prev = parent_last;
		parent_effect.last = effect;
	}
}

/**
 * @param {number} type
 * @param {null | (() => void | (() => void))} fn
 * @param {boolean} sync
 * @returns {Effect}
 */
function create_effect(type, fn, sync) {
	var parent = active_effect;

	if (parent !== null && (parent.f & INERT) !== 0) {
		type |= INERT;
	}

	/** @type {Effect} */
	var effect = {
		ctx: component_context,
		deps: null,
		nodes_start: null,
		nodes_end: null,
		f: type | DIRTY | CONNECTED,
		first: null,
		fn,
		last: null,
		next: null,
		parent,
		b: parent && parent.b,
		prev: null,
		teardown: null,
		transitions: null,
		wv: 0,
		ac: null
	};

	if (sync) {
		try {
			update_effect(effect);
			effect.f |= EFFECT_RAN;
		} catch (e) {
			destroy_effect(effect);
			throw e;
		}
	} else if (fn !== null) {
		schedule_effect(effect);
	}

	/** @type {Effect | null} */
	var e = effect;

	// if an effect has already ran and doesn't need to be kept in the tree
	// (because it won't re-run, has no DOM, and has no teardown etc)
	// then we skip it and go to its child (if any)
	if (
		sync &&
		e.deps === null &&
		e.teardown === null &&
		e.nodes_start === null &&
		e.first === e.last && // either `null`, or a singular child
		(e.f & EFFECT_PRESERVED) === 0
	) {
		e = e.first;
		if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
			e.f |= EFFECT_TRANSPARENT;
		}
	}

	if (e !== null) {
		e.parent = parent;

		if (parent !== null) {
			push_effect(e, parent);
		}

		// if we're in a derived, add the effect there too
		if (
			active_reaction !== null &&
			(active_reaction.f & DERIVED) !== 0 &&
			(type & ROOT_EFFECT) === 0
		) {
			var derived = /** @type {Derived} */ (active_reaction);
			(derived.effects ??= []).push(e);
		}
	}

	return effect;
}

/**
 * Internal representation of `$effect.tracking()`
 * @returns {boolean}
 */
function effect_tracking() {
	return active_reaction !== null && !untracking;
}

/**
 * @param {() => void} fn
 */
function teardown(fn) {
	const effect = create_effect(RENDER_EFFECT, null, false);
	set_signal_status(effect, CLEAN);
	effect.teardown = fn;
	return effect;
}

/**
 * Internal representation of `$effect(...)`
 * @param {() => void | (() => void)} fn
 */
function user_effect(fn) {
	validate_effect();

	// Non-nested `$effect(...)` in a component should be deferred
	// until the component is mounted
	var flags = /** @type {Effect} */ (active_effect).f;
	var defer = !active_reaction && (flags & BRANCH_EFFECT) !== 0 && (flags & EFFECT_RAN) === 0;

	if (defer) {
		// Top-level `$effect(...)` in an unmounted component — defer until mount
		var context = /** @type {ComponentContext} */ (component_context);
		(context.e ??= []).push(fn);
	} else {
		// Everything else — create immediately
		return create_user_effect(fn);
	}
}

/**
 * @param {() => void | (() => void)} fn
 */
function create_user_effect(fn) {
	return create_effect(EFFECT | USER_EFFECT, fn, false);
}

/**
 * Internal representation of `$effect.pre(...)`
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function user_pre_effect(fn) {
	validate_effect();
	return create_effect(RENDER_EFFECT | USER_EFFECT, fn, true);
}

/**
 * Internal representation of `$: ..`
 * @param {() => any} deps
 * @param {() => void | (() => void)} fn
 */
function legacy_pre_effect(deps, fn) {
	var context = /** @type {ComponentContextLegacy} */ (component_context);

	/** @type {{ effect: null | Effect, ran: boolean, deps: () => any }} */
	var token = { effect: null, ran: false, deps };

	context.l.$.push(token);

	token.effect = render_effect(() => {
		deps();

		// If this legacy pre effect has already run before the end of the reset, then
		// bail out to emulate the same behavior.
		if (token.ran) return;

		token.ran = true;
		untrack(fn);
	});
}

function legacy_pre_effect_reset() {
	var context = /** @type {ComponentContextLegacy} */ (component_context);

	render_effect(() => {
		// Run dirty `$:` statements
		for (var token of context.l.$) {
			token.deps();

			var effect = token.effect;

			// If the effect is CLEAN, then make it MAYBE_DIRTY. This ensures we traverse through
			// the effects dependencies and correctly ensure each dependency is up-to-date.
			if ((effect.f & CLEAN) !== 0) {
				set_signal_status(effect, MAYBE_DIRTY);
			}

			if (is_dirty(effect)) {
				update_effect(effect);
			}

			token.ran = false;
		}
	});
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function render_effect(fn, flags = 0) {
	return create_effect(RENDER_EFFECT | flags, fn, true);
}

/**
 * @param {Effect} effect
 */
function execute_effect_teardown(effect) {
	var teardown = effect.teardown;
	if (teardown !== null) {
		const previously_destroying_effect = is_destroying_effect;
		const previous_reaction = active_reaction;
		set_is_destroying_effect(true);
		set_active_reaction(null);
		try {
			teardown.call(null);
		} finally {
			set_is_destroying_effect(previously_destroying_effect);
			set_active_reaction(previous_reaction);
		}
	}
}

/**
 * @param {Effect} signal
 * @param {boolean} remove_dom
 * @returns {void}
 */
function destroy_effect_children(signal, remove_dom = false) {
	var effect = signal.first;
	signal.first = signal.last = null;

	while (effect !== null) {
		const controller = effect.ac;

		if (controller !== null) {
			without_reactive_context(() => {
				controller.abort(STALE_REACTION);
			});
		}

		var next = effect.next;

		if ((effect.f & ROOT_EFFECT) !== 0) {
			// this is now an independent root
			effect.parent = null;
		} else {
			destroy_effect(effect, remove_dom);
		}

		effect = next;
	}
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function destroy_block_effect_children(signal) {
	var effect = signal.first;

	while (effect !== null) {
		var next = effect.next;
		if ((effect.f & BRANCH_EFFECT) === 0) {
			destroy_effect(effect);
		}
		effect = next;
	}
}

/**
 * @param {Effect} effect
 * @param {boolean} [remove_dom]
 * @returns {void}
 */
function destroy_effect(effect, remove_dom = true) {
	var removed = false;

	if (
		(remove_dom || (effect.f & HEAD_EFFECT) !== 0) &&
		effect.nodes_start !== null &&
		effect.nodes_end !== null
	) {
		remove_effect_dom(effect.nodes_start, /** @type {TemplateNode} */ (effect.nodes_end));
		removed = true;
	}

	destroy_effect_children(effect, remove_dom && !removed);
	remove_reactions(effect, 0);
	set_signal_status(effect, DESTROYED);

	var transitions = effect.transitions;

	if (transitions !== null) {
		for (const transition of transitions) {
			transition.stop();
		}
	}

	execute_effect_teardown(effect);

	var parent = effect.parent;

	// If the parent doesn't have any children, then skip this work altogether
	if (parent !== null && parent.first !== null) {
		unlink_effect(effect);
	}

	// `first` and `child` are nulled out in destroy_effect_children
	// we don't null out `parent` so that error propagation can work correctly
	effect.next =
		effect.prev =
		effect.teardown =
		effect.ctx =
		effect.deps =
		effect.fn =
		effect.nodes_start =
		effect.nodes_end =
		effect.ac =
			null;
}

/**
 *
 * @param {TemplateNode | null} node
 * @param {TemplateNode} end
 */
function remove_effect_dom(node, end) {
	while (node !== null) {
		/** @type {TemplateNode | null} */
		var next = node === end ? null : /** @type {TemplateNode} */ (get_next_sibling(node));

		node.remove();
		node = next;
	}
}

/**
 * Detach an effect from the effect tree, freeing up memory and
 * reducing the amount of work that happens on subsequent traversals
 * @param {Effect} effect
 */
function unlink_effect(effect) {
	var parent = effect.parent;
	var prev = effect.prev;
	var next = effect.next;

	if (prev !== null) prev.next = next;
	if (next !== null) next.prev = prev;

	if (parent !== null) {
		if (parent.first === effect) parent.first = next;
		if (parent.last === effect) parent.last = prev;
	}
}

/**
 * Makes an `export`ed (non-prop) variable available on the `$$props` object
 * so that consumers can do `bind:x` on the component.
 * @template V
 * @param {Record<string, unknown>} props
 * @param {string} prop
 * @param {V} value
 * @returns {void}
 */
function bind_prop(props, prop, value) {
	var desc = get_descriptor(props, prop);

	if (desc && desc.set) {
		props[prop] = value;
		teardown(() => {
			props[prop] = null;
		});
	}
}

/** @import { ComponentContextLegacy } from '#client' */

/**
 * Legacy-mode only: Call `onMount` callbacks and set up `beforeUpdate`/`afterUpdate` effects
 * @param {boolean} [immutable]
 */
function init$1(immutable = false) {
	const context = /** @type {ComponentContextLegacy} */ (component_context);

	const callbacks = context.l.u;
	if (!callbacks) return;

	let props = () => deep_read_state(context.s);

	if (immutable) {
		let version = 0;
		let prev = /** @type {Record<string, any>} */ ({});

		// In legacy immutable mode, before/afterUpdate only fire if the object identity of a prop changes
		const d = derived(() => {
			let changed = false;
			const props = context.s;
			for (const key in props) {
				if (props[key] !== prev[key]) {
					prev[key] = props[key];
					changed = true;
				}
			}
			if (changed) version++;
			return version;
		});

		props = () => get$1(d);
	}

	// beforeUpdate
	if (callbacks.b.length) {
		user_pre_effect(() => {
			observe_all(context, props);
			run_all$1(callbacks.b);
		});
	}

	// onMount (must run before afterUpdate)
	user_effect(() => {
		const fns = untrack(() => callbacks.m.map(run$1));
		return () => {
			for (const fn of fns) {
				if (typeof fn === 'function') {
					fn();
				}
			}
		};
	});

	// afterUpdate
	if (callbacks.a.length) {
		user_effect(() => {
			observe_all(context, props);
			run_all$1(callbacks.a);
		});
	}
}

/**
 * Invoke the getter of all signals associated with a component
 * so they can be registered to the effect this function is called in.
 * @param {ComponentContextLegacy} context
 * @param {(() => void)} props
 */
function observe_all(context, props) {
	if (context.l.s) {
		for (const signal of context.l.s) get$1(signal);
	}

	props();
}

/** @import { StoreReferencesContainer } from '#client' */
/** @import { Store } from '#shared' */

/**
 * Whether or not the prop currently being read is a store binding, as in
 * `<Child bind:x={$y} />`. If it is, we treat the prop as mutable even in
 * runes mode, and skip `binding_property_non_reactive` validation
 */
let is_store_binding = false;

let IS_UNMOUNTED = Symbol();

/**
 * Gets the current value of a store. If the store isn't subscribed to yet, it will create a proxy
 * signal that will be updated when the store is. The store references container is needed to
 * track reassignments to stores and to track the correct component context.
 * @template V
 * @param {Store<V> | null | undefined} store
 * @param {string} store_name
 * @param {StoreReferencesContainer} stores
 * @returns {V}
 */
function store_get(store, store_name, stores) {
	const entry = (stores[store_name] ??= {
		store: null,
		source: mutable_source(undefined),
		unsubscribe: noop$1
	});

	// if the component that setup this is already unmounted we don't want to register a subscription
	if (entry.store !== store && !(IS_UNMOUNTED in stores)) {
		entry.unsubscribe();
		entry.store = store ?? null;

		if (store == null) {
			entry.source.v = undefined; // see synchronous callback comment below
			entry.unsubscribe = noop$1;
		} else {
			var is_synchronous_callback = true;

			entry.unsubscribe = subscribe_to_store(store, (v) => {
				if (is_synchronous_callback) {
					// If the first updates to the store value (possibly multiple of them) are synchronously
					// inside a derived, we will hit the `state_unsafe_mutation` error if we `set` the value
					entry.source.v = v;
				} else {
					set(entry.source, v);
				}
			});

			is_synchronous_callback = false;
		}
	}

	// if the component that setup this stores is already unmounted the source will be out of sync
	// so we just use the `get` for the stores, less performant but it avoids to create a memory leak
	// and it will keep the value consistent
	if (store && IS_UNMOUNTED in stores) {
		return get(store);
	}

	return get$1(entry.source);
}

/**
 * Unsubscribes from all auto-subscribed stores on destroy
 * @returns {[StoreReferencesContainer, ()=>void]}
 */
function setup_stores() {
	/** @type {StoreReferencesContainer} */
	const stores = {};

	function cleanup() {
		teardown(() => {
			for (var store_name in stores) {
				const ref = stores[store_name];
				ref.unsubscribe();
			}
			define_property(stores, IS_UNMOUNTED, {
				enumerable: false,
				value: true
			});
		});
	}

	return [stores, cleanup];
}

/**
 * Returns a tuple that indicates whether `fn()` reads a prop that is a store binding.
 * Used to prevent `binding_property_non_reactive` validation false positives and
 * ensure that these props are treated as mutable even in runes mode
 * @template T
 * @param {() => T} fn
 * @returns {[T, boolean]}
 */
function capture_store_binding(fn) {
	var previous_is_store_binding = is_store_binding;

	try {
		is_store_binding = false;
		return [fn(), is_store_binding];
	} finally {
		is_store_binding = previous_is_store_binding;
	}
}

/** @import { Effect, Source } from './types.js' */

/**
 * This function is responsible for synchronizing a possibly bound prop with the inner component state.
 * It is used whenever the compiler sees that the component writes to the prop, or when it has a default prop_value.
 * @template V
 * @param {Record<string, unknown>} props
 * @param {string} key
 * @param {number} flags
 * @param {V | (() => V)} [fallback]
 * @returns {(() => V | ((arg: V) => V) | ((arg: V, mutation: boolean) => V))}
 */
function prop(props, key, flags, fallback) {
	var runes = !legacy_mode_flag || (flags & PROPS_IS_RUNES) !== 0;
	var bindable = (flags & PROPS_IS_BINDABLE) !== 0;
	var lazy = (flags & PROPS_IS_LAZY_INITIAL) !== 0;

	var fallback_value = /** @type {V} */ (fallback);
	var fallback_dirty = true;

	var get_fallback = () => {
		if (fallback_dirty) {
			fallback_dirty = false;

			fallback_value = lazy
				? untrack(/** @type {() => V} */ (fallback))
				: /** @type {V} */ (fallback);
		}

		return fallback_value;
	};

	/** @type {((v: V) => void) | undefined} */
	var setter;

	if (bindable) {
		// Can be the case when someone does `mount(Component, props)` with `let props = $state({...})`
		// or `createClassComponent(Component, props)`
		var is_entry_props = STATE_SYMBOL in props || LEGACY_PROPS in props;

		setter =
			get_descriptor(props, key)?.set ??
			(is_entry_props && key in props ? (v) => (props[key] = v) : undefined);
	}

	var initial_value;
	var is_store_sub = false;

	if (bindable) {
		[initial_value, is_store_sub] = capture_store_binding(() => /** @type {V} */ (props[key]));
	} else {
		initial_value = /** @type {V} */ (props[key]);
	}

	if (initial_value === undefined && fallback !== undefined) {
		initial_value = get_fallback();

		if (setter) {
			if (runes) props_invalid_value();
			setter(initial_value);
		}
	}

	/** @type {() => V} */
	var getter;

	if (runes) {
		getter = () => {
			var value = /** @type {V} */ (props[key]);
			if (value === undefined) return get_fallback();
			fallback_dirty = true;
			return value;
		};
	} else {
		getter = () => {
			var value = /** @type {V} */ (props[key]);

			if (value !== undefined) {
				// in legacy mode, we don't revert to the fallback value
				// if the prop goes from defined to undefined. The easiest
				// way to model this is to make the fallback undefined
				// as soon as the prop has a value
				fallback_value = /** @type {V} */ (undefined);
			}

			return value === undefined ? fallback_value : value;
		};
	}

	// prop is never written to — we only need a getter
	if (runes && (flags & PROPS_IS_UPDATED) === 0) {
		return getter;
	}

	// prop is written to, but the parent component had `bind:foo` which
	// means we can just call `$$props.foo = value` directly
	if (setter) {
		var legacy_parent = props.$$legacy;
		return /** @type {() => V} */ (
			function (/** @type {V} */ value, /** @type {boolean} */ mutation) {
				if (arguments.length > 0) {
					// We don't want to notify if the value was mutated and the parent is in runes mode.
					// In that case the state proxy (if it exists) should take care of the notification.
					// If the parent is not in runes mode, we need to notify on mutation, too, that the prop
					// has changed because the parent will not be able to detect the change otherwise.
					if (!runes || !mutation || legacy_parent || is_store_sub) {
						/** @type {Function} */ (setter)(mutation ? getter() : value);
					}

					return value;
				}

				return getter();
			}
		);
	}

	// Either prop is written to, but there's no binding, which means we
	// create a derived that we can write to locally.
	// Or we are in legacy mode where we always create a derived to replicate that
	// Svelte 4 did not trigger updates when a primitive value was updated to the same value.
	var overridden = false;

	var d = ((flags & PROPS_IS_IMMUTABLE) !== 0 ? derived : derived_safe_equal)(() => {
		overridden = false;
		return getter();
	});

	// Capture the initial value if it's bindable
	if (bindable) get$1(d);

	var parent_effect = /** @type {Effect} */ (active_effect);

	return /** @type {() => V} */ (
		function (/** @type {any} */ value, /** @type {boolean} */ mutation) {
			if (arguments.length > 0) {
				const new_value = mutation ? get$1(d) : runes && bindable ? proxy(value) : value;

				set(d, new_value);
				overridden = true;

				if (fallback_value !== undefined) {
					fallback_value = new_value;
				}

				return value;
			}

			// special case — avoid recalculating the derived if we're in a
			// teardown function and the prop was overridden locally, or the
			// component was already destroyed (this latter part is necessary
			// because `bind:this` can read props after the component has
			// been destroyed. TODO simplify `bind:this`
			if ((is_destroying_effect && overridden) || (parent_effect.f & DESTROYED) !== 0) {
				return d.v;
			}

			return get$1(d);
		}
	);
}

/** @import { ComponentContext, ComponentContextLegacy } from '#client' */
/** @import { EventDispatcher } from './index.js' */
/** @import { NotFunction } from './internal/types.js' */

/**
 * `onMount`, like [`$effect`](https://svelte.dev/docs/svelte/$effect), schedules a function to run as soon as the component has been mounted to the DOM.
 * Unlike `$effect`, the provided function only runs once.
 *
 * It must be called during the component's initialisation (but doesn't need to live _inside_ the component;
 * it can be called from an external module). If a function is returned _synchronously_ from `onMount`,
 * it will be called when the component is unmounted.
 *
 * `onMount` functions do not run during [server-side rendering](https://svelte.dev/docs/svelte/svelte-server#render).
 *
 * @template T
 * @param {() => NotFunction<T> | Promise<NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	if (component_context === null) {
		lifecycle_outside_component();
	}

	if (legacy_mode_flag && component_context.l !== null) {
		init_update_callbacks(component_context).m.push(fn);
	} else {
		user_effect(() => {
			const cleanup = untrack(fn);
			if (typeof cleanup === 'function') return /** @type {() => void} */ (cleanup);
		});
	}
}

/**
 * Schedules a callback to run immediately before the component is unmounted.
 *
 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
 * only one that runs inside a server-side component.
 *
 * @param {() => any} fn
 * @returns {void}
 */
function onDestroy(fn) {
	if (component_context === null) {
		lifecycle_outside_component();
	}

	onMount(() => () => untrack(fn));
}

/**
 * Legacy-mode: Init callbacks object for onMount/beforeUpdate/afterUpdate
 * @param {ComponentContext} context
 */
function init_update_callbacks(context) {
	var l = /** @type {ComponentContextLegacy} */ (context).l;
	return (l.u ??= { a: [], b: [], m: [] });
}

/** @import { Readable } from './public' */

/**
 * @template T
 * @param {Readable<T> | null | undefined} store
 * @param {(value: T) => void} run
 * @param {(value: T) => void} [invalidate]
 * @returns {() => void}
 */
function subscribe_to_store(store, run, invalidate) {
	if (store == null) {
		// @ts-expect-error
		run(undefined);

		return noop$1;
	}

	// Svelte store takes a private second argument
	// StartStopNotifier could mutate state, and we want to silence the corresponding validation error
	const unsub = untrack(() =>
		store.subscribe(
			run,
			// @ts-expect-error
			invalidate
		)
	);

	// Also support RxJS
	// @ts-expect-error TODO fix this in the types?
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

/** @import { Readable, StartStopNotifier, Subscriber, Unsubscriber, Updater, Writable } from '../public.js' */
/** @import { Stores, StoresValues, SubscribeInvalidateTuple } from '../private.js' */

/**
 * @type {Array<SubscribeInvalidateTuple<any> | any>}
 */
const subscriber_queue = [];

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 *
 * @template T
 * @param {T} [value] initial value
 * @param {StartStopNotifier<T>} [start]
 * @returns {Writable<T>}
 */
function writable(value, start = noop$1) {
	/** @type {Unsubscriber | null} */
	let stop = null;

	/** @type {Set<SubscribeInvalidateTuple<T>>} */
	const subscribers = new Set();

	/**
	 * @param {T} new_value
	 * @returns {void}
	 */
	function set(new_value) {
		if (safe_not_equal$1(value, new_value)) {
			value = new_value;
			if (stop) {
				// store is ready
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1]);
					}
					subscriber_queue.length = 0;
				}
			}
		}
	}

	/**
	 * @param {Updater<T>} fn
	 * @returns {void}
	 */
	function update(fn) {
		set(fn(/** @type {T} */ (value)));
	}

	/**
	 * @param {Subscriber<T>} run
	 * @param {() => void} [invalidate]
	 * @returns {Unsubscriber}
	 */
	function subscribe(run, invalidate = noop$1) {
		/** @type {SubscribeInvalidateTuple<T>} */
		const subscriber = [run, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			stop = start(set, update) || noop$1;
		}
		run(/** @type {T} */ (value));
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return { set, update, subscribe };
}

/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 *
 * @template T
 * @param {Readable<T>} store
 * @returns {T}
 */
function get(store) {
	let value;
	subscribe_to_store(store, (_) => (value = _))();
	// @ts-expect-error
	return value;
}

const weekdays$1 = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
const defaultSettings = Object.freeze({
    shouldConfirmBeforeCreate: true,
    weekStart: "locale",
    wordsPerDot: DEFAULT_WORDS_PER_DOT,
    useChineseWordCount: false,
    showWeeklyNote: false,
    weeklyNoteFormat: "",
    weeklyNoteTemplate: "",
    weeklyNoteFolder: "",
    localeOverride: "system-default",
});
function appHasPeriodicNotesPluginLoaded() {
    var _a, _b;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = window.app.plugins.getPlugin("periodic-notes");
    return periodicNotes && ((_b = (_a = periodicNotes.settings) === null || _a === void 0 ? void 0 : _a.weekly) === null || _b === void 0 ? void 0 : _b.enabled);
}
class CalendarSettingsTab extends require$$0.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        this.containerEl.empty();
        if (!mainExports.appHasDailyNotesPluginLoaded()) {
            this.containerEl.createDiv("settings-banner", (banner) => {
                banner.createEl("h3", {
                    text: "⚠️ Daily Notes plugin not enabled",
                });
                banner.createEl("p", {
                    cls: "setting-item-description",
                    text: "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
                });
            });
        }
        this.containerEl.createEl("h3", {
            text: "General Settings",
        });
        this.addDotThresholdSetting();
        // === 插入的新开关 ===
        new require$$0.Setting(this.containerEl)
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
        this.addWeekStartSetting();
        this.addConfirmCreateSetting();
        this.addShowWeeklyNoteSetting();
        if (this.plugin.options.showWeeklyNote &&
            !appHasPeriodicNotesPluginLoaded()) {
            this.containerEl.createEl("h3", {
                text: "Weekly Note Settings",
            });
            this.containerEl.createEl("p", {
                cls: "setting-item-description",
                text: "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
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
    addDotThresholdSetting() {
        new require$$0.Setting(this.containerEl)
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
    addWeekStartSetting() {
        const { moment } = window;
        const localizedWeekdays = moment.weekdays();
        const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
        const localeWeekStart = moment.weekdays()[localeWeekStartNum];
        new require$$0.Setting(this.containerEl)
            .setName("Start week on:")
            .setDesc("Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js")
            .addDropdown((dropdown) => {
            dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
            localizedWeekdays.forEach((day, i) => {
                dropdown.addOption(weekdays$1[i], day);
            });
            dropdown.setValue(this.plugin.options.weekStart);
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    weekStart: value,
                }));
            });
        });
    }
    addConfirmCreateSetting() {
        new require$$0.Setting(this.containerEl)
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
    addShowWeeklyNoteSetting() {
        new require$$0.Setting(this.containerEl)
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
    addWeeklyNoteFormatSetting() {
        new require$$0.Setting(this.containerEl)
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
    addWeeklyNoteTemplateSetting() {
        new require$$0.Setting(this.containerEl)
            .setName("Weekly note template")
            .setDesc("Choose the file you want to use as the template for your weekly notes")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteTemplate);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
            });
        });
    }
    addWeeklyNoteFolderSetting() {
        new require$$0.Setting(this.containerEl)
            .setName("Weekly note folder")
            .setDesc("New weekly notes will be placed here")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteFolder);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
            });
        });
    }
    addLocaleOverrideSetting() {
        var _a;
        const { moment } = window;
        const sysLocale = (_a = navigator.language) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        new require$$0.Setting(this.containerEl)
            .setName("Override locale:")
            .setDesc("Set this if you want to use a locale different from the default")
            .addDropdown((dropdown) => {
            dropdown.addOption("system-default", `Same as system (${sysLocale})`);
            moment.locales().forEach((locale) => {
                dropdown.addOption(locale, locale);
            });
            dropdown.setValue(this.plugin.options.localeOverride);
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    localeOverride: value,
                }));
            });
        });
    }
}

const classList = (obj) => {
    return Object.entries(obj)
        .filter(([_k, v]) => !!v)
        .map(([k, _k]) => k);
};
function clamp(num, lowerBound, upperBound) {
    return Math.min(Math.max(lowerBound, num), upperBound);
}
function partition(arr, predicate) {
    const pass = [];
    const fail = [];
    arr.forEach((elem) => {
        if (predicate(elem)) {
            pass.push(elem);
        }
        else {
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
function getDateUIDFromFile(file) {
    if (!file) {
        return null;
    }
    // TODO: I'm not checking the path!
    let date = mainExports.getDateFromFile(file, "day");
    if (date) {
        return mainExports.getDateUID(date, "day");
    }
    date = mainExports.getDateFromFile(file, "week");
    if (date) {
        return mainExports.getDateUID(date, "week");
    }
    return null;
}
/**
 * 计算字数
 * @param text 文本内容
 * @param useChinese 是否开启中文精准模式
 */
function getWordCount(text, useChinese = false) {
    // 模式 1：中文精准模式 (开启开关时)
    if (useChinese) {
        if (!text)
            return 0;
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

function createDailyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const dailyNotes = mainExports.getAllDailyNotes();
                store.set(dailyNotes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    // Avoid error being shown multiple times
                    console.log("[Calendar] Failed to find daily notes folder", err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
function createWeeklyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const weeklyNotes = mainExports.getAllWeeklyNotes();
                store.set(weeklyNotes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    // Avoid error being shown multiple times
                    console.log("[Calendar] Failed to find weekly notes folder", err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
const settings = writable(defaultSettings);
const dailyNotes = createDailyNotesStore();
const weeklyNotes = createWeeklyNotesStore();
function createSelectedFileStore() {
    const store = writable(null);
    return Object.assign({ setFile: (file) => {
            const id = getDateUIDFromFile(file);
            store.set(id);
        } }, store);
}
const activeFile = createSelectedFileStore();

class ConfirmationModal extends require$$0.Modal {
    constructor(app, config) {
        super(app);
        const { cta, onAccept, text, title } = config;
        this.contentEl.createEl("h2", { text: title });
        this.contentEl.createEl("p", { text });
        this.contentEl.createDiv("modal-button-container", (buttonsEl) => {
            buttonsEl
                .createEl("button", { text: "Never mind" })
                .addEventListener("click", () => this.close());
            buttonsEl
                .createEl("button", {
                cls: "mod-cta",
                text: cta,
            })
                .addEventListener("click", async (e) => {
                await onAccept(e);
                this.close();
            });
        });
    }
}
function createConfirmationDialog({ cta, onAccept, text, title, }) {
    new ConfirmationModal(window.app, { cta, onAccept, text, title }).open();
}

/**
 * Create a Daily Note for a given date.
 */
async function tryToCreateDailyNote(date, inNewSplit, settings, cb) {
    const { workspace } = window.app;
    const { format } = mainExports.getDailyNoteSettings();
    const filename = date.format(format);
    const createFile = async () => {
        const dailyNote = await mainExports.createDailyNote(date);
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(dailyNote, { active: true });
        cb === null || cb === void 0 ? void 0 : cb(dailyNote);
    };
    if (settings.shouldConfirmBeforeCreate) {
        createConfirmationDialog({
            cta: "Create",
            onAccept: createFile,
            text: `File ${filename} does not exist. Would you like to create it?`,
            title: "New Daily Note",
        });
    }
    else {
        await createFile();
    }
}

/**
 * Create a Weekly Note for a given date.
 */
async function tryToCreateWeeklyNote(date, inNewSplit, settings, cb) {
    const { workspace } = window.app;
    const { format } = mainExports.getWeeklyNoteSettings();
    const filename = date.format(format);
    const createFile = async () => {
        const dailyNote = await mainExports.createWeeklyNote(date);
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(dailyNote, { active: true });
        cb === null || cb === void 0 ? void 0 : cb(dailyNote);
    };
    if (settings.shouldConfirmBeforeCreate) {
        createConfirmationDialog({
            cta: "Create",
            onAccept: createFile,
            text: `File ${filename} does not exist. Would you like to create it?`,
            title: "New Weekly Note",
        });
    }
    else {
        await createFile();
    }
}

// generated during release, do not modify

const PUBLIC_VERSION = '5';

if (typeof window !== 'undefined') {
	// @ts-expect-error
	((window.__svelte ??= {}).v ??= new Set()).add(PUBLIC_VERSION);
}

enable_legacy_mode_flag();

function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function is_promise(value) {
    return value && typeof value === 'object' && typeof value.then === 'function';
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function not_equal(a, b) {
    return a != a ? b == b : a !== b;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
    const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function null_to_empty(value) {
    return value == null ? '' : value;
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_attributes(node, attributes) {
    // @ts-ignore
    const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
    for (const key in attributes) {
        if (attributes[key] == null) {
            node.removeAttribute(key);
        }
        else if (key === 'style') {
            node.style.cssText = attributes[key];
        }
        else if (key === '__value') {
            node.value = node[key] = attributes[key];
        }
        else if (descriptors[key] && descriptors[key].set) {
            node[key] = attributes[key];
        }
        else {
            attr(node, key, attributes[key]);
        }
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

function handle_promise(promise, info) {
    const token = info.token = {};
    function update(type, index, key, value) {
        if (info.token !== token)
            return;
        info.resolved = value;
        let child_ctx = info.ctx;
        if (key !== undefined) {
            child_ctx = child_ctx.slice();
            child_ctx[key] = value;
        }
        const block = type && (info.current = type)(child_ctx);
        let needs_flush = false;
        if (info.block) {
            if (info.blocks) {
                info.blocks.forEach((block, i) => {
                    if (i !== index && block) {
                        group_outros();
                        transition_out(block, 1, 1, () => {
                            if (info.blocks[i] === block) {
                                info.blocks[i] = null;
                            }
                        });
                        check_outros();
                    }
                });
            }
            else {
                info.block.d(1);
            }
            block.c();
            transition_in(block, 1);
            block.m(info.mount(), info.anchor);
            needs_flush = true;
        }
        info.block = block;
        if (info.blocks)
            info.blocks[index] = block;
        if (needs_flush) {
            flush();
        }
    }
    if (is_promise(promise)) {
        const current_component = get_current_component();
        promise.then(value => {
            set_current_component(current_component);
            update(info.then, 1, info.value, value);
            set_current_component(null);
        }, error => {
            set_current_component(current_component);
            update(info.catch, 2, info.error, error);
            set_current_component(null);
            if (!info.hasCatch) {
                throw error;
            }
        });
        // if we previously had a then/catch block, destroy it
        if (info.current !== info.pending) {
            update(info.pending, 0);
            return true;
        }
    }
    else {
        if (info.current !== info.then) {
            update(info.then, 1, info.value, promise);
            return true;
        }
        info.resolved = promise;
    }
}
function outro_and_destroy_block(block, lookup) {
    transition_out(block, 1, 1, () => {
        lookup.delete(block.key);
    });
}
function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else {
            block.p(child_ctx, dirty);
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    return new_blocks;
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function get_spread_object(spread_props) {
    return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/**
 * dateUID is a way of weekly identifying daily/weekly/monthly notes.
 * They are prefixed with the granularity to avoid ambiguity.
 */
function getDateUID(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
var getDateUID_1 = getDateUID;

/* src/components/Dot.svelte generated by Svelte v3.35.0 */

function add_css$5() {
	var style = element("style");
	style.id = "svelte-1widvzq-style";
	style.textContent = ".dot.svelte-1widvzq,.hollow.svelte-1widvzq{display:inline-block;height:6px;width:6px;margin:0 1px}.filled.svelte-1widvzq{fill:var(--color-dot)}.active.filled.svelte-1widvzq{fill:var(--text-on-accent)}.hollow.svelte-1widvzq{fill:none;stroke:var(--color-dot)}.active.hollow.svelte-1widvzq{fill:none;stroke:var(--text-on-accent)}";
	append(document.head, style);
}

// (14:0) {:else}
function create_else_block$1(ctx) {
	let svg;
	let circle;
	let svg_class_value;

	return {
		c() {
			svg = svg_element("svg");
			circle = svg_element("circle");
			attr(circle, "cx", "3");
			attr(circle, "cy", "3");
			attr(circle, "r", "2");
			attr(svg, "class", svg_class_value = "" + (null_to_empty(`hollow ${/*className*/ ctx[0]}`) + " svelte-1widvzq"));
			attr(svg, "viewBox", "0 0 6 6");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			toggle_class(svg, "active", /*isActive*/ ctx[2]);
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, circle);
		},
		p(ctx, dirty) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(`hollow ${/*className*/ ctx[0]}`) + " svelte-1widvzq"))) {
				attr(svg, "class", svg_class_value);
			}

			if (dirty & /*className, isActive*/ 5) {
				toggle_class(svg, "active", /*isActive*/ ctx[2]);
			}
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (6:0) {#if isFilled}
function create_if_block$2(ctx) {
	let svg;
	let circle;
	let svg_class_value;

	return {
		c() {
			svg = svg_element("svg");
			circle = svg_element("circle");
			attr(circle, "cx", "3");
			attr(circle, "cy", "3");
			attr(circle, "r", "2");
			attr(svg, "class", svg_class_value = "" + (null_to_empty(`dot filled ${/*className*/ ctx[0]}`) + " svelte-1widvzq"));
			attr(svg, "viewBox", "0 0 6 6");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			toggle_class(svg, "active", /*isActive*/ ctx[2]);
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, circle);
		},
		p(ctx, dirty) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(`dot filled ${/*className*/ ctx[0]}`) + " svelte-1widvzq"))) {
				attr(svg, "class", svg_class_value);
			}

			if (dirty & /*className, isActive*/ 5) {
				toggle_class(svg, "active", /*isActive*/ ctx[2]);
			}
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

function create_fragment$6(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*isFilled*/ ctx[1]) return create_if_block$2;
		return create_else_block$1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, [dirty]) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { className = "" } = $$props;
	let { isFilled } = $$props;
	let { isActive } = $$props;

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("isFilled" in $$props) $$invalidate(1, isFilled = $$props.isFilled);
		if ("isActive" in $$props) $$invalidate(2, isActive = $$props.isActive);
	};

	return [className, isFilled, isActive];
}

class Dot extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1widvzq-style")) add_css$5();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { className: 0, isFilled: 1, isActive: 2 });
	}
}

/* src/components/MetadataResolver.svelte generated by Svelte v3.35.0 */

const get_default_slot_changes_1 = dirty => ({});
const get_default_slot_context_1 = ctx => ({ metadata: null });
const get_default_slot_changes = dirty => ({ metadata: dirty & /*metadata*/ 1 });
const get_default_slot_context = ctx => ({ metadata: /*resolvedMeta*/ ctx[3] });

// (11:0) {:else}
function create_else_block(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_1);

	return {
		c() {
			if (default_slot) default_slot.c();
		},
		m(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 2) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_1, get_default_slot_context_1);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (default_slot) default_slot.d(detaching);
		}
	};
}

// (7:0) {#if metadata}
function create_if_block$1(ctx) {
	let await_block_anchor;
	let promise;
	let current;

	let info = {
		ctx,
		current: null,
		token: null,
		hasCatch: false,
		pending: create_pending_block,
		then: create_then_block,
		catch: create_catch_block,
		value: 3,
		blocks: [,,,]
	};

	handle_promise(promise = /*metadata*/ ctx[0], info);

	return {
		c() {
			await_block_anchor = empty();
			info.block.c();
		},
		m(target, anchor) {
			insert(target, await_block_anchor, anchor);
			info.block.m(target, info.anchor = anchor);
			info.mount = () => await_block_anchor.parentNode;
			info.anchor = await_block_anchor;
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			info.ctx = ctx;

			if (dirty & /*metadata*/ 1 && promise !== (promise = /*metadata*/ ctx[0]) && handle_promise(promise, info)) ; else {
				const child_ctx = ctx.slice();
				child_ctx[3] = info.resolved;
				info.block.p(child_ctx, dirty);
			}
		},
		i(local) {
			if (current) return;
			transition_in(info.block);
			current = true;
		},
		o(local) {
			for (let i = 0; i < 3; i += 1) {
				const block = info.blocks[i];
				transition_out(block);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(await_block_anchor);
			info.block.d(detaching);
			info.token = null;
			info = null;
		}
	};
}

// (1:0) <svelte:options immutable />  <script lang="ts">; export let metadata; </script>  {#if metadata}
function create_catch_block(ctx) {
	return {
		c: noop,
		m: noop,
		p: noop,
		i: noop,
		o: noop,
		d: noop
	};
}

// (8:37)      <slot metadata="{resolvedMeta}
function create_then_block(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context);

	return {
		c() {
			if (default_slot) default_slot.c();
		},
		m(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope, metadata*/ 3) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, get_default_slot_changes, get_default_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (default_slot) default_slot.d(detaching);
		}
	};
}

// (1:0) <svelte:options immutable />  <script lang="ts">; export let metadata; </script>  {#if metadata}
function create_pending_block(ctx) {
	return {
		c: noop,
		m: noop,
		p: noop,
		i: noop,
		o: noop,
		d: noop
	};
}

function create_fragment$5(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$1, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*metadata*/ ctx[0]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	
	let { metadata } = $$props;

	$$self.$$set = $$props => {
		if ("metadata" in $$props) $$invalidate(0, metadata = $$props.metadata);
		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	return [metadata, $$scope, slots];
}

class MetadataResolver extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, not_equal, { metadata: 0 });
	}
}

function isMacOS() {
    return navigator.appVersion.indexOf("Mac") !== -1;
}
function isMetaPressed(e) {
    return isMacOS() ? e.metaKey : e.ctrlKey;
}
function getDaysOfWeek(..._args) {
    return window.moment.weekdaysShort(true);
}
function isWeekend(date) {
    return date.isoWeekday() === 6 || date.isoWeekday() === 7;
}
function getStartOfWeek(days) {
    return days[0].weekday(0);
}
/**
 * Generate a 2D array of daily information to power
 * the calendar view.
 */
function getMonth(displayedMonth, ..._args) {
    const locale = window.moment().locale();
    const month = [];
    let week;
    const startOfMonth = displayedMonth.clone().locale(locale).date(1);
    const startOffset = startOfMonth.weekday();
    let date = startOfMonth.clone().subtract(startOffset, "days");
    for (let _day = 0; _day < 42; _day++) {
        if (_day % 7 === 0) {
            week = {
                days: [],
                weekNum: date.week(),
            };
            month.push(week);
        }
        week.days.push(date);
        date = date.clone().add(1, "days");
    }
    return month;
}

/* src/components/Day.svelte generated by Svelte v3.35.0 */

function add_css$4() {
	var style = element("style");
	style.id = "svelte-q3wqg9-style";
	style.textContent = ".day.svelte-q3wqg9{background-color:var(--color-background-day);border-radius:4px;color:var(--color-text-day);cursor:pointer;font-size:0.8em;height:100%;padding:4px;position:relative;text-align:center;transition:background-color 0.1s ease-in, color 0.1s ease-in;vertical-align:baseline}.day.svelte-q3wqg9:hover{background-color:var(--interactive-hover)}.day.active.svelte-q3wqg9:hover{background-color:var(--interactive-accent-hover)}.adjacent-month.svelte-q3wqg9{opacity:0.25}.today.svelte-q3wqg9{color:var(--color-text-today)}.day.svelte-q3wqg9:active,.active.svelte-q3wqg9,.active.today.svelte-q3wqg9{color:var(--text-on-accent);background-color:var(--interactive-accent)}.dot-container.svelte-q3wqg9{display:flex;flex-wrap:wrap;justify-content:center;line-height:6px;min-height:6px}";
	append(document.head, style);
}

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

// (36:8) {#each metadata.dots as dot}
function create_each_block$2(ctx) {
	let dot;
	let current;
	const dot_spread_levels = [/*dot*/ ctx[11]];
	let dot_props = {};

	for (let i = 0; i < dot_spread_levels.length; i += 1) {
		dot_props = assign(dot_props, dot_spread_levels[i]);
	}

	dot = new Dot({ props: dot_props });

	return {
		c() {
			create_component(dot.$$.fragment);
		},
		m(target, anchor) {
			mount_component(dot, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const dot_changes = (dirty & /*metadata*/ 128)
			? get_spread_update(dot_spread_levels, [get_spread_object(/*dot*/ ctx[11])])
			: {};

			dot.$set(dot_changes);
		},
		i(local) {
			if (current) return;
			transition_in(dot.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(dot.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(dot, detaching);
		}
	};
}

// (22:2) <MetadataResolver metadata="{metadata}" let:metadata>
function create_default_slot$1(ctx) {
	let div1;
	let t0_value = /*date*/ ctx[0].format("D") + "";
	let t0;
	let t1;
	let div0;
	let div1_class_value;
	let current;
	let mounted;
	let dispose;
	let each_value = /*metadata*/ ctx[7].dots;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	let div1_levels = [
		{
			class: div1_class_value = `day ${/*metadata*/ ctx[7].classes.join(" ")}`
		},
		/*metadata*/ ctx[7].dataAttributes || {}
	];

	let div1_data = {};

	for (let i = 0; i < div1_levels.length; i += 1) {
		div1_data = assign(div1_data, div1_levels[i]);
	}

	return {
		c() {
			div1 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "dot-container svelte-q3wqg9");
			set_attributes(div1, div1_data);
			toggle_class(div1, "active", /*selectedId*/ ctx[6] === getDateUID_1(/*date*/ ctx[0], "day"));
			toggle_class(div1, "adjacent-month", !/*date*/ ctx[0].isSame(/*displayedMonth*/ ctx[5], "month"));
			toggle_class(div1, "today", /*date*/ ctx[0].isSame(/*today*/ ctx[4], "day"));
			toggle_class(div1, "svelte-q3wqg9", true);
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, t0);
			append(div1, t1);
			append(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div1, "click", function () {
						if (is_function(/*onClick*/ ctx[2] && /*click_handler*/ ctx[8])) (/*onClick*/ ctx[2] && /*click_handler*/ ctx[8]).apply(this, arguments);
					}),
					listen(div1, "contextmenu", function () {
						if (is_function(/*onContextMenu*/ ctx[3] && /*contextmenu_handler*/ ctx[9])) (/*onContextMenu*/ ctx[3] && /*contextmenu_handler*/ ctx[9]).apply(this, arguments);
					}),
					listen(div1, "pointerover", function () {
						if (is_function(/*onHover*/ ctx[1] && /*pointerover_handler*/ ctx[10])) (/*onHover*/ ctx[1] && /*pointerover_handler*/ ctx[10]).apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if ((!current || dirty & /*date*/ 1) && t0_value !== (t0_value = /*date*/ ctx[0].format("D") + "")) set_data(t0, t0_value);

			if (dirty & /*metadata*/ 128) {
				each_value = /*metadata*/ ctx[7].dots;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div0, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			set_attributes(div1, div1_data = get_spread_update(div1_levels, [
				(!current || dirty & /*metadata*/ 128 && div1_class_value !== (div1_class_value = `day ${/*metadata*/ ctx[7].classes.join(" ")}`)) && { class: div1_class_value },
				dirty & /*metadata*/ 128 && (/*metadata*/ ctx[7].dataAttributes || {})
			]));

			toggle_class(div1, "active", /*selectedId*/ ctx[6] === getDateUID_1(/*date*/ ctx[0], "day"));
			toggle_class(div1, "adjacent-month", !/*date*/ ctx[0].isSame(/*displayedMonth*/ ctx[5], "month"));
			toggle_class(div1, "today", /*date*/ ctx[0].isSame(/*today*/ ctx[4], "day"));
			toggle_class(div1, "svelte-q3wqg9", true);
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$4(ctx) {
	let td;
	let metadataresolver;
	let current;

	metadataresolver = new MetadataResolver({
			props: {
				metadata: /*metadata*/ ctx[7],
				$$slots: {
					default: [
						create_default_slot$1,
						({ metadata }) => ({ 7: metadata }),
						({ metadata }) => metadata ? 128 : 0
					]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			td = element("td");
			create_component(metadataresolver.$$.fragment);
		},
		m(target, anchor) {
			insert(target, td, anchor);
			mount_component(metadataresolver, td, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const metadataresolver_changes = {};
			if (dirty & /*metadata*/ 128) metadataresolver_changes.metadata = /*metadata*/ ctx[7];

			if (dirty & /*$$scope, metadata, selectedId, date, displayedMonth, today, onClick, onContextMenu, onHover*/ 16639) {
				metadataresolver_changes.$$scope = { dirty, ctx };
			}

			metadataresolver.$set(metadataresolver_changes);
		},
		i(local) {
			if (current) return;
			transition_in(metadataresolver.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(metadataresolver.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(td);
			destroy_component(metadataresolver);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	
	
	let { date } = $$props;
	let { metadata } = $$props;
	let { onHover } = $$props;
	let { onClick } = $$props;
	let { onContextMenu } = $$props;
	let { today } = $$props;
	let { displayedMonth = null } = $$props;
	let { selectedId = null } = $$props;
	const click_handler = e => onClick(date, isMetaPressed(e));
	const contextmenu_handler = e => onContextMenu(date, e);
	const pointerover_handler = e => onHover(date, e.target, isMetaPressed(e));

	$$self.$$set = $$props => {
		if ("date" in $$props) $$invalidate(0, date = $$props.date);
		if ("metadata" in $$props) $$invalidate(7, metadata = $$props.metadata);
		if ("onHover" in $$props) $$invalidate(1, onHover = $$props.onHover);
		if ("onClick" in $$props) $$invalidate(2, onClick = $$props.onClick);
		if ("onContextMenu" in $$props) $$invalidate(3, onContextMenu = $$props.onContextMenu);
		if ("today" in $$props) $$invalidate(4, today = $$props.today);
		if ("displayedMonth" in $$props) $$invalidate(5, displayedMonth = $$props.displayedMonth);
		if ("selectedId" in $$props) $$invalidate(6, selectedId = $$props.selectedId);
	};

	return [
		date,
		onHover,
		onClick,
		onContextMenu,
		today,
		displayedMonth,
		selectedId,
		metadata,
		click_handler,
		contextmenu_handler,
		pointerover_handler
	];
}

class Day extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-q3wqg9-style")) add_css$4();

		init(this, options, instance$4, create_fragment$4, not_equal, {
			date: 0,
			metadata: 7,
			onHover: 1,
			onClick: 2,
			onContextMenu: 3,
			today: 4,
			displayedMonth: 5,
			selectedId: 6
		});
	}
}

/* src/components/Arrow.svelte generated by Svelte v3.35.0 */

function add_css$3() {
	var style = element("style");
	style.id = "svelte-156w7na-style";
	style.textContent = ".arrow.svelte-156w7na.svelte-156w7na{align-items:center;cursor:pointer;display:flex;justify-content:center;width:24px}.arrow.is-mobile.svelte-156w7na.svelte-156w7na{width:32px}.right.svelte-156w7na.svelte-156w7na{transform:rotate(180deg)}.arrow.svelte-156w7na svg.svelte-156w7na{color:var(--color-arrow);height:16px;width:16px}";
	append(document.head, style);
}

function create_fragment$3(ctx) {
	let div;
	let svg;
	let path;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			svg = svg_element("svg");
			path = svg_element("path");
			attr(path, "fill", "currentColor");
			attr(path, "d", "M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z");
			attr(svg, "focusable", "false");
			attr(svg, "role", "img");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "viewBox", "0 0 320 512");
			attr(svg, "class", "svelte-156w7na");
			attr(div, "class", "arrow svelte-156w7na");
			attr(div, "aria-label", /*tooltip*/ ctx[1]);
			toggle_class(div, "is-mobile", /*isMobile*/ ctx[3]);
			toggle_class(div, "right", /*direction*/ ctx[2] === "right");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, svg);
			append(svg, path);

			if (!mounted) {
				dispose = listen(div, "click", function () {
					if (is_function(/*onClick*/ ctx[0])) /*onClick*/ ctx[0].apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;

			if (dirty & /*tooltip*/ 2) {
				attr(div, "aria-label", /*tooltip*/ ctx[1]);
			}

			if (dirty & /*direction*/ 4) {
				toggle_class(div, "right", /*direction*/ ctx[2] === "right");
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { onClick } = $$props;
	let { tooltip } = $$props;
	let { direction } = $$props;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let isMobile = window.app.isMobile;

	$$self.$$set = $$props => {
		if ("onClick" in $$props) $$invalidate(0, onClick = $$props.onClick);
		if ("tooltip" in $$props) $$invalidate(1, tooltip = $$props.tooltip);
		if ("direction" in $$props) $$invalidate(2, direction = $$props.direction);
	};

	return [onClick, tooltip, direction, isMobile];
}

class Arrow extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-156w7na-style")) add_css$3();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { onClick: 0, tooltip: 1, direction: 2 });
	}
}

/* src/components/Nav.svelte generated by Svelte v3.35.0 */

function add_css$2() {
	var style = element("style");
	style.id = "svelte-1vwr9dd-style";
	style.textContent = ".nav.svelte-1vwr9dd.svelte-1vwr9dd{align-items:center;display:flex;margin:0.6em 0 1em;padding:0 8px;width:100%}.nav.is-mobile.svelte-1vwr9dd.svelte-1vwr9dd{padding:0}.title.svelte-1vwr9dd.svelte-1vwr9dd{color:var(--color-text-title);font-size:1.5em;margin:0}.is-mobile.svelte-1vwr9dd .title.svelte-1vwr9dd{font-size:1.3em}.month.svelte-1vwr9dd.svelte-1vwr9dd{font-weight:500;text-transform:capitalize}.year.svelte-1vwr9dd.svelte-1vwr9dd{color:var(--interactive-accent)}.right-nav.svelte-1vwr9dd.svelte-1vwr9dd{display:flex;justify-content:center;margin-left:auto}.reset-button.svelte-1vwr9dd.svelte-1vwr9dd{cursor:pointer;border-radius:4px;color:var(--text-muted);font-size:0.7em;font-weight:600;letter-spacing:1px;margin:0 4px;padding:0px 4px;text-transform:uppercase}.is-mobile.svelte-1vwr9dd .reset-button.svelte-1vwr9dd{display:none}";
	append(document.head, style);
}

function create_fragment$2(ctx) {
	let div2;
	let h3;
	let span0;
	let t0_value = /*displayedMonth*/ ctx[0].format("MMM") + "";
	let t0;
	let t1;
	let span1;
	let t2_value = /*displayedMonth*/ ctx[0].format("YYYY") + "";
	let t2;
	let t3;
	let div1;
	let arrow0;
	let t4;
	let div0;
	let t6;
	let arrow1;
	let current;
	let mounted;
	let dispose;

	arrow0 = new Arrow({
			props: {
				direction: "left",
				onClick: /*decrementDisplayedMonth*/ ctx[3],
				tooltip: "Previous Month"
			}
		});

	arrow1 = new Arrow({
			props: {
				direction: "right",
				onClick: /*incrementDisplayedMonth*/ ctx[2],
				tooltip: "Next Month"
			}
		});

	return {
		c() {
			div2 = element("div");
			h3 = element("h3");
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");
			t2 = text(t2_value);
			t3 = space();
			div1 = element("div");
			create_component(arrow0.$$.fragment);
			t4 = space();
			div0 = element("div");
			div0.textContent = `${/*todayDisplayStr*/ ctx[4]}`;
			t6 = space();
			create_component(arrow1.$$.fragment);
			attr(span0, "class", "month svelte-1vwr9dd");
			attr(span1, "class", "year svelte-1vwr9dd");
			attr(h3, "class", "title svelte-1vwr9dd");
			attr(div0, "class", "reset-button svelte-1vwr9dd");
			attr(div1, "class", "right-nav svelte-1vwr9dd");
			attr(div2, "class", "nav svelte-1vwr9dd");
			toggle_class(div2, "is-mobile", /*isMobile*/ ctx[5]);
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, h3);
			append(h3, span0);
			append(span0, t0);
			append(h3, t1);
			append(h3, span1);
			append(span1, t2);
			append(div2, t3);
			append(div2, div1);
			mount_component(arrow0, div1, null);
			append(div1, t4);
			append(div1, div0);
			append(div1, t6);
			mount_component(arrow1, div1, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(h3, "click", function () {
						if (is_function(/*resetDisplayedMonth*/ ctx[1])) /*resetDisplayedMonth*/ ctx[1].apply(this, arguments);
					}),
					listen(div0, "click", function () {
						if (is_function(/*resetDisplayedMonth*/ ctx[1])) /*resetDisplayedMonth*/ ctx[1].apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			if ((!current || dirty & /*displayedMonth*/ 1) && t0_value !== (t0_value = /*displayedMonth*/ ctx[0].format("MMM") + "")) set_data(t0, t0_value);
			if ((!current || dirty & /*displayedMonth*/ 1) && t2_value !== (t2_value = /*displayedMonth*/ ctx[0].format("YYYY") + "")) set_data(t2, t2_value);
			const arrow0_changes = {};
			if (dirty & /*decrementDisplayedMonth*/ 8) arrow0_changes.onClick = /*decrementDisplayedMonth*/ ctx[3];
			arrow0.$set(arrow0_changes);
			const arrow1_changes = {};
			if (dirty & /*incrementDisplayedMonth*/ 4) arrow1_changes.onClick = /*incrementDisplayedMonth*/ ctx[2];
			arrow1.$set(arrow1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(arrow0.$$.fragment, local);
			transition_in(arrow1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(arrow0.$$.fragment, local);
			transition_out(arrow1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div2);
			destroy_component(arrow0);
			destroy_component(arrow1);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	
	let { displayedMonth } = $$props;
	let { today } = $$props;
	let { resetDisplayedMonth } = $$props;
	let { incrementDisplayedMonth } = $$props;
	let { decrementDisplayedMonth } = $$props;

	// Get the word 'Today' but localized to the current language
	const todayDisplayStr = today.calendar().split(/\d|\s/)[0];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let isMobile = window.app.isMobile;

	$$self.$$set = $$props => {
		if ("displayedMonth" in $$props) $$invalidate(0, displayedMonth = $$props.displayedMonth);
		if ("today" in $$props) $$invalidate(6, today = $$props.today);
		if ("resetDisplayedMonth" in $$props) $$invalidate(1, resetDisplayedMonth = $$props.resetDisplayedMonth);
		if ("incrementDisplayedMonth" in $$props) $$invalidate(2, incrementDisplayedMonth = $$props.incrementDisplayedMonth);
		if ("decrementDisplayedMonth" in $$props) $$invalidate(3, decrementDisplayedMonth = $$props.decrementDisplayedMonth);
	};

	return [
		displayedMonth,
		resetDisplayedMonth,
		incrementDisplayedMonth,
		decrementDisplayedMonth,
		todayDisplayStr,
		isMobile,
		today
	];
}

class Nav extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1vwr9dd-style")) add_css$2();

		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
			displayedMonth: 0,
			today: 6,
			resetDisplayedMonth: 1,
			incrementDisplayedMonth: 2,
			decrementDisplayedMonth: 3
		});
	}
}

/* src/components/WeekNum.svelte generated by Svelte v3.35.0 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-egt0yd-style";
	style.textContent = "td.svelte-egt0yd{border-right:1px solid var(--background-modifier-border)}.week-num.svelte-egt0yd{background-color:var(--color-background-weeknum);border-radius:4px;color:var(--color-text-weeknum);cursor:pointer;font-size:0.65em;height:100%;padding:4px;text-align:center;transition:background-color 0.1s ease-in, color 0.1s ease-in;vertical-align:baseline}.week-num.svelte-egt0yd:hover{background-color:var(--interactive-hover)}.week-num.active.svelte-egt0yd:hover{background-color:var(--interactive-accent-hover)}.active.svelte-egt0yd{color:var(--text-on-accent);background-color:var(--interactive-accent)}.dot-container.svelte-egt0yd{display:flex;flex-wrap:wrap;justify-content:center;line-height:6px;min-height:6px}";
	append(document.head, style);
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

// (35:8) {#each metadata.dots as dot}
function create_each_block$1(ctx) {
	let dot;
	let current;
	const dot_spread_levels = [/*dot*/ ctx[11]];
	let dot_props = {};

	for (let i = 0; i < dot_spread_levels.length; i += 1) {
		dot_props = assign(dot_props, dot_spread_levels[i]);
	}

	dot = new Dot({ props: dot_props });

	return {
		c() {
			create_component(dot.$$.fragment);
		},
		m(target, anchor) {
			mount_component(dot, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const dot_changes = (dirty & /*metadata*/ 64)
			? get_spread_update(dot_spread_levels, [get_spread_object(/*dot*/ ctx[11])])
			: {};

			dot.$set(dot_changes);
		},
		i(local) {
			if (current) return;
			transition_in(dot.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(dot.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(dot, detaching);
		}
	};
}

// (24:2) <MetadataResolver metadata="{metadata}" let:metadata>
function create_default_slot(ctx) {
	let div1;
	let t0;
	let t1;
	let div0;
	let div1_class_value;
	let current;
	let mounted;
	let dispose;
	let each_value = /*metadata*/ ctx[6].dots;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div1 = element("div");
			t0 = text(/*weekNum*/ ctx[0]);
			t1 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "dot-container svelte-egt0yd");
			attr(div1, "class", div1_class_value = "" + (null_to_empty(`week-num ${/*metadata*/ ctx[6].classes.join(" ")}`) + " svelte-egt0yd"));
			toggle_class(div1, "active", /*selectedId*/ ctx[5] === getDateUID_1(/*days*/ ctx[1][0], "week"));
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, t0);
			append(div1, t1);
			append(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div1, "click", function () {
						if (is_function(/*onClick*/ ctx[3] && /*click_handler*/ ctx[8])) (/*onClick*/ ctx[3] && /*click_handler*/ ctx[8]).apply(this, arguments);
					}),
					listen(div1, "contextmenu", function () {
						if (is_function(/*onContextMenu*/ ctx[4] && /*contextmenu_handler*/ ctx[9])) (/*onContextMenu*/ ctx[4] && /*contextmenu_handler*/ ctx[9]).apply(this, arguments);
					}),
					listen(div1, "pointerover", function () {
						if (is_function(/*onHover*/ ctx[2] && /*pointerover_handler*/ ctx[10])) (/*onHover*/ ctx[2] && /*pointerover_handler*/ ctx[10]).apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (!current || dirty & /*weekNum*/ 1) set_data(t0, /*weekNum*/ ctx[0]);

			if (dirty & /*metadata*/ 64) {
				each_value = /*metadata*/ ctx[6].dots;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div0, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			if (!current || dirty & /*metadata*/ 64 && div1_class_value !== (div1_class_value = "" + (null_to_empty(`week-num ${/*metadata*/ ctx[6].classes.join(" ")}`) + " svelte-egt0yd"))) {
				attr(div1, "class", div1_class_value);
			}

			if (dirty & /*metadata, selectedId, getDateUID, days*/ 98) {
				toggle_class(div1, "active", /*selectedId*/ ctx[5] === getDateUID_1(/*days*/ ctx[1][0], "week"));
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$1(ctx) {
	let td;
	let metadataresolver;
	let current;

	metadataresolver = new MetadataResolver({
			props: {
				metadata: /*metadata*/ ctx[6],
				$$slots: {
					default: [
						create_default_slot,
						({ metadata }) => ({ 6: metadata }),
						({ metadata }) => metadata ? 64 : 0
					]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			td = element("td");
			create_component(metadataresolver.$$.fragment);
			attr(td, "class", "svelte-egt0yd");
		},
		m(target, anchor) {
			insert(target, td, anchor);
			mount_component(metadataresolver, td, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const metadataresolver_changes = {};
			if (dirty & /*metadata*/ 64) metadataresolver_changes.metadata = /*metadata*/ ctx[6];

			if (dirty & /*$$scope, metadata, selectedId, days, onClick, startOfWeek, onContextMenu, onHover, weekNum*/ 16639) {
				metadataresolver_changes.$$scope = { dirty, ctx };
			}

			metadataresolver.$set(metadataresolver_changes);
		},
		i(local) {
			if (current) return;
			transition_in(metadataresolver.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(metadataresolver.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(td);
			destroy_component(metadataresolver);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	
	
	let { weekNum } = $$props;
	let { days } = $$props;
	let { metadata } = $$props;
	let { onHover } = $$props;
	let { onClick } = $$props;
	let { onContextMenu } = $$props;
	let { selectedId = null } = $$props;
	let startOfWeek;
	const click_handler = e => onClick(startOfWeek, isMetaPressed(e));
	const contextmenu_handler = e => onContextMenu(days[0], e);
	const pointerover_handler = e => onHover(startOfWeek, e.target, isMetaPressed(e));

	$$self.$$set = $$props => {
		if ("weekNum" in $$props) $$invalidate(0, weekNum = $$props.weekNum);
		if ("days" in $$props) $$invalidate(1, days = $$props.days);
		if ("metadata" in $$props) $$invalidate(6, metadata = $$props.metadata);
		if ("onHover" in $$props) $$invalidate(2, onHover = $$props.onHover);
		if ("onClick" in $$props) $$invalidate(3, onClick = $$props.onClick);
		if ("onContextMenu" in $$props) $$invalidate(4, onContextMenu = $$props.onContextMenu);
		if ("selectedId" in $$props) $$invalidate(5, selectedId = $$props.selectedId);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*days*/ 2) {
			$$invalidate(7, startOfWeek = getStartOfWeek(days));
		}
	};

	return [
		weekNum,
		days,
		onHover,
		onClick,
		onContextMenu,
		selectedId,
		metadata,
		startOfWeek,
		click_handler,
		contextmenu_handler,
		pointerover_handler
	];
}

class WeekNum extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-egt0yd-style")) add_css$1();

		init(this, options, instance$1, create_fragment$1, not_equal, {
			weekNum: 0,
			days: 1,
			metadata: 6,
			onHover: 2,
			onClick: 3,
			onContextMenu: 4,
			selectedId: 5
		});
	}
}

async function metadataReducer(promisedMetadata) {
    const meta = {
        dots: [],
        classes: [],
        dataAttributes: {},
    };
    const metas = await Promise.all(promisedMetadata);
    return metas.reduce((acc, meta) => ({
        classes: [...acc.classes, ...(meta.classes || [])],
        dataAttributes: Object.assign(acc.dataAttributes, meta.dataAttributes),
        dots: [...acc.dots, ...(meta.dots || [])],
    }), meta);
}
function getDailyMetadata(sources, date, ..._args) {
    return metadataReducer(sources.map((source) => source.getDailyMetadata(date)));
}
function getWeeklyMetadata(sources, date, ..._args) {
    return metadataReducer(sources.map((source) => source.getWeeklyMetadata(date)));
}

/* src/components/Calendar.svelte generated by Svelte v3.35.0 */

function add_css() {
	var style = element("style");
	style.id = "svelte-pcimu8-style";
	style.textContent = ".container.svelte-pcimu8{--color-background-heading:transparent;--color-background-day:transparent;--color-background-weeknum:transparent;--color-background-weekend:transparent;--color-dot:var(--text-muted);--color-arrow:var(--text-muted);--color-button:var(--text-muted);--color-text-title:var(--text-normal);--color-text-heading:var(--text-muted);--color-text-day:var(--text-normal);--color-text-today:var(--interactive-accent);--color-text-weeknum:var(--text-muted)}.container.svelte-pcimu8{padding:0 8px}.container.is-mobile.svelte-pcimu8{padding:0}th.svelte-pcimu8{text-align:center}.weekend.svelte-pcimu8{background-color:var(--color-background-weekend)}.calendar.svelte-pcimu8{border-collapse:collapse;width:100%}th.svelte-pcimu8{background-color:var(--color-background-heading);color:var(--color-text-heading);font-size:0.6em;letter-spacing:1px;padding:4px;text-transform:uppercase}";
	append(document.head, style);
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[18] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[21] = list[i];
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[24] = list[i];
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	return child_ctx;
}

// (55:6) {#if showWeekNums}
function create_if_block_2(ctx) {
	let col;

	return {
		c() {
			col = element("col");
		},
		m(target, anchor) {
			insert(target, col, anchor);
		},
		d(detaching) {
			if (detaching) detach(col);
		}
	};
}

// (58:6) {#each month[1].days as date}
function create_each_block_3(ctx) {
	let col;

	return {
		c() {
			col = element("col");
			attr(col, "class", "svelte-pcimu8");
			toggle_class(col, "weekend", isWeekend(/*date*/ ctx[27]));
		},
		m(target, anchor) {
			insert(target, col, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*isWeekend, month*/ 16384) {
				toggle_class(col, "weekend", isWeekend(/*date*/ ctx[27]));
			}
		},
		d(detaching) {
			if (detaching) detach(col);
		}
	};
}

// (64:8) {#if showWeekNums}
function create_if_block_1(ctx) {
	let th;

	return {
		c() {
			th = element("th");
			th.textContent = "W";
			attr(th, "class", "svelte-pcimu8");
		},
		m(target, anchor) {
			insert(target, th, anchor);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (67:8) {#each daysOfWeek as dayOfWeek}
function create_each_block_2(ctx) {
	let th;
	let t_value = /*dayOfWeek*/ ctx[24] + "";
	let t;

	return {
		c() {
			th = element("th");
			t = text(t_value);
			attr(th, "class", "svelte-pcimu8");
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, t);
		},
		p(ctx, dirty) {
			if (dirty & /*daysOfWeek*/ 32768 && t_value !== (t_value = /*dayOfWeek*/ ctx[24] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (75:10) {#if showWeekNums}
function create_if_block(ctx) {
	let weeknum;
	let current;

	const weeknum_spread_levels = [
		/*week*/ ctx[18],
		{
			metadata: getWeeklyMetadata(/*sources*/ ctx[8], /*week*/ ctx[18].days[0], /*today*/ ctx[10])
		},
		{ onClick: /*onClickWeek*/ ctx[7] },
		{
			onContextMenu: /*onContextMenuWeek*/ ctx[5]
		},
		{ onHover: /*onHoverWeek*/ ctx[3] },
		{ selectedId: /*selectedId*/ ctx[9] }
	];

	let weeknum_props = {};

	for (let i = 0; i < weeknum_spread_levels.length; i += 1) {
		weeknum_props = assign(weeknum_props, weeknum_spread_levels[i]);
	}

	weeknum = new WeekNum({ props: weeknum_props });

	return {
		c() {
			create_component(weeknum.$$.fragment);
		},
		m(target, anchor) {
			mount_component(weeknum, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const weeknum_changes = (dirty & /*month, getWeeklyMetadata, sources, today, onClickWeek, onContextMenuWeek, onHoverWeek, selectedId*/ 18344)
			? get_spread_update(weeknum_spread_levels, [
					dirty & /*month*/ 16384 && get_spread_object(/*week*/ ctx[18]),
					dirty & /*getWeeklyMetadata, sources, month, today*/ 17664 && {
						metadata: getWeeklyMetadata(/*sources*/ ctx[8], /*week*/ ctx[18].days[0], /*today*/ ctx[10])
					},
					dirty & /*onClickWeek*/ 128 && { onClick: /*onClickWeek*/ ctx[7] },
					dirty & /*onContextMenuWeek*/ 32 && {
						onContextMenu: /*onContextMenuWeek*/ ctx[5]
					},
					dirty & /*onHoverWeek*/ 8 && { onHover: /*onHoverWeek*/ ctx[3] },
					dirty & /*selectedId*/ 512 && { selectedId: /*selectedId*/ ctx[9] }
				])
			: {};

			weeknum.$set(weeknum_changes);
		},
		i(local) {
			if (current) return;
			transition_in(weeknum.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(weeknum.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(weeknum, detaching);
		}
	};
}

// (85:10) {#each week.days as day (day.format())}
function create_each_block_1(key_1, ctx) {
	let first;
	let day;
	let current;

	day = new Day({
			props: {
				date: /*day*/ ctx[21],
				today: /*today*/ ctx[10],
				displayedMonth: /*displayedMonth*/ ctx[0],
				onClick: /*onClickDay*/ ctx[6],
				onContextMenu: /*onContextMenuDay*/ ctx[4],
				onHover: /*onHoverDay*/ ctx[2],
				metadata: getDailyMetadata(/*sources*/ ctx[8], /*day*/ ctx[21], /*today*/ ctx[10]),
				selectedId: /*selectedId*/ ctx[9]
			}
		});

	return {
		key: key_1,
		first: null,
		c() {
			first = empty();
			create_component(day.$$.fragment);
			this.first = first;
		},
		m(target, anchor) {
			insert(target, first, anchor);
			mount_component(day, target, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const day_changes = {};
			if (dirty & /*month*/ 16384) day_changes.date = /*day*/ ctx[21];
			if (dirty & /*today*/ 1024) day_changes.today = /*today*/ ctx[10];
			if (dirty & /*displayedMonth*/ 1) day_changes.displayedMonth = /*displayedMonth*/ ctx[0];
			if (dirty & /*onClickDay*/ 64) day_changes.onClick = /*onClickDay*/ ctx[6];
			if (dirty & /*onContextMenuDay*/ 16) day_changes.onContextMenu = /*onContextMenuDay*/ ctx[4];
			if (dirty & /*onHoverDay*/ 4) day_changes.onHover = /*onHoverDay*/ ctx[2];
			if (dirty & /*sources, month, today*/ 17664) day_changes.metadata = getDailyMetadata(/*sources*/ ctx[8], /*day*/ ctx[21], /*today*/ ctx[10]);
			if (dirty & /*selectedId*/ 512) day_changes.selectedId = /*selectedId*/ ctx[9];
			day.$set(day_changes);
		},
		i(local) {
			if (current) return;
			transition_in(day.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(day.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(first);
			destroy_component(day, detaching);
		}
	};
}

// (73:6) {#each month as week (week.weekNum)}
function create_each_block(key_1, ctx) {
	let tr;
	let t0;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let t1;
	let current;
	let if_block = /*showWeekNums*/ ctx[1] && create_if_block(ctx);
	let each_value_1 = /*week*/ ctx[18].days;
	const get_key = ctx => /*day*/ ctx[21].format();

	for (let i = 0; i < each_value_1.length; i += 1) {
		let child_ctx = get_each_context_1(ctx, each_value_1, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
	}

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			if (if_block) if_block.c();
			t0 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			this.first = tr;
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			if (if_block) if_block.m(tr, null);
			append(tr, t0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tr, null);
			}

			append(tr, t1);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (/*showWeekNums*/ ctx[1]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*showWeekNums*/ 2) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(tr, t0);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}

			if (dirty & /*month, today, displayedMonth, onClickDay, onContextMenuDay, onHoverDay, getDailyMetadata, sources, selectedId*/ 18261) {
				each_value_1 = /*week*/ ctx[18].days;
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, tr, outro_and_destroy_block, create_each_block_1, t1, get_each_context_1);
				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			transition_out(if_block);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr);
			if (if_block) if_block.d();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function create_fragment(ctx) {
	let div;
	let nav;
	let t0;
	let table;
	let colgroup;
	let t1;
	let t2;
	let thead;
	let tr;
	let t3;
	let t4;
	let tbody;
	let each_blocks = [];
	let each2_lookup = new Map();
	let current;

	nav = new Nav({
			props: {
				today: /*today*/ ctx[10],
				displayedMonth: /*displayedMonth*/ ctx[0],
				incrementDisplayedMonth: /*incrementDisplayedMonth*/ ctx[11],
				decrementDisplayedMonth: /*decrementDisplayedMonth*/ ctx[12],
				resetDisplayedMonth: /*resetDisplayedMonth*/ ctx[13]
			}
		});

	let if_block0 = /*showWeekNums*/ ctx[1] && create_if_block_2();
	let each_value_3 = /*month*/ ctx[14][1].days;
	let each_blocks_2 = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks_2[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	let if_block1 = /*showWeekNums*/ ctx[1] && create_if_block_1();
	let each_value_2 = /*daysOfWeek*/ ctx[15];
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	let each_value = /*month*/ ctx[14];
	const get_key = ctx => /*week*/ ctx[18].weekNum;

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each2_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	return {
		c() {
			div = element("div");
			create_component(nav.$$.fragment);
			t0 = space();
			table = element("table");
			colgroup = element("colgroup");
			if (if_block0) if_block0.c();
			t1 = space();

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].c();
			}

			t2 = space();
			thead = element("thead");
			tr = element("tr");
			if (if_block1) if_block1.c();
			t3 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t4 = space();
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(table, "class", "calendar svelte-pcimu8");
			attr(div, "id", "calendar-container");
			attr(div, "class", "container svelte-pcimu8");
			toggle_class(div, "is-mobile", /*isMobile*/ ctx[16]);
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(nav, div, null);
			append(div, t0);
			append(div, table);
			append(table, colgroup);
			if (if_block0) if_block0.m(colgroup, null);
			append(colgroup, t1);

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].m(colgroup, null);
			}

			append(table, t2);
			append(table, thead);
			append(thead, tr);
			if (if_block1) if_block1.m(tr, null);
			append(tr, t3);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(tr, null);
			}

			append(table, t4);
			append(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			const nav_changes = {};
			if (dirty & /*today*/ 1024) nav_changes.today = /*today*/ ctx[10];
			if (dirty & /*displayedMonth*/ 1) nav_changes.displayedMonth = /*displayedMonth*/ ctx[0];
			nav.$set(nav_changes);

			if (/*showWeekNums*/ ctx[1]) {
				if (if_block0) ; else {
					if_block0 = create_if_block_2();
					if_block0.c();
					if_block0.m(colgroup, t1);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty & /*isWeekend, month*/ 16384) {
				each_value_3 = /*month*/ ctx[14][1].days;
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks_2[i]) {
						each_blocks_2[i].p(child_ctx, dirty);
					} else {
						each_blocks_2[i] = create_each_block_3(child_ctx);
						each_blocks_2[i].c();
						each_blocks_2[i].m(colgroup, null);
					}
				}

				for (; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].d(1);
				}

				each_blocks_2.length = each_value_3.length;
			}

			if (/*showWeekNums*/ ctx[1]) {
				if (if_block1) ; else {
					if_block1 = create_if_block_1();
					if_block1.c();
					if_block1.m(tr, t3);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty & /*daysOfWeek*/ 32768) {
				each_value_2 = /*daysOfWeek*/ ctx[15];
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_2(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(tr, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_2.length;
			}

			if (dirty & /*month, today, displayedMonth, onClickDay, onContextMenuDay, onHoverDay, getDailyMetadata, sources, selectedId, getWeeklyMetadata, onClickWeek, onContextMenuWeek, onHoverWeek, showWeekNums*/ 18431) {
				each_value = /*month*/ ctx[14];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each2_lookup, tbody, outro_and_destroy_block, create_each_block, null, get_each_context);
				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(nav.$$.fragment, local);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			transition_out(nav.$$.fragment, local);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_component(nav);
			if (if_block0) if_block0.d();
			destroy_each(each_blocks_2, detaching);
			if (if_block1) if_block1.d();
			destroy_each(each_blocks_1, detaching);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	
	
	let { localeData } = $$props;
	let { showWeekNums = false } = $$props;
	let { onHoverDay } = $$props;
	let { onHoverWeek } = $$props;
	let { onContextMenuDay } = $$props;
	let { onContextMenuWeek } = $$props;
	let { onClickDay } = $$props;
	let { onClickWeek } = $$props;
	let { sources = [] } = $$props;
	let { selectedId } = $$props;
	let { today = window.moment() } = $$props;
	let { displayedMonth = today } = $$props;
	let month;
	let daysOfWeek;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let isMobile = window.app.isMobile;

	function incrementDisplayedMonth() {
		$$invalidate(0, displayedMonth = displayedMonth.clone().add(1, "month"));
	}

	function decrementDisplayedMonth() {
		$$invalidate(0, displayedMonth = displayedMonth.clone().subtract(1, "month"));
	}

	function resetDisplayedMonth() {
		$$invalidate(0, displayedMonth = today.clone());
	}

	$$self.$$set = $$props => {
		if ("localeData" in $$props) $$invalidate(17, localeData = $$props.localeData);
		if ("showWeekNums" in $$props) $$invalidate(1, showWeekNums = $$props.showWeekNums);
		if ("onHoverDay" in $$props) $$invalidate(2, onHoverDay = $$props.onHoverDay);
		if ("onHoverWeek" in $$props) $$invalidate(3, onHoverWeek = $$props.onHoverWeek);
		if ("onContextMenuDay" in $$props) $$invalidate(4, onContextMenuDay = $$props.onContextMenuDay);
		if ("onContextMenuWeek" in $$props) $$invalidate(5, onContextMenuWeek = $$props.onContextMenuWeek);
		if ("onClickDay" in $$props) $$invalidate(6, onClickDay = $$props.onClickDay);
		if ("onClickWeek" in $$props) $$invalidate(7, onClickWeek = $$props.onClickWeek);
		if ("sources" in $$props) $$invalidate(8, sources = $$props.sources);
		if ("selectedId" in $$props) $$invalidate(9, selectedId = $$props.selectedId);
		if ("today" in $$props) $$invalidate(10, today = $$props.today);
		if ("displayedMonth" in $$props) $$invalidate(0, displayedMonth = $$props.displayedMonth);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*displayedMonth, localeData*/ 131073) {
			$$invalidate(14, month = getMonth(displayedMonth, localeData));
		}

		if ($$self.$$.dirty & /*today, localeData*/ 132096) {
			$$invalidate(15, daysOfWeek = getDaysOfWeek(today, localeData));
		}
	};

	return [
		displayedMonth,
		showWeekNums,
		onHoverDay,
		onHoverWeek,
		onContextMenuDay,
		onContextMenuWeek,
		onClickDay,
		onClickWeek,
		sources,
		selectedId,
		today,
		incrementDisplayedMonth,
		decrementDisplayedMonth,
		resetDisplayedMonth,
		month,
		daysOfWeek,
		isMobile,
		localeData
	];
}

let Calendar$1 = class Calendar extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-pcimu8-style")) add_css();

		init(this, options, instance, create_fragment, not_equal, {
			localeData: 17,
			showWeekNums: 1,
			onHoverDay: 2,
			onHoverWeek: 3,
			onContextMenuDay: 4,
			onContextMenuWeek: 5,
			onClickDay: 6,
			onClickWeek: 7,
			sources: 8,
			selectedId: 9,
			today: 10,
			displayedMonth: 0,
			incrementDisplayedMonth: 11,
			decrementDisplayedMonth: 12,
			resetDisplayedMonth: 13
		});
	}

	get incrementDisplayedMonth() {
		return this.$$.ctx[11];
	}

	get decrementDisplayedMonth() {
		return this.$$.ctx[12];
	}

	get resetDisplayedMonth() {
		return this.$$.ctx[13];
	}
};

const langToMomentLocale = {
    en: "en-gb",
    zh: "zh-cn",
    "zh-TW": "zh-tw",
    ru: "ru",
    ko: "ko",
    it: "it",
    id: "id",
    ro: "ro",
    "pt-BR": "pt-br",
    cz: "cs",
    da: "da",
    de: "de",
    es: "es",
    fr: "fr",
    no: "nn",
    pl: "pl",
    pt: "pt",
    tr: "tr",
    hi: "hi",
    nl: "nl",
    ar: "ar",
    ja: "ja",
};
const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
function overrideGlobalMomentWeekStart(weekStart) {
    const { moment } = window;
    const currentLocale = moment.locale();
    // Save the initial locale weekspec so that we can restore
    // it when toggling between the different options in settings.
    if (!window._bundledLocaleWeekSpec) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window._bundledLocaleWeekSpec = moment.localeData()._week;
    }
    if (weekStart === "locale") {
        moment.updateLocale(currentLocale, {
            week: window._bundledLocaleWeekSpec,
        });
    }
    else {
        moment.updateLocale(currentLocale, {
            week: {
                dow: weekdays.indexOf(weekStart) || 0,
            },
        });
    }
}
/**
 * Sets the locale used by the calendar. This allows the calendar to
 * default to the user's locale (e.g. Start Week on Sunday/Monday/Friday)
 *
 * @param localeOverride locale string (e.g. "en-US")
 */
function configureGlobalMomentLocale(localeOverride = "system-default", weekStart = "locale") {
    var _a;
    const obsidianLang = localStorage.getItem("language") || "en";
    const systemLang = (_a = navigator.language) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    let momentLocale = langToMomentLocale[obsidianLang];
    if (localeOverride !== "system-default") {
        momentLocale = localeOverride;
    }
    else if (systemLang.startsWith(obsidianLang)) {
        // If the system locale is more specific (en-gb vs en), use the system locale.
        momentLocale = systemLang;
    }
    const currentLocale = window.moment.locale(momentLocale);
    console.debug(`[Calendar] Trying to switch Moment.js global locale to ${momentLocale}, got ${currentLocale}`);
    overrideGlobalMomentWeekStart(weekStart);
    return currentLocale;
}

function Calendar($$anchor, $$props) {
	push($$props, false);

	const $settings = () => store_get(settings, '$settings', $$stores);
	const $activeFile = () => store_get(activeFile, '$activeFile', $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let today = mutable_source(void 0, true);
	let displayedMonth = prop($$props, 'displayedMonth', 29, () => get$1(today));
	let sources = prop($$props, 'sources', 9);
	let onHoverDay = prop($$props, 'onHoverDay', 9);
	let onHoverWeek = prop($$props, 'onHoverWeek', 9);
	let onClickDay = prop($$props, 'onClickDay', 9);
	let onClickWeek = prop($$props, 'onClickWeek', 9);
	let onContextMenuDay = prop($$props, 'onContextMenuDay', 9);
	let onContextMenuWeek = prop($$props, 'onContextMenuWeek', 9);

	function tick() {
		set(today, window.moment());
	}

	function getToday(settings) {
		configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
		dailyNotes.reindex();
		weeklyNotes.reindex();

		return window.moment();
	}

	// 1 minute heartbeat to keep `today` reflecting the current day
	let heartbeat = setInterval(
		() => {
			tick();

			const isViewingCurrentMonth = displayedMonth().isSame(get$1(today), "day");

			if (isViewingCurrentMonth) {
				// if it's midnight on the last day of the month, this will
				// update the display to show the new month.
				displayedMonth(get$1(today));
			}
		},
		1000 * 60
	);

	onDestroy(() => {
		clearInterval(heartbeat);
	});

	legacy_pre_effect(() => ($settings()), () => {
		set(today, getToday($settings()));
	});

	legacy_pre_effect_reset();

	var $$exports = { tick };

	init$1(true);

	{
		let $0 = derived_safe_equal(() => (get$1(today), untrack(() => get$1(today).localeData())));

		Calendar$1($$anchor, {
			get sources() {
				return sources();
			},

			get today() {
				return get$1(today);
			},

			get onHoverDay() {
				return onHoverDay();
			},

			get onHoverWeek() {
				return onHoverWeek();
			},

			get onContextMenuDay() {
				return onContextMenuDay();
			},

			get onContextMenuWeek() {
				return onContextMenuWeek();
			},

			get onClickDay() {
				return onClickDay();
			},

			get onClickWeek() {
				return onClickWeek();
			},

			get localeData() {
				return get$1($0);
			},

			get selectedId() {
				return $activeFile();
			},

			get showWeekNums() {
				return ($settings(), untrack(() => $settings().showWeeklyNote));
			},

			get displayedMonth() {
				return displayedMonth();
			},

			set displayedMonth($$value) {
				displayedMonth($$value);
			},

			$$legacy: true
		});
	}

	bind_prop($$props, 'tick', tick);

	var $$pop = pop($$exports);

	$$cleanup();

	return $$pop;
}

function showFileMenu(app, file, position) {
    const fileMenu = new require$$0.Menu(app);
    fileMenu.addItem((item) => item
        .setTitle("Delete")
        .setIcon("trash")
        .onClick(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.fileManager.promptForFileDeletion(file);
    }));
    app.workspace.trigger("file-menu", fileMenu, file, "calendar-context-menu", null);
    fileMenu.showAtPosition(position);
}

const getStreakClasses = (file) => {
    return classList({
        "has-note": !!file,
    });
};
const streakSource = {
    getDailyMetadata: async (date) => {
        const file = mainExports.getDailyNote(date, get(dailyNotes));
        return {
            classes: getStreakClasses(file),
            dots: [],
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = mainExports.getWeeklyNote(date, get(weeklyNotes));
        return {
            classes: getStreakClasses(file),
            dots: [],
        };
    },
};

function getNoteTags(note) {
    var _a;
    if (!note) {
        return [];
    }
    const { metadataCache } = window.app;
    const frontmatter = (_a = metadataCache.getFileCache(note)) === null || _a === void 0 ? void 0 : _a.frontmatter;
    const tags = [];
    if (frontmatter) {
        const frontmatterTags = require$$0.parseFrontMatterTags(frontmatter) || [];
        tags.push(...frontmatterTags);
    }
    // strip the '#' at the beginning
    return tags.map((tag) => tag.substring(1));
}
function getFormattedTagAttributes(note) {
    const attrs = {};
    const tags = getNoteTags(note);
    const [emojiTags, nonEmojiTags] = partition(tags, (tag) => /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/.test(tag));
    if (nonEmojiTags) {
        attrs["data-tags"] = nonEmojiTags.join(" ");
    }
    if (emojiTags) {
        attrs["data-emoji-tag"] = emojiTags[0];
    }
    return attrs;
}
const customTagsSource = {
    getDailyMetadata: async (date) => {
        const file = mainExports.getDailyNote(date, get(dailyNotes));
        return {
            dataAttributes: getFormattedTagAttributes(file),
            dots: [],
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = mainExports.getWeeklyNote(date, get(weeklyNotes));
        return {
            dataAttributes: getFormattedTagAttributes(file),
            dots: [],
        };
    },
};

async function getNumberOfRemainingTasks(note) {
    if (!note) {
        return 0;
    }
    const { vault } = window.app;
    const fileContents = await vault.cachedRead(note);
    return (fileContents.match(/(-|\*) \[ \]/g) || []).length;
}
async function getDotsForDailyNote$1(dailyNote) {
    if (!dailyNote) {
        return [];
    }
    const numTasks = await getNumberOfRemainingTasks(dailyNote);
    const dots = [];
    if (numTasks) {
        dots.push({
            className: "task",
            color: "default",
            isFilled: false,
        });
    }
    return dots;
}
const tasksSource = {
    getDailyMetadata: async (date) => {
        const file = mainExports.getDailyNote(date, get(dailyNotes));
        const dots = await getDotsForDailyNote$1(file);
        return {
            dots,
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = mainExports.getWeeklyNote(date, get(weeklyNotes));
        const dots = await getDotsForDailyNote$1(file);
        return {
            dots,
        };
    },
};

const NUM_MAX_DOTS = 5;
async function getWordLengthAsDots(note) {
    // 1. 【修改】解构出 useChineseWordCount
    // (如果 useChineseWordCount 报红线，就在分号前加个 " as any" )
    const { wordsPerDot = DEFAULT_WORDS_PER_DOT, useChineseWordCount } = get(settings);
    if (!note || wordsPerDot <= 0) {
        return 0;
    }
    const fileContents = await window.app.vault.cachedRead(note);
    // 2. 【修改】把开关状态传给 getWordCount
    const wordCount = getWordCount(fileContents, useChineseWordCount);
    const numDots = wordCount / wordsPerDot;
    return clamp(Math.floor(numDots), 1, NUM_MAX_DOTS);
}
async function getDotsForDailyNote(dailyNote) {
    if (!dailyNote) {
        return [];
    }
    const numSolidDots = await getWordLengthAsDots(dailyNote);
    const dots = [];
    for (let i = 0; i < numSolidDots; i++) {
        dots.push({
            color: "default",
            isFilled: true,
        });
    }
    return dots;
}
const wordCountSource = {
    getDailyMetadata: async (date) => {
        const file = mainExports.getDailyNote(date, get(dailyNotes));
        const dots = await getDotsForDailyNote(file);
        return {
            dots,
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = mainExports.getWeeklyNote(date, get(weeklyNotes));
        const dots = await getDotsForDailyNote(file);
        return {
            dots,
        };
    },
};

class CalendarView extends require$$0.ItemView {
    constructor(leaf) {
        super(leaf);
        this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
        this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);
        this.onNoteSettingsUpdate = this.onNoteSettingsUpdate.bind(this);
        this.onFileCreated = this.onFileCreated.bind(this);
        this.onFileDeleted = this.onFileDeleted.bind(this);
        this.onFileModified = this.onFileModified.bind(this);
        this.onFileOpen = this.onFileOpen.bind(this);
        this.onHoverDay = this.onHoverDay.bind(this);
        this.onHoverWeek = this.onHoverWeek.bind(this);
        this.onContextMenuDay = this.onContextMenuDay.bind(this);
        this.onContextMenuWeek = this.onContextMenuWeek.bind(this);
        this.registerEvent(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.app.workspace.on("periodic-notes:settings-updated", this.onNoteSettingsUpdate));
        this.registerEvent(this.app.vault.on("create", this.onFileCreated));
        this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
        this.registerEvent(this.app.vault.on("modify", this.onFileModified));
        this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));
        this.settings = null;
        settings.subscribe((val) => {
            this.settings = val;
            // Refresh the calendar if settings change
            if (this.calendar) {
                this.calendar.tick();
            }
        });
    }
    getViewType() {
        return VIEW_TYPE_CALENDAR;
    }
    getDisplayText() {
        return "Calendar";
    }
    getIcon() {
        return "calendar-with-checkmark";
    }
    onClose() {
        if (this.calendar) {
            this.calendar.$destroy();
        }
        return Promise.resolve();
    }
    async onOpen() {
        // Integration point: external plugins can listen for `calendar:open`
        // to feed in additional sources.
        const sources = [
            customTagsSource,
            streakSource,
            wordCountSource,
            tasksSource,
        ];
        this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);
        this.calendar = new Calendar({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.contentEl,
            props: {
                onClickDay: this.openOrCreateDailyNote,
                onClickWeek: this.openOrCreateWeeklyNote,
                onHoverDay: this.onHoverDay,
                onHoverWeek: this.onHoverWeek,
                onContextMenuDay: this.onContextMenuDay,
                onContextMenuWeek: this.onContextMenuWeek,
                sources,
            },
        });
    }
    onHoverDay(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const { format } = mainExports.getDailyNoteSettings();
        const note = mainExports.getDailyNote(date, get(dailyNotes));
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onHoverWeek(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const note = mainExports.getWeeklyNote(date, get(weeklyNotes));
        const { format } = mainExports.getWeeklyNoteSettings();
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onContextMenuDay(date, event) {
        const note = mainExports.getDailyNote(date, get(dailyNotes));
        if (!note) {
            // If no file exists for a given day, show nothing.
            return;
        }
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onContextMenuWeek(date, event) {
        const note = mainExports.getWeeklyNote(date, get(weeklyNotes));
        if (!note) {
            // If no file exists for a given day, show nothing.
            return;
        }
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onNoteSettingsUpdate() {
        dailyNotes.reindex();
        weeklyNotes.reindex();
        this.updateActiveFile();
    }
    async onFileDeleted(file) {
        if (mainExports.getDateFromFile(file, "day")) {
            dailyNotes.reindex();
            this.updateActiveFile();
        }
        if (mainExports.getDateFromFile(file, "week")) {
            weeklyNotes.reindex();
            this.updateActiveFile();
        }
    }
    async onFileModified(file) {
        const date = mainExports.getDateFromFile(file, "day") || mainExports.getDateFromFile(file, "week");
        if (date && this.calendar) {
            this.calendar.tick();
        }
    }
    onFileCreated(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (mainExports.getDateFromFile(file, "day")) {
                dailyNotes.reindex();
                this.calendar.tick();
            }
            if (mainExports.getDateFromFile(file, "week")) {
                weeklyNotes.reindex();
                this.calendar.tick();
            }
        }
    }
    onFileOpen(_file) {
        if (this.app.workspace.layoutReady) {
            this.updateActiveFile();
        }
    }
    updateActiveFile() {
        const { view } = this.app.workspace.activeLeaf;
        let file = null;
        if (view instanceof require$$0.FileView) {
            file = view.file;
        }
        activeFile.setFile(file);
        if (this.calendar) {
            this.calendar.tick();
        }
    }
    revealActiveNote() {
        const { moment } = window;
        const { activeLeaf } = this.app.workspace;
        if (activeLeaf.view instanceof require$$0.FileView) {
            // Check to see if the active note is a daily-note
            let date = mainExports.getDateFromFile(activeLeaf.view.file, "day");
            if (date) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
            // Check to see if the active note is a weekly-note
            const { format } = mainExports.getWeeklyNoteSettings();
            date = moment(activeLeaf.view.file.basename, format, true);
            if (date.isValid()) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
        }
    }
    async openOrCreateWeeklyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const startOfWeek = date.clone().startOf("week");
        const existingFile = mainExports.getWeeklyNote(date, get(weeklyNotes));
        if (!existingFile) {
            // File doesn't exist
            tryToCreateWeeklyNote(startOfWeek, inNewSplit, this.settings, (file) => {
                activeFile.setFile(file);
            });
            return;
        }
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile);
        activeFile.setFile(existingFile);
        workspace.setActiveLeaf(leaf, true, true);
    }
    async openOrCreateDailyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const existingFile = mainExports.getDailyNote(date, get(dailyNotes));
        if (!existingFile) {
            // File doesn't exist
            tryToCreateDailyNote(date, inNewSplit, this.settings, (dailyNote) => {
                activeFile.setFile(dailyNote);
            });
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mode = this.app.vault.getConfig("defaultViewMode");
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true, mode });
        activeFile.setFile(existingFile);
    }
}

class CalendarPlugin extends require$$0.Plugin {
    onunload() {
        this.app.workspace
            .getLeavesOfType(VIEW_TYPE_CALENDAR)
            .forEach((leaf) => leaf.detach());
    }
    async onload() {
        this.register(settings.subscribe((value) => {
            this.options = value;
        }));
        this.registerView(VIEW_TYPE_CALENDAR, (leaf) => (this.view = new CalendarView(leaf)));
        this.addCommand({
            id: "show-calendar-view",
            name: "Open view",
            checkCallback: (checking) => {
                if (checking) {
                    return (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0);
                }
                this.initLeaf();
            },
        });
        this.addCommand({
            id: "open-weekly-note",
            name: "Open Weekly Note",
            checkCallback: (checking) => {
                if (checking) {
                    return !appHasPeriodicNotesPluginLoaded();
                }
                this.view.openOrCreateWeeklyNote(window.moment(), false);
            },
        });
        this.addCommand({
            id: "reveal-active-note",
            name: "Reveal active note",
            callback: () => this.view.revealActiveNote(),
        });
        await this.loadOptions();
        this.addSettingTab(new CalendarSettingsTab(this.app, this));
        if (this.app.workspace.layoutReady) {
            this.initLeaf();
        }
        else {
            this.registerEvent(this.app.workspace.on("layout-ready", this.initLeaf.bind(this)));
        }
    }
    initLeaf() {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length) {
            return;
        }
        this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_CALENDAR,
        });
    }
    async loadOptions() {
        const options = await this.loadData();
        settings.update((old) => {
            return Object.assign(Object.assign({}, old), (options || {}));
        });
        await this.saveData(this.options);
    }
    async writeOptions(changeOpts) {
        settings.update((old) => (Object.assign(Object.assign({}, old), changeOpts(old))));
        await this.saveData(this.options);
    }
}

module.exports = CalendarPlugin;
//# sourceMappingURL=main.js.map
