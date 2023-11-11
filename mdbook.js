const { chromium, devices } = require('playwright');

const SITE_CONFIG = {
  bodySelector: '.page',
  chapterLinksElmSelector: '#sidebar .chapter-item a:not(.active)',
  bookContentSelector: '#content',
  chapterAppendSelector: '#content',
  headerSelector: '#menu-bar',
  navNextSelector: '.nav-wrapper',
  sideBarSelector: '#sidebar',
  menuContainerSelector: '#content',
  menuNextElmSelector: '#content main',
};

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
    // const pageConfig = isMobile ? devices['iPhone 14'] : devices['Desktop Chrome'];
    const pageConfig = {};
    const page = await browser.newPage();
    

    return new GitBookPDFSpider({browser, page, pageConfig, url, bookName});
  }

  async run() {
    await this._openMainPage();
    const chaptersMetaInfo = await this._getChaptersMetaInfo();
    console.log('chaptersMetaInfo', chaptersMetaInfo);
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
    const res = await this._mainPage.evaluate(({chaptersMetaInfo = [], SITE_CONFIG}) => {
      // for gitbook
      const bodyElm = document.querySelector(SITE_CONFIG.bodySelector);
      if (bodyElm) {
        bodyElm.style.position = 'static';
      }
      // for rustbook
      document.documentElement.style.setProperty('--sidebar-width', '0');
      try {
        document.querySelector(SITE_CONFIG.sideBarSelector).remove();
        document.querySelector(SITE_CONFIG.headerSelector).remove();
        document.querySelector(SITE_CONFIG.navNextSelector).remove();
      } catch (e) {
        console.error('remove elm error', e);
      }
      const pdfMenu = document.createElement('div');
      pdfMenu.style.fontSize = '16px';
      pdfMenu.style.padding = '2px 48px';
      pdfMenu.style.marginBottom = '600px';
      chaptersMetaInfo.forEach((chapter, index) => {
        const {title, id} = chapter;
        const chapterLink = document.createElement('a');
        chapterLink.textContent = `${index}. ${title}`;

        const chapterLinkContainer = document.createElement('div');
        chapterLinkContainer.style.margin = '4px 18px';
        chapterLinkContainer.appendChild(chapterLink);
        pdfMenu.appendChild(chapterLinkContainer);
      });

      const bookContainer = document.querySelector(SITE_CONFIG.menuContainerSelector);
      const bookStartElm = document.querySelector(SITE_CONFIG.menuNextElmSelector);
      bookContainer.insertBefore(pdfMenu, bookStartElm);

      return pdfMenu.innerHTML;
    }, {chaptersMetaInfo, SITE_CONFIG});
  }

  // {url, title, id}
  _getChaptersMetaInfo = async () => {
    console.log('get Chapters MetaInfo');

    return this._mainPage.evaluate((SITE_CONFIG) => {
      const res = [];
      const linksElm = document.querySelectorAll(SITE_CONFIG.chapterLinksElmSelector);
      linksElm.forEach((link, index) => {
        link.href && res.push({
          url: link.href,
          title: link.textContent.trim() || 'UnTitled',
          id: `pdfchapter_${index}`
        });
      });

      return res;
    }, SITE_CONFIG);
  }

  _fetchAllChaptersHTMLContent = async (chaptersMetaInfo = []) => {
    const chaptersContents = [];
    if (chaptersMetaInfo.length) {
      const newPage = await this._browser.newPage();
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
    await page.evaluate((SITE_CONFIG) => {
      const bodyElm = document.querySelector(SITE_CONFIG.bodySelector);
      if (bodyElm) {
        bodyElm.style.position = 'relative';
      }
    }, SITE_CONFIG);
    const bookContent = await page.$(SITE_CONFIG.bookContentSelector);
    const bookContentHTML = bookContent ? await page.evaluate((bookContent) => bookContent.outerHTML, bookContent) : null;
    // console.log(bookContentHTML)

    return bookContentHTML;
  }

  _generateFullHTMLPage = async (chaptersHTMLContent = []) => {
    if (chaptersHTMLContent.length) {
      await this._mainPage.evaluate(({chaptersHTMLContent, SITE_CONFIG}) => {
        const bodyElm = document.querySelector(SITE_CONFIG.chapterAppendSelector);
        chaptersHTMLContent.forEach((htmlStr) => {
          const container = document.createElement('div');
          container.innerHTML = htmlStr;
          container.style.marginTop = '800px';
          container.style.paddingTop = '40px';
          bodyElm.appendChild(container);
        });
      }, {chaptersHTMLContent, SITE_CONFIG});
    }
  }

}

GitBookPDFSpider.create({
  url: 'https://rust-lang.github.io/mdBook/',
  bookName: 'mdBook.pdf',
}).then(spider => {
  spider.run();
});