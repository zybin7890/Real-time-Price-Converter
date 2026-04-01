# Real-time Price Converter / 实时价格汇率换算器

![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)

A Tampermonkey userscript that detects prices on shopping websites and shows converted values next to the original price.  
一个用于 Tampermonkey 的用户脚本，用来在购物网站上识别价格，并在原价旁边显示换算后的目标货币价格。

## Quick Navigation / 快速导航

- [English](#english)
- [简体中文](#简体中文)
- [License / 许可证](#license--许可证)

---

## English

### What it does

Real-time Price Converter scans supported shopping pages, detects prices, figures out the source currency from the page context, and appends a converted price in your preferred target currency.

It is designed for everyday users:

- install once in Tampermonkey
- choose your target currency
- browse supported websites normally

### Features

- Real-time price conversion on many shopping websites
- Multi-currency support with symbols, codes, and common aliases
- Dedicated rules for popular websites
- Generic fallback parser for unsupported layouts
- Works with many dynamic pages and late-loaded content
- Custom refresh interval for exchange rates
- Built-in bilingual UI: Simplified Chinese / English / Follow browser
- Optional debug mode for troubleshooting

### Supported websites

Dedicated rules are included for:

- Amazon
- Steam
- eBay
- AliExpress
- Shopee
- Taobao / Tmall
- JD.com
- Newegg
- Best Buy
- Walmart
- Target
- Rakuten
- Yahoo Shopping Japan

Unsupported sites may still work thanks to the generic text-based fallback parser.

### Supported currencies

The script supports common shopping currencies and aliases, including:

USD, EUR, GBP, JPY, CNY, TWD, HKD, SGD, AUD, CAD, NZD, KRW, INR, THB, PHP, MYR, IDR, VND, RUB, BRL, MXN, TRY, AED, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON, UAH, ZAR, ILS

### Installation

#### Step 1: Install Tampermonkey

Install the **Tampermonkey** browser extension first.

- Official website / download page: <https://www.tampermonkey.net/>
- Tampermonkey supports major browsers including Firefox, Chrome, Microsoft Edge, Safari, and Opera.

After the extension is installed, make sure Tampermonkey is enabled in your browser.

#### Step 2: Install this userscript

##### Option A: Install from GreasyFork

- Direct install: [Real-time Price Converter.user.js](https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.user.js)
- Auto-update metadata: [Real-time Price Converter.meta.js](https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.meta.js)

If Tampermonkey is already installed, opening the direct install link should trigger the installation page automatically.

##### Option B: Install from this repository

1. Download or open `real-time-price-converter.user.js`
2. Open it with Tampermonkey, or drag it into the Tampermonkey dashboard
3. Confirm installation
4. Visit a supported shopping page

### GreasyFork metadata

If you publish or mirror the script, these are the current update endpoints used by the userscript metadata:

```javascript
// @downloadURL https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.user.js
// @updateURL https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.meta.js
```

### Menu options

After installation, open the Tampermonkey menu to use:

- **Set target currency**
- **Set text color**
- **Set refresh interval**
- **Set interface language**
- **Debug mode**

Supported refresh interval formats:

- `10`
- `30m`
- `2h`
- `1d`

### Notes

- This script only changes how prices are displayed in your browser.
- It does not change the actual checkout price.
- Website layouts may change over time.
- Some prices rendered in unusual components may still be missed.

### Privacy

This script runs locally in your browser.

It does not require an account.  
It does not upload your shopping history to a custom backend.  
It only requests exchange-rate data needed for conversion.

### Troubleshooting

**No converted price appears**

1. Refresh the page
2. Open a product detail page instead of a listing page
3. Make sure Tampermonkey is enabled on the site
4. Enable debug mode and check the browser console

**Wrong currency detected**
Some symbols such as `$`, `¥`, and `kr` can mean different currencies on different regional sites.  
The script uses domain and page-language hints, but edge cases may still exist.

**Exchange rates are not updating**
Reduce the refresh interval in the menu or reload the page after the cache expires.

---

## 简体中文

### 这是什么

实时价格汇率换算器是一个 Tampermonkey 用户脚本。  
它会在支持的购物页面中自动识别价格、结合页面上下文判断原始币种，并在原价后面追加你设定的目标货币换算结果。

它面向普通用户使用：

- 安装一次即可
- 设置目标货币即可
- 平时正常浏览购物网站就能看到换算结果

### 功能特点

- 多个购物网站实时价格换算
- 支持多种货币、货币符号、货币代码和常见别名
- 对主流网站提供专门规则
- 对未专门适配的网站提供通用兜底解析
- 兼容很多动态页面和延迟加载内容
- 支持自定义汇率更新时间间隔
- 内置中英双语界面，可切换为简体中文 / English / 跟随浏览器
- 带调试模式，便于排查问题

### 当前支持的网站

脚本目前内置了以下网站的专门规则：

- Amazon
- Steam
- eBay
- AliExpress
- Shopee
- 淘宝 / 天猫
- 京东
- Newegg
- Best Buy
- Walmart
- Target
- Rakuten
- Yahoo Shopping Japan

即使是不在上面列表中的网站，也有机会通过通用文本解析正常工作。

### 当前支持的货币

脚本支持常见购物场景中的主要货币及别名，包括：

USD、EUR、GBP、JPY、CNY、TWD、HKD、SGD、AUD、CAD、NZD、KRW、INR、THB、PHP、MYR、IDR、VND、RUB、BRL、MXN、TRY、AED、CHF、SEK、NOK、DKK、PLN、CZK、HUF、RON、UAH、ZAR、ILS

### 安装方法

#### 第一步：下载安装 Tampermonkey（油猴）

请先在浏览器中安装 **Tampermonkey** 扩展。

- 官方网站 / 下载页：<https://www.tampermonkey.net/>
- Tampermonkey 支持 Firefox、Chrome、Microsoft Edge、Safari、Opera 等主流浏览器。

安装完成后，请确认浏览器中的 Tampermonkey 已启用。

#### 第二步：安装本脚本

##### 方式 A：从 GreasyFork 直接安装

- 直接安装脚本： [Real-time Price Converter.user.js](https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.user.js)
- 自动更新元数据： [Real-time Price Converter.meta.js](https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.meta.js)

如果浏览器已经安装 Tampermonkey，打开上面的直接安装链接通常会自动弹出安装页面。

##### 方式 B：从当前仓库安装

1. 下载或打开 `real-time-price-converter.user.js`
2. 用 Tampermonkey 打开它，或者把它拖入 Tampermonkey 面板
3. 确认安装
4. 打开支持的购物页面

### GreasyFork 元信息

如果你要发布或镜像这个脚本，当前使用的更新地址如下：

```javascript
// @downloadURL https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.user.js
// @updateURL https://update.greasyfork.org/scripts/572072/Real-time%20Price%20Converter.meta.js
```

### 菜单功能

安装完成后，可以在 Tampermonkey 菜单中使用：

- **设置目标货币**
- **设置价格颜色**
- **设置更新时间间隔**
- **设置界面语言**
- **调试日志**

更新时间间隔支持以下格式：

- `10`
- `30m`
- `2h`
- `1d`

### 使用说明

- 脚本只会修改浏览器页面中的显示内容
- 它不会修改网站真实结算价格
- 网站页面结构随时可能变化
- 某些特殊组件里的价格仍然可能漏掉

### 隐私说明

这个脚本主要在你的浏览器本地运行。

它不需要账号。  
它不会把你的购物记录上传到自定义服务器。  
它只会请求价格换算所需的汇率数据。

### 常见问题

**页面上没有显示换算价格**

1. 刷新页面
2. 尝试进入商品详情页，而不是列表页
3. 确认 Tampermonkey 已在该站点启用
4. 打开调试模式并查看浏览器控制台

**识别出的币种不对**
像 `$`、`¥`、`kr` 这类符号在不同地区网站中可能代表不同货币。  
脚本会结合域名和页面语言进行判断，但边缘情况仍可能误判。

**汇率没有更新**
可以在菜单中缩短更新时间间隔，或者等缓存过期后刷新页面。

---

## License / 许可证

This project is licensed under **GNU General Public License v3.0**.  
本项目采用 **GNU General Public License v3.0** 开源协议。

See the `LICENSE` file for the full license text.  
完整许可证文本请查看仓库中的 `LICENSE` 文件。
