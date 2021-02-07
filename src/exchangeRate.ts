
const euroCentralUrl = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";


async function get_rates_from_euro_central() {
	return fetch(euroCentralUrl)
		.then(res => res.text())
		.then(text => (new window.DOMParser()).parseFromString(text, "text/xml"))
		.then(xml => {
			let nodes = xml.getElementsByTagName("Cube");
			let rates = {};
			for (let node of nodes) {
				if (node.attributes && node.attributes['currency']) {
					rates[node.attributes['currency'].value] = parseFloat(node.attributes['rate'].value);
				}
			}
			return { rates: rates, base: 'EUR' };
		});
}

export async function get_exchange_rates() {
	return get_rates_from_euro_central();
}
