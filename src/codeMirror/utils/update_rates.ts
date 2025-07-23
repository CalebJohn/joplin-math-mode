import { get_exchange_rates } from "../../exchangeRate";
import { math } from "./mathUtils";

export async function update_rates() {
	console.log("fetching rates");
	const rates = await get_exchange_rates();
	console.log(rates);
	math.createUnit(rates.base);
	math.createUnit(rates.base.toLowerCase(), math.unit(1, rates.base));
	Object.keys(rates.rates)
		.forEach((currency) => {
			math.createUnit(currency, math.unit(1/rates.rates[currency], rates.base));
			math.createUnit(currency.toLowerCase(), math.unit(1/rates.rates[currency], rates.base));
		});
}
