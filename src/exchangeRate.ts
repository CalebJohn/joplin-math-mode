const frankfurterUrl = "https://api.frankfurter.dev/v2/rates?base=EUR";

interface FrankfurterRow {
	base: string;
	quote: string;
	rate: number;
}

function is_rate_row(row: unknown): row is FrankfurterRow {
	return !!row
		&& typeof row === 'object'
		&& 'base' in row && typeof row.base === 'string'
		&& 'quote' in row && typeof row.quote === 'string'
		&& 'rate' in row && typeof row.rate === 'number'
		&& isFinite(row.rate)
		&& row.rate > 0;
}


// Frankfurter (https://frankfurter.dev) serves daily reference rates from the
// European Central Bank and other official sources. Unlike the ECB's own feed,
// Frankfurter sends CORS headers, so it can be reached from the mobile app.
export async function get_exchange_rates() {
	const response = await fetch(frankfurterUrl);

	if (!response.ok) {
		throw new Error(`Frankfurter responded with HTTP ${response.status}`);
	}

	const rows: unknown = await response.json();

	const rates: Record<string, number> = {};
	let base: string | null = null;
	if (Array.isArray(rows)) {
		for (const row of rows) {
			if (is_rate_row(row)) {
				rates[row.quote] = row.rate;
				if (base === null) {
					base = row.base;
				}
			}
		}
	}

	// A failed or unusable response must throw, otherwise the caller would
	// silently register no currency units and every money expression would break
	if (base === null || Object.keys(rates).length === 0) {
		throw new Error('Frankfurter returned no usable exchange rates');
	}

	return { rates: rates, base: base };
}
