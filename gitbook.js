const { chromium, devices } = require('playwright');

/** legacy config, for old gitbook */
const SITE_CONFIG = {
  // for step 1, get all chapter links
  chapterLinksElmSelector: '.summary li.chapter>a',

  // for step 2, fetch all chapters html content
  // bodySelector is optional, just for beautify
  bodySelector: '.book-body',
  // bookContentSelector is important, it's the container of each chapter content
  bookContentSelector: '#book-search-results',

  // for step 3, beautify page, remove header and sidebar menu etc.
  headerSelector: '.book-header',
  navNextSelector: '.navigation-next',
  sideBarSelector: '.book-summary',
}

/**
 * url: 'https://docs.facefusion.io/',
 * bookName: 'FaceFusion.pdf',
 */
// const SITE_CONFIG = {
//   chapterLinksElmSelector: 'body > div > div > aside > div > ul a',
//   bookContentSelector: 'main',
//   headerSelector: 'header',
// }

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
    const pdfMenuHTML = await this._generatePDFMenuHTML(chaptersMetaInfo);
    await this._beautifyMainPage(chaptersMetaInfo);
    await this._generateFullHTMLPage(chaptersHTMLContent, pdfMenuHTML);
    await this._mainPage.pdf({ path: this._bookName, format: 'A4' });
    await this._browser.close();
  }

  _openMainPage = async () => {
    console.log('open url', this._bookUrl);
    await this._mainPage.goto(this._bookUrl);
    await this._mainPage.waitForLoadState('domcontentloaded');
  }

  _generatePDFMenuHTML = async (chaptersMetaInfo = []) => {
    return this._mainPage.evaluate(({chaptersMetaInfo = [], SITE_CONFIG}) => {
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

      return pdfMenu.innerHTML;
    }, {chaptersMetaInfo, SITE_CONFIG});
  }

  // hide left menu; add pdf chapter link
  _beautifyMainPage = async (chaptersMetaInfo = []) => {
    console.log('beautify MainPage...')
    await this._mainPage.evaluate(({chaptersMetaInfo = [], SITE_CONFIG}) => {
      // for gitbook
      const bodyElm = document.querySelector(SITE_CONFIG.bodySelector);
      if (bodyElm) {
        bodyElm.style.position = 'static';
      }
      // for rustbook
      document.documentElement.style.setProperty('--sidebar-width', '0');

      const sideBarElm = document.querySelector(SITE_CONFIG.sideBarSelector);
      sideBarElm && sideBarElm.remove();

      const headerElm = document.querySelector(SITE_CONFIG.headerSelector);
      headerElm && headerElm.remove();

      const navNextElm = document.querySelector(SITE_CONFIG.navNextSelector);
      navNextElm && navNextElm.remove();
    }, {chaptersMetaInfo, SITE_CONFIG});
  }

  // {url, title, id}
  _getChaptersMetaInfo = async () => {
    console.log('get Chapters MetaInfo');

    return this._mainPage.evaluate((SITE_CONFIG) => {
      const res = [];
      const linksElm = document.querySelectorAll(SITE_CONFIG.chapterLinksElmSelector);
      if (!linksElm) {
        throw new Error('Can not find chapter links, try to modify SITE_CONFIG.chapterLinksElmSelector');
      }
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

  _generateFullHTMLPage = async (chaptersHTMLContent = [], pdfMenuHTML = '') => {
    if (!chaptersHTMLContent.length) return;

    await this._mainPage.evaluate(({chaptersHTMLContent, pdfMenuHTML, SITE_CONFIG}) => {
      const bodyElm = document.querySelector(SITE_CONFIG.bookContentSelector);
      bodyElm.innerHTML = '';
      bodyElm.appendChild(document.createElement('div')).innerHTML = pdfMenuHTML;
      
      chaptersHTMLContent.forEach((htmlStr) => {
        const container = document.createElement('div');
        container.innerHTML = htmlStr;
        container.style.marginTop = '800px';
        container.style.paddingTop = '40px';
        bodyElm.appendChild(container);
      });
    }, {chaptersHTMLContent, pdfMenuHTML, SITE_CONFIG});
  }

}

GitBookPDFSpider.create({
  url: 'https://braydie.gitbooks.io/how-to-be-a-programmer/content/en/',
  bookName: 'How to be a programer.pdf',
}).then(spider => {
  spider.run();
});