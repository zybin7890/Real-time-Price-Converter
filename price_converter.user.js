// ==UserScript==
// @name         实时价格汇率换算器 (Real-time Price Converter - Ultra)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  扩展货币与网站支持，修复 Amazon / Firefox 兼容问题，支持自定义汇率更新时间间隔。
// @author       zybin
// @license      GPL-2.0
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.exchangerate-api.com
// @run-at       document-end
// ==/UserScript==

(function ()
{
    'use strict';

    const MARK_PROCESSED_ATTR = 'data-zybin-processed';
    const MARK_OWNED_ATTR     = 'data-zybin-owned';
    const ZERO_WIDTH_SPACE    = '\u200B';
    const DEFAULT_CACHE_MS    = 60 * 60 * 1000;
    const MIN_CACHE_MS        = 60 * 1000;

    const config =
    {
        targetCurrency: GM_getValue('targetCurrency', 'CNY'),
        textColor:      GM_getValue('textColor', 'green'),
        cacheTime:      clampCacheTime(GM_getValue('cacheTimeMs', DEFAULT_CACHE_MS)),
        debug:          GM_getValue('debug', false)
    };

    let exchangeRates = {};
    let mutationTimer = 0;

    function clampCacheTime(value)
    {
        const num = Number(value);

        if (!Number.isFinite(num) || num < MIN_CACHE_MS)
        {
            return DEFAULT_CACHE_MS;
        }

        return Math.round(num);
    }

    function log(...args)
    {
        if (config.debug)
        {
            console.log('[zybin-price-converter]', ...args);
        }
    }

    function getHost()
    {
        return location.hostname.toLowerCase();
    }

    function getLang()
    {
        return (document.documentElement.lang || '').toLowerCase();
    }

    function inferDefaultCurrencyByHost(host = getHost())
    {
        const lang = getLang();

        if (host.endsWith('.jp') || host.includes('amazon.co.jp') || host.includes('rakuten') || host.includes('yahoo.co.jp'))
        {
            return 'JPY';
        }

        if (host.endsWith('.cn') || host.includes('taobao') || host.includes('tmall') || host.includes('jd.com') || host.includes('1688.com'))
        {
            return 'CNY';
        }

        if (host.endsWith('.tw') || host.includes('shopee.tw') || host.includes('ruten'))
        {
            return 'TWD';
        }

        if (host.endsWith('.hk') || host.includes('shopee.hk'))
        {
            return 'HKD';
        }

        if (host.endsWith('.sg') || host.includes('shopee.sg'))
        {
            return 'SGD';
        }

        if (host.endsWith('.au') || host.includes('amazon.com.au'))
        {
            return 'AUD';
        }

        if (host.endsWith('.ca') || host.includes('amazon.ca'))
        {
            return 'CAD';
        }

        if (host.endsWith('.my') || host.includes('shopee.com.my') || lang.includes('ms'))
        {
            return 'MYR';
        }

        if (host.endsWith('.ph') || host.includes('shopee.ph'))
        {
            return 'PHP';
        }

        if (host.endsWith('.th') || host.includes('shopee.co.th'))
        {
            return 'THB';
        }

        if (host.endsWith('.vn') || host.includes('shopee.vn'))
        {
            return 'VND';
        }

        if (host.endsWith('.id') || host.includes('tokopedia') || host.includes('shopee.co.id'))
        {
            return 'IDR';
        }

        if (host.endsWith('.br'))
        {
            return 'BRL';
        }

        if (host.endsWith('.mx'))
        {
            return 'MXN';
        }

        if (host.endsWith('.tr'))
        {
            return 'TRY';
        }

        if (host.endsWith('.ae'))
        {
            return 'AED';
        }

        if (host.endsWith('.pl'))
        {
            return 'PLN';
        }

        if (host.endsWith('.cz'))
        {
            return 'CZK';
        }

        if (host.endsWith('.hu'))
        {
            return 'HUF';
        }

        if (host.endsWith('.ro'))
        {
            return 'RON';
        }

        if (host.endsWith('.ua'))
        {
            return 'UAH';
        }

        if (host.endsWith('.za'))
        {
            return 'ZAR';
        }

        if (host.endsWith('.no'))
        {
            return 'NOK';
        }

        if (host.endsWith('.dk'))
        {
            return 'DKK';
        }

        if (host.endsWith('.se'))
        {
            return 'SEK';
        }

        if (host.endsWith('.uk'))
        {
            return 'GBP';
        }

        if (host.endsWith('.eu') || host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.it') || host.endsWith('.es') || host.endsWith('.nl'))
        {
            return 'EUR';
        }

        return 'USD';
    }

    function detectContextCurrency(symbol)
    {
        if (symbol === '¥' || symbol === '￥')
        {
            const host = getHost();
            const lang = getLang();

            if (lang.includes('ja') || host.endsWith('.jp') || host.includes('rakuten') || host.includes('amazon.co.jp') || host.includes('yahoo.co.jp'))
            {
                return 'JPY';
            }

            if (lang.includes('zh') || host.endsWith('.cn') || host.includes('taobao') || host.includes('tmall') || host.includes('jd.com') || host.includes('1688.com'))
            {
                return 'CNY';
            }

            return 'JPY';
        }

        if (symbol === '$')
        {
            return inferDefaultCurrencyByHost();
        }

        if (symbol.toLowerCase() === 'kr')
        {
            const host = getHost();

            if (host.endsWith('.no'))
            {
                return 'NOK';
            }

            if (host.endsWith('.dk'))
            {
                return 'DKK';
            }

            return 'SEK';
        }

        return null;
    }

    const currencyMap =
    {
        '$':     detectContextCurrency('$'),
        'US$':   'USD',
        'HK$':   'HKD',
        'NT$':   'TWD',
        'S$':    'SGD',
        'A$':    'AUD',
        'AU$':   'AUD',
        'C$':    'CAD',
        'CA$':   'CAD',
        'NZ$':   'NZD',
        'R$':    'BRL',
        'MX$':   'MXN',
        'CHF':   'CHF',
        'Fr.':   'CHF',
        '€':     'EUR',
        '£':     'GBP',
        '¥':     detectContextCurrency('¥'),
        '￥':    detectContextCurrency('¥'),
        '₩':     'KRW',
        '₽':     'RUB',
        '₹':     'INR',
        '฿':     'THB',
        '₪':     'ILS',
        '₱':     'PHP',
        '₫':     'VND',
        '₴':     'UAH',
        '₺':     'TRY',
        'د.إ':   'AED',
        'RM':    'MYR',
        'Rp':    'IDR',
        'kr':    detectContextCurrency('kr'),
        'KR':    detectContextCurrency('kr'),
        'zł':    'PLN',
        'ZŁ':    'PLN',
        'Kč':    'CZK',
        'KČ':    'CZK',
        'Ft':    'HUF',
        'FT':    'HUF',
        'lei':   'RON',
        'LEI':   'RON',
        'грн':   'UAH',
        'ГРН':   'UAH',
        'R':     'ZAR',
        '円':    'JPY',
        '日元':  'JPY',
        '元':    'CNY',
        '块':    'CNY',
        '人民币': 'CNY',
        '台币':  'TWD',
        '新台币': 'TWD',
        '港币':  'HKD',
        '韩元':  'KRW',
        'USD':   'USD',
        'EUR':   'EUR',
        'GBP':   'GBP',
        'JPY':   'JPY',
        'CNY':   'CNY',
        'TWD':   'TWD',
        'HKD':   'HKD',
        'SGD':   'SGD',
        'AUD':   'AUD',
        'CAD':   'CAD',
        'NZD':   'NZD',
        'KRW':   'KRW',
        'RUB':   'RUB',
        'INR':   'INR',
        'THB':   'THB',
        'PHP':   'PHP',
        'MYR':   'MYR',
        'IDR':   'IDR',
        'VND':   'VND',
        'BRL':   'BRL',
        'MXN':   'MXN',
        'TRY':   'TRY',
        'AED':   'AED',
        'CHF':   'CHF',
        'SEK':   'SEK',
        'NOK':   'NOK',
        'DKK':   'DKK',
        'PLN':   'PLN',
        'CZK':   'CZK',
        'HUF':   'HUF',
        'RON':   'RON',
        'UAH':   'UAH',
        'ZAR':   'ZAR',
        'ILS':   'ILS'
    };

    const numPatternStr = '([0-9]{1,3}(?:[.,\\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)';

    const nonAlphaPrefixes =
        'US\\$|HK\\$|NT\\$|S\\$|A\\$|AU\\$|C\\$|CA\\$|NZ\\$|R\\$|MX\\$|Fr\\.|\\$|€|£|¥|￥|₩|₽|₹|฿|₪|₱|₫|₴|₺|د\\.إ';

    const alphaPrefixes =
        'AED|AUD|USD|EUR|GBP|JPY|CNY|TWD|HKD|SGD|CAD|NZD|KRW|RUB|INR|THB|PHP|MYR|IDR|VND|BRL|MXN|TRY|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|UAH|ZAR|ILS|RM|Rp';

    const nonAlphaSuffixes =
        '€|円|日元|元|块|人民币|台币|新台币|港币|韩元|zł|Kč|Ft|lei|грн|₽|₩|₫|₴|₺';

    const alphaSuffixes =
        'AED|AUD|USD|EUR|GBP|JPY|CNY|TWD|HKD|SGD|CAD|NZD|KRW|RUB|INR|THB|PHP|MYR|IDR|VND|BRL|MXN|TRY|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|UAH|ZAR|ILS|kr|RM|Rp';

    const prefixSymbolsStr = `(${nonAlphaPrefixes}|(?:(?<![a-zA-Z])(?:${alphaPrefixes})(?![a-zA-Z])))`;
    const suffixSymbolsStr = `(${nonAlphaSuffixes}|(?:(?<![a-zA-Z])(?:${alphaSuffixes})(?![a-zA-Z])))`;

    const priceRegex = new RegExp(
        `(?:${prefixSymbolsStr}\\s*${numPatternStr})|(?:${numPatternStr}\\s*${suffixSymbolsStr})`,
        'gi'
    );

    const isolatedSymbolRegex = new RegExp(`^[\\s\\n]*${prefixSymbolsStr}[\\s\\n]*$`, 'i');
    const isolatedNumRegex    = new RegExp(`^[\\s\\n]*${numPatternStr}[\\s\\n]*$`, 'i');
    const isolatedSuffixRegex = new RegExp(`^[\\s\\n]*${suffixSymbolsStr}[\\s\\n]*$`, 'i');
    const bareNumberRegex     = new RegExp(numPatternStr, 'i');

    const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'OPTION', 'SVG', 'CANVAS']);

    function parsePriceValue(priceStr)
    {
        const cleanStr = String(priceStr).replace(/\s+/g, '');

        if (/.*\d\.\d{3},\d{1,2}$/.test(cleanStr) || /^\d+,\d{1,2}$/.test(cleanStr))
        {
            return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
        }

        return parseFloat(cleanStr.replace(/,/g, ''));
    }

    function formatDurationForPrompt(ms)
    {
        const minutes = ms / 60000;

        if (minutes % 1440 === 0)
        {
            return `${minutes / 1440}d`;
        }

        if (minutes % 60 === 0)
        {
            return `${minutes / 60}h`;
        }

        return `${minutes}m`;
    }

    function formatDurationForDisplay(ms)
    {
        const minutes = ms / 60000;

        if (minutes % 1440 === 0)
        {
            return `${minutes / 1440} 天`;
        }

        if (minutes % 60 === 0)
        {
            return `${minutes / 60} 小时`;
        }

        return `${minutes} 分钟`;
    }

    function parseDurationInput(input)
    {
        if (typeof input !== 'string')
        {
            return null;
        }

        const trimmed = input.trim();

        if (!trimmed)
        {
            return null;
        }

        const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([mhdMHD]?)$/);

        if (!match)
        {
            return null;
        }

        const value = Number(match[1]);
        const unit  = (match[2] || 'm').toLowerCase();

        if (!Number.isFinite(value) || value <= 0)
        {
            return null;
        }

        if (unit === 'm')
        {
            return Math.round(value * 60 * 1000);
        }

        if (unit === 'h')
        {
            return Math.round(value * 60 * 60 * 1000);
        }

        if (unit === 'd')
        {
            return Math.round(value * 24 * 60 * 60 * 1000);
        }

        return null;
    }

    function getCurrencyAndPrice(matchObj)
    {
        const rawSymbol = matchObj[1] || matchObj[4];
        const rawPrice  = matchObj[2] || matchObj[3];

        if (!rawSymbol || !rawPrice)
        {
            return null;
        }

        let baseCurrency = currencyMap[rawSymbol] || currencyMap[rawSymbol.toUpperCase()];

        if (!baseCurrency && rawSymbol.toLowerCase() === 'kr')
        {
            baseCurrency = detectContextCurrency('kr');
        }

        if (!baseCurrency)
        {
            return null;
        }

        return {
            rawSymbol,
            rawPrice,
            baseCurrency
        };
    }

    function createBadge(converted, baseCurrency, originalPrice)
    {
        const badge = document.createElement('span');
        badge.className = 'zybin-converted-price';
        badge.setAttribute(MARK_OWNED_ATTR, 'true');
        badge.style.cssText =
            `color: ${config.textColor} !important; ` +
            'font-weight: bold !important; ' +
            'margin-left: 4px !important; ' +
            'font-size: 14px !important; ' +
            'display: inline-block !important;';

        badge.textContent = `(${converted.toFixed(2)} ${config.targetCurrency})`;
        badge.title = `${originalPrice} ${baseCurrency} -> ${converted.toFixed(2)} ${config.targetCurrency}`;

        return badge;
    }

    function injectBadge(targetNode, matchObj, textContainer, insertAfterTarget = false)
    {
        const parsed = getCurrencyAndPrice(matchObj);

        if (!parsed)
        {
            return false;
        }

        const { rawPrice, baseCurrency } = parsed;

        if (!exchangeRates[baseCurrency] ||
            !exchangeRates[config.targetCurrency] ||
            baseCurrency === config.targetCurrency)
        {
            return false;
        }

        const priceVal = parsePriceValue(rawPrice);

        if (!Number.isFinite(priceVal))
        {
            return false;
        }

        const rateToUSD  = exchangeRates[baseCurrency];
        const targetRate = exchangeRates[config.targetCurrency];
        const converted  = (priceVal / rateToUSD) * targetRate;

        if (!Number.isFinite(converted))
        {
            return false;
        }

        if (textContainer && textContainer.nodeType === Node.TEXT_NODE)
        {
            textContainer.nodeValue = ZERO_WIDTH_SPACE + textContainer.nodeValue;
        }
        else if (textContainer && textContainer.nodeType === Node.ELEMENT_NODE)
        {
            textContainer.textContent = ZERO_WIDTH_SPACE + textContainer.textContent;
        }

        const badge = createBadge(converted, baseCurrency, priceVal);

        if (targetNode && targetNode.parentNode)
        {
            targetNode.parentNode.insertBefore(badge, targetNode.nextSibling);
            targetNode.setAttribute(MARK_PROCESSED_ATTR, 'true');
            log('badge inserted', { baseCurrency, priceVal, converted, targetNode });
            return true;
        }

        return false;
    }

    function getFirstTextElement(node, selectors)
    {
        if (!node || !Array.isArray(selectors))
        {
            return null;
        }

        for (const selector of selectors)
        {
            const element = node.querySelector(selector);

            if (element && element.textContent && element.textContent.trim())
            {
                return element;
            }
        }

        return null;
    }

    function buildPseudoMatchForForcedCurrency(text, forcedCurrency)
    {
        const numberMatch = String(text).match(bareNumberRegex);

        if (!numberMatch)
        {
            return null;
        }

        return [null, forcedCurrency, numberMatch[1], null, null];
    }

    function matchPriceText(text, forcedCurrency = null)
    {
        const normalizedText = String(text || '').trim();

        if (!normalizedText || normalizedText.includes(ZERO_WIDTH_SPACE))
        {
            return null;
        }

        priceRegex.lastIndex = 0;
        const directMatch = priceRegex.exec(normalizedText);

        if (directMatch)
        {
            return directMatch;
        }

        if (forcedCurrency)
        {
            return buildPseudoMatchForForcedCurrency(normalizedText, forcedCurrency);
        }

        return null;
    }

    function processPriceNode(node, options = {})
    {
        if (!node || node.getAttribute(MARK_PROCESSED_ATTR) === 'true')
        {
            return;
        }

        const textCarrier = options.textSelectors ? getFirstTextElement(node, options.textSelectors) : node;
        const text = textCarrier ? textCarrier.textContent : node.textContent;
        const forcedCurrency = options.forcedCurrency || null;
        const match = matchPriceText(text, forcedCurrency);

        if (match)
        {
            injectBadge(node, match, textCarrier || node, Boolean(options.insertAfterTarget));
            return;
        }

        node.setAttribute(MARK_PROCESSED_ATTR, 'true');
    }

    const siteRules =
    [
        {
            name:     'Amazon Global',
            match:    () => getHost().includes('amazon.'),
            selector: '.a-price',
            process:  (node) =>
            {
                processPriceNode(node,
                {
                    textSelectors:      ['.a-offscreen', '[aria-hidden="true"]'],
                    insertAfterTarget:  true
                });
            }
        },
        {
            name:     'Steam',
            match:    () => getHost().includes('steampowered.com'),
            selector: '.discount_final_price, .game_purchase_price, .salepreviewwidgets_StoreSalePriceBox_Wh0L8',
            process:  (node) => processPriceNode(node)
        },
        {
            name:     'eBay',
            match:    () => getHost().includes('ebay.'),
            selector: '.x-price-primary, .display-price, .notranslate',
            process:  (node) => processPriceNode(node)
        },
        {
            name:     'AliExpress',
            match:    () => getHost().includes('aliexpress.'),
            selector: '.snow-price_SnowPrice__mainS, .price--currentPriceText--V8_y_b5, .product-price-current',
            process:  (node) => processPriceNode(node)
        },
        {
            name:     'Shopee',
            match:    () => getHost().includes('shopee.'),
            selector: '[class*="price"], [class*="Price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: inferDefaultCurrencyByHost() })
        },
        {
            name:     'Taobao / Tmall',
            match:    () => getHost().includes('taobao.com') || getHost().includes('tmall.com'),
            selector: '.price, .tb-rmb-num, .tm-price, [class*="Price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: 'CNY' })
        },
        {
            name:     'JD',
            match:    () => getHost().includes('jd.com') || getHost().includes('3.cn'),
            selector: '.price, .p-price, [class*="price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: 'CNY' })
        },
        {
            name:     'Newegg',
            match:    () => getHost().includes('newegg.'),
            selector: '.price-current, .price-current-label, .price-current strong, .is-bold',
            process:  (node) => processPriceNode(node, { forcedCurrency: inferDefaultCurrencyByHost() })
        },
        {
            name:     'BestBuy',
            match:    () => getHost().includes('bestbuy.'),
            selector: '.priceView-customer-price, .pricing-price__range, [class*="priceView"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: inferDefaultCurrencyByHost() })
        },
        {
            name:     'Walmart',
            match:    () => getHost().includes('walmart.'),
            selector: '[itemprop="price"], .price-characteristic, [data-automation-id="product-price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: inferDefaultCurrencyByHost() })
        },
        {
            name:     'Target',
            match:    () => getHost().includes('target.'),
            selector: '[data-test="product-price"], [class*="CurrentPrice"], [class*="Price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: inferDefaultCurrencyByHost() })
        },
        {
            name:     'Rakuten',
            match:    () => getHost().includes('rakuten.'),
            selector: '.price2, .price, .price-taxin, [class*="price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: 'JPY' })
        },
        {
            name:     'Yahoo Shopping Japan',
            match:    () => getHost().includes('shopping.yahoo.co.jp'),
            selector: '.Price__value, .elPriceValue, .price, [class*="Price"]',
            process:  (node) => processPriceNode(node, { forcedCurrency: 'JPY' })
        }
    ];

    const currentSiteRules = siteRules.filter((rule) => rule.match());

    function getNextNonEmptyTextNode(startNode, maxSteps = 5)
    {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        walker.currentNode = startNode;

        let next;
        let steps = 0;

        while ((next = walker.nextNode()) && steps < maxSteps)
        {
            steps++;

            if (next.nodeValue.trim() !== '' && !next.nodeValue.includes(ZERO_WIDTH_SPACE))
            {
                return next;
            }
        }

        return null;
    }

    function processTextNode(node)
    {
        const text = node.nodeValue;

        if (!text || text.includes(ZERO_WIDTH_SPACE))
        {
            return;
        }

        const isolatedPrefixMatch = text.match(isolatedSymbolRegex);

        if (isolatedPrefixMatch)
        {
            const nextTextNode = getNextNonEmptyTextNode(node);

            if (nextTextNode && isolatedNumRegex.test(nextTextNode.nodeValue))
            {
                const symbolMatch = text.match(isolatedSymbolRegex);
                const priceMatch  = nextTextNode.nodeValue.match(isolatedNumRegex);

                if (symbolMatch && priceMatch)
                {
                    const pseudoMatch = [null, symbolMatch[1], priceMatch[1], null, null];
                    injectBadge(nextTextNode, pseudoMatch, nextTextNode, false);
                    return;
                }
            }
        }

        const isolatedNumMatch = text.match(isolatedNumRegex);

        if (isolatedNumMatch)
        {
            const nextTextNode = getNextNonEmptyTextNode(node);

            if (nextTextNode && isolatedSuffixRegex.test(nextTextNode.nodeValue))
            {
                const priceMatch  = text.match(isolatedNumRegex);
                const symbolMatch = nextTextNode.nodeValue.match(isolatedSuffixRegex);

                if (priceMatch && symbolMatch)
                {
                    const pseudoMatch = [null, null, null, priceMatch[1], symbolMatch[1]];
                    injectBadge(nextTextNode, pseudoMatch, nextTextNode, false);
                    return;
                }
            }
        }

        priceRegex.lastIndex = 0;

        if (!priceRegex.test(text))
        {
            return;
        }

        priceRegex.lastIndex = 0;

        let match;
        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        while ((match = priceRegex.exec(text)) !== null)
        {
            const parsed = getCurrencyAndPrice(match);
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

            if (parsed &&
                exchangeRates[parsed.baseCurrency] &&
                exchangeRates[config.targetCurrency] &&
                parsed.baseCurrency !== config.targetCurrency)
            {
                const priceVal   = parsePriceValue(parsed.rawPrice);
                const rateToUSD  = exchangeRates[parsed.baseCurrency];
                const targetRate = exchangeRates[config.targetCurrency];
                const converted  = (priceVal / rateToUSD) * targetRate;

                if (Number.isFinite(converted))
                {
                    const wrapper = document.createElement('span');
                    wrapper.className = 'zybin-price-wrapper';
                    wrapper.setAttribute(MARK_OWNED_ATTR, 'true');

                    wrapper.appendChild(
                        document.createTextNode(match[0].replace(parsed.rawPrice, ZERO_WIDTH_SPACE + parsed.rawPrice))
                    );

                    wrapper.appendChild(createBadge(converted, parsed.baseCurrency, priceVal));
                    fragment.appendChild(wrapper);
                }
                else
                {
                    fragment.appendChild(document.createTextNode(match[0]));
                }
            }
            else
            {
                fragment.appendChild(document.createTextNode(match[0]));
            }

            lastIndex = priceRegex.lastIndex;
        }

        if (lastIndex < text.length)
        {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        if (node.parentNode)
        {
            node.parentNode.replaceChild(fragment, node);
        }
    }

    function walkDOM(node)
    {
        if (!node)
        {
            return;
        }

        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
        {
            Array.from(node.childNodes).forEach(walkDOM);
            return;
        }

        if (node.shadowRoot)
        {
            walkDOM(node.shadowRoot);
        }

        if (node.nodeType === Node.ELEMENT_NODE)
        {
            if (node.getAttribute(MARK_OWNED_ATTR) === 'true')
            {
                return;
            }

            let handledByRule = false;

            for (const rule of currentSiteRules)
            {
                if (node.matches && node.matches(rule.selector))
                {
                    try
                    {
                        rule.process(node);
                    }
                    catch (err)
                    {
                        log('rule process error', rule.name, err);
                    }

                    handledByRule = true;
                    break;
                }
            }

            if (handledByRule)
            {
                return;
            }

            const tagName = node.tagName ? node.tagName.toUpperCase() : '';

            if (!EXCLUDED_TAGS.has(tagName))
            {
                Array.from(node.childNodes).forEach(walkDOM);
            }

            return;
        }

        if (node.nodeType === Node.TEXT_NODE)
        {
            processTextNode(node);
        }
    }

    function observeMutations()
    {
        const observer = new MutationObserver((mutations) =>
        {
            let shouldProcess = false;

            for (const mutation of mutations)
            {
                for (const added of mutation.addedNodes)
                {
                    if (added.nodeType === Node.ELEMENT_NODE)
                    {
                        if (added.getAttribute && added.getAttribute(MARK_OWNED_ATTR) === 'true')
                        {
                            continue;
                        }
                    }

                    shouldProcess = true;
                    break;
                }

                if (shouldProcess)
                {
                    break;
                }
            }

            if (!shouldProcess)
            {
                return;
            }

            clearTimeout(mutationTimer);
            mutationTimer = window.setTimeout(() =>
            {
                walkDOM(document.body);
            }, 250);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function registerMenuCommands()
    {
        GM_registerMenuCommand(`⚙️ 设置目标货币 (当前: ${config.targetCurrency})`, () =>
        {
            const currency = prompt(
                '请输入 3 位目标货币代码，例如 CNY、USD、JPY、TWD、EUR：',
                config.targetCurrency
            );

            if (currency && currency.trim().length === 3)
            {
                GM_setValue('targetCurrency', currency.toUpperCase().trim());
                location.reload();
            }
        });

        GM_registerMenuCommand(`🎨 设置价格颜色 (当前: ${config.textColor})`, () =>
        {
            const color = prompt(
                '请输入 CSS 颜色值，例如 green、red、#00ff00：',
                config.textColor
            );

            if (color)
            {
                GM_setValue('textColor', color.trim());
                location.reload();
            }
        });

        GM_registerMenuCommand(`⏱️ 设置更新时间间隔 (当前: ${formatDurationForDisplay(config.cacheTime)})`, () =>
        {
            const input = prompt(
                '请输入汇率更新时间间隔，例如 10、30m、2h、1d：',
                formatDurationForPrompt(config.cacheTime)
            );

            if (input === null)
            {
                return;
            }

            const ms = parseDurationInput(input);

            if (!ms)
            {
                alert('输入无效，请输入例如 10、30m、2h 或 1d。');
                return;
            }

            const cacheTimeMs = clampCacheTime(ms);
            GM_setValue('cacheTimeMs', cacheTimeMs);
            alert(`已设置汇率更新时间间隔为 ${formatDurationForDisplay(cacheTimeMs)}，刷新页面后生效。`);
            location.reload();
        });

        GM_registerMenuCommand(`🪵 调试日志 (当前: ${config.debug ? '开' : '关'})`, () =>
        {
            GM_setValue('debug', !config.debug);
            location.reload();
        });
    }

    function useCachedRatesIfAvailable(now)
    {
        const cachedData = GM_getValue('ratesCache', null);

        if (!cachedData || !cachedData.rates)
        {
            return false;
        }

        if (now - cachedData.timestamp >= config.cacheTime)
        {
            return false;
        }

        if (!cachedData.rates[config.targetCurrency])
        {
            return false;
        }

        exchangeRates = cachedData.rates;
        return true;
    }

    function fetchRates(now)
    {
        GM_xmlhttpRequest(
        {
            method: 'GET',
            url:    'https://api.exchangerate-api.com/v4/latest/USD',
            onload: function (response)
            {
                if (response.status !== 200)
                {
                    log('rate request failed', response.status);
                    return;
                }

                let data = null;

                try
                {
                    data = JSON.parse(response.responseText);
                }
                catch (err)
                {
                    log('rate parse error', err);
                    return;
                }

                if (!data || !data.rates)
                {
                    log('invalid rate data');
                    return;
                }

                exchangeRates = data.rates;
                GM_setValue('ratesCache', { timestamp: now, rates: exchangeRates });
                walkDOM(document.body);
                observeMutations();
            },
            onerror: function (err)
            {
                log('rate request error', err);
            }
        });
    }

    function init()
    {
        const now = Date.now();

        registerMenuCommands();
        log('site rules active', currentSiteRules.map((item) => item.name));

        if (useCachedRatesIfAvailable(now))
        {
            walkDOM(document.body);
            observeMutations();
            return;
        }

        fetchRates(now);
    }

    init();
})();
