
export interface ContentScriptContext {
	postMessage(data: any): Promise<any>;
}

type YesOrNo = 'yes' | 'no';

export interface GlobalConfig {
	global: YesOrNo,
	simplify: YesOrNo,
	bignumber: YesOrNo,
	displaytotal: YesOrNo,
	hide: YesOrNo,
	verbose: YesOrNo,
	inline: YesOrNo,
	notation: string,
	lowerExp: number,
	precision: number,
	align: string,
	inlinesyntax: boolean,
	copyButton: boolean,
	currency: boolean,
}

export interface PluginState {
	scope: object;
	globalConfig: object;
	lineData: object;
};

export type MathBlockType = '+' | '-';
