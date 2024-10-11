## Local Dev
```js
GitBookPDFSpider.create({
  // replace target gitbook url & name
  url: 'https://braydie.gitbooks.io/how-to-be-a-programmer/content/en/',
  bookName: 'How to be a programer.pdf'
}).then(spider => {
  spider.run();
});
```

```bash
node ./gitbook.js
```


## Generate PDF on Playwright Playground
1. Copy gibook.js content
2. open playwright playground: https://try.playwright.tech/?e=generate-pdf
3. replace GitBookPDFSpider.create config


## spider.run internal process
1. get all chapter links
2. fetch all chapters html content
3. beautify page, remove header and sidebar menu etc.

*try to modify [SITE_CONFIG](https://github.com/lufengd3/htmlbook2pdf/blob/main/gitbook.js#L4) to adapt to different gitbook site structure.*