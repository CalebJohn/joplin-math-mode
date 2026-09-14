import { get_exchange_rates } from "../../exchangeRate";
import { math } from "./mathUtils";

const cache_key = 'mathmode.exchangeRates.v1';

export interface ExchangeRates {
	base: string;
	rates: Record<string, number>;
}

function apply_rates({ base, rates }: ExchangeRates) {
	if (!math.Unit.isValuelessUnit(base)) {
		math.createUnit(base);
	}
	math.createUnit(base.toLowerCase(), math.unit(1, base), { override: true });
	Object.keys(rates)
		.forEach((currency) => {
			math.createUnit(currency, math.unit(1/rates[currency], base), { override: true });
			math.createUnit(currency.toLowerCase(), math.unit(1/rates[currency], base), { override: true });
		});
}

function is_exchange_rates(value: unknown): value is ExchangeRates {
	if (!value || typeof value !== 'object') {
		return false;
	}
	if (!('base' in value) || typeof value.base !== 'string' || !value.base) {
		return false;
	}
	if (!('rates' in value) || typeof value.rates !== 'object' || value.rates === null) {
		return false;
	}
	const rate_values = Object.values(value.rates);
	return rate_values.length > 0
		&& rate_values.every(rate => typeof rate === 'number' && isFinite(rate) && rate > 0);
}

function cache_read(): ExchangeRates | null {
	try {
		const raw = window.localStorage.getItem(cache_key);
		if (!raw) {
			return null;
		}
		const parsed: unknown = JSON.parse(raw);
		return is_exchange_rates(parsed) ? parsed : null;
	} catch {
		// Corrupted or unavailable storage is not an error worth surfacing
		return null;
	}
}

function cache_write(rates: ExchangeRates) {
	try {
		window.localStorage.setItem(cache_key, JSON.stringify(rates));
	} catch {
		// Storage may be unavailable; the fetch path still works without the cache
	}
}

// Applies cached rates synchronously. Returns true when a usable cache was found.
// The markdown-it viewer renders synchronously, so a rate fetch that lands after
// rendering can never correct the current output — this is the only way to have
// currency units available for the first note rendered in a session.
export function load_cached_rates(): boolean {
	const cached = cache_read();
	if (!cached) {
		return false;
	}
	try {
		apply_rates(cached);
	} catch {
		return false;
	}
	return true;
}

export async function update_rates() {
	const rates = await get_exchange_rates();
	apply_rates(rates);
	cache_write(rates);
}
