# inject-before-lighthouse
The `inject-before-lighthouse` Command Line tool injects cookies and CSS on the fly before executing [Lighthouse](https://github.com/GoogleChrome/lighthouse).

Using [Puppeteer](https://github.com/puppeteer/puppeteer), a headful chrome browser is initiated with a mobile sized viewport, after setting the applicable cookies and injections Lighthouse will be executed on that page.

The resulted Lighthouse top level scores will be logged to the output and the full HTML report will be saved to the file system. This is controllable via the `--log-only` option so file system access is not required.

## Command Line Settings

Default run:
```
npm run start
```

##### `-u, --url <url>`
The URL of the page to be tested with Lighthouse.
```
npm run start -- --url https://github.com
```

##### `-c, --cookie [key=value pairs...]`
Sets a cookie (or cookies) on the page before executing Lighthouse.
```
npm run start -- --cookie name=value name2=value2
```

##### `-x, --css-no-animate`
Inject CSS to block any animation on the page before executing Lighthouse. This can be used to ignore performance issues caused by CSS animations or to compare non-animating page vs animating page.
```
npm run start -- --css-no-animate
```

##### `-r, --repeat <times>`
Repeats the Lighthouse execution multiple times, idealy to get an overall average of a fluctuating score.
```
npm run start -- --repeat 3
```

##### `-l, --log-only`
This prevents accessing the file system and will only log the top level score to the output.
```
npm run start -- --log-only
```

##### `-t, --table`
Log the results as a table where each test gets a new row. Using this option will only log the "performance" results in order to minimize the resulted table cells. This is useful with the `--repeat` option for easier analysis.
```
npm run start -- --table
```
