import { processDocumentMath } from './processDocument';
import { renderMathBlock, renderExpressionLine } from './renderMath';
import { update_rates } from '../shared/utils/update_rates';
import { LineDataType, process_next, defaultProcessContext } from '../shared/utils/mathUtils';
import { getGlobalConfigSync } from '../shared/utils/config';
import { inline_math_regex } from '../shared/constants';

module.exports = {
	default: function(_context: any) {
		return {
			plugin: function(markdownIt: any, options: any) {
				const globalConfig = getGlobalConfigSync(options.settingValue);

				if (globalConfig.currency) {
					update_rates().catch(err => {
						console.error('Failed to load exchange rates:', err);
					});
				}

				markdownIt.core.ruler.before('block', 'math_process_all', function(state: any) {
					if (!state.env) {
						state.env = {};
					}

					const documentData = processDocumentMath(state.src, globalConfig);
					state.env.mathDocumentData = documentData;
				});

				const defaultFence = markdownIt.renderer.rules.fence || function(tokens: any[], idx: number, options: any, env: any, self: any) {
					return self.renderToken(tokens, idx, options);
				};

				markdownIt.renderer.rules.fence = function(tokens: any[], idx: number, options: any, env: any, self: any) {
					const token = tokens[idx];
					const info = token.info ? token.info.trim() : '';

					if (info !== 'math') {
						return defaultFence(tokens, idx, options, env, self);
					}

					if (!env.mathDocumentData) {
						return '<div>Error: Math data not processed</div>\n';
					}

					// Find the starting line in the original document
					const srcLines = env.mathDocumentData.lines;
					let startLine = token.map[0] + 1;

					const fenceLines = token.content.split('\n');
					if (srcLines[startLine] !== fenceLines[0]) {
						console.warn(srcLines);
						return '<div>Error: Malformed math block</div>\n';
					}

					const escapedSource = markdownIt.utils.escapeHtml(token.content.trim());

					let html = '<div class="joplin-editable math-block">\n';

					html += '<pre class="joplin-source" ';
					html += 'data-joplin-language="math" ';
					html += 'data-joplin-source-open="```math\n" ';
					html += 'data-joplin-source-close="\n```">';
					html += escapedSource;
					html += '</pre>\n';
					html += renderMathBlock(fenceLines, env.mathDocumentData.lineData, startLine, globalConfig, markdownIt.utils.escapeHtml);

					html += '</div>\n';

					return html;
				};

				if (globalConfig.inlinesyntax) {
					markdownIt.core.ruler.after('block', 'math_inline', function(state: any) {
						if (!state.env || !state.env.mathDocumentData) {
							return;
						}

						const tokens = state.tokens;
						const lineData = state.env.mathDocumentData.lineData;
						const srcLines = state.env.mathDocumentData.lines;

						for (let i = 0; i < tokens.length; i++) {
							const token = tokens[i];

							if (token.type === 'paragraph_open') {
								const contentToken = tokens[i + 1];
								const closeToken = tokens[i + 2];

								if (contentToken && contentToken.type === 'inline') {
									const content = contentToken.content;

									if (inline_math_regex.test(content)) {
										let startLine = contentToken.map ? contentToken.map[0] : -1;
										let endLine = contentToken.map ? contentToken.map[1] : -1;

										if (startLine >= 0 && endLine > startLine) {
											let combinedHtml = '';
											let hasAnyMathLines = false;

											for (let lineNum = startLine; lineNum < endLine; lineNum++) {
												if (lineData[lineNum] && lineData[lineNum].type === LineDataType.Expression) {
													hasAnyMathLines = true;
													combinedHtml += renderExpressionLine(srcLines[lineNum], lineData[lineNum], globalConfig, markdownIt.utils.escapeHtml, false);
												}
											}

											if (hasAnyMathLines) {
												const htmlToken = new state.Token('html_block', '', 0);
												htmlToken.content = combinedHtml;
												htmlToken.block = true;

												tokens.splice(i, 3, htmlToken);
												i--;
											}
										}
									}
								}
							}
						}
					});
				}
			},

			assets: function() {
				return [
					{
						mime: 'text/css',
						inline: true,
						text: `.math-expression-line {
											clear: both;
											overflow: hidden;
										}
										.math-result {
											opacity: 0.75;
											display: block;
										}
										.math-result-right {
											padding-right: 5px;
											text-align: right;
										}
										.math-input-inline {
											float: left;
											padding-right: 10px;
										}
										.math-hidden {
											display: none;
										}
										.math-block {
											margin: 1em 0;
											border: 1px solid black;
											border-radius: 3px;
											padding: 4px;
										}
										.joplin-editable {
											position: relative;
										}
										.joplin-source {
											display: none;
										}`
					}
				];
			}
		}
	}
};
