const proxyUrl = "https://api.allorigins.win/raw?url=";
const euroCentralUrl = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const proxiedUrl = proxyUrl + encodeURIComponent(euroCentralUrl);


async function get_rates_from_euro_central(url: string) {
	return fetch(url)
		.then(res => res.text())
		.then(text => (new window.DOMParser()).parseFromString(text, "text/xml"))
		.then(xml => {
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
		});
}


export async function get_exchange_rates() {
	try {
		return await get_rates_from_euro_central(euroCentralUrl);
	} catch {
		// Mobile app rejects the raw url for CORS issues
		// This uses an external server to proxy the content and get around CORS,
		// I don't know how stable that is, so this is just a fallback
		return await get_rates_from_euro_central(proxiedUrl);
	}
}
