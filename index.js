// from here https://github.com/GoogleChrome/lighthouse/blob/master/docs/puppeteer.md

const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const { program } = require('commander');
const {URL} = require('url');
const fs = require('fs');
const path = require('path');
const glob = require("glob");
const Table = require('cli-table');

const shortenedMetricNames = {
	'Performance': 'Perf',
	'Largest Contentful Paint': 'LCP',
	'First Contentful Paint': 'FCP',
	'Speed Index': 'SI',
	'Time to Interactive': 'TTI',
	'Total Blocking Time': 'TBT',
	'Cumulative Layout Shift': 'CLS'
};

program
	.option('-u, --url <url>', "The URL to be tested with Lighthouse.")
	.option('-c, --cookie [key=value pairs...]', 'Sets a cookie on the page before executing Lighthouse.')
	.option('-x, --css-no-animate', 'Inject CSS to block any animation on the page before executing Lighthouse.')
	.option('-r, --repeat <times>', 'Repeats the test <times> times.', 1)
	.option('-l, --log-only', 'Don\'t save the HTML report to the file system.')
	.option('-t, --table', 'Log the performance results as a table where each test gets a new row. This is useful with the --repeat option for easier analysis.');

program.parse(process.argv);

(async() => {
	let url = program.url;
	const injectCss = program.cssNoAnimate;
	const reexecuteTimes = parseInt(program.repeat);
	var table = null;

	try {
		// verify valid url
		new URL(url);
	} catch(e){
		if(url)
			console.log('Invalid URL passed, using default URL.');
		url = 'https://www.bhphotovideo.com';
	}

	console.log('Preparing to run Lighthouse ' + (reexecuteTimes > 1 ? reexecuteTimes + ' times' : 'once') + ' for: ', url);

	if(program.cookie)
		console.log(' -> With the following cookies: ', program.cookie);

	if(injectCss)
		console.log(' -> With CSS injection to block animations.');

	// keep some visual space
	console.log('');

	// delete previous saved reports
	if(!program.logOnly)
		glob.sync("./report-*.html").forEach(file => fs.unlinkSync(file));

	// each iteration opens a new browser with a fresh session
	for (let i = 1; i <= reexecuteTimes; i++) {

		// Use Puppeteer to launch headful Chrome and don't use its default 800x600 viewport.
		const browser = await puppeteer.launch({
			headless: false,
			defaultViewport: null,
		}).catch(function(error){
			console.log('failed to launch puppeteer');
			console.log(error);
		});

		// set the cookies
		if(program.cookie && program.cookie.length){

			var cookies = program.cookie.map(pair => {
				return {
					name: pair.split('=')[0],
					value: pair.split('=')[1]
				};
			});

			const page = await browser.newPage();
			await page.goto(url);

			await page.setCookie(...cookies);

			// close page for lighthouse failure of multiple pages with same origin
			await page.close();
		}

		// Wait for Lighthouse to open url, then customize network conditions.
		// Note: this will re-establish these conditions when LH reloads the page. Think that's ok....
		browser.on('targetchanged', async target => {

			const page = await target.page();

			// inject elements on page
			if(injectCss){
				await injectOnPage(page);
			}
		});

		async function injectOnPage(page){
			function addStyleContent(content) {
				const style = document.createElement('style');
				style.type = 'text/css';
				style.appendChild(document.createTextNode(content));
				document.head.appendChild(style);
				return style
			}

			const css = '* {color: red !important; -o-transition-property: none !important; -moz-transition-property: none !important; -ms-transition-property: none !important; -webkit-transition-property: none !important;  transition-property: none !important;  -o-transform: none !important; -moz-transform: none !important;   -ms-transform: none !important;  -webkit-transform: none !important;   transform: none !important;   -webkit-animation: none !important;   -moz-animation: none !important;   -o-animation: none !important;   -ms-animation: none !important;   animation: none !important;}';

			let expression;

			if(injectCss)
				expression = `(${addStyleContent.toString()})('${css}')`;

			if(!page){
				console.log('no page found');
				return false;
			}

			// get all console messages from client
			//page.on('console', msg => console.log(msg.text()));

			// Note: can't use page.addStyleTag due to github.com/GoogleChrome/puppeteer/issues/1955.
			// Do it ourselves.
			const client = await page.target().createCDPSession();
			await client.send('Runtime.evaluate', {
				expression: expression
			}).then(function(result){
				//console.log('Done Runtime.evaluate');
			}).catch(function(error){
				console.log('failed Runtime.evaluate');
				console.log(error);
			});
		}

		// Lighthouse will open URL. Puppeteer observes `targetchanged` and sets up network conditions.
		// Possible race condition.
		const {lhr, report} = await lighthouse(url, {
			port: (new URL(browser.wsEndpoint())).port,
			output: 'html',
			logLevel: 'silent', // 'info', 'silent', 'verbose'
		}).catch(function(error){
			console.log('failed lighthouse execution');
			console.log(error);
		});

		const performanceCat = lhr.categories.performance;
		const performanceSubCats = performanceCat.auditRefs.filter(r => r.weight > 0);

		if(program.table){
			if(!table){
				table = new Table({
					head: ['', 'Perf',
						...performanceSubCats.map(r => shortenedMetricNames[lhr.audits[r.id].title])
					],
					//colWidths: [100, 200]
				});
			}

			table.push([`Run ${i}`, performanceCat.score, ...performanceSubCats.map(r => lhr.audits[r.id].displayValue)])
		}
		else {
			// log main metrics
			console.log(`\nLighthouse score (Run ${i}):`);
			console.log(`${Object.values(lhr.categories).map(c => c.title + ': ' + c.score).join(', \n')}`);

			// log performance breakdown metrics (based on weight)
			console.log(performanceSubCats.map(r => '  ' + lhr.audits[r.id].title + ': ' + lhr.audits[r.id].displayValue).join('\n'));
		}

		if(!program.logOnly){
			try {
				fs.writeFileSync(`./report-${i}.html`, report);
				
				console.log('');
				console.log('Report saved to ', path.resolve(`./report-${i}.html`));
			} catch(e){
				console.log(e);
			}
		}

		await browser.close();
	}

	if(table)
		console.log(table.toString());
})();