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