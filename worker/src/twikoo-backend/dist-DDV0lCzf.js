import { a as __toESM, t as __commonJSMin } from "./rolldown-runtime-7_rZTKki.js";
//#endregion
//#region ../pushoo/dist/index.mjs
var import_remove_markdown = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(md, options) {
		options = options || {};
		options.listUnicodeChar = options.hasOwnProperty("listUnicodeChar") ? options.listUnicodeChar : false;
		options.stripListLeaders = options.hasOwnProperty("stripListLeaders") ? options.stripListLeaders : true;
		options.gfm = options.hasOwnProperty("gfm") ? options.gfm : true;
		options.useImgAltText = options.hasOwnProperty("useImgAltText") ? options.useImgAltText : true;
		options.abbr = options.hasOwnProperty("abbr") ? options.abbr : false;
		options.replaceLinksWithURL = options.hasOwnProperty("replaceLinksWithURL") ? options.replaceLinksWithURL : false;
		options.separateLinksAndTexts = options.hasOwnProperty("separateLinksAndTexts") ? options.separateLinksAndTexts : null;
		options.htmlTagsToSkip = options.hasOwnProperty("htmlTagsToSkip") ? options.htmlTagsToSkip : [];
		options.throwError = options.hasOwnProperty("throwError") ? options.throwError : false;
		var output = md || "";
		output = output.replace(/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/gm, "");
		try {
			if (options.stripListLeaders) {
				if (options.listUnicodeChar) output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, options.listUnicodeChar + " $1");
				else output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, "$1");
			}
			if (options.gfm) output = output.replace(/\n={2,}/g, "\n").replace(/~{3}.*\n/g, "").replace(/~~/g, "").replace(/```(?:.*)\n([\s\S]*?)```/g, (_, code) => code.trim());
			if (options.abbr) output = output.replace(/\*\[.*\]:.*\n/, "");
			let htmlReplaceRegex = /<[^>]*>/g;
			if (options.htmlTagsToSkip && options.htmlTagsToSkip.length > 0) {
				const joinedHtmlTagsToSkip = options.htmlTagsToSkip.join("|");
				htmlReplaceRegex = new RegExp(`<(?!\/?(${joinedHtmlTagsToSkip})(?=>|\s[^>]*>))[^>]*>`, "g");
			}
			if (options.separateLinksAndTexts) output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1" + options.separateLinksAndTexts + "$2");
			output = output.replace(htmlReplaceRegex, "").replace(/^[=\-]{2,}\s*$/g, "").replace(/\[\^.+?\](\: .*?$)?/g, "").replace(/\s{0,2}\[.*?\]: .*?$/g, "").replace(/\!\[(.*?)\][\[\(].*?[\]\)]/g, options.useImgAltText ? "$1" : "").replace(/\[([\s\S]*?)\]\s*[\(\[](.*?)[\)\]]/g, options.replaceLinksWithURL ? "$2" : "$1").replace(/^(\n)?\s{0,3}>\s?/gm, "$1").replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, "").replace(/^(\n)?\s{0,}#{1,6}\s*( (.+))? +#+$|^(\n)?\s{0,}#{1,6}\s*( (.+))?$/gm, "$1$3$4$6").replace(/([\*]+)(\S)(.*?\S)??\1/g, "$2$3").replace(/(^|\W)([_]+)(\S)(.*?\S)??\2($|\W)/g, "$1$3$4$5").replace(/(`{3,})(.*?)\1/gm, "$2").replace(/`(.+?)`/g, "$1").replace(/~(.*?)~/g, "$1");
		} catch (e) {
			if (options.throwError) throw e;
			console.error("remove-markdown encountered error: %s", e);
			return md;
		}
		return output;
	};
})))(), 1);
function checkParameters(options, requires = []) {
	requires.forEach((require) => {
		if (!options[require]) throw new Error(`${require} is required`);
	});
}
/**
* 发送请求：非 2xx 抛错（与 axios 一致），返回 { data, status } 供各渠道读取。
*
* 用原生 fetch 而非 axios，是为了能在 Cloudflare Workers 等只提供 Web 标准 API 的
* 运行时里工作（axios 依赖 Node 的 http 模块）。
* @param url 请求地址
* @param init fetch 参数
* @returns 响应数据与状态码
*/
async function sendRequest(url, init = {}) {
	const response = await fetch(url, init);
	if (!response.ok) throw new Error(`Request failed with status code ${response.status}`);
	const text = await response.text();
	let data = text;
	try {
		data = text ? JSON.parse(text) : text;
	} catch {}
	return {
		data,
		status: response.status
	};
}
/**
* GET 请求（调用形态对齐 `axios.get(url, { params })`）。
*
* params 兼容普通对象与 URLSearchParams 两种形态（bark 传的是后者）。
* @param url 请求地址
* @param config 查询参数
* @returns 响应数据与状态码
*/
function httpGet(url, config = {}) {
	const params = config.params;
	const entries = params instanceof URLSearchParams ? [...params] : Object.entries(params ?? {});
	const queryString = new URLSearchParams(entries.filter(([, value]) => value !== void 0)).toString();
	return sendRequest(queryString ? `${url}${url.includes("?") ? "&" : "?"}${queryString}` : url, { method: "GET" });
}
/**
* POST 请求（调用形态对齐 `axios.post(url, data, config)`）。
*
* 对象体走 JSON、字符串体走表单编码，与 axios 的默认推断一致——服务端常按
* Content-Type 分流解析。
* @param url 请求地址
* @param body 请求体
* @param config 请求头与超时（毫秒）
* @returns 响应数据与状态码
*/
function httpPost(url, body, config = {}) {
	const isStringBody = typeof body === "string";
	const headers = isStringBody ? {
		"Content-Type": "application/x-www-form-urlencoded",
		...config.headers
	} : {
		"Content-Type": "application/json",
		...config.headers
	};
	return sendRequest(url, {
		method: "POST",
		body: isStringBody ? body : JSON.stringify(body ?? {}),
		headers,
		signal: config.timeout ? AbortSignal.timeout(config.timeout) : void 0
	});
}
function getTxt(content) {
	return (0, import_remove_markdown.default)(content).trim();
}
function getTitle(content) {
	return getTxt(content).split("\n")[0];
}
function removeUrlAndIp(content) {
	return content.replace(/(https?:\/\/[^\s]+)/g, "").replace(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g, "").replace(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g, "");
}
/**
* 自定义 Webhook 推送
*/
async function noticeWebhook(options) {
	checkParameters(options, ["content"]);
	const method = options?.options?.webhook?.method || "POST";
	const url = options?.options?.webhook?.url;
	if (!url) throw new Error("Webhook url is required");
	if (method === "GET") return (await httpGet(url, { params: new URLSearchParams({
		...options.token ? { token: options.token } : {},
		...options.title ? { title: options.title } : {},
		content: options.content
	}) })).data;
	if (method === "POST") return (await httpPost(url, {
		...options.token && { token: options.token },
		...options.title && { title: options.title },
		content: options.content
	})).data;
	throw new Error(`Unsupported Webhook request method: ${method}`);
}
/**
* https://qmsg.zendee.cn/
*/
async function noticeQmsg(options) {
	checkParameters(options, ["token", "content"]);
	const url = options?.options?.qmsg?.url || "https://qmsg.zendee.cn";
	let msg = getTxt(options.content);
	if (options.title) msg = `${options.title}\n${msg}`;
	msg = removeUrlAndIp(msg);
	const param = new URLSearchParams({ msg });
	const qq = options?.options?.qmsg?.qq || false;
	if (qq) param.append("qq", qq);
	const bot = options?.options?.qmsg?.bot || false;
	if (bot) param.append("bot", bot);
	return (await httpPost(`${url}/${options?.options?.qmsg?.group || false ? "group" : "send"}/${options.token}`, param.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } })).data;
}
/**
* https://github.com/Tianli0/push-bot-api/
*/
async function noticeAtri(options) {
	checkParameters(options, ["token", "content"]);
	const url = "http://pushoo.tianli0.top/";
	let message = getTxt(options.content);
	if (options.title) message = `${options.title}\n${message}`;
	return (await httpPost(url, new URLSearchParams({
		user_id: options.token,
		message
	}).toString(), { headers: { "X-Requested-By": "pushoo" } })).data;
}
/**
* Turbo: https://sct.ftqq.com/
* V3: https://sc3.ft07.com/
*/
async function noticeServerChan(options) {
	checkParameters(options, ["token", "content"]);
	let url;
	let param;
	if (options.token.startsWith("sctp")) {
		const sctpMatch = options.token.match(/^sctp(\d+)t/);
		if (!sctpMatch) throw new Error("invalid serverchan sctp token");
		url = `https://${sctpMatch[1]}.push.ft07.com/send`;
		param = new URLSearchParams({
			title: options.title || getTitle(options.content),
			desp: options.content
		});
	} else if (options.token.substring(0, 3).toLowerCase() === "sct") {
		url = "https://sctapi.ftqq.com";
		param = new URLSearchParams({
			title: options.title || getTitle(options.content),
			desp: options.content
		});
	} else {
		url = "https://sc.ftqq.com";
		param = new URLSearchParams({
			text: options.title || getTitle(options.content),
			desp: options.content
		});
	}
	return (await httpPost(`${url}/${options.token}.send`, param.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } })).data;
}
/**
* https://www.pushplus.plus/
*/
async function noticePushPlus(options) {
	checkParameters(options, ["token", "content"]);
	return (await httpPost("http://www.pushplus.plus/send", {
		token: options.token,
		title: options.title || getTitle(options.content),
		content: options.content,
		template: "markdown"
	})).data;
}
/**
* 文档: https://open.dingtalk.com/document/group/custom-robot-access
* 教程: https://blog.ljcbaby.top/article/Twikoo-DingTalk/
*/
async function noticeDingTalk(options) {
	checkParameters(options, ["token", "content"]);
	let url = "https://oapi.dingtalk.com/robot/send?access_token=";
	if (options.token.substring(0, 4).toLowerCase() === "http") url = options.token;
	else url += options.token;
	const msgtype = options.options?.dingtalk?.msgtype || "text";
	const content = msgtype === "text" ? (options.title ? `${options.title}\n` : "") + getTxt(options.content) : options.content;
	const msgBody = { msgtype };
	if (msgtype === "text") msgBody[msgtype] = { content };
	else if (msgtype === "markdown") msgBody[msgtype] = {
		title: options.title || getTitle(options.content),
		text: content
	};
	return (await httpPost(url, msgBody)).data;
}
/**
* 文档: https://developer.work.weixin.qq.com/document/path/90236
* 教程: https://sct.ftqq.com/forward
*/
async function noticeWeCom(options) {
	checkParameters(options, ["token", "content"]);
	const [corpid, corpsecret, agentid, touser = "@all"] = options.token.split("#");
	checkParameters({
		corpid,
		corpsecret,
		agentid
	}, [
		"corpid",
		"corpsecret",
		"agentid"
	]);
	let accessToken;
	try {
		accessToken = (await httpGet(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${corpsecret}`)).data.access_token;
	} catch (e) {
		console.error("获取企业微信 access token 失败，请检查 token", e);
		return {};
	}
	const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
	let content = getTxt(options.content);
	if (options.title) content = `${options.title}\n${content}`;
	return (await httpPost(url, {
		touser,
		msgtype: "text",
		agentid,
		text: { content }
	})).data;
}
/**
* https://github.com/Finb/Bark
*/
async function noticeBark(options) {
	checkParameters(options, ["token", "content"]);
	let url = "https://api.day.app/";
	if (options.token.substring(0, 4).toLowerCase() === "http") url = options.token;
	else url += options.token;
	if (!url.endsWith("/")) url += "/";
	const title = encodeURIComponent(options.title || getTitle(options.content));
	const content = encodeURIComponent(getTxt(options.content));
	/** url 沿用 1.x：即使未配置也带上（行为基准）；其余可选参数有值才透传 */
	const params = new URLSearchParams({ url: options?.options?.bark?.url || "" });
	for (const [key, value] of Object.entries(options?.options?.bark ?? {})) {
		if (key === "url") continue;
		if (value === void 0 || value === null || value === "") continue;
		params.set(key, String(value));
	}
	return (await httpGet(`${url}${title}/${content}/`, { params })).data;
}
/**
* 文档: https://docs.go-cqhttp.org/api/
* 教程: https://twikoo.js.org/QQ_API.html
*/
async function noticeGoCqhttp(options) {
	checkParameters(options, ["token", "content"]);
	const url = options.token;
	let message = getTxt(options.content);
	if (options.title) message = `${options.title}\n${message}`;
	return (await httpPost(url, new URLSearchParams({ message }).toString())).data;
}
/**
* 文档: https://github.com/botuniverse/onebot-11
* 教程: https://ayakasuki.com/
*/
async function noticeNodeOnebot(options) {
	checkParameters(options, ["token", "content"]);
	try {
		const urlObj = new URL(options.token);
		const { searchParams } = urlObj;
		const groupId = searchParams.get("group_id");
		const userId = searchParams.get("user_id");
		searchParams.delete("group_id");
		searchParams.delete("user_id");
		const apiUrl = urlObj.toString();
		const body = { message: options.title ? `${options.title}\n${getTxt(options.content)}` : getTxt(options.content) };
		if (groupId) body.group_id = Number(groupId);
		if (userId) body.user_id = Number(userId);
		const response = await httpPost(apiUrl, body, {
			timeout: 5e3,
			headers: { "Content-Type": "application/json" }
		});
		if (response.data?.retcode !== 0) throw new Error(`[${response.data.retcode}] ${response.data.status || "Unknown Error"}`);
		return response.data;
	} catch (e) {
		console.error("[ONEBOT] 推送失败:", e.response?.data || e.message);
		throw new Error(`OneBot推送失败: ${e.message}`);
	}
}
async function noticePushdeer(options) {
	checkParameters(options, ["token", "content"]);
	return (await httpPost("https://api2.pushdeer.com/message/push", {
		pushkey: options.token,
		text: options.title || getTitle(options.content),
		desp: options.content
	})).data;
}
async function noticeIgot(options) {
	checkParameters(options, ["token", "content"]);
	return (await httpPost(`https://push.hellyw.com/${options.token}`, {
		title: options.title || getTitle(options.content),
		content: getTxt(options.content)
	})).data;
}
/**
* 文档: https://core.telegram.org/method/messages.sendMessage
* 教程: https://core.telegram.org/bots#3-how-do-i-create-a-bot
*/
async function noticeTelegram(options) {
	checkParameters(options, ["token", "content"]);
	const [tgToken, chatId] = options.token.split("#");
	checkParameters({
		tgToken,
		chatId
	}, ["tgToken", "chatId"]);
	let text = options.content.replace(/([*_])/g, "\\$1");
	if (options.title) text = `${options.title}\n\n${text}`;
	return (await httpPost(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
		text,
		chat_id: chatId,
		parse_mode: "Markdown"
	})).data;
}
/**
* 飞书 / Lark 机器人推送：两端点仅开放平台 base URL 不同，其余请求语义一致。
* @param baseUrl 开放平台 base URL
* @param options 推送参数
* @returns 接口返回体
*/
async function noticeFeishuBot(baseUrl, options) {
	checkParameters(options, ["token", "content"]);
	const v1 = `${baseUrl}/open-apis/bot/hook/`;
	const v2 = `${baseUrl}/open-apis/bot/v2/hook/`;
	let url;
	let params;
	if (options.token.substring(0, 4).toLowerCase() === "http") url = options.token;
	else url = v2 + options.token;
	if (url.substring(0, v1.length) === v1) params = {
		title: options.title || getTitle(options.content),
		text: getTxt(options.content)
	};
	else {
		let text = getTxt(options.content);
		if (options.title) text = `${options.title}\n${text}`;
		params = {
			msg_type: "text",
			content: { text }
		};
	}
	return (await httpPost(url, params)).data;
}
/**
* https://www.feishu.cn/hc/zh-CN/articles/360024984973
*/
async function noticeFeishu(options) {
	return noticeFeishuBot("https://open.feishu.cn", options);
}
/**
* Lark（飞书国际版）：https://open.larksuite.com/
*/
async function noticeLark(options) {
	return noticeFeishuBot("https://open.larksuite.com", options);
}
/**
* https://ifttt.com/maker_webhooks
* http://ift.tt/webhooks_faq
*/
async function noticeIfttt(options) {
	checkParameters(options, ["token", "content"]);
	const [token, eventName] = options.token.split("#");
	checkParameters({
		token,
		eventName
	}, ["token", "eventName"]);
	return (await httpPost(`https://maker.ifttt.com/trigger/${eventName}/with/key/${token}`, {
		value1: options.options?.ifttt?.value1 || getTxt(options.title || ""),
		value2: options.options?.ifttt?.value2 || getTxt(options.content),
		value3: options.options?.ifttt?.value3
	}, { headers: { "Content-Type": "application/json" } })).data;
}
/**
* 文档: https://developer.work.weixin.qq.com/document/path/91770
* 教程: https://developer.work.weixin.qq.com/tutorial/detail/54
*/
async function noticeWecombot(options) {
	checkParameters(options, ["token", "content"]);
	return (await httpPost(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${options.token}`, {
		msgtype: "text",
		text: { content: getTxt(options.content) }
	}, { headers: { "Content-Type": "application/json" } })).data;
}
/**
* 文档：https://discord.com/developers/docs/resources/webhook#execute-webhook
*/
async function noticeDiscord(options) {
	checkParameters(options, ["token", "content"]);
	return `Delivered successfully, code ${(await httpPost(options.token.startsWith("https://") ? options.token : `https://discord.com/api/webhooks/${options.token.replace(/#/, "/")}`, {
		content: options.content,
		username: options.options?.discord?.userName,
		avatar_url: options.options?.discord?.avatarUrl
	}, { headers: { "Content-Type": "application/json" } })).status}.`;
}
/**
* WXPusher 推送
* 教程：https://wxpusher.zjiecode.com/admin/
* 文档: https://wxpusher.zjiecode.com/docs/#/
*/
async function noticeWxPusher(options) {
	checkParameters(options, ["token", "content"]);
	const url = "http://wxpusher.zjiecode.com/api/send/message";
	const [appToken, topicIds] = options.token.split("#");
	checkParameters({
		appToken,
		topicIds
	}, ["appToken", "topicIds"]);
	return (await httpPost(url, {
		appToken,
		content: options.content,
		summary: options.title || getTitle(options.content),
		contentType: 3,
		topicIds: topicIds.split(",").map((id) => Number(id)),
		uids: options?.options?.wxpusher?.uids || [],
		url: options?.options?.wxpusher?.url || "",
		verifyPayload: options?.options?.wxpusher?.verifyPay || false
	}, { headers: { "Content-Type": "application/json" } })).data;
}
/**
* Join 推送
* 文档: https://joaoapps.com/join/api/
*/
async function noticeJoin(options) {
	checkParameters(options, ["token", "content"]);
	const [apiKey, deviceId] = options.token.split("#");
	checkParameters({
		apiKey,
		deviceId
	}, ["apiKey", "deviceId"]);
	return (await httpPost("https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush", new URLSearchParams({
		apikey: apiKey,
		deviceId,
		title: options.title || getTitle(options.content),
		text: options.content
	}).toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } })).data;
}
/**
* 头部值编码：HTTP 头部只接受 latin1，非 ASCII 值按 RFC 2047 编码（ntfy 支持该形式）
* @param value 原始头部值
* @returns 可写入头部的值
*/
function encodeHeaderValue(value) {
	if (/^[\x20-\x7e]*$/.test(value)) return value;
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	bytes.forEach((byte) => {
		binary += String.fromCharCode(byte);
	});
	return `=?UTF-8?B?${typeof Buffer === "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64")}?=`;
}
/**
* ntfy 推送
* 文档: https://docs.ntfy.sh/publish/
* @param options 推送参数
* @returns 接口返回体
*/
async function noticeNtfy(options) {
	checkParameters(options, ["token", "content"]);
	const url = options.token.startsWith("http") ? options.token : `https://ntfy.sh/${options.token}`;
	const ntfy = options.options?.ntfy;
	const headers = {
		"Content-Type": "text/plain; charset=utf-8",
		Title: encodeHeaderValue(options.title || getTitle(options.content))
	};
	if (ntfy?.priority !== void 0) headers.Priority = String(ntfy.priority);
	if (ntfy?.tags) headers.Tags = ntfy.tags;
	if (ntfy?.click) headers.Click = ntfy.click;
	if (ntfy?.accessToken) headers.Authorization = `Bearer ${ntfy.accessToken}`;
	return (await httpPost(url, getTxt(options.content), { headers })).data;
}
async function notice(channel, options) {
	try {
		let data;
		const noticeFn = {
			webhook: noticeWebhook,
			qmsg: noticeQmsg,
			serverchan: noticeServerChan,
			serverchain: noticeServerChan,
			pushplus: noticePushPlus,
			dingtalk: noticeDingTalk,
			wecom: noticeWeCom,
			bark: noticeBark,
			gocqhttp: noticeGoCqhttp,
			onebot: noticeNodeOnebot,
			atri: noticeAtri,
			pushdeer: noticePushdeer,
			igot: noticeIgot,
			telegram: noticeTelegram,
			feishu: noticeFeishu,
			lark: noticeLark,
			ifttt: noticeIfttt,
			wecombot: noticeWecombot,
			discord: noticeDiscord,
			wxpusher: noticeWxPusher,
			ntfy: noticeNtfy,
			join: noticeJoin
		}[channel.toLowerCase()];
		if (noticeFn) data = await noticeFn(options);
		else if (typeof channel === "string" && (channel.startsWith("http://") || channel.startsWith("https://"))) {
			options.options = options.options || {};
			options.options.webhook = { url: channel };
			if (channel.endsWith(":GET")) {
				options.options.webhook.method = "GET";
				options.options.webhook.url = channel.slice(0, -4);
			}
			data = await noticeWebhook(options);
		} else throw new Error(`<${channel}> is not supported`);
		console.debug(`[PUSHOO] Send to <${channel}> result:`, data);
		return data;
	} catch (caught) {
		const e = caught instanceof Error ? caught : new Error(String(caught));
		console.error("[PUSHOO] Got error:", e.message);
		return { error: e };
	}
}
//#endregion
export { notice as default, notice, noticeAtri, noticeBark, noticeDingTalk, noticeDiscord, noticeFeishu, noticeGoCqhttp, noticeIfttt, noticeIgot, noticeJoin, noticeLark, noticeNodeOnebot, noticeNtfy, noticePushPlus, noticePushdeer, noticeQmsg, noticeServerChan, noticeTelegram, noticeWeCom, noticeWecombot, noticeWxPusher };

//# sourceMappingURL=dist-DDV0lCzf.js.map