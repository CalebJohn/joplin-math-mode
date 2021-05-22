// convert math to Lex
//  
const mathjs = require('mathjs');
import { truthy, process_config, trim_lines, process_line } from './mathKit';
import { get_exchange_rates } from './exchangeRate'
const tag = 'mathMode';

const defaultGlobConfig = {
    align: "left",
    bignumber: "no",
    displaytotal: "no",
    global: "no",
    hide: "no",
    inline: "yes",
    inlinesyntax: true,
    notation: "auto",
    precision: 8,
    simplify: "no",
    verbose: "yes",
}

function j000LexHandler(node, options) {
    switch(node.type) {
        case 'FunctionNode': {
            if (node.name === "simplify") {
                let i = node.args.map(n => {
                    return n.toTex(options)
                });
                let s = "\\mathrm{"+node.name+"}("+i.join(', ') + ")";
                return s;
            }
        }
        case 'ConstantNode': {
            if (mathjs.typeOf(node.value) === 'string') {
                return node.value;
            }
            return 
        }
        case 'OperatorNode': {
            // 只对「符号」特殊处理
            if (node.args && node.args.length == 2 && node.args[1].type === 'SymbolNode') {
                let t = node.getIdentifier();
                if ( t === 'OperatorNode:divide') {
                    return node.args[0].toTex(options) + '/'+ node.args[1].toTex(options);
                }
                if ( t === 'OperatorNode:multiply') {
                    return node.args[0].toTex(options) + '\\ ' + node.args[1].toTex(options);
                }
            }
        }
    }
}

// 转换纯文本
function convertLex(math:any, mathMode:any, src:string) {
    const allow_inline = mathMode.globalConfig.inlinesyntax;
    const lines0 = src.split('\n')
    const lines = trim_lines(lines0.slice(), allow_inline);
    let scope = Object.assign({}, mathMode.scope);
    let lineData = {};
    let globalConfig = Object.assign({}, mathMode.globalConfig);
    let config = Object.assign({}, globalConfig);
    let block_total = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!line || line === '```math') {
            block_total = '';
        }
        else if (line === '```') {
            config = Object.assign({}, globalConfig);
            block_total = '';
        }
        else if (line.includes(':')) {
            lineData[i] = process_config(math, line, config);
        }
        else {
            // Allow the user to redefine the total variable if they want
            const localScope = Object.assign({ total: block_total }, scope);
            lineData[i] = process_line(math, line, localScope, config, block_total);
            // Update the scope
            scope = Object.assign(scope, localScope);
            block_total = lineData[i].total;
        }

        if (truthy(config.global)) {
            globalConfig = Object.assign(globalConfig, config, { global: 'false' });
        }
    }

    let isblock = false
    for (let i = 0; i < lines0.length; i++) {
        const ld = lineData[i];
        if (lines[i] === '```math') {
            isblock = true
            lines0[i] = '$$\n\\begin{aligned}'
        } else if (lines[i] === '```') {
            isblock = false
            lines0[i] = '\\end{aligned}\n$$'
        }

        if (!ld) continue;
        if (ld.isConfig) {
            if (isblock) {
                lines0[i]= lines0[i].replace(':','&\\ :') + '\\\\';
            }
            continue
        }
        if (ld.resultHidden) continue
        let result = ld.result
        if (ld.displaytotal && !result.include('total')) {
            result = ld.total;
        }
        if (typeof result === 'string' && result ==='undefined') {
            result = ''
        }

        const latex: string = ld.expr ? ld.expr.toTex({ handler: j000LexHandler }) : '';

        if (latex && latex!=='undefined') {
            let expr: string = isblock ? latex : `$${latex.trim()}$`;
            if (isblock) {
                expr += "&\\ => " + result + '\\\\';
            } else {
                expr += " => " + result;
            }
            lines0[i] = expr;
            continue
        }
        if (result==='')  {
            lines0[i] = '';
        } else {
            lines0[i] = " => " + result;
        }
    }

    return lines0.join('\n')
}

function plugin(markdownIt, context) {
    const pluginId = context.pluginId;
    const math = mathjs.create(mathjs.all, {});

    // FIXME: 
    const interval = setInterval(() => { 
		get_exchange_rates().then(rates => {;
			math.createUnit(rates.base);
			math.createUnit(rates.base.toLowerCase(), math.unit(1, rates.base));
			Object.keys(rates.rates)
				.forEach((currency) => {
					math.createUnit(currency, math.unit(1/rates.rates[currency], rates.base));
					math.createUnit(currency.toLowerCase(), math.unit(1/rates.rates[currency], rates.base));
				});
		});
    }, 1000*60*60*24);
    // setTimeout(() => {
    //     const globalConfig = context.postMessage({ name: 'getConfig' });
    //     mathMode.globalConfig = Object.assign({}, defaultGlobConfig, globalConfig)
    // })
    const mathMode = {
        scope: {},
        globalConfig: Object.assign({}, defaultGlobConfig),
    }

    // 'normalize' 'block' 'inline'
    markdownIt.core.ruler.before('block', `${tag}`, function (state) {
        state.src = convertLex(math, mathMode, state.src)
    })
}

module.exports = {
    default: function (context) {
        return {
            plugin: function (markdownIt, _options) {
                return plugin(markdownIt, context);
            },
            assets: function () {
                return [];
            }
        }
    }
}
