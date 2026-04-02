// ==UserScript==
// @name         Real-time Price Converter
// @name:zh-CN   实时价格汇率换算器
// @name:en      Real-time Price Converter
// @namespace    https://greasyfork.org/scripts/572072
// @version      4.1.1
// @description  Detect prices on shopping websites and show converted values in real time.
// @description:zh-CN 在购物网站上识别价格，并实时显示目标货币换算结果。
// @description:en Detect prices on shopping websites and show converted values in real time.
// @author       zybin
// @license      GPL-3.0-only
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      open.er-api.com
// @downloadURL  https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.user.js
// @updateURL    https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.meta.js
// ==/UserScript==

(function ()
{
    'use strict';

    // ================= 1. Config =================
    const DEFAULT_CACHE_MS = 24 * 60 * 60 * 1000;

    const config =
    {
        targetCurrency: GM_getValue('targetCurrency', 'CNY'),
        textColor:      GM_getValue('textColor', '#3fb950'),
        cacheTime:      GM_getValue('cacheTimeMs', DEFAULT_CACHE_MS),
        debug:          GM_getValue('debug', false),
        language:       GM_getValue('language', 'auto')
    };

    let exchangeRates = {};
    let siteRules     = [];

    // ================= 2. I18N =================
    function detectBrowserLanguage()
    {
        const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();

        if (lang.startsWith('zh'))
        {
            return 'zh-CN';
        }

        return 'en';
    }

    function getCurrentLanguage()
    {
        if (config.language === 'auto')
        {
            return detectBrowserLanguage();
        }

        return config.language;
    }

    const i18n =
    {
        'zh-CN':
        {
            language_option_auto: '跟随浏览器',
            language_option_zh:   '简体中文',
            language_option_en:   'English',

            debug_on:             '开',
            debug_off:            '关',

            menu_set_currency:    '⚙️ 设置目标货币 (当前: {currency})',
            menu_set_color:       '🎨 设置价格颜色 (当前: {color})',
            menu_set_cache:       '⏱️ 设置更新时间间隔 (当前: {interval})',
            menu_set_language:    '🌐 设置界面语言 (当前: {language})',
            menu_toggle_debug:    '🪵 调试日志 (当前: {state})',

            prompt_currency:      '请输入 3 位目标货币代码，例如: CNY, USD, JPY, TWD, EUR',
            prompt_color:         '请输入 CSS 颜色值，例如: #3fb950, green, #00ff00',
            prompt_cache:         '请输入汇率更新时间间隔，支持以下格式:\n\n10   = 10 分钟\n30m  = 30 分钟\n2h   = 2 小时\n1d   = 1 天',
            prompt_language:      '请输入界面语言:\n\nauto = 跟随浏览器\nzh   = 简体中文\nen   = English',

            alert_invalid_currency: '请输入有效的 3 位货币代码。',
            alert_invalid_cache:    '请输入有效的时间间隔，例如 10、30m、2h、1d。',
            alert_invalid_language: '请输入 auto、zh 或 en。',
            alert_cache_saved:      '已设置更新时间间隔为 {interval}，刷新页面后生效。',
            alert_language_saved:   '已设置界面语言为 {language}，刷新页面后生效。',

            badge_title:            '{original} {baseCurrency} -> {converted} {targetCurrency}',
            attribution_text:       '汇率来源'
        },

        'en':
        {
            language_option_auto: 'Follow browser',
            language_option_zh:   'Simplified Chinese',
            language_option_en:   'English',

            debug_on:             'On',
            debug_off:            'Off',

            menu_set_currency:    '⚙️ Set target currency (Current: {currency})',
            menu_set_color:       '🎨 Set text color (Current: {color})',
            menu_set_cache:       '⏱️ Set refresh interval (Current: {interval})',
            menu_set_language:    '🌐 Set interface language (Current: {language})',
            menu_toggle_debug:    '🪵 Debug mode (Current: {state})',

            prompt_currency:      'Enter a 3-letter target currency code, for example: CNY, USD, JPY, TWD, EUR',
            prompt_color:         'Enter a CSS color value, for example: #3fb950, green, #00ff00',
            prompt_cache:         'Enter the exchange-rate refresh interval. Supported formats:\n\n10   = 10 minutes\n30m  = 30 minutes\n2h   = 2 hours\n1d   = 1 day',
            prompt_language:      'Enter interface language:\n\nauto = Follow browser\nzh   = Simplified Chinese\nen   = English',

            alert_invalid_currency: 'Please enter a valid 3-letter currency code.',
            alert_invalid_cache:    'Please enter a valid interval, such as 10, 30m, 2h, or 1d.',
            alert_invalid_language: 'Please enter auto, zh, or en.',
            alert_cache_saved:      'Refresh interval has been set to {interval}. Reload the page to apply it.',
            alert_language_saved:   'Interface language has been set to {language}. Reload the page to apply it.',

            badge_title:            '{original} {baseCurrency} -> {converted} {targetCurrency}',
            attribution_text:       'Rates by'
        }
    };

    function formatTemplate(template, vars = {})
    {
        return String(template).replace(/\{(\w+)\}/g, (_, key) =>
        {
            return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
        });
    }

    function t(key, vars = {})
    {
        const lang     = getCurrentLanguage();
        const table    = i18n[lang] || i18n.en;
        const fallback = i18n.en;
        const template = table[key] || fallback[key] || key;
        return formatTemplate(template, vars);
    }

    function getLanguageDisplayName(value)
    {
        if (value === 'auto')
        {
            return t('language_option_auto');
        }

        if (value === 'zh-CN')
        {
            return t('language_option_zh');
        }

        return t('language_option_en');
    }

    // ================= 3. Helpers =================
    function log(...args)
    {
        if (config.debug)
        {
            console.log('[price-converter]', ...args);
        }
    }

    function detectContextCurrency(symbol)
    {
        const lang = (document.documentElement.lang || '').toLowerCase();
        const host = location.hostname.toLowerCase();

        if (symbol === '¥' || symbol === '￥')
        {
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
            if (host.endsWith('.tw') || host.includes('ruten') || host.includes('shopee.tw') || lang.includes('tw'))
            {
                return 'TWD';
            }

            if (host.endsWith('.hk') || host.includes('amazon.com.hk') || lang.includes('hk'))
            {
                return 'HKD';
            }

            if (host.endsWith('.sg') || host.includes('amazon.sg') || lang.includes('sg'))
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

            return 'USD';
        }

        return null;
    }

    const currencyMap =
    {
        'US$':     'USD',
        'HK$':     'HKD',
        'NT$':     'TWD',
        'S$':      'SGD',
        'A$':      'AUD',
        'AU$':     'AUD',
        'C$':      'CAD',
        'CA$':     'CAD',
        'NZ$':     'NZD',
        'R$':      'BRL',
        'MX$':     'MXN',
        'Fr.':     'CHF',
        '$':       detectContextCurrency('$'),
        '€':       'EUR',
        '£':       'GBP',
        '¥':       detectContextCurrency('¥'),
        '￥':      detectContextCurrency('¥'),
        '₩':       'KRW',
        '₽':       'RUB',
        '₹':       'INR',
        '฿':       'THB',
        '₪':       'ILS',
        '₱':       'PHP',
        '₫':       'VND',
        '₴':       'UAH',
        '₺':       'TRY',
        'د.إ':     'AED',

        '円':       'JPY',
        '日元':     'JPY',
        '元':       'CNY',
        '块':       'CNY',
        '人民币':    'CNY',
        '台币':     'TWD',
        '新台币':    'TWD',
        '港币':     'HKD',
        '韩元':     'KRW',

        'USD':     'USD',
        'EUR':     'EUR',
        'GBP':     'GBP',
        'JPY':     'JPY',
        'CNY':     'CNY',
        'TWD':     'TWD',
        'HKD':     'HKD',
        'SGD':     'SGD',
        'AUD':     'AUD',
        'CAD':     'CAD',
        'NZD':     'NZD',
        'KRW':     'KRW',
        'RUB':     'RUB',
        'INR':     'INR',
        'THB':     'THB',
        'PHP':     'PHP',
        'MYR':     'MYR',
        'IDR':     'IDR',
        'VND':     'VND',
        'BRL':     'BRL',
        'MXN':     'MXN',
        'TRY':     'TRY',
        'AED':     'AED',
        'CHF':     'CHF',
        'SEK':     'SEK',
        'NOK':     'NOK',
        'DKK':     'DKK',
        'PLN':     'PLN',
        'CZK':     'CZK',
        'HUF':     'HUF',
        'RON':     'RON',
        'UAH':     'UAH',
        'ZAR':     'ZAR',
        'ILS':     'ILS',
        'RM':      'MYR',
        'Rp':      'IDR',
        'kr':      'SEK',
        'zł':      'PLN',
        'Kč':      'CZK',
        'Ft':      'HUF',
        'lei':     'RON',
        'грн':     'UAH'
    };

    function getCurrencyDisplay(code)
    {
        const map =
        {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            CNY: '¥',
            TWD: 'NT$',
            HKD: 'HK$',
            SGD: 'S$',
            AUD: 'A$',
            CAD: 'CA$',
            NZD: 'NZ$',
            KRW: '₩',
            RUB: '₽',
            INR: '₹',
            THB: '฿',
            PHP: '₱',
            VND: '₫',
            AED: 'AED ',
            CHF: 'CHF ',
            BRL: 'R$',
            MXN: 'MX$',
            TRY: '₺',
            PLN: 'zł ',
            CZK: 'Kč ',
            HUF: 'Ft ',
            RON: 'lei ',
            UAH: '₴',
            ZAR: 'R ',
            ILS: '₪'
        };

        return map[code] || `${code} `;
    }

    function formatSteamCompactPrice(converted, currencyCode)
    {
        const symbol = getCurrencyDisplay(currencyCode);

        switch (currencyCode)
        {
            case 'JPY':
            case 'CNY':
            case 'KRW':
            case 'RUB':
            case 'TWD':
            case 'HKD':
                return `${symbol}${Math.round(converted)}`;

            case 'USD':
            case 'EUR':
            case 'GBP':
            case 'AUD':
            case 'CAD':
            case 'SGD':
                if (converted < 100)
                {
                    return `${symbol}${converted.toFixed(1)}`;
                }

                return `${symbol}${Math.round(converted)}`;

            default:
                if (converted < 100)
                {
                    return `${symbol}${converted.toFixed(1)}`;
                }

                return `${symbol}${Math.round(converted)}`;
        }
    }

    function parseIntervalToMs(input)
    {
        if (!input)
        {
            return null;
        }

        const value = input.trim().toLowerCase();
        const match = value.match(/^(\d+(?:\.\d+)?)(m|h|d)?$/);

        if (!match)
        {
            return null;
        }

        const number = Number(match[1]);
        const unit   = match[2] || 'm';

        if (!Number.isFinite(number) || number <= 0)
        {
            return null;
        }

        switch (unit)
        {
            case 'm':
                return Math.round(number * 60 * 1000);

            case 'h':
                return Math.round(number * 60 * 60 * 1000);

            case 'd':
                return Math.round(number * 24 * 60 * 60 * 1000);

            default:
                return null;
        }
    }

    function formatIntervalForDisplay(ms)
    {
        if (!Number.isFinite(ms) || ms <= 0)
        {
            return 'N/A';
        }

        const lang    = getCurrentLanguage();
        const minutes = ms / 60000;

        if (minutes % (24 * 60) === 0)
        {
            const days = minutes / (24 * 60);
            return lang === 'zh-CN' ? `${days} 天` : `${days} day(s)`;
        }

        if (minutes % 60 === 0)
        {
            const hours = minutes / 60;
            return lang === 'zh-CN' ? `${hours} 小时` : `${hours} hour(s)`;
        }

        return lang === 'zh-CN' ? `${minutes} 分钟` : `${minutes} minute(s)`;
    }

    function parsePriceValue(priceStr)
    {
        const cleanStr = priceStr.replace(/\s+/g, '');

        if (/.*\d\.\d{3},\d{1,2}$/.test(cleanStr) || /^\d+,\d{1,2}$/.test(cleanStr))
        {
            return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
        }

        return parseFloat(cleanStr.replace(/,/g, ''));
    }

    // ================= 4. Regex =================
    const numPatternStr = '([0-9]{1,3}(?:[.,\\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)';

    const nonAlphaPrefixes =
        'US\\$|HK\\$|NT\\$|S\\$|A\\$|AU\\$|C\\$|CA\\$|NZ\\$|R\\$|MX\\$|Fr\\.|\\$|€|£|¥|￥|₩|₽|₹|฿|₪|₱|₫|₴|₺|د\\.إ';

    const alphaPrefixes =
        'AED|AUD|USD|EUR|GBP|JPY|CNY|TWD|HKD|SGD|CAD|NZD|KRW|RUB|INR|THB|PHP|MYR|IDR|VND|BRL|MXN|TRY|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|UAH|ZAR|ILS|RM|Rp';

    const prefixSymbolsStr = `(${nonAlphaPrefixes}|(?:(?<![a-zA-Z])(?:${alphaPrefixes})(?![a-zA-Z])))`;

    const nonAlphaSuffixes =
        '€|円|日元|元|块|人民币|台币|新台币|港币|韩元|zł|Kč|Ft|lei|грн|₽|₩|₫|₴|₺';

    const alphaSuffixes =
        'AED|AUD|USD|EUR|GBP|JPY|CNY|TWD|HKD|SGD|CAD|NZD|KRW|RUB|INR|THB|PHP|MYR|IDR|VND|BRL|MXN|TRY|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|UAH|ZAR|ILS|kr|RM|Rp';

    const suffixSymbolsStr = `(${nonAlphaSuffixes}|(?:(?<![a-zA-Z])(?:${alphaSuffixes})(?![a-zA-Z])))`;

    const priceRegex = new RegExp(
        `(?:${prefixSymbolsStr}\\s*${numPatternStr})|(?:${numPatternStr}\\s*${suffixSymbolsStr})`,
        'gi'
    );

    const isolatedSymbolRegex = new RegExp(`^[\\s\\n]*${prefixSymbolsStr}[\\s\\n]*$`, 'i');
    const isolatedNumRegex    = new RegExp(`^[\\s\\n]*${numPatternStr}[\\s\\n]*$`, 'i');
    const isolatedSuffixRegex = new RegExp(`^[\\s\\n]*${suffixSymbolsStr}[\\s\\n]*$`, 'i');

    // ================= 5. Styles =================
    function ensureInjectedStyles()
    {
        if (document.getElementById('zybin-price-style'))
        {
            return;
        }

        const style = document.createElement('style');
        style.id = 'zybin-price-style';
        style.textContent = `
            .zybin-price-wrapper
            {
                display: inline !important;
            }

            .zybin-converted-price
            {
                display: inline-block !important;
                margin-left: 4px !important;
                font-size: 12px !important;
                line-height: 1.2 !important;
                font-weight: 600 !important;
                color: ${config.textColor} !important;
                vertical-align: middle !important;
                text-shadow: none !important;
            }

            /* ================= Steam base ================= */
            .zybin-converted-price.zybin-steam-price
            {
                display: block !important;
                margin-left: 0 !important;
                text-align: right !important;
                text-shadow: none !important;
                letter-spacing: 0 !important;
                opacity: 0.92 !important;
                white-space: nowrap !important;
            }

            /* 首页活动卡片 / 胶囊 */
            .zybin-converted-price.zybin-steam-card
            {
                margin-top: 2px !important;
                font-size: 10px !important;
                line-height: 1.12 !important;
                font-weight: 500 !important;
                color: rgba(255, 255, 255, 0.68) !important;
            }

            /* 搜索列表 / 愿望单 / 列表型布局 */
            .zybin-converted-price.zybin-steam-search
            {
                margin-top: 2px !important;
                font-size: 11px !important;
                line-height: 1.15 !important;
                font-weight: 500 !important;
                color: rgba(255, 255, 255, 0.74) !important;
            }

            /* 详情页购买框 / Bundle 行：紧凑同排，禁止再起新行 */
            .zybin-converted-price.zybin-steam-detail
            {
                display: inline-block !important;
                margin-left: 4px !important;
                margin-top: 0 !important;
                font-size: 10px !important;
                line-height: 1 !important;
                font-weight: 600 !important;
                color: rgba(255, 255, 255, 0.76) !important;
                vertical-align: baseline !important;
                white-space: nowrap !important;
                opacity: 0.95 !important;
                text-align: right !important;
            }

            /* 细修：首页折扣胶囊 */
            .sale_capsule .discount_final_price .zybin-converted-price.zybin-steam-card,
            .cluster_capsule .discount_final_price .zybin-converted-price.zybin-steam-card,
            .special .discount_final_price .zybin-converted-price.zybin-steam-card,
            .special_tiny_cap .discount_final_price .zybin-converted-price.zybin-steam-card,
            .home_area_spotlight .discount_final_price .zybin-converted-price.zybin-steam-card
            {
                margin-top: 1px !important;
                font-size: 10px !important;
            }

            /* 细修：搜索列表 */
            .search_result_row .discount_final_price .zybin-converted-price.zybin-steam-search,
            .tab_item .discount_final_price .zybin-converted-price.zybin-steam-search,
            .wishlist_row .discount_final_price .zybin-converted-price.zybin-steam-search
            {
                margin-top: 2px !important;
            }

            /* 细修：详情页购买框 / DLC / Bundle */
            .game_area_purchase_game .game_purchase_price .zybin-converted-price.zybin-steam-detail,
            .game_area_dlc_row .game_purchase_price .zybin-converted-price.zybin-steam-detail,
            .discount_block.game_purchase_discount .discount_final_price .zybin-converted-price.zybin-steam-detail,
            .game_area_purchase_game .discount_final_price .zybin-converted-price.zybin-steam-detail
            {
                margin-top: 0 !important;
            }

            #zybin-rate-attribution
            {
                position: fixed !important;
                right: 10px !important;
                bottom: 8px !important;
                z-index: 2147483647 !important;
                font-size: 10px !important;
                line-height: 1 !important;
                opacity: 0.55 !important;
                padding: 0 !important;
                margin: 0 !important;
                pointer-events: auto !important;
                text-decoration: none !important;
                color: rgba(255, 255, 255, 0.7) !important;
                background: transparent !important;
            }

            #zybin-rate-attribution:hover
            {
                opacity: 0.85 !important;
                text-decoration: underline !important;
            }
        `;

        document.head.appendChild(style);
    }

    function ensureAttributionLink()
    {
        if (document.getElementById('zybin-rate-attribution'))
        {
            return;
        }

        const a = document.createElement('a');
        a.id          = 'zybin-rate-attribution';
        a.href        = 'https://www.exchangerate-api.com';
        a.target      = '_blank';
        a.rel         = 'noreferrer noopener';
        a.textContent = `${t('attribution_text')} ExchangeRate-API`;

        const parent = document.body || document.documentElement;

        if (parent)
        {
            parent.appendChild(a);
        }
    }

    // ================= 6. Site-specific rules =================
    function getSiteText(node, selectors)
    {
        for (const selector of selectors)
        {
            const el = node.querySelector(selector);

            if (el && el.textContent && el.textContent.trim())
            {
                return el;
            }
        }

        return null;
    }

    function buildPseudoMatchForForcedCurrency(text, forcedCurrency)
    {
        const m = text.match(/([0-9]{1,3}(?:[.,\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/);

        if (!m)
        {
            return null;
        }

        return [null, forcedCurrency, m[1], null, null];
    }

    function getCurrencyAndPrice(matchObj)
    {
        const rawSymbol = matchObj[1] || matchObj[4];
        const rawPrice  = matchObj[2] || matchObj[3];

        if (!rawSymbol || !rawPrice)
        {
            return null;
        }

        const lookupKey    = rawSymbol.toUpperCase();
        const baseCurrency = currencyMap[lookupKey] || currencyMap[rawSymbol];

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

    function getSteamPriceLayout(targetNode)
    {
        if (!targetNode || !location.hostname.includes('steampowered.com'))
        {
            return 'card';
        }

        if (targetNode.closest(
            '.game_area_purchase_game, ' +
            '.game_purchase_action, ' +
            '.game_area_dlc_row, ' +
            '.discount_block.game_purchase_discount, ' +
            '.game_area_purchase_platform'
        ))
        {
            return 'detail';
        }

        if (targetNode.closest(
            '.search_result_row, ' +
            '.tab_item, ' +
            '.wishlist_row, ' +
            '.match, ' +
            '.browse_tag_game, ' +
            '.salepreviewwidgets_SaleItemBrowserRow_y9MSd'
        ))
        {
            return 'search';
        }

        return 'card';
    }

    function createBadge(converted, baseCurrency, originalPrice, targetNode)
    {
        const badge   = document.createElement('span');
        const isSteam = location.hostname.includes('steampowered.com');

        badge.className = 'zybin-converted-price';

        if (isSteam)
        {
            const layout = getSteamPriceLayout(targetNode);

            badge.classList.add('zybin-steam-price');
            badge.classList.add(`zybin-steam-${layout}`);

            if (layout === 'detail')
            {
                badge.textContent = formatSteamCompactPrice(converted, config.targetCurrency);
            }
            else
            {
                const display = getCurrencyDisplay(config.targetCurrency);
                badge.textContent = `${display}${converted.toFixed(2)}`;
            }
        }
        else
        {
            badge.textContent = `(${converted.toFixed(2)} ${config.targetCurrency})`;
        }

        badge.title = t('badge_title',
        {
            original:       originalPrice,
            baseCurrency:   baseCurrency,
            converted:      converted.toFixed(2),
            targetCurrency: config.targetCurrency
        });

        badge.dataset.zybin = 'true';
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

        if (textContainer.nodeType === Node.TEXT_NODE)
        {
            textContainer.nodeValue = '\u200B' + textContainer.nodeValue;
        }
        else
        {
            textContainer.textContent = '\u200B' + textContainer.textContent;
        }

        const badge   = createBadge(converted, baseCurrency, priceVal, targetNode);
        const isSteam = location.hostname.includes('steampowered.com');

        if (isSteam && targetNode && targetNode.nodeType === Node.ELEMENT_NODE)
        {
            const layout = getSteamPriceLayout(targetNode);

            if (layout === 'detail')
            {
                targetNode.appendChild(document.createTextNode(' '));
                targetNode.appendChild(badge);
            }
            else
            {
                targetNode.appendChild(badge);
            }
        }
        else if (insertAfterTarget && targetNode.parentNode)
        {
            targetNode.parentNode.insertBefore(badge, targetNode.nextSibling);
        }
        else if (targetNode.parentNode)
        {
            targetNode.parentNode.insertBefore(badge, targetNode.nextSibling);
        }

        log('badge inserted', { baseCurrency, priceVal, converted, targetNode });

        return true;
    }

    function processSimplePriceNode(node, forcedCurrency = null)
    {
        if (!node || node.dataset.zybin === 'true')
        {
            return;
        }

        const text = (node.textContent || '').trim();

        if (!text || text.includes('\u200B'))
        {
            return;
        }

        let match = null;

        if (forcedCurrency)
        {
            match = buildPseudoMatchForForcedCurrency(text, forcedCurrency);
        }
        else
        {
            priceRegex.lastIndex = 0;
            match = priceRegex.exec(text);
        }

        if (match)
        {
            injectBadge(node, match, node, false);
        }

        node.dataset.zybin = 'true';
    }

    function buildSiteRules()
    {
        return [
            {
                name: 'Amazon',
                match: () => location.hostname.includes('amazon.'),
                selector: '.a-price',
                process: (node) =>
                {
                    if (!node || node.dataset.zybin === 'true')
                    {
                        return;
                    }

                    const offscreen = getSiteText(node, ['.a-offscreen', '[aria-hidden="true"]']);

                    if (!offscreen)
                    {
                        return;
                    }

                    const text = (offscreen.textContent || '').trim();

                    if (!text || text.includes('\u200B'))
                    {
                        return;
                    }

                    priceRegex.lastIndex = 0;
                    const match = priceRegex.exec(text);

                    if (match)
                    {
                        injectBadge(node, match, offscreen, true);
                    }

                    node.dataset.zybin = 'true';
                }
            },
            {
                name: 'Steam',
                match: () => location.hostname.includes('steampowered.com'),
                selector: '.discount_final_price, .game_purchase_price, .sale_price, .match_price, .search_price',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'eBay',
                match: () => location.hostname.includes('ebay.'),
                selector: '.x-price-primary, .display-price, .u-flL.condText',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'AliExpress',
                match: () => location.hostname.includes('aliexpress.'),
                selector: '.snow-price_SnowPrice__mainS, .price--currentPriceText--V8_y_b5, .product-price-current',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'TaobaoTmall',
                match: () => location.hostname.includes('taobao.com') || location.hostname.includes('tmall.com'),
                selector: '.price, .tb-rmb-num, .tm-price, [class*="priceText"]',
                process: (node) =>
                {
                    processSimplePriceNode(node, 'CNY');
                }
            },
            {
                name: 'JD',
                match: () => location.hostname.includes('jd.com'),
                selector: '.price, .p-price, .summary-price',
                process: (node) =>
                {
                    processSimplePriceNode(node, 'CNY');
                }
            },
            {
                name: 'Newegg',
                match: () => location.hostname.includes('newegg.'),
                selector: '.price-current, .price-current-label, .price-current strong',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'BestBuy',
                match: () => location.hostname.includes('bestbuy.'),
                selector: '.priceView-customer-price, .pricing-price, [data-testid="customer-price"]',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'Walmart',
                match: () => location.hostname.includes('walmart.'),
                selector: '[itemprop="price"], .price-characteristic, [data-automation-id="product-price"]',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'Target',
                match: () => location.hostname.includes('target.'),
                selector: '[data-test="product-price"], [data-test="product-regular-price"], .h-text-bs',
                process: (node) =>
                {
                    processSimplePriceNode(node);
                }
            },
            {
                name: 'Rakuten',
                match: () => location.hostname.includes('rakuten.'),
                selector: '.price2, .price, .price-taxin',
                process: (node) =>
                {
                    processSimplePriceNode(node, 'JPY');
                }
            },
            {
                name: 'YahooShoppingJP',
                match: () => location.hostname.includes('shopping.yahoo.co.jp'),
                selector: '.Price__value, .elPriceValue, .price',
                process: (node) =>
                {
                    processSimplePriceNode(node, 'JPY');
                }
            }
        ].filter((rule) => rule.match());
    }

    // ================= 7. Generic fallback =================
    function getNextNonEmptyTextNode(startNode, maxSteps = 5)
    {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        walker.currentNode = startNode;

        let next;
        let steps = 0;

        while ((next = walker.nextNode()) && steps < maxSteps)
        {
            steps++;

            if (next.nodeValue.trim() !== '' && !next.nodeValue.includes('\u200B'))
            {
                return next;
            }
        }

        return null;
    }

    function processTextNode(node)
    {
        const text = node.nodeValue;

        if (!text || text.includes('\u200B'))
        {
            return;
        }

        const isolatedPrefixMatch = text.match(isolatedSymbolRegex);

        if (isolatedPrefixMatch)
        {
            const nextTextNode = getNextNonEmptyTextNode(node);

            if (nextTextNode && isolatedNumRegex.test(nextTextNode.nodeValue))
            {
                const symbol     = isolatedPrefixMatch[1];
                const priceMatch = nextTextNode.nodeValue.match(isolatedNumRegex);

                if (priceMatch)
                {
                    const pseudoMatch = [null, symbol, priceMatch[1], null, null];
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
                const symbolMatch = nextTextNode.nodeValue.match(isolatedSuffixRegex);

                if (symbolMatch)
                {
                    const pseudoMatch = [null, null, null, isolatedNumMatch[1], symbolMatch[1]];
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
                    wrapper.dataset.zybin = 'true';

                    wrapper.appendChild(document.createTextNode(match[0].replace(parsed.rawPrice, '\u200B' + parsed.rawPrice)));

                    const layoutTarget = node.parentNode || wrapper;
                    wrapper.appendChild(createBadge(converted, parsed.baseCurrency, priceVal, layoutTarget));
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

    // ================= 8. DOM walk =================
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

        const excludedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'OPTION', 'SVG', 'CANVAS']);

        if (node.nodeType === Node.ELEMENT_NODE)
        {
            if ((node.dataset && node.dataset.zybin === 'true') ||
                node.id === 'zybin-rate-attribution' ||
                (node.classList &&
                    (node.classList.contains('zybin-price-wrapper') || node.classList.contains('zybin-converted-price'))))
            {
                return;
            }

            let handledByRule = false;

            for (const rule of siteRules)
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

            if (!excludedTags.has(tagName))
            {
                Array.from(node.childNodes).forEach(walkDOM);
            }
        }
        else if (node.nodeType === Node.TEXT_NODE)
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
                        if ((added.dataset && added.dataset.zybin === 'true') ||
                            added.id === 'zybin-rate-attribution' ||
                            (added.classList &&
                                (added.classList.contains('zybin-price-wrapper') || added.classList.contains('zybin-converted-price'))))
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

            if (shouldProcess)
            {
                clearTimeout(window.zybinPriceTimeout);
                window.zybinPriceTimeout = setTimeout(() =>
                {
                    walkDOM(document.body);
                }, 250);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ================= 9. Menus =================
    function registerMenus()
    {
        GM_registerMenuCommand(
            t('menu_set_currency', { currency: config.targetCurrency }),
            () =>
            {
                const input = prompt(t('prompt_currency'), config.targetCurrency);

                if (!input)
                {
                    return;
                }

                const value = input.trim().toUpperCase();

                if (!/^[A-Z]{3}$/.test(value))
                {
                    alert(t('alert_invalid_currency'));
                    return;
                }

                GM_setValue('targetCurrency', value);
                location.reload();
            }
        );

        GM_registerMenuCommand(
            t('menu_set_color', { color: config.textColor }),
            () =>
            {
                const input = prompt(t('prompt_color'), config.textColor);

                if (input === null)
                {
                    return;
                }

                GM_setValue('textColor', input.trim());
                location.reload();
            }
        );

        GM_registerMenuCommand(
            t('menu_set_cache', { interval: formatIntervalForDisplay(config.cacheTime) }),
            () =>
            {
                const input = prompt(t('prompt_cache'), String(Math.round(config.cacheTime / 60000)));

                if (input === null)
                {
                    return;
                }

                const ms = parseIntervalToMs(input);

                if (!ms)
                {
                    alert(t('alert_invalid_cache'));
                    return;
                }

                GM_setValue('cacheTimeMs', ms);
                alert(t('alert_cache_saved', { interval: formatIntervalForDisplay(ms) }));
                location.reload();
            }
        );

        GM_registerMenuCommand(
            t('menu_set_language', { language: getLanguageDisplayName(config.language) }),
            () =>
            {
                const currentValue =
                    config.language === 'auto'
                        ? 'auto'
                        : (config.language === 'zh-CN' ? 'zh' : 'en');

                const input = prompt(t('prompt_language'), currentValue);

                if (input === null)
                {
                    return;
                }

                const value = input.trim().toLowerCase();

                if (value === 'auto')
                {
                    GM_setValue('language', 'auto');
                    alert(t('alert_language_saved', { language: t('language_option_auto') }));
                    location.reload();
                    return;
                }

                if (value === 'zh')
                {
                    GM_setValue('language', 'zh-CN');
                    alert(t('alert_language_saved', { language: t('language_option_zh') }));
                    location.reload();
                    return;
                }

                if (value === 'en')
                {
                    GM_setValue('language', 'en');
                    alert(t('alert_language_saved', { language: t('language_option_en') }));
                    location.reload();
                    return;
                }

                alert(t('alert_invalid_language'));
            }
        );

        GM_registerMenuCommand(
            t('menu_toggle_debug',
            {
                state: config.debug ? t('debug_on') : t('debug_off')
            }),
            () =>
            {
                GM_setValue('debug', !config.debug);
                location.reload();
            }
        );
    }

    // ================= 10. Init =================
    function fetchRates()
    {
        const now = Date.now();

        GM_xmlhttpRequest(
        {
            method: 'GET',
            url:    'https://open.er-api.com/v6/latest/USD',
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

                if (!data || data.result !== 'success' || !data.rates)
                {
                    log('invalid rate data', data);
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
        ensureInjectedStyles();
        ensureAttributionLink();

        siteRules = buildSiteRules();
        registerMenus();

        const cachedData = GM_getValue('ratesCache', null);
        const now        = Date.now();

        log('site rules active', siteRules.map((x) => x.name));

        if (cachedData &&
            (now - cachedData.timestamp < config.cacheTime) &&
            cachedData.rates &&
            cachedData.rates[config.targetCurrency])
        {
            exchangeRates = cachedData.rates;
            walkDOM(document.body);
            observeMutations();
            return;
        }

        fetchRates();
    }

    init();
})();
