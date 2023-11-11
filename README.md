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
node ./gitbook.js


## Generate PDF on Playwright Playground
https://try.playwright.tech/?e=generate-pdf