const { chromium, devices } = require('playwright');

class GitBookPDFSpider {
  constructor({browser, page, pageConfig, url, bookName}) {
    this._browser = browser;
    this._mainPage = page;
    this._pageConfig = pageConfig;
    this._bookUrl = url;
    this._bookName = bookName;
  }

  static async create({url, bookName, isMobile = true}) {
    const browser = await chromium.launch();
    const pageConfig = isMobile ? devices['iPhone 14'] : devices['Desktop Chrome'];
    const page = await browser.newPage(pageConfig);

    return new GitBookPDFSpider({browser, page, pageConfig, url, bookName});
  }

  async run() {
    await this._openMainPage();
    const chaptersMetaInfo = await this._getChaptersMetaInfo();
    // console.log(chaptersMetaInfo);
    const chaptersHTMLContent = await this._fetchAllChaptersHTMLContent(chaptersMetaInfo);
    await this._beautifyMainPage(chaptersMetaInfo);
    await this._generateFullHTMLPage(chaptersHTMLContent);
    await this._mainPage.pdf({ path: this._bookName, format: 'A4' });
    await this._browser.close();
  }

  _openMainPage = async () => {
    console.log('open url', this._bookUrl);
    await this._mainPage.goto(this._bookUrl);
    await this._mainPage.waitForLoadState('domcontentloaded');
  }

  // hide left menu; add pdf chapter link
  _beautifyMainPage = async (chaptersMetaInfo = []) => {
    console.log('beautify MainPage')
    const res = await this._mainPage.evaluate((chaptersMetaInfo = []) => {
      try {
        document.querySelector('.book-summary').remove();
        document.querySelector('.book-header').remove();
        document.querySelector('.navigation-next').remove();
      } catch (e) {
        console.error('remove elm error', e);
      }
      document.querySelector('.book-body').style.position = 'static';
      const pdfMenu = document.createElement('div');
      pdfMenu.style.fontSize = '16px';
      pdfMenu.style.padding = '20px 48px';
      chaptersMetaInfo.forEach((chapter, index) => {
        const {title, id} = chapter;
        const chapterLink = document.createElement('a');
        chapterLink.textContent = `${index}. ${title}`;

        const chapterLinkContainer = document.createElement('div');
        chapterLinkContainer.style.margin = '4px 18px';
        chapterLinkContainer.appendChild(chapterLink);
        pdfMenu.appendChild(chapterLinkContainer);
      });

      const bookContainer = document.querySelector('.book-body .page-inner');
      const bookStartElm = document.querySelector('.book-body #book-search-results');
      bookContainer.insertBefore(pdfMenu, bookStartElm);

      return pdfMenu.innerHTML;
    }, chaptersMetaInfo);
  }

  // {url, title, id}
  _getChaptersMetaInfo = async () => {
    console.log('get Chapters MetaInfo');

    return this._mainPage.evaluate(() => {
      const res = [];
      const bodyElm = document.querySelector('.book-body');
      if (bodyElm) {
        bodyElm.style.position = 'relative';
      }

      const linksElm = document.querySelectorAll('.summary li.chapter>a');
      linksElm.forEach((link, index) => {
        link.href && res.push({
          url: link.href,
          title: link.textContent.trim() || 'UnTitled',
          id: `pdfchapter_${index}`
        });
      });

      return res;
    });
  }

  _fetchAllChaptersHTMLContent = async (chaptersMetaInfo = []) => {
    const chaptersContents = [];
    if (chaptersMetaInfo.length) {
      const newPage = await this._browser.newPage(this._pageConfig);
      // const testPages = chaptersMetaInfo.slice(1, 3);
      // for (let {url} of testPages) {
      for (let {url} of chaptersMetaInfo) {
        const contentElm = await this._openURLAndPickHTMLStr(newPage, url);
        contentElm && chaptersContents.push(contentElm);
      }
      await newPage.close();
    }

    return chaptersContents;
  }

  _openURLAndPickHTMLStr = async (page, url) => {
    console.log('open sub page', url);
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      const bodyElm = document.querySelector('.book-body');
      if (bodyElm) {
        bodyElm.style.position = 'relative';
      }
    });
    const bookContent = await page.$('#book-search-results');
    const bookContentHTML = bookContent ? await page.evaluate((bookContent) => bookContent.outerHTML, bookContent) : null;
    // console.log(bookContentHTML)

    return bookContentHTML;
  }

  _generateFullHTMLPage = async (chaptersHTMLContent = []) => {
    if (chaptersHTMLContent.length) {
      await this._mainPage.evaluate((htmlStrList) => {
        const bodyElm = document.querySelector('.book-body .page-inner');
        htmlStrList.forEach((htmlStr) => {
          const container = document.createElement('div');
          container.innerHTML = htmlStr;
          container.style.marginTop = '800px';
          container.style.paddingTop = '40px';
          bodyElm.appendChild(container);
        });
      }, chaptersHTMLContent);
    }
  }

}

GitBookPDFSpider.create({
  url: 'https://braydie.gitbooks.io/how-to-be-a-programmer/content/en/',
  bookName: 'How to be a programer.pdf'
}).then(spider => {
  spider.run();
});