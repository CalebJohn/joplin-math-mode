import { GlobalConfig } from '../types';

export const defaultConfig = {
	global: false,
	simplify: false,
	bignumber: false,
	copyButton: true,
	displaytotal: false,
	hide: false,
	verbose: true,
	inline: true,
	notation: 'auto',
	lowerExp: -3,
	precision: 8,
	align: 'left',
	inlinesyntax: true,
	currency: true,
};

// Build GlobalConfig from plugin settings.
// Note: Settings are accessed via a different API in markdown-it plugins than in CodeMirror plugins.
// Both functions have the sam api, so functionality can be shared here
export async function getGlobalConfig(settingValue: (key: string) => any): Promise<GlobalConfig> {
	return {
		global: defaultConfig.global ? 'yes' : 'no',
		simplify: defaultConfig.simplify ? 'yes' : 'no',
		bignumber: await settingValue('bignumber') ? 'yes' : 'no',
		displaytotal: defaultConfig.displaytotal ? 'yes' : 'no',
		hide: defaultConfig.hide ? 'yes' : 'no',
		verbose: await settingValue('verbose') ? 'yes' : 'no',
		inline: await settingValue('inline') ? 'yes' : 'no',
		notation: await settingValue('notation'),
		lowerExp: await settingValue('lowerExp'),
		precision: await settingValue('precision'),
		align: await settingValue('align'),
		inlinesyntax: await settingValue('inlinesyntax'),
		copyButton: await settingValue('copyButton'),
		currency: await settingValue('currency'),
	};
}

// The markdownIt plugin version of getting settings values is synchronous.So I provide an alternative
// implementation for it
export function getGlobalConfigSync(settingValue: (key: string) => any): GlobalConfig {
	return {
		global: defaultConfig.global ? 'yes' : 'no',
		simplify: defaultConfig.simplify ? 'yes' : 'no',
		bignumber: settingValue('bignumber') ? 'yes' : 'no',
		displaytotal: defaultConfig.displaytotal ? 'yes' : 'no',
		hide: defaultConfig.hide ? 'yes' : 'no',
		verbose: settingValue('verbose') ? 'yes' : 'no',
		inline: settingValue('inline') ? 'yes' : 'no',
		notation: settingValue('notation'),
		lowerExp: settingValue('lowerExp'),
		precision: settingValue('precision'),
		align: settingValue('align') || 'left',
		inlinesyntax: settingValue('inlinesyntax'),
		copyButton: settingValue('copyButton'),
		currency: settingValue('currency'),
	};
}
