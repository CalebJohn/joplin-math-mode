// same as mathMode.ts
type BlockType = '+' | '-';
const inline_math_regex = /^(\+|\-)?=(?= *[0-9a-zA-Z\[\(\-\+])/;

export function truthy(s: string) {
    s = s ? s.toLowerCase() : '';
    return s.startsWith('t') || s.startsWith('y') || s === '1';
}
export function falsey(s: string) {
    s = s ? s.toLowerCase() : '';
    return s.startsWith('f') || s.startsWith('n') || s === '0';
}

// Helper for the math lines function,
// removes all lines until the ```math symbol
function erase_to_start(lines: string[], lineno: number, allow_inline: boolean) {
    for (let i = lineno; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;

        if (line.trim() === '```math') {
            break;
        }
        else if (!(allow_inline && line.match(inline_math_regex))) {
            lines[i] = '';
        }
    }
}

export function trim_lines(lines: string[], allow_inline: boolean) {
    let might_be_in_block = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        if (allow_inline && line.match(inline_math_regex)) {
            continue;
        }
        else if (might_be_in_block && line.trim() === '```') {
            might_be_in_block = false;
            lines[i] = '```';
            continue;
        }
        else if (line.trim() === '```math') {
            might_be_in_block = true;
            lines[i] = '```math';
        }

        if (!might_be_in_block)
            lines[i] = '';
    }
    if (might_be_in_block) {
        erase_to_start(lines, lines.length, allow_inline);
    }

    return lines;
}

export function process_config(math: any, line: string, config: any) {
    const [key, value] = line.split(':', 2);
    config[key.trim()] = value.trim();

    if (truthy(config.bignumber)) {
        math.config({
            number: 'BigNumber',
            precision: 128
        });
    }
    else {
        math.config({
            number: 'number'
        });
    }

    return { isConfig: true };
}

export function get_line_equation(line: string): string {
    return line.replace(inline_math_regex, '');
}

function get_sum_type(line: string): BlockType {
    const match = inline_math_regex.exec(line)

    if (match && match.length > 1 && match[1] === '-')
        return '-';

    return '+';
}

function math_contains_assignment(parsed: any, name: string) {
    if (!parsed) return false;

    const filtered = parsed.filter(function (n) {
        return n.isAssignmentNode && n.name === name
    });

    return filtered.length > 0;
}

function math_contains_symbol(parsed: any, name: string) {
    if (!parsed) return false;

    const filtered = parsed.filter(function (n) {
        return n.isSymbolNode && n.name === name
    });

    return filtered.length > 0;
}


// like mathMode.ts
//   add paramter: math
export function process_line(math:any, line: string, scope: any, config: any, block_total: string): any {
    let p = null;
    let result = '';
    let contains_total = false;

    try {
        p = math.parse(get_line_equation(line));

        // Evaluate the Expression
        if (falsey(config.simplify))
            result = p.evaluate(scope);
        else
            result = math.simplify(p)

        contains_total = math_contains_symbol(p, 'total');
        if (result && !contains_total) {
            const sum_char = get_sum_type(line);
            // An error can occur when the types don't match up
            // To recover, restart the sum counter
            try {
                block_total = math.parse(`${block_total} ${sum_char} ${result}`).evaluate(scope);
            }
            catch(err) {
                // If the error parsing still fails, we will just return the result (no sign)
                // This will fail in cases were the result type is a symbolic type
                // There is probably a better method to handle this case
                try {
                    block_total = math.parse(`${sum_char} ${result}`).evaluate(scope);
                }
                catch(errr) {
                    block_total = result;
                }
            }
        }
        // Format the output
        result = math.format(result, {
            precision: Number(config.precision),
            notation: config.notation,
        });

        // Attach a name if necessary
        if (p.name && truthy(config.verbose))
            result = p.name + ': ' + result;
    } catch(e) {
        result = e.message;

        if (e.message.indexOf('Cannot create unit') === 0) {
            result = '';
        }
    }

    // If the total variable wasn't modified, clear it
    // This needs to be outside the "try" statement to guarantee that it runs
    if (!math_contains_assignment(p, 'total'))
        delete scope['total'];

    return {
        // expr
        expr: p,

        result: result,
        total: block_total,
        displaytotal: truthy(config.displaytotal) && !contains_total,
        inputHidden: config.hide === 'expression',
        resultHidden: config.hide === 'result' || result === '',
        inline: truthy(config.inline),
        alignRight: config.align === 'right',
    };
}