
const euroCentralUrl = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";


async function get_rates_from_euro_central() {
	return fetch(euroCentralUrl)
		.then(res => res.text())
		.then(text => (new window.DOMParser()).parseFromString(text, "text/xml"))
		.then(xml => {
			console.log("Parsing returned rates");
			let nodes = xml.getElementsByTagName("Cube");
			let rates: Record<string, number> = {};
			for (let node of nodes) {
				if (node.attributes && 'currency' in node.attributes && 'rate' in node.attributes) {
					const currencyAttr: any = node.attributes['currency'];
					const rateAttr: any = node.attributes['rate'];
					rates[currencyAttr.value] = parseFloat(rateAttr.value);
				}
			}
			return { rates: rates, base: 'EUR' };
		})
		.catch(error => {
			console.error(error);
			let rates: Record<string, number> = {};
			return { rates: rates, base: 'EUR' };
		});
}

export async function get_exchange_rates() {
	return get_rates_from_euro_central();
}
