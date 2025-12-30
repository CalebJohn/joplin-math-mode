import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { MenuItemLocation } from 'api/types';
import { SettingItemType } from 'api/types';
import { defaultConfig, getGlobalConfig } from './shared/utils/config';

const contentScriptId = 'literate-math-mode';


joplin.plugins.register({
	onStart: async function() {
		// // // // // // // // // // // // // // //
		// Handle Settings
		// // // // // // // // // // // // // // //

		await joplin.settings.registerSection('settings.calebjohn.mathmode', {
			label: 'Math Mode',
			iconName: 'fas fa-calculator'
		});

		await joplin.settings.registerSettings({
			'bignumber': {
				value: defaultConfig.bignumber,
				type: SettingItemType.Bool,
				section: 'settings.calebjohn.mathmode',
				public: true,
				advanced: true,
				label: 'Use 128 bit BigNumbers for calculations ',
				description: '**warning some mathjs features won\'t work**',
			},
			'copyButton': {
				value: defaultConfig.copyButton,
				type: SettingItemType.Bool,
				section: 'settings.calebjohn.mathmode',
				public: true,
				advanced: true,
				label: 'Show copy to clipboard button on hover.'
			},
			'verbose': {
				value: defaultConfig.verbose,
				type: SettingItemType.Bool,
				section: 'settings.calebjohn.mathmode',
				public: true,
				label: 'When assigning a variable, show the name next to the result'
			},
			'inline': {
				value: defaultConfig.inline,
				type: SettingItemType.Bool,
				section: 'settings.calebjohn.mathmode',
				public: true,
				label: 'Show result next to input (inline)'
			},
			'notation': {
				value: defaultConfig.notation,
				type: SettingItemType.String,
				isEnum: true,
				options: {'engineering': 'Engineering', 'exponential': 'Exponential', 'auto': 'Auto', 'fixed': 'Fixed'},
				// mathjs rejects bin, oct and hex for some reason
				// options: {'engineering': 'Engineering', 'exponential': 'Exponential', 'auto': 'Auto', 'fixed': 'Fixed', 'bin': 'Binary', 'oct': 'Octal', 'hex': 'Hex'},
				section: 'settings.calebjohn.mathmode',
				public: true,
				label: 'Which notation should be used for results?'
			},
			'lowerExp': {
				value: defaultConfig.lowerExp,
				type: SettingItemType.Int,
				section: 'settings.calebjohn.mathmode',
				step: 1,
				public: true,
				advanced: true,
				label: 'Lower boundary to format a number as an exponent (auto notation only)'
			},
			'precision': {
				value: defaultConfig.precision,
				type: SettingItemType.Int,
				section: 'settings.calebjohn.mathmode',
				minimum: 0,
				maximum: 16,
				step: 1,
				public: true,
				label: 'How many digits should math results have?'
			},
			'align': {
				value: defaultConfig.align,
				type: SettingItemType.String,
				isEnum: true,
				options: { 'left': 'Left', 'right': 'Right' },
				section: 'settings.calebjohn.mathmode',
				public: true,
				label: 'Which side should math be aligned to?'
			},
			'inlinesyntax': {
				value: defaultConfig.inlinesyntax,
				type: SettingItemType.Bool,
				section: 'settings.calebjohn.mathmode',
				public: true,
				label: 'Treat lines that start with `=` as math lines.'
			},
			'currency': {
				value: defaultConfig.currency,
				type: SettingItemType.Bool,
				section: 'settings.calebjohn.mathmode',
				public: true,
				label: 'Enable currency conversions (e.g. 100 CAD in EUR).'
			}
		});

		// // // // // // // // // // // // // // //
		// Register Content Scripts
		// // // // // // // // // // // // // // //

		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			contentScriptId,
			'./codeMirror/mathMode.js'
		);

		// Register markdown-it plugin for viewer rendering
		await joplin.contentScripts.register(
			ContentScriptType.MarkdownItPlugin,
			'literate-math-mode-viewer',
			'./markdownIt/mathModePlugin.js'
		);

		// // // // // // // // // // // // // // //
		// Register Content Script Messaging
		// // // // // // // // // // // // // // //

		await joplin.contentScripts.onMessage(contentScriptId, async (message:any) => {
			if (message.name === 'getConfig') {
				// We need to wrap the value fetching in a closure so that the proper
				// context is available to the value function (can't pass it directly
				// for some javascript reason)
				return await getGlobalConfig((key) => joplin.settings.value(key));
			}

			return "Error: " + message + " is not a valid message";
		});
	},
});
