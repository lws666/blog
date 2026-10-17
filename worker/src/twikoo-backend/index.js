import { a as __toESM, t as __commonJSMin } from "./rolldown-runtime-7_rZTKki.js";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
//#region ../shared/dist/index.mjs
/*! @twikoojs/shared v0.0.0 */
/**
* Twikoo 统一版本号常量（构建期占位符）。
*
* 声明为 `string`（而非字面量类型），使类型声明产物不残留占位符字面量：
* 构建时由 `@twikoojs/tsdown-config` 的版本替换插件把该值改写为当前包
* `package.json` 的 version。
* - 本地开发构建得到 `'0.0.0'`（各发布包 version 恒为 0.0.0）；
* - CI 发布流程先按 Release tag 注入真实版本号，再构建，产物即携带正式版本。
*
* 占位符字面量由 `@twikoojs/tsdown-config` 的 `VERSION_PLACEHOLDER` 常量定义，
* 客户端与服务端统一读取本常量，避免版本号在多包之间手工同步。
*/
const VERSION = "0.0.0";
/**
* 后端事件名常量（Scope E：24 个客户端事件 + 1 个服务端内部事件）。
*
* 口径说明：1.x 各平台的顶层事件 switch 并集共 **25 个**标识符——24 个由客户端
* 发起，另加服务端内部事件 `POST_SUBMIT`（`COMMENT_SUBMIT` 保存评论后触发
* 垃圾检测与通知，只有 vercel / CloudBase 的顶层 switch 里有它）。本文件即导出
* 这 25 个，客户端的 `api.ts`、`@twikoojs/common` 的事件分发器与契约测试均以此
* 为单一事实来源。
*/
/** 获取后端函数版本号，客户端用于探测服务端能力与版本兼容性 */
const GET_FUNC_VERSION = "GET_FUNC_VERSION";
/** 获取评论列表（前台，按 URL / 分页 / 排序返回可见评论） */
const COMMENT_GET = "COMMENT_GET";
/** 获取评论列表（管理员视图，含待审核与隐藏评论） */
const COMMENT_GET_FOR_ADMIN = "COMMENT_GET_FOR_ADMIN";
/** 管理员更新单条评论（审核状态、可见性、置顶等） */
const COMMENT_SET_FOR_ADMIN = "COMMENT_SET_FOR_ADMIN";
/** 管理员删除评论 */
const COMMENT_DELETE_FOR_ADMIN = "COMMENT_DELETE_FOR_ADMIN";
/** 用户删除自己的评论 */
const COMMENT_DELETE_FOR_USER = "COMMENT_DELETE_FOR_USER";
/** 管理员批量导入评论 */
const COMMENT_IMPORT_FOR_ADMIN = "COMMENT_IMPORT_FOR_ADMIN";
/** 管理员导出评论 */
const COMMENT_EXPORT_FOR_ADMIN = "COMMENT_EXPORT_FOR_ADMIN";
/** 点赞 / 取消点赞评论 */
const COMMENT_LIKE = "COMMENT_LIKE";
/** 提交新评论 */
const COMMENT_SUBMIT = "COMMENT_SUBMIT";
/** 获取页面评论计数 */
const COUNTER_GET = "COUNTER_GET";
/** 查询是否已设置管理密码（不返回密码本身） */
const GET_PASSWORD_STATUS = "GET_PASSWORD_STATUS";
/** 首次设置管理密码 */
const SET_PASSWORD = "SET_PASSWORD";
/** 获取前台可公开的配置项 */
const GET_CONFIG = "GET_CONFIG";
/** 获取管理员完整配置项 */
const GET_CONFIG_FOR_ADMIN = "GET_CONFIG_FOR_ADMIN";
/** 保存配置 */
const SET_CONFIG = "SET_CONFIG";
/** 管理员登录，校验密码并返回鉴权令牌 */
const LOGIN = "LOGIN";
/** 获取评论总数（用于统计展示） */
const GET_COMMENTS_COUNT = "GET_COMMENTS_COUNT";
/** 获取最近评论列表 */
const GET_RECENT_COMMENTS = "GET_RECENT_COMMENTS";
/** 发送测试邮件，验证 SMTP 配置是否正确 */
const EMAIL_TEST = "EMAIL_TEST";
/** 上传图片到图床/存储 */
const UPLOAD_IMAGE = "UPLOAD_IMAGE";
/** 获取 QQ 昵称（用于评论者昵称自动填充） */
const GET_QQ_NICK = "GET_QQ_NICK";
/** 申请验证码（生成 challenge） */
const CAP_CHALLENGE = "CAP_CHALLENGE";
/** 兑换验证码（校验 challenge 答案） */
const CAP_REDEEM = "CAP_REDEEM";
/**
* 提交后内部钩子（评论提交成功后触发通知 / 反垃圾等后续动作）。
*
* 这是**服务端内部事件**，长期保留（不是 1.x 兼容分支）：`COMMENT_SUBMIT` 保存评论后，
* 由各适配器把本事件派发到独立执行单元，使垃圾检测与通知不占用用户请求的执行预算。
* 处理器校验内部派发令牌（`x-twikoo-recursion`），外部直接调用返回 1403。
*/
const POST_SUBMIT = "POST_SUBMIT";
//#endregion
//#region ../server-common/dist/index.mjs
var import_server = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* @typedef {import('node:crypto')} Crypto
	* @typedef {import('node:fs/promises')} FsPromises
	* @typedef {import('fs').PathLike} PathLike
	*/
	/**
	* @typedef {[string, string]} ChallengeTuple
	*/
	/**
	* @typedef {Object} ChallengeData
	* @property {Object} challenge - Challenge configuration object
	* @property {number} challenge.c - Number of challenges
	* @property {number} challenge.s - Size of each challenge
	* @property {number} challenge.d - Difficulty level
	* @property {number} expires - Expiration timestamp
	*/
	/**
	* @typedef {Object} ChallengeState
	* @property {Record<string, ChallengeData>} challengesList - Map of challenge tokens to challenge data
	* @property {Record<string, number>} tokensList - Map of token hashes to expiration timestamps
	*/
	/**
	* @typedef {Object} ChallengeConfig
	* @property {number} [challengeCount=50] - Number of challenges to generate
	* @property {number} [challengeSize=32] - Size of each challenge in bytes
	* @property {number} [challengeDifficulty=4] - Difficulty level of the challenge
	* @property {number} [expiresMs=600000] - Time in milliseconds until the challenge expires
	* @property {boolean} [store=true] - Whether to store the challenge in memory
	*/
	/**
	* @typedef {Object} TokenConfig
	* @property {boolean} [keepToken] - Whether to keep the token after validation
	*/
	/**
	* @typedef {Object} Solution
	* @property {string} token - Challenge token
	* @property {number[]} solutions - Array of challenge solutions
	*/
	/**
	* @typedef {Object} ChallengeStorage
	* @property {function(string, ChallengeData): Promise<void>} store - Store challenge data
	* @property {function(string): Promise<ChallengeData|null>} read - Retrieve challenge data
	* @property {function(string): Promise<void>} delete - Delete challenge data
	* @property {function(): Promise<void>} deleteExpired - Delete expired challenge tokens
	*/
	/**
	* @typedef {Object} TokenStorage
	* @property {function(string, number): Promise<void>} store - Store token with expiration
	* @property {function(string): Promise<number|null>} get - Retrieve token expiration
	* @property {function(string): Promise<void>} delete - Delete token
	* @property {function(): Promise<void>} deleteExpired - Delete expired token keys
	*/
	/**
	* @typedef {Object} StorageHooks
	* @property {ChallengeStorage} [challenges] - Challenge storage hooks
	* @property {TokenStorage} [tokens] - Token storage hooks
	*/
	/**
	* @typedef {Object} CapConfig
	* @property {string} tokens_store_path - Path to store the tokens file
	* @property {ChallengeState} state - State configuration
	* @property {boolean} noFSState - Whether to disable the state file
	* @property {boolean} [disableAutoCleanup] - Whether to disable automatic cleanup of expired tokens and challenges
	* @property {StorageHooks} [storage] - Custom storage hooks for challenges and tokens
	*/
	/** @type {typeof import('node:crypto')} */
	const crypto$2 = require("node:crypto");
	/** @type {typeof import('node:fs/promises')} */
	const fs$1 = require("node:fs/promises");
	const { EventEmitter } = require("node:events");
	const DEFAULT_TOKENS_STORE = ".data/tokensList.json";
	/**
	* Generates a cryptographically secure random hex string of given length
	*
	* @param {number} bytesCount
	* @returns {Promise<string>} Deterministic hex string generated from the seed
	*/
	async function randomHex(bytesCount) {
		if (crypto$2.getRandomValues) {
			const bytes = new Uint8Array(bytesCount);
			crypto$2.getRandomValues(bytes);
			return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
		}
		return new Promise((resolve, reject) => {
			crypto$2.randomBytes(bytesCount, (err, buf) => {
				if (err) return reject(err);
				resolve(buf.toString("hex"));
			});
		});
	}
	/**
	* Calculates a SHA256 hash of a given string
	* @param {string} str
	* @returns {Promise<string>}
	*/
	async function sha256(str) {
		if (crypto$2.webcrypto?.subtle) {
			const enc = new TextEncoder();
			const hash = await crypto$2.webcrypto.subtle.digest("SHA-256", enc.encode(str));
			return Buffer.from(hash).toString("hex");
		}
		return crypto$2.createHash("sha256").update(str).digest("hex");
	}
	/**
	* Generates a deterministic hex string of given length from a string seed
	*
	* @param {string} seed - Initial seed value
	* @param {number} length - Output hex string length
	* @returns {string} Deterministic hex string generated from the seed
	*/
	function prng(seed, length) {
		/**
		* @param {string} str
		*/
		function fnv1a(str) {
			let hash = 2166136261;
			for (let i = 0; i < str.length; i++) {
				hash ^= str.charCodeAt(i);
				hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
			}
			return hash >>> 0;
		}
		let state = fnv1a(seed);
		let result = "";
		function next() {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			return state >>> 0;
		}
		while (result.length < length) {
			const rnd = next();
			result += rnd.toString(16).padStart(8, "0");
		}
		return result.substring(0, length);
	}
	/**
	* Main Cap class
	* @extends EventEmitter
	*/
	var Cap = class extends EventEmitter {
		/** @type {Promise<void>|null} */
		_cleanupPromise;
		/** @type {number} */
		_lastCleanup;
		/** @type {CapConfig} */
		config;
		/**
		* Creates a new Cap instance
		* @param {Partial<CapConfig>} [configObj] - Configuration object
		*/
		constructor(configObj) {
			super();
			this._cleanupPromise = null;
			this._lastCleanup = 0;
			/** @type {CapConfig} */
			this.config = {
				tokens_store_path: DEFAULT_TOKENS_STORE,
				noFSState: false,
				state: {
					challengesList: {},
					tokensList: {}
				},
				...configObj
			};
			if (!this.config.noFSState && !this.config.storage?.tokens) this._loadTokens().catch(() => {});
			process.on("beforeExit", () => this.cleanup());
			[
				"SIGINT",
				"SIGTERM",
				"SIGQUIT"
			].forEach((signal) => {
				process.once(signal, () => {
					this.cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
				});
			});
		}
		/**
		* Performs cleanup if enough time has passed since last cleanup
		* @private
		* @returns {Promise<void>}
		*/
		async _lazyCleanup() {
			if (this.config.disableAutoCleanup) return;
			const now = Date.now();
			if (now - this._lastCleanup > 3e5) {
				await this._cleanExpiredTokens().catch((err) => {
					console.error("[cap] cleanup failed", err);
				});
				this._lastCleanup = now;
			}
		}
		/**
		* Retrieves challenge data from storage
		* @private
		* @param {string} token - Challenge token
		* @returns {Promise<ChallengeData|null>} Challenge data or null if not found
		*/
		async _getChallenge(token) {
			if (this.config.storage?.challenges?.read) return await this.config.storage.challenges.read(token) || null;
			return this.config.state.challengesList[token] || null;
		}
		/**
		* Deletes challenge from storage
		* @private
		* @param {string} token - Challenge token
		* @returns {Promise<void>}
		*/
		async _deleteChallenge(token) {
			if (this.config.storage?.challenges?.delete) await this.config.storage.challenges.delete(token);
			else delete this.config.state.challengesList[token];
		}
		/**
		* Generates a new challenge
		* @param {ChallengeConfig} [conf] - Challenge configuration
		* @returns {Promise<{ challenge: {c: number, s: number, d: number}, token?: string, expires: number }>} Challenge data
		*/
		async createChallenge(conf) {
			await this._lazyCleanup();
			/** @type {{c: number, s: number, d: number}} */
			const challenge = {
				c: conf?.challengeCount ?? 50,
				s: conf?.challengeSize ?? 32,
				d: conf?.challengeDifficulty ?? 4
			};
			const token = await randomHex(25);
			const expires = Date.now() + (conf?.expiresMs ?? 6e5);
			if (conf && conf.store === false) return {
				challenge,
				expires
			};
			const challengeData = {
				expires,
				challenge
			};
			if (this.config.storage?.challenges?.store) await this.config.storage.challenges.store(token, challengeData);
			else this.config.state.challengesList[token] = challengeData;
			return {
				challenge,
				token,
				expires
			};
		}
		/**
		* Redeems a challenge solution in exchange for a token
		* @param {Solution} param0 - Challenge solution data
		* @returns {Promise<{success: boolean, message?: string, token?: string, expires?: number}>}
		*/
		async redeemChallenge({ token, solutions }) {
			if (!token || !solutions || !Array.isArray(solutions) || solutions.some((s) => typeof s !== "number")) return {
				success: false,
				message: "Invalid body"
			};
			await this._lazyCleanup();
			const challengeData = await this._getChallenge(token);
			await this._deleteChallenge(token);
			if (!challengeData || challengeData.expires < Date.now()) return {
				success: false,
				message: "Challenge invalid or expired"
			};
			let i = 0;
			const challenges = Array.from({ length: challengeData.challenge.c }, () => {
				i = i + 1;
				return [prng(`${token}${i}`, challengeData.challenge.s), prng(`${token}${i}d`, challengeData.challenge.d)];
			});
			if (!(await Promise.all(challenges.map(([salt, target], i) => {
				if (typeof solutions[i] !== "number") return null;
				return sha256(salt + solutions[i]).then((h) => [h, target]);
			}))).every((pair) => pair?.[0].startsWith(pair[1]))) return {
				success: false,
				message: "Invalid solution"
			};
			const vertoken = await randomHex(15);
			const expires = Date.now() + 12e5;
			const hash = await sha256(vertoken);
			const id = await randomHex(8);
			const tokenKey = `${id}:${hash}`;
			if (this.config.storage?.tokens?.store) await this.config.storage.tokens.store(tokenKey, expires);
			else {
				if (this?.config?.state?.tokensList) this.config.state.tokensList[tokenKey] = expires;
				if (!this.config.noFSState) await fs$1.writeFile(this.config.tokens_store_path, JSON.stringify(this.config.state.tokensList), "utf8");
			}
			return {
				success: true,
				token: `${id}:${vertoken}`,
				expires
			};
		}
		/**
		* Retrieves token expiration from storage
		* @private
		* @param {string} tokenKey - Token key
		* @returns {Promise<number|null>} Token expiration or null if not found
		*/
		async _getToken(tokenKey) {
			if (this.config.storage?.tokens?.get) return await this.config.storage.tokens.get(tokenKey);
			return this.config.state.tokensList[tokenKey] || null;
		}
		/**
		* Deletes token from storage
		* @private
		* @param {string} tokenKey - Token key
		* @returns {Promise<void>}
		*/
		async _deleteToken(tokenKey) {
			if (this.config.storage?.tokens?.delete) await this.config.storage.tokens.delete(tokenKey);
			else {
				delete this.config.state.tokensList[tokenKey];
				if (!this.config.noFSState) await fs$1.writeFile(this.config.tokens_store_path, JSON.stringify(this.config.state.tokensList), "utf8");
			}
		}
		/**
		* Validates a token
		* @param {string} token - The token to validate
		* @param {TokenConfig} [conf] - Validation configuration
		* @returns {Promise<{success: boolean}>}
		*/
		async validateToken(token, conf) {
			await this._lazyCleanup();
			if (!token || typeof token !== "string") return { success: false };
			const parts = token.split(":");
			if (parts.length !== 2 || !parts[0] || !parts[1]) return { success: false };
			const [id, vertoken] = parts;
			const key = `${id}:${await sha256(vertoken)}`;
			await this._waitForTokensList();
			const tokenExpires = await this._getToken(key);
			if (tokenExpires && tokenExpires > Date.now()) {
				if (!conf?.keepToken) await this._deleteToken(key);
				return { success: true };
			}
			return { success: false };
		}
		/**
		* Loads tokens from the storage file
		* @private
		* @returns {Promise<void>}
		*/
		async _loadTokens() {
			if (this.config.noFSState || this.config.storage?.tokens) return;
			try {
				const dirPath = this.config.tokens_store_path.split("/").slice(0, -1).join("/");
				if (dirPath) await fs$1.mkdir(dirPath, { recursive: true });
				try {
					await fs$1.access(this.config.tokens_store_path);
					const data = await fs$1.readFile(this.config.tokens_store_path, "utf-8");
					this.config.state.tokensList = JSON.parse(data) || {};
					await this._lazyCleanup();
				} catch {
					console.warn(`[cap] tokens file not found, creating a new empty one`);
					await fs$1.writeFile(this.config.tokens_store_path, "{}", "utf-8");
					this.config.state.tokensList = {};
				}
			} catch {
				console.warn(`[cap] Couldn't load or write tokens file, using empty state`);
				this.config.state.tokensList = {};
			}
		}
		/**
		* Removes expired tokens and challenges from memory and storage
		* @private
		* @returns {Promise<boolean>} - True if any tokens were changed/removed
		*/
		async _cleanExpiredTokens() {
			const now = Date.now();
			let tokensChanged = false;
			if (this.config.storage?.challenges?.deleteExpired) await this.config.storage.challenges.deleteExpired();
			else if (!this.config.storage?.challenges) {
				const expired = Object.entries(this.config.state.challengesList).filter(([_, v]) => v.expires < now).map(([k]) => k);
				await Promise.all(expired.map(async (k) => {
					await this._deleteChallenge(k);
				}));
			} else console.warn("[cap] challenge storage hooks provided but no deleteExpired, couldn't delete expired challenges");
			if (this.config.storage?.tokens?.deleteExpired) await this.config.storage.tokens.deleteExpired();
			else if (!this.config.storage?.tokens) {
				for (const k in this.config.state.tokensList) if (this.config.state.tokensList[k] < now) {
					await this._deleteToken(k);
					tokensChanged = true;
				}
			} else console.warn("[cap] token storage hooks provided but no deleteExpired, couldn't delete expired tokens");
			return tokensChanged;
		}
		/**
		* Waits for the tokens list to be initialized
		* @private
		* @returns {Promise<void>}
		*/
		_waitForTokensList() {
			return new Promise((resolve) => {
				if (this.config.state.tokensList) return resolve();
				const l = () => {
					if (this.config.state.tokensList) return resolve();
					setTimeout(l, 10);
				};
				l();
			});
		}
		/**
		* Cleans up expired tokens and syncs state
		* @returns {Promise<void>}
		*/
		async cleanup() {
			if (this._cleanupPromise) return this._cleanupPromise;
			this._cleanupPromise = (async () => {
				if (await this._cleanExpiredTokens() && !this.config.noFSState && !this.config.storage?.tokens?.store) await fs$1.writeFile(this.config.tokens_store_path, JSON.stringify(this.config.state.tokensList), "utf8");
			})();
			return this._cleanupPromise;
		}
	};
	/** @type {typeof Cap} */
	module.exports = Cap;
})))(), 1);
/**
* 数据库端口（规范数据库抽象）。
*
* 抽象要抓**语义**而非 API（规范原文）：MongoDB / LokiJS / Blob KV / CloudBase DB
* 各自实现同一接口，业务层不再关心用哪个库。方法名与分组见下表：
* 评论 8 / 计数 3 / 配置 2 / 验证码 3 / 生命周期 2，共 18 个方法。
*
* 形态设计：每个方法以独立的函数类型**方法级导出**，再由 {@link Database} 接口聚合——
* 四个数据库实现可按方法类型逐一核对签名，契约测试也可按方法粒度引用。
*/
/**
* 「字段不存在」哨兵（Loki 无 $exists 的跨库等价）。
*
* 动机：1.x 里 Mongo 用 `rid: { $exists: false }`、Loki 用 `rid: { $in: ["", null] }`
* 表达同一语义（重点说明），业务层被迫关心底层差异。2.0 统一为语义查询对象
* `{ rid: ABSENT }`，各实现自行翻译成自家语法。
*
* 设计决策：
* - 选 Symbol 哨兵而非字符串常量（如 "__ABSENT__"）：Symbol 与真实数据值构造上不可
*   混淆，杜绝用户评论字段恰好等于哨兵字符串的碰撞；
* - 选 Symbol.for（全局注册表）而非 Symbol()：本包为 ESM + CJS 双格式产物，Symbol()
*   在两个模块实例中生成不同引用，跨格式混用（A 依赖走 CJS、B 依赖走 ESM）时
*   `ABSENT === ABSENT` 会失败；Symbol.for 同名恒等，跨实例安全。
*/
const ABSENT = Symbol.for("twikoo.db.absent");
/**
* 「不等于」哨兵：`{ isSpam: { [NOT]: true } }` 表示 `isSpam != true`。
* 字段缺失视为不等于（与 Mongo $ne 语义一致）。用于 1.x
* `isSpam: { $ne: true }` 的可见性过滤。
*/
const NOT = Symbol.for("twikoo.db.not");
/**
* 「大于」哨兵：`{ created: { [GT]: Date.now() - 600000 } }`（数值比较，
* 1.x limitFilter 的 created $gt 语义）。
*/
const GT = Symbol.for("twikoo.db.gt");
/**
* 「小于」哨兵：`{ created: { [LT]: before } }`（数值比较，1.x commentGet 的
* `created: { $lt: event.before }` 语义——流式分页「加载更多」的游标条件）。
*
* 为什么必须进语义层：`before` 是**比较**而非等值，用标量表达会退化为
* `created === before`（端到端回归实测：加载更多恒为 0 条）。
*/
const LT = Symbol.for("twikoo.db.lt");
/**
* 内部派发令牌（1.x `x-twikoo-recursion` 头语义）。
*
* 派发方向目标执行单元带上此令牌，目标侧的 POST_SUBMIT 事件处理器据此
* 拒绝**外部**直接调用（否则任何人都能凭空触发垃圾检测与通知）。
* 1.x 的取值即 `config.ADMIN_PASS || "true"`。
* @param config 全量配置
* @returns 令牌字符串
*/
function getRecursionToken(config) {
	return String(config.ADMIN_PASS || "true");
}
/**
* pipeline 层错误类型。
*
* pipeline catch 按错误类型决定 HTTP 状态与错误体；业务 handler 抛出的普通
* Error 统一转为 `{ code: FAIL, message }`（1.x 语义：业务错误不改变 HTTP 200）。
*/
/**
* 限流超限错误（1.x protect 的 'Too Many Requests' 升级为类型化错误）。
* pipeline 捕获后返回 HTTP 429（2.0 改进：客户端 TwikooError 按 429
* 映射「请求过于频繁」提示）。
*/
var RateLimitError = class extends Error {
	/** @param ip 被限流的客户端 IP */
	constructor(ip) {
		super("Too Many Requests");
		this.name = "RateLimitError";
		/** 被限流的客户端 IP（日志排障用） */
		this.ip = ip;
	}
	/** 被限流的客户端 IP */
	ip;
};
/**
* 事件处理器未注册错误（过渡期守卫：迁移完成前，dispatcher 对已枚举但
* 尚无实现的 24 个常规事件抛出；pipeline catch 转为 FAIL 错误体，绝不静默）。
*/
var HandlerNotRegisteredError = class extends Error {
	/** @param event 未注册处理器的事件名 */
	constructor(event) {
		super(`事件 ${event} 的处理器尚未注册`);
		this.name = "HandlerNotRegisteredError";
	}
};
/** 事件名 → 处理器 的注册表（模块级单例，进程生命周期内有效） */
const registry = /* @__PURE__ */ new Map();
/**
* 注册（或覆盖）一个事件处理器。
* @param event 事件名（@twikoojs/shared 事件常量）
* @param handler 处理器实现
*/
function registerHandler(event, handler) {
	registry.set(event, handler);
}
/**
* 解析事件处理器；未注册返回 undefined（由调用方决定报错形态）。
* @param event 事件名
* @returns 处理器实现或 undefined
*/
function resolveHandler(event) {
	return registry.get(event);
}
/**
* 服务端常量（1.7.24 `twikoo-func/utils/constants.js` 语义对齐）。
*
* RES_CODE 数值是**对外契约**：客户端按数值判断结果（如 0 成功、1403 未登录），
* 禁止改动任何数值或删除键（BC 保障清单）。
*/
/**
* 业务响应码（1.x RES_CODE 全量对齐）。
* 0 = 成功；100 = 缺少 event 参数；1000 = 通用失败；1001 = 事件不存在；
* 1010 = 密码已存在；1020 = 数据库无配置；1021/1025 = 凭证缺失/无效；
* 1022/1023 = 密码未设置/不匹配；1024 = 需要登录；1403 = 禁止；
* 1030 = Akismet 错误；1040 = 上传失败；1041 = NSFW 拒绝。
*/
const RES_CODE = {
	/** 成功 */
	SUCCESS: 0,
	/** 缺少 event 参数（1.x 对空请求体返回运行正常提示 + 版本号） */
	NO_PARAM: 100,
	/** 通用失败 */
	FAIL: 1e3,
	/** 事件不存在（客户端需更新版本） */
	EVENT_NOT_EXIST: 1001,
	/** 管理密码已存在（需先登录再修改） */
	PASS_EXIST: 1010,
	/** 数据库无配置 */
	CONFIG_NOT_EXIST: 1020,
	/** 凭证不存在 */
	CREDENTIALS_NOT_EXIST: 1021,
	/** 凭证无效 */
	CREDENTIALS_INVALID: 1025,
	/** 管理密码未设置 */
	PASS_NOT_EXIST: 1022,
	/** 管理密码不匹配 */
	PASS_NOT_MATCH: 1023,
	/** 需要登录 */
	NEED_LOGIN: 1024,
	/** 禁止（含 1.x POST_SUBMIT 递归头不匹配场景的历史值） */
	FORBIDDEN: 1403,
	/** Akismet 反垃圾检测出错 */
	AKISMET_ERROR: 1030,
	/** 图片上传失败 */
	UPLOAD_FAILED: 1040,
	/** 内容安全检测判定 NSFW 拒绝 */
	NSFW_REJECTED: 1041
};
/**
* 单 IP 最大请求次数（1.x MAX_REQUEST_TIMES 语义：TWIKOO_THROTTLE 环境变量
* 可覆盖，默认 250）。
*
* 实现为**调用时读取**而非模块加载时固化（1.x 为加载时读取）：进程内环境变量
* 不会变化，行为等价；调用时读取让测试可用 vi.stubEnv 控制阈值，不必动模块
* 加载顺序。
*/
function getMaxRequestTimes() {
	return Number.parseInt(process.env.TWIKOO_THROTTLE ?? "", 10) || 250;
}
/**
* 默认实现（接缝）：记录日志并返回成功，不执行任何副作用。
* 以真实实现覆写（postCheckSpam + saveSpamCheckResult + sendNotice）。
* @param comment 已保存的评论
* @param ctx 请求上下文
* @returns 成功响应体（Promise 形态与真实服务签名一致）
*/
const noopPostSubmit = (comment, ctx) => {
	ctx.logger.info("postSubmit 服务尚未接线，跳过垃圾检测与通知", { id: comment._id });
	return Promise.resolve({ code: RES_CODE.SUCCESS });
};
/** 当前生效的 postSubmit 服务实现（setPostSubmitService 可覆写） */
let current = noopPostSubmit;
/**
* 覆写 postSubmit 服务实现（注入真实实现；测试注入 spy）。
* @param service 新的服务实现
*/
function setPostSubmitService(service) {
	current = service;
}
/**
* 获取当前 postSubmit 服务实现（COMMENT_SUBMIT 成功路径与 POST_SUBMIT
* 兼容分支统一经此调用，保证副作用同源）。
* @returns 当前服务实现
*/
function getPostSubmitService() {
	return current;
}
/**
* 解析查询参数为 query 串（params 兼容普通对象与 URLSearchParams）。
* @param url 请求地址
* @param params 查询参数
* @returns 拼好 query 的 URL
*/
function urlWithParams(url, params) {
	const entries = params instanceof URLSearchParams ? [...params] : Object.entries(params ?? {});
	const queryString = new URLSearchParams(entries.filter(([, value]) => value !== void 0)).toString();
	return queryString ? `${url}${url.includes("?") ? "&" : "?"}${queryString}` : url;
}
/**
* 请求载荷归一：FormData（form-data 包实例）转 Buffer 并补 multipart 头，
* 原生 FormData / URLSearchParams **直通**（multipart 边界由 fetch 自己生成），
* 其余 JSON 对象序列化、字符串原样。
* @param data 载荷
* @param headers 请求头（会被补写 Content-Type）
* @returns fetch 可用的 body
*/
function toFetchBody(data, headers) {
	if (data === void 0 || data === null) return void 0;
	if (Buffer.isBuffer(data)) return data;
	if (typeof FormData !== "undefined" && data instanceof FormData) return data;
	if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) return data;
	const withBuffer = data;
	if (typeof withBuffer.getBuffer === "function") {
		Object.assign(headers, withBuffer.getHeaders());
		return withBuffer.getBuffer();
	}
	if (typeof data === "string") return data;
	headers["Content-Type"] ??= "application/json";
	return JSON.stringify(data);
}
/**
* 发起请求（httpGet/httpPost/httpPut 的公共实现）。
*
* 非 2xx 抛错并在错误对象上带 `response.status` / `response.data`
* （与 axios 的错误形态一致，调用方无需改动 catch 逻辑）。
* @param method 请求方法
* @param url 请求地址
* @param data 请求载荷
* @param config 请求配置
* @returns 响应数据与状态码
*/
async function request(method, url, data, config) {
	const headers = { ...config?.headers ?? {} };
	const body = toFetchBody(data, headers);
	const timeout = Number(config?.timeout) || void 0;
	const response = await fetch(urlWithParams(url, config?.params), {
		method,
		headers,
		body,
		signal: timeout ? AbortSignal.timeout(timeout) : void 0
	});
	const text = await response.text();
	let parsed = text;
	try {
		parsed = JSON.parse(text);
	} catch {}
	if (!response.ok) {
		const error = /* @__PURE__ */ new Error(`Request failed with status code ${response.status}`);
		error.response = {
			status: response.status,
			data: parsed
		};
		throw error;
	}
	return {
		data: parsed,
		status: response.status
	};
}
/**
* GET 请求（原生 fetch；params 自动拼 query）。
* @param url 地址
* @param config 请求配置
* @returns 响应数据与状态码
*/
function httpGet(url, config) {
	return request("GET", url, void 0, config);
}
/**
* POST 请求（原生 fetch；FormData 载荷自动转 Buffer 并补 multipart 头）。
* @param url 地址
* @param data 载荷
* @param config 请求配置
* @returns 响应数据与状态码
*/
function httpPost(url, data, config) {
	return request("POST", url, data, config);
}
/**
* PUT 请求（S3 图床上传用；原生 fetch）。
* @param url 地址
* @param data 载荷
* @param config 请求配置
* @returns 响应数据与状态码
*/
function httpPut(url, data, config) {
	return request("PUT", url, data, config);
}
/**
* 重依赖**字面量**加载表：specifier → 惰性导入 thunk。
*
* **为什么必须是字面量**：`import(specifier)` 的 specifier 一旦是变量，任何
* **静态分析型**的打包/追踪器（`@vercel/nft`、rolldown 的依赖内联、SEA 单文件打包）
* 都无法把它解析成一个具体包 —— 后果是依赖不会被带进产物，运行时才报
* {@link LibLoadError}（Vercel 的 `form-data`、SEA 的 14 个重依赖都是这个坑）。
* 字面量则天然可被解析（1.x `utils/lib.js` 的静态 `require("form-data")` 正是如此）。
*
* **与「零静态依赖」的关系**：本表是**函数体内的动态** `import()`，不在模块顶层执行，
* 因此既保持惰性（不用到不加载，冷启动不受影响），也不违反「禁止重依赖顶层静态 import」。
* 至于「不要被构建器打包进产物」——那由各包的 `deps.neverBundle`（重依赖恒 external）
* 保证，与本表的字面量写法无关。
*
* **维护约定**：新增/更换重依赖时，在此加一行 + 适配器 `dependencies` 同步声明即可；
* 若漏加，`loadLib` 仍会走变量间接的兜底路径（有 `node_modules` 的形态照常工作），
* 但依赖会重新变得不可被静态追踪。
*
* 本常量**不**由 `src/index.ts` 转发（非公共 API），仅供纪律测试核对
* 「`loadLib` 的调用点 ↔ 本表」是否一一对应。
*/
const LITERAL_LOADERS = {
	nodemailer: () => import("./nodemailer-Dn_NX6t-.js"),
	jsdom: () => import("./api-AHdoe3Ji.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)),
	dompurify: () => import("./purify.es-CKs0ZDvj.js"),
	"@imaegoo/node-ip2region": () => import("./lib-stubs-la_KkjCS.js"),
	"akismet-api": () => import("./lib-stubs-la_KkjCS.js"),
	"tencentcloud-sdk-nodejs-tms": () => import("./lib-stubs-la_KkjCS.js"),
	"form-data": () => import("./form_data-BGwZdh54.js").then((n) => /* @__PURE__ */ __toESM(n.t(), 1)),
	xml2js: () => import("./xml2js-CVp50J_4.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)),
	"html-to-text": () => import("./html-to-text-CbnGqNX_.js"),
	pushoo: () => import("./dist-DDV0lCzf.js"),
	"@xsai/generate-text": () => import("./dist-DFi7Q9EW.js"),
	bowser: () => import("./es5-C1Fhvq26.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)),
	marked: () => import("./marked.esm-DZz9F_8r.js")
};
/**
* 默认动态导入：命中 {@link LITERAL_LOADERS} 走字面量（可被静态追踪），
* 未收录的 specifier 回落变量间接的动态 import（保留「不静态绑定未知依赖」的性质）。
* @param specifier 包名
* @returns 模块命名空间
*/
const defaultImporter = async (specifier) => {
	if (Object.prototype.hasOwnProperty.call(LITERAL_LOADERS, specifier)) return await LITERAL_LOADERS[specifier]();
	return await import(
		/* @vite-ignore */
		specifier
);
};
/** 当前生效的导入函数（测试可替换） */
let importer = defaultImporter;
/** 当前覆写库集合（模块级单例，1.x customLibs 语义） */
let customLibs = {};
/**
* 设置覆写库（逃生舱，最高优先级；1.x setCustomLibs 签名对齐）。
* @param libs 覆写库集合
*/
function setCustomLibs(libs) {
	customLibs = libs;
}
/**
* 能力未声明错误（用户友好——绝不以 MODULE_NOT_FOUND 形态暴露）。
*/
var CapabilityError = class extends Error {
	/**
	* @param capability 未声明的能力名
	* @param packageName 关联包名
	* @param reason 平台补充说明（如 EO Makers 邮件受限文案）
	*/
	constructor(capability, packageName, reason) {
		super(`当前部署环境未声明 ${capability} 能力，无法加载 ${packageName}` + (reason ? `：${reason}` : ""));
		this.name = "CapabilityError";
	}
};
/**
* 库加载失败错误（消息含包名与安装提示）。
*/
var LibLoadError = class extends Error {
	/**
	* @param packageName 加载失败的包名
	* @param cause 原始错误
	*/
	constructor(packageName, cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		super(`缺少依赖 ${packageName}，请在当前适配器中安装：npm install ${packageName}（原始错误：${message}）`);
		this.name = "LibLoadError";
	}
};
/**
* 能力门：未声明能力即抛 {@link CapabilityError}（加载前校验，第二层）。
* @param caps 平台能力声明
* @param capability 所需能力名
* @param packageName 关联包名
* @param reason 平台补充说明
*/
function requireCapability(caps, capability, packageName, reason) {
	if (caps[capability] !== true) throw new CapabilityError(capability, packageName, reason);
}
/**
* 加载库（动态 import + 失败转 {@link LibLoadError}）。
* @param specifier 包名
* @returns 模块命名空间
*/
async function loadLib(specifier) {
	try {
		return await importer(specifier);
	} catch (e) {
		throw new LibLoadError(specifier, e);
	}
}
/**
* 取 CJS/ESM 兼容的模块本体（ESM 命名空间的 default 优先）。
* @param mod 模块命名空间
* @returns 模块本体
*/
function pickDefault(mod) {
	return mod?.default ?? mod;
}
/**
* 获取 nodemailer（mail 能力；覆写优先）。
* @param caps 平台能力声明
* @returns nodemailer 模块本体
*/
async function getNodemailer(caps) {
	if (customLibs.nodemailer) return customLibs.nodemailer;
	requireCapability(caps, "mail", "nodemailer", "无法发送邮件");
	return pickDefault(await loadLib("nodemailer"));
}
/**
* 获取 DOMPurify（domPurify 能力；jsdom + dompurify 组合装载；覆写优先——
* eo-makers 以直通 DOMPurify 注入，绕过 jsdom 依赖）。
* @param caps 平台能力声明
* @returns DOMPurify 实例
*/
async function getDomPurify(caps) {
	if (customLibs.DOMPurify) return customLibs.DOMPurify;
	requireCapability(caps, "domPurify", "dompurify", "无法对评论内容做 XSS 消毒");
	const { JSDOM } = pickDefault(await loadLib("jsdom"));
	return pickDefault(await loadLib("dompurify"))(new JSDOM("").window);
}
/**
* 获取 IP 属地查询器（ip2region 能力，体积大故外部化；覆写优先——
* eo-makers 以 fs-free 内存查询器注入，绕过 8.33 MB 的 `fs` 版 db）。
* @param caps 平台能力声明
* @returns 查询器构造器
*/
async function getIpToRegion(caps) {
	const override = customLibs["@imaegoo/node-ip2region"];
	if (override) return override;
	requireCapability(caps, "ip2region", "@imaegoo/node-ip2region");
	return pickDefault(await loadLib("@imaegoo/node-ip2region"));
}
/**
* 获取 Akismet 客户端（akismet 能力）。
* @param caps 平台能力声明
* @returns AkismetClient 构造器
*/
async function getAkismetClient(caps) {
	requireCapability(caps, "akismet", "akismet-api");
	return pickDefault(await loadLib("akismet-api")).AkismetClient;
}
/**
* 获取腾讯云文本安全 SDK（tencentTms 能力）。
* @param caps 平台能力声明
* @returns SDK 模块本体
*/
async function getTencentcloudTms(caps) {
	requireCapability(caps, "tencentTms", "tencentcloud-sdk-nodejs-tms");
	return pickDefault(await loadLib("tencentcloud-sdk-nodejs-tms"));
}
/**
* 获取 FormData（imageUpload 能力；覆写优先——edge 运行时以原生 FormData 垫片注入，
* 绕过只认 Node 流的 `form-data` 包）。
* @param caps 平台能力声明
* @returns FormData 构造器
*/
async function getFormData(caps) {
	if (customLibs["form-data"]) return customLibs["form-data"];
	requireCapability(caps, "imageUpload", "form-data");
	return pickDefault(await loadLib("form-data"));
}
/**
* 获取 xml2js（导入器使用；全部适配器可用）。
* @returns xml2js 模块本体
*/
async function getXml2js() {
	return pickDefault(await loadLib("xml2js"));
}
/**
* 获取 html-to-text 编译产物；通知忽略图片，长度检查按替代文本或固定占位计数。
* @param options 是否使用评论长度计数规则
* @returns 编译后的转换函数
*/
async function getHtmlToText(options = {}) {
	return pickDefault(await loadLib("html-to-text")).compile({
		wordwrap: false,
		formatters: { 
		/** 图片按替代文本计数；无替代文本的图片和分隔线各占 10 个字符。 */
wordCount(elem, _walk, builder) {
			const text = elem.name === "img" ? elem.attribs.alt?.trim() : "";
			builder.addInline(text || "-".repeat(10), { noWordTransform: true });
		} },
		selectors: [
			{
				selector: "a",
				options: { ignoreHref: true }
			},
			{
				selector: "img",
				format: options.forWordCount ? "wordCount" : "skip"
			},
			...options.forWordCount ? [{
				selector: "hr",
				format: "wordCount"
			}] : []
		]
	});
}
/**
* 获取 pushoo（通知能力；全部适配器可用）。
* @returns pushoo 推送函数
*/
async function getPushoo() {
	return pickDefault(await loadLib("pushoo"));
}
/**
* 获取 @xsai/generate-text（ai 能力）。
*
* 注意该包**只有具名导出** `generateText`（无 default），因此**不能**走
* {@link pickDefault}——直接把模块命名空间当函数用会在调用时抛
* `TypeError: ... is not a function`（AI 垃圾检测整体失效，且只在真实密钥下才暴露）。
* @param caps 平台能力声明
* @returns generateText 函数
*/
async function getGenerateText(caps) {
	requireCapability(caps, "ai", "@xsai/generate-text");
	const mod = await loadLib("@xsai/generate-text");
	const impl = mod.generateText ?? mod.default;
	if (typeof impl !== "function") throw new LibLoadError("@xsai/generate-text", /* @__PURE__ */ new TypeError("模块未导出 generateText 函数（期望具名导出 generateText）"));
	return impl;
}
/**
* 获取 bowser（UA 解析；全部适配器可用）。
* @returns bowser 模块本体
*/
async function getBowser() {
	return pickDefault(await loadLib("bowser"));
}
/**
* 获取 marked（导入器 Markdown 解析；全部适配器可用）。
* @returns marked 模块本体
*/
async function getMarked() {
	return pickDefault(await loadLib("marked"));
}
/**
* 安全字符串化工具（消除 [object Object] 风险的统一入口）。
*/
/**
* 任意值转字符串：字符串原样；null/undefined 空串；其余 JSON 化。
* @param v 任意值
* @returns 字符串
*/
function toStr$1(v) {
	if (typeof v === "string") return v;
	if (v === void 0 || v === null) return "";
	try {
		return JSON.stringify(v);
	} catch {
		return "";
	}
}
/**
* 哈希工具（1.x lib.js 的 getMd5/getSha256 对齐，Node 内置 crypto，零依赖）。
*/
/**
* 计算 MD5（1.x getMd5 语义：输入 String 化）。
* @param message 输入
* @returns 32 位十六进制摘要
*/
function md5(message) {
	return createHash("md5").update(toStr$1(message)).digest("hex");
}
/**
* 计算 SHA-256（1.x getSha256 语义：null/undefined 视为空串）。
* @param message 输入
* @returns 64 位十六进制摘要
*/
function sha256(message) {
	return createHash("sha256").update(message == null ? "" : toStr$1(message)).digest("hex");
}
/** IP 属地查询器实例缓存（进程级，1.x ipRegionSearcher 语义） */
let ipRegionSearcher = null;
/**
* 获取（并缓存）IP 属地查询器。
* @param caps 平台能力声明
* @returns 查询器实例；未声明 ip2region 能力返回 null
*/
async function getIpRegionSearcher(caps) {
	if (!ipRegionSearcher) {
		if (caps.ip2region !== true) return null;
		ipRegionSearcher = (await getIpToRegion(caps)).create();
	}
	return ipRegionSearcher;
}
/**
* 同时查询 /path 和 /path/ 的评论（1.x getUrlQuery 对齐）。
* @param url 页面路径
* @returns 两个形态的路径数组
*/
function getUrlQuery(url) {
	return [url, url[url.length - 1] === "/" ? url.substring(0, url.length - 1) : `${url}/`];
}
/**
* 批量页面的多形态路径展平（1.x getUrlsQuery 对齐）。
* @param urls 页面路径列表
* @returns 展平后的路径列表
*/
function getUrlsQuery(urls) {
	const query = [];
	for (const url of urls) if (url) query.push(...getUrlQuery(url));
	return query;
}
/**
* 获取回复人昵称（1.x ruser 对齐）。
* @param pid 父评论 id
* @param comments 同页评论列表
* @returns 被回复人昵称；找不到为 null
*/
function ruser(pid, comments) {
	const comment = comments.find((item) => item._id === pid);
	return comment ? comment.nick : null;
}
/**
* 取 UA 解析器的首组正则捕获（1.x getFirstMatch 对齐）。
* @param regexp 正则
* @param ua UA 字符串
* @returns 捕获组或空串
*/
function getFirstMatch(regexp, ua) {
	const match = ua.match(regexp);
	return match && match.length > 0 && match[1] || "";
}
/**
* 修正 os.versionName 缺失（Win 11 / macOS ^11 / Android ^10 / Harmony，1.x fixOS 对齐）。
* @param uaParser bowser 解析器
* @returns 修正后的 OS 信息
*/
function fixOS(uaParser) {
	const os = uaParser.getOS();
	if (!os.versionName) {
		if (os.name === "Windows" && os.version === "NT 11.0") os.versionName = "11";
		else if (os.name === "macOS") os.versionName = {
			"11": "Big Sur",
			"12": "Monterey",
			"13": "Ventura",
			"14": "Sonoma",
			"15": "Sequoia",
			"16": "Tahoe"
		}[(os.version ?? "").split(".")[0]];
		else if (os.name === "Android") os.versionName = {
			"10": "Quince Tart",
			"11": "Red Velvet Cake",
			"12": "Snow Cone",
			"13": "Tiramisu",
			"14": "Upside Down Cake",
			"15": "Vanilla Ice Cream",
			"16": "Baklava"
		}[(os.version ?? "").split(".")[0]];
		else if (uaParser.test(/harmony/i)) {
			os.name = "Harmony";
			os.version = getFirstMatch(/harmony[\s/-](\d+(\.\d+)*)/i, uaParser.getUA());
			os.versionName = "";
		}
	}
	return os;
}
/**
* 获取 IP 属地（1.x getIpRegion 对齐：IPv4-mapped IPv6 与端口剥离、
* 有省显示省、无省显示国家；detail=true 返回省市运营商）。
* @param caps 平台能力声明
* @param ip IP 地址
* @param detail true 返回省市运营商，false 只返回省
* @returns 属地文案；查询失败或未声明能力返回空串
*/
async function getIpRegion(caps, ip, detail = false) {
	if (!ip) return "";
	try {
		const searcher = await getIpRegionSearcher(caps);
		if (!searcher) return "";
		const normalized = ip.replace(/^::ffff:/, "").replace(/:[0-9]*$/, "");
		const result = searcher.binarySearchSync(normalized);
		if (!result) return "";
		const [country, , province, city, isp] = result.region.split("|");
		const area = province.trim() && province !== "0" ? province : country;
		if (detail) return area === city ? [city, isp].join(" ") : [
			area,
			city,
			isp
		].join(" ");
		return area.replace(/(省|市)$/, "");
	} catch {
		return "";
	}
}
/**
* 规范化邮箱（trim + 小写，1.x normalizeMail 对齐）。
* @param mail 邮箱
* @returns 规范化邮箱
*/
function normalizeMail(mail) {
	return String(mail).trim().toLowerCase();
}
/**
* 邮箱等值比较（1.x equalsMail 对齐；任一为空即 false）。
* @param mail1 邮箱一
* @param mail2 邮箱二
* @returns 是否相等
*/
function equalsMail(mail1, mail2) {
	if (!mail1 || !mail2) return false;
	return normalizeMail(mail1) === normalizeMail(mail2);
}
/**
* 获取评论邮箱 MD5（有 mailMd5 用之，否则由 mail 计算，兜底 nick，1.x 对齐）。
* @param comment 评论文档
* @returns MD5 哈希
*/
function getMailMd5(comment) {
	if (comment.mailMd5) return comment.mailMd5;
	if (comment.mail) return md5(normalizeMail(comment.mail));
	return md5(comment.nick ?? "");
}
/**
* 获取评论邮箱 SHA-256（Cravatar 之外的 Gravatar CDN 使用，1.x 对齐）。
* @param comment 评论文档
* @returns SHA-256 哈希
*/
function getMailSha256(comment) {
	if (comment.mail) return sha256(normalizeMail(comment.mail));
	return sha256(comment.nick ?? "");
}
/**
* 拼接头像地址（1.x getAvatar 对齐：QQ 头像直链优先，Gravatar CDN 兜底；
* Cravatar 不支持 sha256 故用 md5）。
* @param comment 评论文档
* @param config 全量配置
* @returns 头像 URL
*/
function getAvatar(comment, config) {
	if (comment.avatar) return comment.avatar;
	const gravatarCdn = config.GRAVATAR_CDN || "weavatar.com";
	let defaultGravatar = `initials&name=${comment.nick}`;
	if (config.DEFAULT_GRAVATAR) defaultGravatar = String(config.DEFAULT_GRAVATAR);
	return `https://${gravatarCdn}/avatar/${gravatarCdn === "cravatar.cn" ? getMailMd5(comment) : getMailSha256(comment)}?d=${defaultGravatar}`;
}
/**
* 判断是否为 URL（1.x isUrl 对齐）。
* @param s 待测字符串
* @returns 是否 http(s):// 开头
*/
function isUrl(s) {
	return /^http(s)?:\/\//.test(s);
}
/**
* 邮箱格式校验（1.x isValidEmail 对齐：拒绝可能触发 nodemailer 地址分组解析
* 的字符；基础格式校验）。
* @param mail 邮箱
* @returns 是否合法
*/
function isValidEmail(mail) {
	if (!mail || typeof mail !== "string") return false;
	const trimmed = mail.trim();
	if (!trimmed) return false;
	if (trimmed.indexOf(":") !== -1) return false;
	if (trimmed.indexOf(" ") !== -1) return false;
	if (trimmed.indexOf(";") !== -1) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
/**
* 判断是否 QQ 邮箱形态（1.x isQQ 对齐）。
* @param mail 邮箱
* @returns 是否 QQ 号或 QQ 邮箱
*/
function isQQ(mail) {
	return /^[1-9][0-9]{4,10}$/.test(mail) || /^[1-9][0-9]{4,10}@qq.com$/i.test(mail);
}
/**
* 为纯 QQ 号补 @qq.com 后缀（1.x addQQMailSuffix 对齐）。
* @param mail 邮箱
* @returns 补全后的邮箱
*/
function addQQMailSuffix(mail) {
	if (/^[1-9][0-9]{4,10}$/.test(mail)) return `${mail}@qq.com`;
	return mail;
}
/**
* 获取 QQ 头像（1.x getQQAvatar 对齐；接口已失效，失败返回 null）。
* @param qq QQ 号或 QQ 邮箱
* @returns 头像 URL 或 null
*/
async function getQQAvatar(qq) {
	try {
		return (await httpGet(`https://aq.qq.com/cn2/get_img/get_face?img_type=3&uin=${qq.replace(/@qq.com/gi, "")}`)).data?.url || null;
	} catch {
		return null;
	}
}
/**
* 获取 QQ 昵称（1.x getQQNick 对齐：v1.tqq.me 接口，QQ_API_KEY Bearer 鉴权；
* 失败返回 null 不抛错）。
* @param qq QQ 号或 QQ 邮箱
* @param qqApiKey QQ_API_KEY 配置（可选）
* @returns 昵称或 null
*/
async function getQQNick(qq, qqApiKey) {
	try {
		const qqNum = qq.replace(/@qq.com/gi, "");
		/** 请求头（API Key 鉴权可选） */
		const headers = {};
		if (qqApiKey) headers.Authorization = `Bearer ${qqApiKey}`;
		const data = (await httpGet(`https://v1.tqq.me/v1/qqname?qq=${qqNum}`, { headers })).data;
		if (data?.code === 200 && data.data?.nick) return data.data.nick;
		return null;
	} catch {
		return null;
	}
}
/**
* 获取相对路径（绝对 URL 取 pathname；已是相对地址则原样返回，1.x 对齐）。
* @param url 页面地址
* @returns 相对路径
*/
function getRelativeUrl(url) {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}
/**
* 将评论记录转换为前端需要的格式（1.x toCommentDto 逐字段对齐）。
* @param comment 评论文档
* @param uid 当前用户 token
* @param replies 回复 DTO 列表
* @param comments 同页评论列表（ruser 查找用）
* @param config 全量配置
* @param caps 平台能力声明（UA 解析 / IP 属地）
* @returns 前端评论 DTO
*/
async function toCommentDto(comment, uid, replies, comments, config, caps) {
	let displayOs = "";
	let displayBrowser = "";
	if (config.SHOW_UA !== "false" && comment.ua) try {
		const ua = (await getBowser()).getParser(comment.ua);
		const os = fixOS(ua);
		displayOs = [os.name, os.versionName ? os.versionName : os.version].join(" ");
		displayBrowser = [ua.getBrowserName(), ua.getBrowserVersion()].join(" ");
	} catch {}
	const showRegion = !!config.SHOW_REGION && config.SHOW_REGION !== "false";
	const ups = comment.ups ?? [];
	const downs = comment.downs ?? [];
	return {
		id: String(comment._id),
		nick: comment.nick,
		avatar: comment.avatar,
		mailMd5: getMailMd5(comment),
		link: comment.link,
		comment: comment.comment,
		os: displayOs,
		browser: displayBrowser,
		ipRegion: showRegion ? await getIpRegion(caps, comment.ip) : "",
		master: comment.master,
		like: (comment.like ?? []).length,
		ups: ups.length,
		downs: downs.length,
		liked: ups.includes(uid),
		disliked: downs.includes(uid),
		replies,
		rid: comment.rid,
		pid: comment.pid,
		ruser: ruser(comment.pid, comments),
		top: comment.top,
		isSpam: comment.isSpam,
		isOwner: Boolean(uid && comment.uid === uid),
		created: comment.created,
		updated: comment.updated
	};
}
/**
* 筛除隐私字段，拼接回复列表（1.x parseComment 对齐：无 rid 的为主楼，
* 回复按 rid 归组并按 created 升序）。
* @param comments 评论文档列表
* @param uid 当前用户 token
* @param config 全量配置
* @param caps 平台能力声明
* @returns 前端评论 DTO 列表
*/
async function parseComment(comments, uid, config, caps) {
	const result = [];
	for (const comment of comments) if (!comment.rid) {
		const replies = await Promise.all(comments.filter((item) => item.rid === String(comment._id)).map((item) => toCommentDto(item, uid, [], comments, config, caps)));
		replies.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
		result.push(await toCommentDto(comment, uid, replies, [], config, caps));
	}
	return result;
}
/**
* 管理员评论视图（1.x parseCommentForAdmin 对齐：原样保留 + 补 IP 属地详情）。
* @param comments 评论文档列表
* @param caps 平台能力声明
* @returns 附带 ipRegion 的文档列表
*/
async function parseCommentForAdmin(comments, caps) {
	return Promise.all(comments.map(async (comment) => ({
		...comment,
		ipRegion: await getIpRegion(caps, comment.ip, true)
	})));
}
/**
* 反垃圾与验证码服务（1.x utils/spam.js + utils/index.js 的 captcha/limit 部分
* 语义对齐）。
*
* 链路（COMMENT_SUBMIT）：
* 1. preCheckSpam 预检（长度 / 屏蔽词 / 人工审核标记 / 违禁词）——按需加载纯文本转换器；
* 2. checkCaptcha 验证码（Turnstile / Geetest / Cap 内嵌或外部）；
* 3. limitFilter 频率限制（单 IP 与全站 10 分钟窗口）；
* 4. postCheckSpam 后检（腾讯云 TMS / Akismet / Jev / LLM，postSubmit 异步阶段）。
*/
/**
* 预垃圾评论检测；长度限制按 HTML 转换后的文本计算。
* @param comment 待检评论字段
* @param config 全量配置
* @param logger 请求日志
* @returns 是否标记为垃圾（MANUAL_REVIEW / 违禁词）
*/
async function preCheckSpam(comment, config, logger) {
	let limitLength = parseInt(String(config.LIMIT_LENGTH ?? ""));
	if (Number.isNaN(limitLength)) limitLength = 500;
	if (limitLength) {
		if (comment.comment.length > limitLength * 10) throw new Error("评论内容过长");
		if ((await getHtmlToText({ forWordCount: true }))(comment.comment).length > limitLength) throw new Error("评论内容过长");
	}
	if (config.BLOCKED_WORDS) {
		const commentLowerCase = comment.comment.toLowerCase();
		const nickLowerCase = comment.nick.toLowerCase();
		for (const blockedWord of String(config.BLOCKED_WORDS).split(",")) {
			const blockedWordLowerCase = blockedWord.trim().toLowerCase();
			if (commentLowerCase.indexOf(blockedWordLowerCase) !== -1 || nickLowerCase.indexOf(blockedWordLowerCase) !== -1) throw new Error("包含屏蔽词");
		}
	}
	if (config.AKISMET_KEY === "MANUAL_REVIEW") {
		logger.info("已使用人工审核模式，评论审核后才会发表~");
		return true;
	} else if (config.FORBIDDEN_WORDS) {
		const commentLowerCase = comment.comment.toLowerCase();
		const nickLowerCase = comment.nick.toLowerCase();
		const linkLowerCase = (comment.link || "").toLowerCase();
		const mailLowerCase = (comment.mail || "").toLowerCase();
		for (const forbiddenWord of String(config.FORBIDDEN_WORDS).replace(/,+$/, "").split(",")) {
			const forbiddenWordLowerCase = forbiddenWord.trim().toLowerCase();
			if (commentLowerCase.indexOf(forbiddenWordLowerCase) !== -1 || nickLowerCase.indexOf(forbiddenWordLowerCase) !== -1 || linkLowerCase.indexOf(forbiddenWordLowerCase) !== -1 || mailLowerCase.indexOf(forbiddenWordLowerCase) !== -1) {
				logger.warn("包含违禁词，直接标记为垃圾评论~");
				return true;
			}
		}
	}
	return false;
}
/**
* Turnstile 验证码检测（1.x checkTurnstileCaptcha 对齐）。
* @param params 验证参数
*/
async function checkTurnstileCaptcha(params) {
	try {
		const formData = new (await (getFormData(params.caps)))();
		formData.append("secret", params.turnstileTokenSecretKey);
		formData.append("response", params.turnstileToken);
		formData.append("remoteip", params.ip);
		if (!(await httpPost("https://challenges.cloudflare.com/turnstile/v0/siteverify", formData, { headers: formData.getHeaders() })).data.success) throw new Error("验证码错误");
	} catch (e) {
		throw new Error(`验证码检测失败: ${e instanceof Error ? e.message : String(e)}`);
	}
}
/**
* Geetest v4 验证码检测（1.x checkGeeTestCaptcha 对齐：HMAC-SHA256 签名）。
* @param params 验证参数
*/
async function checkGeeTestCaptcha(params) {
	try {
		const signToken = createHmac("sha256", params.geeTestCaptchaKey).update(params.geeTestLotNumber).digest("hex");
		const search = new URLSearchParams({
			lot_number: params.geeTestLotNumber,
			captcha_output: params.geeTestCaptchaOutput,
			pass_token: params.geeTestPassToken,
			gen_time: params.geeTestGenTime,
			sign_token: signToken
		});
		const data = (await httpPost(`https://gcaptcha4.geetest.com/validate?captcha_id=${params.geeTestCaptchaId}`, search.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } })).data;
		if (data.result !== "success") throw new Error(data.reason || data.msg || "验证码错误");
	} catch (e) {
		throw new Error(`极验验证码检测失败: ${e instanceof Error ? e.message : String(e)}`);
	}
}
/**
* Cap 验证码检测（内嵌 validateToken 或外部 Standalone siteverify，1.x 对齐）。
* @param params 验证参数（cap 为内嵌 Cap 实例）
* @param validateToken 内嵌 Cap 的 token 校验函数
*/
async function checkCapCaptcha(params, validateToken) {
	try {
		if (params.cap) {
			if (!validateToken) throw new Error("内嵌 Cap 未初始化");
			if (!await validateToken(params.cap, params.capToken)) throw new Error("验证码错误");
			return;
		}
		const data = (await httpPost(`${(params.capApiEndpoint ?? "").replace(/\/$/, "")}/siteverify`, {
			secret: params.capSecretKey,
			response: params.capToken
		}, { headers: { "Content-Type": "application/json" } })).data;
		if (!data.success) throw new Error(data.error || "验证码错误");
	} catch (e) {
		throw new Error(`Cap验证码检测失败: ${e instanceof Error ? e.message : String(e)}`);
	}
}
/**
* 发表频率限制（1.x limitFilter 对齐：单 IP 与全站 10 分钟窗口计数）。
* @param options 限流入参
*/
async function limitFilter(options) {
	const { db, config, ip } = options;
	let limitPerMinute = parseInt(String(config.LIMIT_PER_MINUTE ?? ""));
	if (Number.isNaN(limitPerMinute)) limitPerMinute = 10;
	if (limitPerMinute) {
		if (await db.countComments({
			ip,
			created: { [GT]: Date.now() - 6e5 }
		}) > limitPerMinute) throw new Error("发言频率过高");
	}
	let limitPerMinuteAll = parseInt(String(config.LIMIT_PER_MINUTE_ALL ?? ""));
	if (Number.isNaN(limitPerMinuteAll)) limitPerMinuteAll = 10;
	if (limitPerMinuteAll) {
		if (await db.countComments({ created: { [GT]: Date.now() - 6e5 } }) > limitPerMinuteAll) throw new Error("评论太火爆啦 >_< 请稍后再试");
	}
}
/**
* 提取模型返回中的 JSON 片段（1.x extractJson 对齐）。
* @param rawText 模型原始返回
* @returns JSON 片段
*/
function extractJson(rawText) {
	if (!rawText) return "";
	const trimmed = rawText.trim();
	const match = trimmed.match(/\{[\s\S]*\}/);
	return match ? match[0] : trimmed;
}
/**
* 修复模型返回 JSON 的尾逗号（1.x repairJson 对齐）。
* @param jsonStr JSON 片段
* @returns 修复后文本
*/
function repairJson(jsonStr) {
	if (!jsonStr) return "";
	return jsonStr.trim().replace(/,\s*([}\]])/g, "$1");
}
/**
* 构建垃圾判定消息（1.x buildMessages 对齐：system 指令 + user 评论数据 + 重试错误）。
* @param commentData 评论数据
* @param errorMsg 上次校验错误（重试用）
* @param customPrompt 管理员自定义指令
* @returns messages 数组
*/
function buildMessages(commentData, errorMsg = "", customPrompt = "") {
	const systemContent = customPrompt || `You are a blog comment moderation assistant. Analyze ALL fields below and determine if this submission is spam or ham.

Spam includes ANY of the following in ANY field:
- Commercial ads, promotions, or buying/selling offers (e.g., "代开发票", "加微信", "兼职", "办证", "AI中转站").
- Special case: If the comment text is harmless, but the nickname is suspicious (e.g., contains ads or promotions) AND a website link is provided, treat it as SPAM.
- Meaningless gibberish or spammy repetition (e.g., "顶顶顶", "111111", "asdfgh", "好" repeated).
- Abusive language, insults, or offensive Chinese slang.
- Suspicious links or SEO spam in the website field.
- Bot-like automated greetings.

Ham includes:
- Genuine questions, constructive feedback, technical discussions, or normal greetings in Chinese/English.

Strictly follow these rules:
1. If ANY field contains spam content, output exactly {"spam": true}.
2. If ALL fields are legitimate, output exactly {"spam": false}.
3. Do not include any explanations, introduction, punctuation, or extra spaces. Output only the JSON object.

Your response MUST be a single valid JSON object, like:
{"spam": true} or {"spam": false}`;
	let userContent = `Comment: ${commentData.comment}
Nickname: ${commentData.nick || ""}
Website: ${commentData.link || ""}`;
	if (errorMsg) userContent += `\n\n[ERROR FROM PREVIOUS ATTEMPT]: Your last response failed verification with error: "${errorMsg}". Please correct your output format and make sure to return exactly valid JSON.`;
	return [{
		role: "system",
		content: systemContent
	}, {
		role: "user",
		content: userContent
	}];
}
/**
* Jev 垃圾检测（System One noul 概率判定）。
*
* 使用固定问题让 Jev 判断整条评论是否为垃圾内容；state 同时包含正文、昵称和网址，
* 避免「正文正常但昵称/网址是推广」这类软广告漏判。
*
* @param comment 评论数据
* @param config 全量配置
* @param logger 请求日志
* @returns 是否垃圾；响应格式异常时抛错，由 postCheckSpam 统一降级为 undefined
*/
async function checkByJev(comment, config, logger) {
	const endpoint = String(config.JEV_API_ENDPOINT || "https://api.typesafe.ai/v1/systemone");
	const model = String(config.JEV_MODEL || "jev-latest");
	const configuredThreshold = Number(config.JEV_SPAM_THRESHOLD);
	const threshold = config.JEV_SPAM_THRESHOLD !== void 0 && config.JEV_SPAM_THRESHOLD !== "" && Number.isFinite(configuredThreshold) && configuredThreshold >= 0 && configuredThreshold <= 1 ? configuredThreshold : .85;
	const response = await httpPost(endpoint, {
		model,
		state: {
			comment: comment.comment || "",
			nickname: comment.nick || "",
			website: comment.link || ""
		},
		questions: { spam: {
			type: "noul",
			instructions: `
Is this submission spam for a personal blog?

Evaluate the comment text, nickname, and website together.

Treat the submission as spam when it contains or represents:
- Unsolicited commercial advertisements or promotions.
- SEO spam, link-building spam, marketing, or lead-generation services.
- Scams, gambling, adult services, or financial promotions.
- Meaningless repetitive content or automated promotional greetings.
- Generic praise, thanks, or greetings when the nickname or website clearly represents a commercial, SEO, marketing, or promotional service.

Important:
- A harmless-looking comment does not make the submission legitimate if the nickname or website is primarily being used for promotion.
- Do not judge only the comment text. Consider nickname and website as equally important signals.
- Do not penalize genuine personal blogs, developer websites, project pages, or personal homepages when the comment contains relevant, substantive discussion or normal community interaction.

Treat genuine questions, technical discussions, constructive feedback, relevant experience sharing, and normal greetings from ordinary users as not spam.
`.trim()
		} }
	}, {
		headers: {
			Authorization: `Bearer ${String(config.JEV_API_KEY)}`,
			"Content-Type": "application/json"
		},
		timeout: 3e4
	});
	const score = response.data?.answers?.spam?.noul;
	if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) throw new Error("Jev 返回格式不合法：缺少 answers.spam.noul");
	const isSpam = score >= threshold;
	logger.info(`Jev 判定为 ${isSpam ? "SPAM" : "HAM"} (score=${score.toFixed(4)}, threshold=${threshold}, model="${response.data.model || model}")`);
	return isSpam;
}
/**
* LLM 垃圾检测（1.x checkByLLM 对齐：重试 + JSON 校验 + 失败放行兜底）。
* @param comment 评论数据
* @param config 全量配置
* @param caps 平台能力声明（ai）
* @param logger 请求日志
* @returns 是否垃圾；历经重试仍失败时放行（false）
*/
async function checkByLLM(comment, config, caps, logger) {
	const maxRetries = Number(config.LLM_MAX_RETRIES) || 3;
	let lastError = "";
	let generateText = null;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 1e3));
		try {
			if (!generateText) generateText = await getGenerateText(caps);
			const messages = buildMessages(comment, lastError, String(config.LLM_SPAM_PROMPT ?? ""));
			const rawText = (await generateText?.({
				apiKey: config.LLM_API_KEY,
				baseURL: config.LLM_API_ENDPOINT || "https://api.deepseek.com/v1",
				model: config.LLM_MODEL || "deepseek-chat",
				responseFormat: { type: "json_object" },
				messages
			}))?.text ?? "";
			let parsed;
			try {
				parsed = JSON.parse(repairJson(extractJson(rawText)));
			} catch (err) {
				lastError = err instanceof Error ? err.message : String(err);
				logger.warn(`LLM 返回校验失败 (尝试第 ${attempt}/${maxRetries} 次)`);
				continue;
			}
			if (typeof parsed === "object" && parsed !== null && typeof parsed.spam === "boolean") {
				logger.info(`LLM 判定为 ${parsed.spam ? "SPAM" : "HAM"} (第 ${attempt} 次)`);
				return parsed.spam;
			}
			lastError = "Key \"spam\" must be a boolean value";
			logger.warn(`LLM 返回校验失败 (尝试第 ${attempt}/${maxRetries} 次)`);
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			logger.error(`LLM 请求异常 (尝试第 ${attempt}/${maxRetries} 次), 错误: ${lastError}`);
		}
	}
	logger.error(`LLM 垃圾评论检测历经 ${maxRetries} 次尝试均失败，执行终极放行兜底（返回 false）`);
	return false;
}
/**
* 后垃圾评论检测（1.x postCheckSpam 链路对齐基础上扩展：博主豁免 → 腾讯云 →
* Akismet → Jev → LLM；异常不阻断主流程）。
* @param options 检测入参
* @returns 是否垃圾；无法判定时 undefined（1.x 兼容）
*/
async function postCheckSpam(options) {
	const { comment, config, caps, logger } = options;
	try {
		let isSpam;
		if (comment.isSpam) isSpam = true;
		else if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) isSpam = false;
		else if (config.QCLOUD_SECRET_ID && config.QCLOUD_SECRET_KEY) {
			const ClientCtor = (await getTencentcloudTms(caps)).tms.v20201229.Client;
			const checkResult = await new ClientCtor({
				credential: {
					secretId: config.QCLOUD_SECRET_ID,
					secretKey: config.QCLOUD_SECRET_KEY
				},
				region: "ap-shanghai",
				profile: { httpProfile: { endpoint: "tms.tencentcloudapi.com" } }
			}).TextModeration({
				Content: Buffer.from(String(comment.comment ?? ""), "utf8").toString("base64"),
				DataId: comment._id,
				User: { Nickname: comment.nick },
				Device: { IP: comment.ip },
				...config.QCLOUD_CMS_BIZTYPE ? { BizType: config.QCLOUD_CMS_BIZTYPE } : {}
			});
			isSpam = checkResult.Suggestion !== "Pass";
			if (isSpam) logger.warn(`腾讯云判定不通过: id="${comment._id}" nick="${comment.nick}" suggestion="${checkResult.Suggestion}" label="${checkResult.Label}" subLabel="${checkResult.SubLabel}"`);
		} else if (config.AKISMET_KEY) {
			const akismetClient = new (await (getAkismetClient(caps)))({
				key: config.AKISMET_KEY,
				blog: config.SITE_URL
			});
			if (!await akismetClient.verifyKey()) {
				logger.warn("Akismet key 不可用：", config.AKISMET_KEY);
				return;
			}
			isSpam = await akismetClient.checkSpam({
				user_ip: comment.ip,
				user_agent: comment.ua,
				permalink: comment.href,
				comment_type: comment.rid ? "reply" : "comment",
				comment_author: comment.nick,
				comment_author_email: comment.mail,
				comment_author_url: comment.link,
				comment_content: comment.comment
			});
		} else if (config.JEV_API_KEY) isSpam = await checkByJev(comment, config, logger);
		else if (config.LLM_API_KEY) isSpam = await checkByLLM(comment, config, caps, logger);
		logger.verbose("垃圾评论检测结果：", isSpam);
		return isSpam;
	} catch (err) {
		logger.error("垃圾评论检测异常：", err);
		return;
	}
}
/**
* 保存垃圾检测结果（1.x saveSpamCheckResult 对齐：判定为垃圾才回写）。
* 2.0 差异说明：postSubmit 收到的评论已带 _id（保存阶段回填），按 _id 精确
* 回写；1.x 按 created 回写是历史形态，行为等价但可能误伤同毫秒文档。
* @param db 数据库
* @param comment 评论（携带 _id）
* @param isSpam 判定结果
*/
async function saveSpamCheckResult(db, comment, isSpam) {
	if (isSpam !== void 0) comment.isSpam = isSpam;
	if (isSpam && comment._id) await db.updateComment(comment._id, {
		isSpam,
		updated: Date.now()
	});
}
/**
* HTML 实体转义（1.x escapeHtml 对齐：仅在渲染邮件时转义，防止邮件模板
* 存储型 XSS；不改数据库内容）。
* @param str 原文
* @returns 转义后文本
*/
function escapeHtml(str) {
	if (typeof str !== "string") return toStr$1(str);
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** 已初始化的邮件传输器（进程级缓存；emailTest 前重置） */
let transporter = null;
/**
* 初始化邮件插件（1.x initMailer 对齐：SMTP_SERVICE 或 SMTP_HOST 两种形态）。
* @param options 初始化选项
* @param caps 平台能力声明
* @param logger 请求日志
* @returns 是否初始化成功
*/
async function initMailer(options) {
	const { config, throwErr = false, caps, logger } = options;
	try {
		if (!config || !config.SMTP_USER || !config.SMTP_PASS) throw new Error("数据库配置不存在");
		/** nodemailer 传输配置 */
		const transportConfig = { auth: {
			user: config.SMTP_USER,
			pass: config.SMTP_PASS
		} };
		if (config.SMTP_SERVICE) transportConfig.service = config.SMTP_SERVICE;
		else if (config.SMTP_HOST) {
			transportConfig.host = config.SMTP_HOST;
			transportConfig.port = parseInt(String(config.SMTP_PORT));
			transportConfig.secure = config.SMTP_SECURE === "true";
		} else throw new Error("SMTP 服务器没有配置");
		transporter = (await getNodemailer(caps)).createTransport(transportConfig);
		try {
			if (await transporter.verify()) logger.info("SMTP 邮箱配置正常");
		} catch (error) {
			throw new Error(`SMTP 邮箱配置异常：${error instanceof Error ? error.message : String(error)}`);
		}
		return true;
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (throwErr) {
			logger.error("邮件初始化异常：", message);
			throw e;
		}
		logger.warn("邮件初始化异常：", message);
		return false;
	}
}
/**
* 拼接评论定位 URL 的 hash（1.x appendHashToUrl 对齐）。
* @param url 页面地址
* @param hash 评论 id
* @returns 带 hash 的地址
*/
function appendHashToUrl(url, hash) {
	if (url.indexOf("#") === -1) return `${url}#${String(hash)}`;
	return `${url.substring(0, url.indexOf("#"))}#${String(hash)}`;
}
/**
* 博主通知（1.x noticeMaster 逐行对齐：模板变量替换 + IM 推送互斥逻辑）。
* @param options 通知入参
*/
async function noticeMaster(options) {
	const { comment, config, caps, logger } = options;
	if (!transporter && !await initMailer({
		config,
		caps,
		logger
	})) {
		logger.info("未配置邮箱或邮箱配置有误，不通知");
		return;
	}
	if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
		logger.info("博主本人评论，不发送通知给博主");
		return;
	}
	if (config.PUSHOO_CHANNEL && config.PUSHOO_TOKEN && config.SC_MAIL_NOTIFY !== "true") {
		logger.info("存在即时消息推送配置，默认不发送邮件给博主，您可以在管理面板修改此行为");
		return;
	}
	const SITE_NAME = toStr$1(config.SITE_NAME);
	const NICK = escapeHtml(comment.nick);
	const IMG = getAvatar(comment, config);
	const IP = toStr$1(comment.ip);
	const MAIL = escapeHtml(comment.mail);
	const COMMENT = toStr$1(comment.comment);
	const SITE_URL = config.SITE_URL;
	const POST_URL = escapeHtml(appendHashToUrl(toStr$1(comment.href) || `${SITE_URL}${toStr$1(comment.url)}`, comment._id));
	const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`;
	let emailContent;
	if (config.MAIL_TEMPLATE_ADMIN) emailContent = String(config.MAIL_TEMPLATE_ADMIN).replace(/\$\{SITE_URL\}/g, String(SITE_URL)).replace(/\$\{SITE_NAME\}/g, String(SITE_NAME)).replace(/\$\{NICK\}/g, String(NICK)).replace(/\$\{IMG\}/g, String(IMG)).replace(/\$\{IP\}/g, String(IP)).replace(/\$\{MAIL\}/g, String(MAIL)).replace(/\$\{COMMENT\}/g, String(COMMENT)).replace(/\$\{POST_URL\}/g, String(POST_URL));
	else emailContent = `
        <div style="border-top:2px solid #12addb;box-shadow:0 1px 3px #aaaaaa;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
          <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
            您在<a style="text-decoration:none;color: #12addb;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的文章有了新的评论
          </h2>
          <p><strong>${NICK}</strong>回复说：</p>
          <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
          <p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a><br></p>
        </div>`;
	const toMail = config.BLOGGER_EMAIL || config.SENDER_EMAIL;
	if (!isValidEmail(toMail)) {
		logger.warn("博主邮箱格式不合法，跳过发送博主通知：", toMail);
		return;
	}
	let sendResult;
	try {
		sendResult = await transporter?.sendMail({
			from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
			to: toMail,
			subject: emailSubject,
			html: emailContent
		});
	} catch (e) {
		sendResult = e;
	}
	logger.verbose("博主通知结果：", sendResult);
	return sendResult;
}
/**
* 即时消息推送内容获取（1.x getIMPushContent 对齐）。
* @param comment 评论
* @param config 全量配置
* @returns 推送载荷（subject/content/url）
*/
async function getIMPushContent(comment, config) {
	const SITE_NAME = toStr$1(config.SITE_NAME);
	const NICK = escapeHtml(comment.nick);
	const MAIL = escapeHtml(comment.mail);
	const IP = toStr$1(comment.ip);
	const COMMENT = (await getHtmlToText())(toStr$1(comment.comment));
	const SITE_URL = toStr$1(config.SITE_URL);
	const POST_URL = escapeHtml(appendHashToUrl(toStr$1(comment.href) || `${SITE_URL}${toStr$1(comment.url)}`, comment._id));
	return {
		subject: toStr$1(config.MAIL_SUBJECT_ADMIN) || `${SITE_NAME}有新评论了`,
		content: `评论人：${NICK} ([${MAIL}](mailto:${MAIL}))

评论人IP：${IP}

评论内容：${COMMENT}

原文链接：[${POST_URL}](${POST_URL})`,
		url: POST_URL
	};
}
/**
* 即时消息通知（1.x noticePushoo 对齐：pushoo 渠道推送，bark 附 url）。
* @param options 通知入参
*/
async function noticePushoo(options) {
	const { comment, config, logger } = options;
	if (!config.PUSHOO_CHANNEL || !config.PUSHOO_TOKEN) {
		logger.info("没有配置 pushoo，放弃即时消息通知");
		return;
	}
	if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
		logger.info("博主本人评论，不发送通知给博主");
		return;
	}
	const pushContent = await getIMPushContent(comment, config);
	const pushoo = await getPushoo();
	/** PUSHOO_OPTIONS：可选附加参数（JSON），与内置 bark.url 合并后透传（如 Bark 的 group / icon / level） */
	let extraOptions = {};
	if (config.PUSHOO_OPTIONS) try {
		extraOptions = JSON.parse(String(config.PUSHOO_OPTIONS));
	} catch (e) {
		logger.warn("PUSHOO_OPTIONS 不是合法 JSON，已忽略：", e);
	}
	const sendResult = await pushoo(String(config.PUSHOO_CHANNEL), {
		token: config.PUSHOO_TOKEN,
		title: pushContent.subject,
		content: pushContent.content,
		options: {
			...extraOptions,
			bark: {
				url: pushContent.url,
				...extraOptions.bark
			}
		}
	});
	logger.info("即时消息通知结果：", sendResult);
}
/**
* 回复通知（1.x noticeReply 逐行对齐：父评论缺失/博主/自回复豁免 + 模板变量）。
* @param options 通知入参（getParentComment 由调用方以 db 闭包提供）
*/
async function noticeReply(options) {
	const { currentComment, config, caps, logger, getParentComment } = options;
	if (!currentComment.pid) {
		logger.info("无父级评论，不通知");
		return;
	}
	if (!transporter && !await initMailer({
		config,
		caps,
		logger
	})) {
		logger.info("未配置邮箱或邮箱配置有误，不通知");
		return;
	}
	const parentComment = await getParentComment(currentComment);
	if (!parentComment) return void 0;
	if (equalsMail(config.BLOGGER_EMAIL, parentComment.mail)) {
		logger.info("回复给博主，因为会发博主通知邮件，所以不再重复通知");
		return;
	}
	if (equalsMail(currentComment.mail, parentComment.mail)) {
		logger.info("回复自己的评论，不邮件通知");
		return;
	}
	const PARENT_NICK = escapeHtml(parentComment.nick);
	const IMG = getAvatar(currentComment, config);
	const PARENT_IMG = getAvatar(parentComment, config);
	const SITE_NAME = toStr$1(config.SITE_NAME);
	const NICK = escapeHtml(currentComment.nick);
	const COMMENT = toStr$1(currentComment.comment);
	const PARENT_COMMENT = toStr$1(parentComment.comment);
	const POST_URL = escapeHtml(appendHashToUrl(String(currentComment.href || `${config.SITE_URL}${currentComment.url}`), currentComment._id));
	const SITE_URL = config.SITE_URL;
	const emailSubject = config.MAIL_SUBJECT || `${toStr$1(PARENT_NICK)}，您在『${SITE_NAME}』上的评论收到了回复`;
	let emailContent;
	if (config.MAIL_TEMPLATE) emailContent = String(config.MAIL_TEMPLATE).replace(/\$\{IMG\}/g, String(IMG)).replace(/\$\{PARENT_IMG\}/g, String(PARENT_IMG)).replace(/\$\{SITE_URL\}/g, String(SITE_URL)).replace(/\$\{SITE_NAME\}/g, String(SITE_NAME)).replace(/\$\{PARENT_NICK\}/g, String(PARENT_NICK)).replace(/\$\{PARENT_COMMENT\}/g, String(PARENT_COMMENT)).replace(/\$\{NICK\}/g, String(NICK)).replace(/\$\{COMMENT\}/g, String(COMMENT)).replace(/\$\{POST_URL\}/g, String(POST_URL));
	else emailContent = `
        <div style="border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
          <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
            您在<a style="text-decoration:none;color: #12ADDB;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的评论有了新的回复
          </h2>
          ${PARENT_NICK} 同学，您曾发表评论：
          <div style="padding:0 12px 0 12px;margin-top:18px">
            <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${PARENT_COMMENT}</div>
            <p><strong>${NICK}</strong>回复说：</p>
            <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
            <p>
              您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a>，
              欢迎再次光临<a style="text-decoration:none; color:#12addb" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>。<br>
            </p>
          </div>
        </div>`;
	if (!isValidEmail(parentComment.mail)) {
		logger.warn("回复通知邮箱格式不合法，跳过发送回复通知：", parentComment.mail);
		return;
	}
	let sendResult;
	try {
		sendResult = await transporter?.sendMail({
			from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
			to: parentComment.mail,
			subject: emailSubject,
			html: emailContent
		});
	} catch (e) {
		sendResult = e;
	}
	logger.verbose("回复通知结果：", sendResult);
	return sendResult;
}
/**
* 发送通知（1.x sendNotice 对齐：垃圾评论豁免 + 三路并发，失败不阻断）。
* @param options 通知入参
*/
async function sendNotice(options) {
	const { comment, config, caps, logger, getParentComment } = options;
	if (comment.isSpam && config.NOTIFY_SPAM === "false") return;
	const results = await Promise.allSettled([
		noticeMaster({
			comment,
			config,
			caps,
			logger
		}),
		noticeReply({
			currentComment: comment,
			config,
			caps,
			logger,
			getParentComment
		}),
		noticePushoo({
			comment,
			config,
			logger
		})
	]);
	for (const result of results) if (result.status === "rejected") logger.error("通知异常：", result.reason);
}
/**
* 邮件测试（1.x emailTest 对齐：重置传输器 → 校验配置 → 发送测试邮件）。
* @param options 测试入参
* @returns 测试响应
*/
async function emailTest(options) {
	const { mail, config, isAdminUser, caps, logger } = options;
	/** 响应体 */
	const res = {};
	if (!isAdminUser) {
		res.code = RES_CODE.NEED_LOGIN;
		res.message = "请先登录";
		return res;
	}
	try {
		transporter = null;
		await initMailer({
			config,
			throwErr: true,
			caps,
			logger
		});
		const toMail = mail || config.BLOGGER_EMAIL || config.SENDER_EMAIL;
		if (!isValidEmail(toMail)) {
			res.message = "邮箱格式不合法";
			return res;
		}
		res.result = await transporter?.sendMail({
			from: config.SENDER_EMAIL,
			to: toMail,
			subject: "Twikoo 邮件通知测试邮件",
			html: "如果您收到这封邮件，说明 Twikoo 邮件功能配置正确"
		});
	} catch (e) {
		res.message = e instanceof Error ? e.message : String(e);
	}
	return res;
}
/**
* GET_FUNC_VERSION 事件处理器（1.7.24 getFuncVersion 语义对齐）。
*/
/**
* 获取 Twikoo 云函数版本：返回 `{ code: 0, version }`（1.x 形态一致）。
* version 来自 @twikoojs/shared 的构建期占位符（发布时由构建插件注入实际值）。
* @param ctx 请求上下文（本处理器不消费上下文数据）
* @returns 版本响应体
*/
const getFuncVersion = () => ({
	code: RES_CODE.SUCCESS,
	version: VERSION
});
/**
* POST_SUBMIT：执行 COMMENT_SUBMIT 之后的后置副作用链（垃圾检测 → 回写结果 →
* 邮件/IM 通知）。
*
* **它不是废弃的兼容分支，不计划移除。** 它是「把耗时副作用移出用户请求预算」
* 的承载机制：
*
* - 单次执行平台（cloudbase / vercel / netlify / aws-lambda）：COMMENT_SUBMIT
*   保存评论后，由适配器的派发端口把本事件送到**另一个执行单元**
*   （`callFunction` / HTTP 自调用 / Lambda Invoke Event），副作用因此拥有
*   自己的执行时间预算——用户请求可以立即返回，云函数超时也不会让「评论已
*   入库」变成客户端错误。
* - 常驻进程平台（self-hosted）与 eo-makers：适配器直接进程内调用
*   同一个 postSubmit 服务，不经本事件。
*
* **防外部滥用**：本事件若允许外部直接调用，任何人都能凭空触发垃圾检测与
* 邮件/IM 通知。故沿用 1.x 的 `x-twikoo-recursion` 令牌校验——只有携带内部
* 派发令牌（{@link getRecursionToken}）的请求才执行，其余一律 1403 拒绝。
*
* @param ctx 请求上下文（body.comment 为目标评论）
* @returns postSubmit 服务响应体；令牌不符时返回 1403
*/
const postSubmitEvent = async (ctx) => {
	if (ctx.request.headers["x-twikoo-recursion"] !== getRecursionToken(ctx.config)) {
		ctx.logger.warn("POST_SUBMIT 被外部调用，已拒绝（缺少有效的内部派发令牌）");
		return { code: RES_CODE.FORBIDDEN };
	}
	const comment = ctx.request.body.comment ?? {};
	return getPostSubmitService()(comment, ctx);
};
/**
* 请求参数校验（1.x validate 对齐：必传参数缺失/为空即报错）。
* @param event 已解析的请求体
* @param requiredParams 必传参数名列表
*/
function validate(event = {}, requiredParams = []) {
	for (const requiredParam of requiredParams) if (!event[requiredParam]) throw new Error(`参数"${requiredParam}"不合法`);
}
/**
* 客户端字段类型校验，防止 NoSQL 查询条件注入。
*
* 以下字段会直接参与数据库查询或作为评论归属标识：如果传入对象，会被数据库
* 解释为查询操作符（如 $ne、$gt），导致越权删除评论、绕过评论可见性限制等问题。
* 允许字段缺省或为 null（兼容首次匿名请求），有值时必须是字符串。
* @param event 已解析的请求体
*/
function validateClientFields(event = { event: "GET_FUNC_VERSION" }) {
	for (const field of [
		"accessToken",
		"id",
		"url",
		"pid",
		"rid"
	]) {
		const value = event[field];
		if (value !== void 0 && value !== null && typeof value !== "string") throw new Error(`参数"${field}"必须是字符串`);
	}
	if (event.urls !== void 0 && event.urls !== null) {
		const urls = event.urls;
		if (!Array.isArray(urls) || urls.some((url) => typeof url !== "string")) throw new Error("参数\"urls\"必须是字符串数组");
	}
}
/**
* 判断是否管理员（1.x isAdmin 对齐：md5(token) 与 ADMIN_PASS 比对）。
* @param config 全量配置
* @param accessToken 请求令牌
* @returns 是否管理员
*/
function isAdmin(config, accessToken) {
	return config.ADMIN_PASS === md5(accessToken);
}
/**
* 管理员登录（1.x login 逐行对齐）。
* @param config 全量配置
* @param password 管理密码（明文）
* @returns 登录响应
*/
function login(config, password) {
	if (!config) return {
		code: RES_CODE.CONFIG_NOT_EXIST,
		message: "数据库无配置"
	};
	if (!config.ADMIN_PASS) return {
		code: RES_CODE.PASS_NOT_EXIST,
		message: "未配置管理密码"
	};
	if (typeof password !== "string" || config.ADMIN_PASS !== md5(password)) return {
		code: RES_CODE.PASS_NOT_MATCH,
		message: "密码错误"
	};
	return { code: RES_CODE.SUCCESS };
}
/**
* 写入管理密码（1.x setPassword 对齐：库中无密码可直接写入；已有密码需管理员）。
* @param ctx 配置与鉴权载荷
* @returns 响应体
*/
async function setPassword(options) {
	const { config, configReadFailed = false, accessToken, password, saveConfig } = options;
	if (configReadFailed) return {
		code: RES_CODE.FAIL,
		message: "配置读取失败，请稍后重试"
	};
	const isAdminUser = isAdmin(config, accessToken);
	if (config.ADMIN_PASS && !isAdminUser) return {
		code: RES_CODE.PASS_EXIST,
		message: "请先登录再修改密码"
	};
	validate({ password }, ["password"]);
	if (typeof password !== "string") return {
		code: RES_CODE.FAIL,
		message: "参数\"password\"不合法"
	};
	await saveConfig({ ADMIN_PASS: md5(password) });
	return { code: RES_CODE.SUCCESS };
}
/**
* 判断是否存在管理员密码（1.x getPasswordStatus 对齐）。
* @param config 全量配置
* @param version 当前版本
* @returns 状态响应
*/
function getPasswordStatus(config, version) {
	return {
		code: RES_CODE.SUCCESS,
		status: !!config.ADMIN_PASS,
		credentials: !!config.CREDENTIALS,
		version
	};
}
/**
* 校验评论归属：确认评论存在且属于当前用户（1.x checkCommentOwnership 对齐，
* 含防 undefined 归属误判的兜底）。
* @param id 评论 id
* @param uid 用户 token
* @param getComment 单条查询函数
* @returns 归属的评论
*/
async function checkCommentOwnership(id, uid, getComment) {
	validate({ id }, ["id"]);
	if (typeof id !== "string") throw new Error("参数\"id\"必须是字符串");
	const comment = await getComment(id);
	if (!comment) throw new Error("评论不存在");
	if (!uid || comment.uid !== uid) throw new Error("只能删除自己的评论");
	return comment;
}
/**
* 评论查询共享服务（1.x getSearchKeyword/getCommentSearchCondition/
* commentSearch/getCommentQuery 的语义收拢，COMMENT_GET 与
* COMMENT_GET_FOR_ADMIN 共用）。
*/
/**
* 提取搜索关键词（1.x getSearchKeyword 对齐：字符串校验 + 100 字符上限）。
* @param event 请求体
* @returns 关键词（无则空串）
*/
function getSearchKeyword(event) {
	const keyword = event.keyword;
	if (keyword === void 0 || keyword === null) return "";
	if (typeof keyword !== "string") throw new Error("搜索关键词必须是字符串");
	const trimmed = keyword.trim();
	if (trimmed.length > 100) throw new Error("搜索关键词不能超过 100 个字符");
	return trimmed;
}
/**
* 访客搜索可匹配的字段。
*
* 只含**本来就会随 DTO 下发给访客**的字段（`nick` / `link` / `comment` /
* `url` / `href`），因此命中与否不泄露任何额外信息。
*/
const VISITOR_KEYWORD_FIELDS = [
	"nick",
	"link",
	"comment",
	"url",
	"href"
];
/**
* 管理员搜索可额外匹配的字段（`mail` / `ip`）。
*
* ⚠️ **绝不能用于访客搜索**：`mail` / `ip` 在 DTO 里被隐藏，但「某条评论是否
* 命中」本身就会回答「这个邮箱/IP 是否存在」，而且子串匹配允许逐字符探测
* （GHSA-v349-m8q5-7x2g）。管理员已在管理面板中直接看得到这两个字段，
* 故管理端搜索保留它们不构成额外泄露。
*/
const ADMIN_KEYWORD_FIELDS = [
	"nick",
	"mail",
	"link",
	"ip",
	"comment",
	"url",
	"href"
];
/**
* 评论字段是否命中关键词（大小写不敏感子串，1.x commentMatchesKeyword 对齐）。
* @param comment 评论
* @param keyword 关键词
* @param options 匹配范围（`includeSensitive` 仅管理员搜索可置 true）
* @returns 是否命中
*/
function commentMatchesKeyword(comment, keyword, options = {}) {
	const keywordLower = keyword.toLowerCase();
	return (options.includeSensitive ? ADMIN_KEYWORD_FIELDS : VISITOR_KEYWORD_FIELDS).some((field) => {
		const value = comment[field];
		return typeof value === "string" ? value.toLowerCase().includes(keywordLower) : false;
	});
}
/**
* 可见性语义展开（1.x getCommentQuery 的 $or 服务层等价形态）：
* 管理员（未开 HIDE_SPAM）全可见；否则「非垃圾 + 本人垃圾」双查合并，两组互斥。
* @param db 数据库
* @param condition 基础条件
* @param uid 当前用户
* @param isAdminUser 是否管理员
* @param config 全量配置
* @param options 查询选项（排序和读取上限同时应用于两个分支）
* @returns 合并后的评论
*/
async function queryVisibleComments(db, condition, uid, isAdminUser, config, options) {
	if (isAdminUser && config.HIDE_SPAM !== "true") return db.getComments(condition, options);
	const [notSpam, mySpam] = await Promise.all([db.getComments({
		...condition,
		isSpam: { [NOT]: true }
	}, options), db.getComments({
		...condition,
		uid,
		isSpam: true
	}, options)]);
	const merged = [...notSpam, ...mySpam];
	if (options?.sort) {
		const entries = Object.entries(options.sort);
		merged.sort((a, b) => {
			for (const [field, direction] of entries) {
				const diff = (a[field] ?? 0) - (b[field] ?? 0);
				if (diff !== 0) return direction === -1 ? -diff : diff;
			}
			return 0;
		});
	}
	return merged;
}
/**
* 访客搜索（1.x commentSearch 服务层形态：页内关键词过滤 + 可见性 + DTO 拼装）。
*
* 匹配范围**恒为访客字段集**（见 {@link VISITOR_KEYWORD_FIELDS}）：本函数由公开的
* COMMENT_GET 触达，即便调用者恰好是管理员也不放宽——否则返回结果的条数差异仍会
* 成为 `mail` / `ip` 的存在性预言机（GHSA-v349-m8q5-7x2g）。管理员要按邮箱/IP 检索
* 请走 COMMENT_GET_FOR_ADMIN。
* @param ctx 请求上下文
* @returns 搜索结果响应
*/
async function searchVisibleComments(ctx) {
	const event = ctx.request.body;
	const config = ctx.config;
	const uid = ctx.accessToken;
	const isAdminUser = isAdmin(config, uid);
	const keyword = getSearchKeyword(event);
	const matched = (await ctx.adapters.database.getComments({ url: { $in: getUrlsQuery([event.url]) } })).filter((c) => commentMatchesKeyword(c, keyword));
	const data = await parseComment(isAdminUser ? matched : matched.filter((c) => !c.isSpam || c.uid === uid), uid, config, ctx.adapters.capabilities);
	return {
		code: 0,
		data,
		count: data.length
	};
}
/**
* COMMENT_GET 事件处理器（1.x commentGet 语义对齐）。
*
* 可见性：访客可见「非垃圾」+「本人的全部评论」（1.x $or 的服务层双查合并，
* 见 comment-query.ts）；管理员 HIDE_SPAM=true 时仅见非垃圾。主楼 rid ABSENT +
* 置顶分离 + 流式分页（多读 1 条判 more）+ 回复按 rid 归组，parseComment 拼装。
*/
/**
* COMMENT_GET：读取页面评论（含回复、置顶、分页、排序）。
* @param ctx 请求上下文
* @returns 评论列表响应（data/more/count）
*/
const commentGet = async (ctx) => {
	const event = ctx.request.body;
	validate(event, ["url"]);
	if (getSearchKeyword(event)) return searchVisibleComments(ctx);
	const config = ctx.config;
	const uid = ctx.accessToken;
	const isAdminUser = isAdmin(config, uid);
	const db = ctx.adapters.database;
	const pageSize = parseInt(String(config.COMMENT_PAGE_SIZE ?? "")) || 8;
	const sort = event.sort || "newest";
	let more = false;
	/** 查询条件：url 多形态 + 顶级评论 */
	let condition = {
		url: { $in: getUrlQuery(event.url) },
		rid: ABSENT
	};
	const count = await queryVisibleCount(ctx, condition);
	if (event.before !== void 0 && event.before !== null) condition = {
		...condition,
		created: { [LT]: event.before }
	};
	const mainCondition = {
		...condition,
		top: { [NOT]: true }
	};
	let main = await queryVisibleComments(db, mainCondition, uid, isAdminUser, config, {
		sort: sort === "oldest" ? { created: 1 } : sort === "popular" ? {
			ups: -1,
			created: -1
		} : { created: -1 },
		limit: pageSize + 1
	});
	if (main.length > pageSize) {
		more = true;
		main = main.slice(0, pageSize);
	}
	let top = [];
	if (!config.TOP_DISABLED && !event.before) top = await queryVisibleComments(db, {
		...mainCondition,
		top: true
	}, uid, isAdminUser, config, { sort: { created: -1 } });
	main = [...top, ...main];
	const reply = await queryVisibleComments(db, { rid: { $in: main.map((item) => String(item._id)) } }, uid, isAdminUser, config);
	const data = await parseComment([...main, ...reply], uid, config, ctx.adapters.capabilities);
	return {
		code: RES_CODE.SUCCESS,
		data,
		more,
		count
	};
};
/**
* 可见性计数：非垃圾 + 本人垃圾，两组互斥，避免读取完整文档去重。
* @param ctx 请求上下文
* @param condition 基础条件
* @returns 可见条数
*/
async function queryVisibleCount(ctx, condition) {
	const db = ctx.adapters.database;
	if (isAdmin(ctx.config, ctx.accessToken) && ctx.config.HIDE_SPAM !== "true") return db.countComments(condition);
	const [notSpam, mySpam] = await Promise.all([db.countComments({
		...condition,
		isSpam: { [NOT]: true }
	}), db.countComments({
		...condition,
		uid: ctx.accessToken,
		isSpam: true
	})]);
	return notSpam + mySpam;
}
/**
* COMMENT_GET_FOR_ADMIN 事件处理器（1.x commentGetForAdmin + getCommentSearchCondition
* 语义对齐）。
*
* 筛选走请求体的 `type` 字段（1.x 语义）：`"VISIBLE"` / `"HIDDEN"` / 空（全部）。
* ⚠️ 这两个值是**参数取值，不是事件名**——1.x 从未把 HIDDEN / VISIBLE 作为事件分发，
* 2.0 亦如此（重构期曾误加为事件分支，已删除）。
*/
/**
* 管理员读取评论列表（分页 + 筛选：VISIBLE/HIDDEN/全部 + 关键词模糊）。
* @param ctx 请求上下文
* @returns 管理员评论列表响应（data/count）
*/
const commentGetForAdmin = async (ctx) => {
	const res = {};
	if (!isAdmin(ctx.config, ctx.accessToken)) return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
	const event = ctx.request.body;
	validate(event, ["per", "page"]);
	const db = ctx.adapters.database;
	/** 筛选条件（type + 关键词在服务层过滤） */
	const condition = event.type === "VISIBLE" ? { isSpam: { [NOT]: true } } : event.type === "HIDDEN" ? { isSpam: true } : {};
	const per = Number(event.per);
	const page = Number(event.page);
	const keyword = getSearchKeyword(event);
	/** 当前页文档 */
	let pageData;
	/** 命中总数（分页控件依赖，1.x `res.count` 对齐） */
	let count;
	if (keyword) {
		const matched = (await db.getComments(condition, { sort: { created: -1 } })).filter((c) => commentMatchesKeyword(c, keyword, { includeSensitive: true }));
		count = matched.length;
		pageData = matched.slice(per * (page - 1), per * (page - 1) + per);
	} else {
		count = await db.countComments(condition);
		pageData = await db.getComments(condition, {
			sort: { created: -1 },
			skip: per * (page - 1),
			limit: per
		});
	}
	const data = await parseCommentForAdmin(pageData, ctx.adapters.capabilities);
	res.code = RES_CODE.SUCCESS;
	res.count = count;
	res.data = data;
	return res;
};
/**
* 管理员修改评论（$set 部分更新 + updated 时间戳）。
* @param ctx 请求上下文
* @returns 更新响应
*/
const commentSetForAdmin = async (ctx) => {
	if (!isAdmin(ctx.config, ctx.accessToken)) return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
	const event = ctx.request.body;
	validate(event, ["id", "set"]);
	await ctx.adapters.database.updateComment(event.id, {
		...event.set,
		updated: Date.now()
	});
	return {
		code: RES_CODE.SUCCESS,
		updated: 1
	};
};
/**
* 管理员删除评论。
* @param ctx 请求上下文
* @returns 删除响应
*/
const commentDeleteForAdmin = async (ctx) => {
	if (!isAdmin(ctx.config, ctx.accessToken)) return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
	const event = ctx.request.body;
	validate(event, ["id"]);
	await ctx.adapters.database.deleteComment(event.id);
	return {
		code: RES_CODE.SUCCESS,
		deleted: 1
	};
};
/**
* 用户删除自己的评论（归属校验失败转 code 1000 错误体）。
* @param ctx 请求上下文
* @returns 删除响应
*/
const commentDeleteForUser = async (ctx) => {
	const res = {};
	try {
		const uid = ctx.accessToken;
		const event = ctx.request.body;
		await checkCommentOwnership(event.id, uid, async (id) => ctx.adapters.database.getComment(id));
		await ctx.adapters.database.deleteComment(event.id);
		res.code = RES_CODE.SUCCESS;
		res.deleted = 1;
	} catch (e) {
		res.code = RES_CODE.FAIL;
		res.message = e instanceof Error ? e.message : String(e);
	}
	return res;
};
/** 数组形态字段（1.x ARRAY_FIELDS 对齐：兼容字符串化 JSON 存储） */
const ARRAY_FIELDS = [
	"like",
	"ups",
	"downs"
];
/**
* 解析可能为字符串化 JSON 的数组字段（1.x parseJsonArrayField 对齐）。
* @param value 原始值
* @returns 数组或原值
*/
function parseJsonArrayField(value) {
	if (Array.isArray(value)) return value;
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	if (!trimmed.startsWith("[")) return value;
	try {
		const parsed = JSON.parse(trimmed);
		return Array.isArray(parsed) ? parsed : value;
	} catch {
		return value;
	}
}
/**
* 规范化 Twikoo 备份评论（1.x normalizeTwikooComment 对齐：$oid 历史 id、
* null pid/rid 剔除、数组字段反序列化）。
* @param comment 备份评论
* @returns 规范化评论
*/
function normalizeTwikooComment(comment) {
	const parsed = { ...comment };
	const rawId = comment._id;
	if (rawId && typeof rawId === "object" && rawId.$oid) parsed._id = rawId.$oid;
	if (comment.pid === null) delete parsed.pid;
	if (comment.rid === null) delete parsed.rid;
	for (const field of ARRAY_FIELDS) if (field in parsed) parsed[field] = parseJsonArrayField(parsed[field]);
	return parsed;
}
/**
* 兼容 Leancloud 两种 JSON 导出格式（1.x jsonParse 对齐：整体解析失败转逐行）。
* @param content 文件文本
* @returns 解析结果
*/
function jsonParse(content) {
	try {
		return JSON.parse(content);
	} catch {
		const results = [];
		const lines = content.split("\n");
		for (const line of lines) try {
			results.push(JSON.parse(line));
		} catch {}
		return { results };
	}
}
/**
* 解析 XML 文本（xml2js 动态加载）。
* @param xml XML 文本
* @returns 解析结果
*/
async function parseXml(xml) {
	return (await getXml2js()).parseStringPromise(xml);
}
/**
* Valine 导入（1.x commentImportValine 对齐）。
* @param valineDb 解析后的备份
* @param log 日志函数
* @returns 评论列表
*/
async function commentImportValine(valineDb, log) {
	let arr;
	if (Array.isArray(valineDb)) arr = valineDb;
	else if (valineDb && typeof valineDb === "object" && "results" in valineDb) arr = valineDb.results;
	if (!arr) {
		log("Valine 评论文件格式有误");
		return;
	}
	const comments = [];
	log(`共 ${arr.length} 条评论`);
	for (const comment of arr) try {
		comments.push({
			_id: comment.objectId,
			nick: comment.nick,
			ip: comment.ip,
			mail: comment.mail,
			mailMd5: comment.mailMd5,
			isSpam: comment.isSpam,
			ua: comment.ua || "",
			link: comment.link,
			pid: comment.pid,
			rid: comment.rid,
			master: false,
			comment: comment.comment,
			url: comment.url,
			created: new Date(comment.createdAt).getTime(),
			updated: new Date(comment.updatedAt).getTime()
		});
		log(`${String(comment.objectId)} 解析成功`);
	} catch (e) {
		log(`${String(comment.objectId)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
	}
	log(`解析成功 ${comments.length} 条评论`);
	return comments;
}
/**
* Disqus 导入（1.x commentImportDisqus 对齐：thread 定位、父链回溯根评论）。
* @param disqusDb 解析后的 XML 对象
* @param log 日志函数
* @returns 评论列表
*/
async function commentImportDisqus(disqusDb, log) {
	const root = disqusDb;
	if (!root?.disqus?.thread || !root.disqus.post) {
		log("Disqus 评论文件格式有误");
		return;
	}
	const { thread, post } = root.disqus;
	/** 字段取值辅助（XML 数组形态） */
	const at = (v) => Array.isArray(v) ? v[0] : v;
	/**
	*
	*/
	const attr = (v) => Array.isArray(v) ? v[0]?.$?.["dsq:id"] : void 0;
	const comments = [];
	/**
	*
	*/
	const getParent = (p) => {
		const parentId = attr(p.parent);
		if (!parentId) return null;
		return post.find((item) => item.$?.["dsq:id"] === parentId) ?? null;
	};
	let threads = [];
	try {
		threads = thread.map((t) => ({
			id: attr(t.$),
			url: at(t.id),
			href: at(t.link)
		}));
	} catch (e) {
		log(`无法读取 thread：${e instanceof Error ? e.message : String(e)}`);
		return;
	}
	log(`共 ${post.length} 条评论`);
	for (const p of post) {
		const postId = attr(p.$);
		try {
			const threadId = attr(p.thread);
			const t = threads.find((item) => item.id === threadId);
			const parent = getParent(p);
			let rootPost = null;
			if (parent) {
				let grandParent = parent;
				while (true) {
					if (grandParent) rootPost = grandParent;
					else break;
					grandParent = getParent(grandParent);
				}
			}
			const threadUrl = typeof t?.url === "string" ? t.url : void 0;
			const threadHref = typeof t?.href === "string" ? t.href : void 0;
			const author = p.author;
			comments.push({
				_id: postId,
				nick: author?.[0]?.name?.[0],
				mail: "",
				link: "",
				url: threadUrl ? threadUrl.indexOf("http") === 0 ? getRelativeUrl(threadUrl) : threadUrl : threadHref ? getRelativeUrl(threadHref) : void 0,
				href: threadHref,
				comment: at(p.message),
				ua: "",
				ip: "",
				isSpam: at(p.isSpam) === "true" || at(p.isDeleted) === "true",
				master: false,
				pid: parent ? parent.$?.["dsq:id"] : void 0,
				rid: rootPost ? rootPost.$?.["dsq:id"] : void 0,
				created: new Date(at(p.createdAt)).getTime(),
				updated: Date.now()
			});
			log(`${String(postId)} 解析成功`);
		} catch (e) {
			log(`${String(postId)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
		}
	}
	log(`解析成功 ${comments.length} 条评论`);
	return comments;
}
/**
* Artalk Markdown 渲染 + 消毒（artalk/artalk2 共用；1.x setOptions 形态对齐）。
* @param content Markdown 文本
* @param caps 平台能力声明
* @returns 消毒后 HTML
*/
async function renderMarkdown(content, caps) {
	const DOMPurify = await getDomPurify(caps);
	const html = (await getMarked()).parse(content);
	return DOMPurify.sanitize(html);
}
/**
* Artalk 导入（1.x commentImportArtalk 对齐）。
* @param artalkDb 解析后的备份
* @param log 日志函数
* @param caps 平台能力声明
* @returns 评论列表
*/
async function commentImportArtalk(artalkDb, log, caps) {
	if (!Array.isArray(artalkDb) || !artalkDb.length) {
		log("Artalk 评论文件格式有误");
		return;
	}
	const comments = [];
	log(`共 ${artalkDb.length} 条评论`);
	for (const c of artalkDb) try {
		const rid = c.rid && c.rid !== "0" ? `artalk` + toStr$1(c.rid) : void 0;
		comments.push({
			_id: `artalk${String(c.id)}`,
			nick: c.nick,
			ip: c.ip,
			mail: c.email,
			mailMd5: md5(normalizeMail(c.email)),
			isSpam: false,
			ua: c.ua || "",
			link: c.link,
			pid: rid,
			rid,
			master: false,
			comment: await renderMarkdown(toStr$1(c.content), caps),
			url: getRelativeUrl(toStr$1(c.page_key)),
			href: c.page_key,
			created: new Date(c.date).getTime(),
			updated: Date.now()
		});
		log(`${String(c.id)} 解析成功`);
	} catch (e) {
		log(`${String(c.id)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
	}
	log(`解析成功 ${comments.length} 条评论`);
	return comments;
}
/**
* Artalk v2 导入（1.x commentImportArtalk2 对齐：is_pending 判定、created_at）。
* @param artalkDb 解析后的备份
* @param log 日志函数
* @param caps 平台能力声明
* @returns 评论列表
*/
async function commentImportArtalk2(artalkDb, log, caps) {
	if (!Array.isArray(artalkDb) || !artalkDb.length) {
		log("Artalk v2 评论文件格式有误");
		return;
	}
	const comments = [];
	log(`共 ${artalkDb.length} 条评论`);
	for (const c of artalkDb) try {
		const rid = c.rid && c.rid !== "0" ? `artalk` + toStr$1(c.rid) : void 0;
		comments.push({
			_id: `artalk${String(c.id)}`,
			nick: c.nick,
			ip: c.ip,
			mail: c.email,
			mailMd5: md5(normalizeMail(c.email)),
			isSpam: c.is_pending === "true",
			ua: c.ua || "",
			link: c.link,
			pid: rid,
			rid,
			master: false,
			comment: await renderMarkdown(toStr$1(c.content), caps),
			url: getRelativeUrl(toStr$1(c.page_key)),
			href: c.page_key,
			created: new Date(c.created_at).getTime(),
			updated: Date.now()
		});
		log(`${String(c.id)} 解析成功`);
	} catch (e) {
		log(`${String(c.id)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
	}
	log(`解析成功 ${comments.length} 条评论`);
	return comments;
}
/**
* Twikoo 备份导入（1.x commentImportTwikoo 对齐）。
* @param twikooDb 解析后的备份
* @param log 日志函数
* @returns 评论列表
*/
async function commentImportTwikoo(twikooDb, log) {
	let arr;
	if (Array.isArray(twikooDb)) arr = twikooDb;
	else if (twikooDb && typeof twikooDb === "object" && "results" in twikooDb) arr = twikooDb.results;
	if (!arr) {
		log("Twikoo 评论文件格式有误");
		return;
	}
	const comments = [];
	log(`共 ${arr.length} 条评论`);
	for (const comment of arr) try {
		comments.push(normalizeTwikooComment(comment));
		log(`${String(comment._id)} 解析成功`);
	} catch (e) {
		log(`${String(comment._id)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
	}
	log(`解析成功 ${comments.length} 条评论`);
	return comments;
}
/**
* 管理员导入评论（valine/disqus/artalk/artalk2/twikoo 五格式）。
* @param ctx 请求上下文
* @returns 导入响应（res.log 含全过程日志）
*/
const commentImportForAdmin = async (ctx) => {
	const res = {};
	let logText = "";
	/** 导入日志（时间戳标注，随响应回传） */
	const log = (message) => {
		logText += `${(/* @__PURE__ */ new Date()).toLocaleString()} ${message}\n`;
	};
	if (!isAdmin(ctx.config, ctx.accessToken)) return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
	try {
		const event = ctx.request.body;
		validate(event, ["source", "file"]);
		log(`开始导入 ${String(event.source)}`);
		let comments;
		switch (event.source) {
			case "valine":
				comments = await commentImportValine(jsonParse(String(event.file)), log);
				break;
			case "disqus":
				comments = await commentImportDisqus(await parseXml(String(event.file)), log);
				break;
			case "artalk":
				comments = await commentImportArtalk(jsonParse(String(event.file)), log, ctx.adapters.capabilities);
				break;
			case "artalk2":
				comments = await commentImportArtalk2(jsonParse(String(event.file)), log, ctx.adapters.capabilities);
				break;
			case "twikoo":
				comments = await commentImportTwikoo(jsonParse(String(event.file)), log);
				break;
			default: throw new Error(`不支持 ${String(event.source)} 的导入，请更新 Twikoo 云函数至最新版本`);
		}
		if (comments) {
			await ctx.adapters.database.bulkAddComments(comments);
			log(`导入成功 ${comments.length} 条评论`);
		}
	} catch (e) {
		log(e instanceof Error ? e.message : String(e));
	}
	res.code = RES_CODE.SUCCESS;
	res.log = logText;
	ctx.logger.info(logText);
	return res;
};
/**
* 管理员导出数据集合（1.x commentExportForAdmin 语义对齐）。
* @param ctx 请求上下文
* @returns 导出响应（data 为对应集合的全量文档）
*/
const commentExportForAdmin = async (ctx) => {
	if (!isAdmin(ctx.config, ctx.accessToken)) return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
	/** 导出集合名（缺省 comment，1.x `event.collection || 'comment'` 对齐） */
	const collection = ctx.request.body.collection ?? "comment";
	if (collection === "comment") return {
		code: RES_CODE.SUCCESS,
		data: await ctx.adapters.database.getAllComments()
	};
	if (collection === "counter") return {
		code: RES_CODE.SUCCESS,
		data: await ctx.adapters.database.getAllCounters()
	};
	return {
		code: RES_CODE.FAIL,
		message: "collection 仅支持 comment 或 counter"
	};
};
/**
* 点赞 / 反对 / 取消（同一 uid 重复操作为取消；赞踩互斥）。
* @param ctx 请求上下文
* @returns 更新响应
*/
const commentLike = async (ctx) => {
	const event = ctx.request.body;
	validate(event, ["id"]);
	const uid = ctx.accessToken;
	const type = event.type || "up";
	const db = ctx.adapters.database;
	const comment = await db.getComment(event.id);
	const commentData = comment ?? {};
	const ups = commentData.ups ?? [];
	const downs = commentData.downs ?? [];
	let newUps = [...ups];
	let newDowns = [...downs];
	if (type === "up") {
		if (ups.includes(uid)) newUps = ups.filter((item) => item !== uid);
		else {
			newUps.push(uid);
			newDowns = downs.filter((item) => item !== uid);
		}
	} else if (type === "down") {
		if (downs.includes(uid)) newDowns = downs.filter((item) => item !== uid);
		else {
			newDowns.push(uid);
			newUps = ups.filter((item) => item !== uid);
		}
	}
	if (comment) await db.updateComment(comment._id, {
		ups: newUps,
		downs: newDowns
	});
	return {
		code: RES_CODE.SUCCESS,
		updated: 1
	};
};
/**
* 内嵌 Cap 验证码服务（1.x utils/cap.js 移植；@cap.js/server 为常规依赖）。
*
* 存储：1.x 的 mongoStorage / lokiStorage / tcbStorage / kvStorage 四份复制
* 收敛为**单一 Database 存储适配器**——基于 Database 端口的 cap 四方法
* （capGet/capSet/capDel/capDeleteExpired），键设计沿用 1.x kvStorage 的
* `cap:c:<token>` / `cap:t:<key>` 形态（JSON 序列化值自带过期时间：读取时过滤，
* 并由 `deleteExpired` 定期下推清理，见 #1174）。
*/
/** 挑战参数（1.x CHALLENGE_OPTS 对齐：10 分钟有效期） */
const CHALLENGE_OPTS = {
	/** 挑战数量 */
	challengeCount: 50,
	/** 挑战串长度 */
	challengeSize: 32,
	/** 难度前缀零数 */
	challengeDifficulty: 4,
	/** 有效期（毫秒） */
	expiresMs: 6e5
};
/**
* 基于 Database 端口的 Cap 存储适配器（challenges/tokens 双组钩子）。
* @param db 数据库句柄
* @returns Cap 存储端口
*/
function databaseCapStorage(db) {
	return {
		challenges: {
			/** 存储挑战（token 存在则覆盖） */
			async store(token, data) {
				await db.capSet(`cap:c:${token}`, data);
			},
			/** 读取未过期挑战 */
			async read(token) {
				const data = await db.capGet(`cap:c:${token}`);
				if (!data || data.expires < Date.now()) return null;
				return data;
			},
			/** 删除挑战 */
			async delete(token) {
				await db.capDel(`cap:c:${token}`);
			},
			/**
			* 清理过期挑战（Cap 的 `_lazyCleanup` 最多每 5 分钟调一次）。
			*
			* 过期清理**下推给数据库**（`capDeleteExpired`），而不是拉回全部键逐条判断：
			* 该集合正是「匿名者可反复申请挑战并弃用、过期不删就无限增长」的那一个（#1174）。
			*/
			async deleteExpired() {
				await db.capDeleteExpired(Date.now());
			}
		},
		tokens: {
			/** 存储通行 token */
			async store(key, expires) {
				await db.capSet(`cap:t:${key}`, { expires });
			},
			/** 读取未过期 token */
			async get(key) {
				const data = await db.capGet(`cap:t:${key}`);
				if (!data || data.expires < Date.now()) return null;
				return data.expires;
			},
			/** 删除 token */
			async delete(key) {
				await db.capDel(`cap:t:${key}`);
			},
			/**
			* 清理过期通行 token。
			*
			* 与挑战侧共用同一个下推删除（cap_kv 整体清理）；Cap 会对两个钩子各调一次，
			* 第二次通常为 0 条——幂等，无需额外去重。
			*/
			async deleteExpired() {
				await db.capDeleteExpired(Date.now());
			}
		}
	};
}
/**
* 创建内嵌 Cap 实例（1.x createCap 对齐；noFSState 免文件状态）。
* @param storage 存储适配器（缺省内存形态，由 Cap 库内部处理）
* @returns Cap 实例
*/
function createCap(storage) {
	return new import_server.default({
		noFSState: true,
		storage
	});
}
/**
* 创建挑战（1.x createChallenge 对齐）。
* @param cap Cap 实例
* @returns 挑战数据（challenge 列表等）
*/
async function createChallenge(cap) {
	return await cap.createChallenge(CHALLENGE_OPTS);
}
/**
* 兑换挑战（1.x redeemChallenge 对齐：token + solutions 校验）。
* @param cap Cap 实例
* @param body 请求体（token/solutions）
* @returns 兑换结果
*/
async function redeemChallenge(cap, body) {
	const token = body && body.token;
	const solutions = body && body.solutions;
	if (!token || !solutions || !Array.isArray(solutions)) return {
		success: false,
		error: "Missing token or solutions"
	};
	return await cap.redeemChallenge({
		token,
		solutions
	});
}
/**
* 校验通行 token（1.x validateToken 对齐；异常视为未通过）。
* @param cap Cap 实例
* @param token 通行 token
* @returns 是否有效
*/
async function validateToken(cap, token) {
	if (!token) return false;
	try {
		const { success } = await cap.validateToken(token);
		return !!success;
	} catch {
		return false;
	}
}
/**
* 判断是否使用内嵌 Cap（1.x isBuiltinCap 对齐：CAPTCHA_PROVIDER=Cap 且无外部 endpoint）。
* @param config 全量配置
* @returns 是否内嵌 Cap
*/
function isBuiltinCap(config) {
	return config.CAPTCHA_PROVIDER === "Cap" && !config.CAP_API_ENDPOINT;
}
/**
* CAP_CHALLENGE 事件处理（1.x capChallenge 对齐：内嵌 Cap 未启用时报错）。
* @param options 处理入参
* @returns 挑战响应
*/
async function capChallenge(options) {
	const { config, db } = options;
	if (!isBuiltinCap(config)) return {
		code: RES_CODE.FAIL,
		message: "内嵌 Cap 未启用"
	};
	const data = await createChallenge(createCap(databaseCapStorage(db)));
	return {
		code: RES_CODE.SUCCESS,
		...data
	};
}
/**
* CAP_REDEEM 事件处理（1.x capRedeem 对齐）。
* @param options 处理入参
* @returns 兑换响应
*/
async function capRedeem(options) {
	const { config, db, body } = options;
	if (!isBuiltinCap(config)) return {
		code: RES_CODE.FAIL,
		message: "内嵌 Cap 未启用"
	};
	const data = await redeemChallenge(createCap(databaseCapStorage(db)), body);
	return {
		code: RES_CODE.SUCCESS,
		...data
	};
}
/**
* 安全字符串化（字段值非字符串时 JSON 化，避免 [object Object]）。
* @param v 任意字段值
* @returns 字符串
*/
function toStr(v) {
	if (typeof v === "string") return v;
	if (v === void 0 || v === null) return "";
	return JSON.stringify(v);
}
/**
* 将评论转为数据库存储格式（1.x parse 逐字段对齐）。
* @param ctx 请求上下文
* @returns 存储形态评论
*/
async function parseCommentDoc(ctx) {
	const { config, accessToken, adapters, request } = ctx;
	const comment = request.body;
	const timestamp = Date.now();
	const isAdminUser = isAdmin(config, accessToken);
	const isBloggerMail = equalsMail(comment.mail, config.BLOGGER_EMAIL);
	if (isBloggerMail && !isAdminUser) throw new Error("请先登录管理面板，再使用博主身份发送评论");
	if (comment.mail && !isValidEmail(comment.mail)) throw new Error("邮箱格式不合法");
	const hashMethod = config.GRAVATAR_CDN === "cravatar.cn" ? md5 : sha256;
	const DOMPurify = await getDomPurify(adapters.capabilities);
	const commentDo = {
		uid: accessToken,
		nick: comment.nick ? toStr(comment.nick) : "匿名",
		mail: comment.mail ? toStr(comment.mail) : "",
		mailMd5: comment.mail ? hashMethod(normalizeMail(comment.mail)) : "",
		link: comment.link ? toStr(comment.link) : "",
		ua: comment.ua,
		ip: request.ip,
		master: isBloggerMail,
		url: comment.url,
		href: comment.href,
		comment: DOMPurify.sanitize(toStr(comment.comment), {
			FORBID_TAGS: ["style"],
			FORBID_ATTR: ["style"]
		}),
		pid: comment.pid ? toStr(comment.pid) : toStr(comment.rid),
		rid: comment.rid,
		isSpam: isAdminUser ? false : await preCheckSpam({
			comment: toStr(comment.comment),
			nick: toStr(comment.nick),
			link: comment.link,
			mail: comment.mail
		}, config, ctx.logger),
		created: timestamp,
		updated: timestamp
	};
	if (typeof comment.mail === "string" && isQQ(comment.mail)) {
		commentDo.mail = addQQMailSuffix(comment.mail);
		commentDo.mailMd5 = hashMethod(normalizeMail(commentDo.mail));
		commentDo.avatar = await getQQAvatar(comment.mail) ?? void 0;
	}
	return commentDo;
}
/**
* 验证码检测分发（1.x checkCaptcha 逐分支对齐）。
* @param ctx 请求上下文
*/
async function checkCaptcha(ctx) {
	const { config, adapters, request } = ctx;
	const comment = request.body;
	const provider = config.CAPTCHA_PROVIDER;
	if (provider === "Turnstile" && config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY) await checkTurnstileCaptcha({
		caps: adapters.capabilities,
		ip: request.ip,
		turnstileToken: comment.turnstileToken,
		turnstileTokenSecretKey: config.TURNSTILE_SECRET_KEY
	});
	else if (provider === "Geetest" && config.GEETEST_CAPTCHA_ID && config.GEETEST_CAPTCHA_KEY) await checkGeeTestCaptcha({
		geeTestCaptchaId: config.GEETEST_CAPTCHA_ID,
		geeTestCaptchaKey: config.GEETEST_CAPTCHA_KEY,
		geeTestLotNumber: comment.geeTestLotNumber,
		geeTestCaptchaOutput: comment.geeTestCaptchaOutput,
		geeTestPassToken: comment.geeTestPassToken,
		geeTestGenTime: comment.geeTestGenTime
	});
	else if (provider === "Cap" && isBuiltinCap(config)) {
		if (!comment.capToken) throw new Error("验证码 token 缺失，请刷新页面重试");
		await checkCapCaptcha({
			capToken: comment.capToken,
			cap: createCap(databaseCapStorage(adapters.database))
		}, validateToken);
	} else if (provider === "Cap" && config.CAP_API_ENDPOINT && config.CAP_SECRET_KEY) {
		if (!comment.capToken) throw new Error("验证码 token 缺失，请刷新页面重试");
		await checkCapCaptcha({
			capToken: comment.capToken,
			capSecretKey: config.CAP_SECRET_KEY,
			capApiEndpoint: config.CAP_API_ENDPOINT
		});
	} else if (provider === "Cap") throw new Error("Cap 验证码配置不完整：内嵌模式无需额外配置，外部模式需填写 CAP_API_ENDPOINT 与 CAP_SECRET_KEY");
	else if (provider) throw new Error(`不支持的验证码类型: ${String(provider)}`);
}
/**
* COMMENT_SUBMIT：提交评论（校验 → 限流 → 验证码 → 预检 → 保存 → 副作用）。
* @param ctx 请求上下文
* @returns 提交响应（id 为新评论 id）
*/
const commentSubmit = async (ctx) => {
	const res = {};
	const event = ctx.request.body;
	validate(event, [
		"url",
		"ua",
		"comment"
	]);
	await limitFilter({
		db: ctx.adapters.database,
		config: ctx.config,
		ip: ctx.request.ip
	});
	await checkCaptcha(ctx);
	const data = await parseCommentDoc(ctx);
	const comment = await ctx.adapters.database.addComment(data);
	res.id = comment._id;
	res.code = RES_CODE.SUCCESS;
	ctx.logger.verbose("派发 POST_SUBMIT（垃圾检测 + 通知）");
	await ctx.adapters.postSubmit.dispatch(comment, ctx).catch((e) => {
		ctx.logger.error("POST_SUBMIT 派发失败", e instanceof Error ? e.message : String(e));
	});
	return res;
};
/**
* 获取文章点击量（读取 + 自增一次）。
*
* 阅读数按「同一页面的不同 URL 形态」合并统计：`/path` 与 `/path/` 指向同一页面，
* 读取时把两种形态的计数相加 —— 存量数据可能分散在两个键上（1.x 起就存在该问题），
* 只查一个键会显示成两个不同的页面。自增仍写在客户端实际请求的那个 URL 上，
* 与评论侧 `getUrlQuery` 的 `$in` 查询语义保持一致。
* @param ctx 请求上下文
* @returns 计数响应（data/time/updated）
*/
const counterGet = async (ctx) => {
	const res = {};
	try {
		const event = ctx.request.body;
		validate(event, ["url"]);
		const url = event.url;
		const variants = getUrlQuery(url).filter((v) => v);
		const found = (await Promise.all(variants.map((v) => ctx.adapters.database.getCounter(v)))).filter((r) => Boolean(r));
		const time = found.reduce((sum, r) => sum + (r.time ?? 0), 0);
		const base = found.reduce((best, r) => best === null || (r.time ?? 0) > (best.time ?? 0) ? r : best, null);
		res.data = base ? {
			...base,
			time
		} : {};
		res.time = time;
		await ctx.adapters.database.incCounter(url, event.title);
		res.updated = 1;
	} catch (e) {
		res.message = e instanceof Error ? e.message : String(e);
		return res;
	}
	return res;
};
/**
* 判断是否存在管理员密码（前端据此决定是否显示初始化/登录入口）。
* @param ctx 请求上下文
* @returns 状态响应
*/
const getPasswordStatusEvent = (ctx) => getPasswordStatus(ctx.config, VERSION);
/**
* 写入管理密码（库中无密码可直接写入；已有密码需管理员）。
* @param ctx 请求上下文
* @returns 设置响应
*/
const setPasswordEvent = (ctx) => setPassword({
	config: ctx.config,
	configReadFailed: ctx.configReadFailed,
	accessToken: ctx.accessToken,
	password: ctx.request.body.password,
	/**
	*
	*/
	saveConfig: (config) => ctx.adapters.database.saveConfig(config)
});
/**
* 构建对外公开配置（1.x getConfig 逐字段对齐）。
* @param config 全量配置
* @param isAdminUser 是否管理员
* @returns 公开配置响应
*/
function getPublicConfig(config, isAdminUser) {
	/** 对外白名单配置 */
	const baseConfig = {
		VERSION,
		IS_ADMIN: isAdminUser,
		SITE_NAME: config.SITE_NAME,
		SITE_URL: config.SITE_URL,
		MASTER_TAG: config.MASTER_TAG,
		COMMENT_BG_IMG: config.COMMENT_BG_IMG,
		GRAVATAR_CDN: config.GRAVATAR_CDN,
		DEFAULT_GRAVATAR: config.DEFAULT_GRAVATAR,
		SHOW_IMAGE: config.SHOW_IMAGE || "true",
		IMAGE_CDN: config.IMAGE_CDN,
		LIGHTBOX: config.LIGHTBOX || "false",
		SHOW_EMOTION: config.SHOW_EMOTION || "true",
		EMOTION_CDN: config.EMOTION_CDN,
		COMMENT_PLACEHOLDER: config.COMMENT_PLACEHOLDER,
		SHOW_ORDER: config.SHOW_ORDER || "true",
		SHOW_DISLIKE: config.SHOW_DISLIKE || "true",
		DISPLAYED_FIELDS: config.DISPLAYED_FIELDS,
		REQUIRED_FIELDS: config.REQUIRED_FIELDS,
		HIDE_ADMIN_CRYPT: config.HIDE_ADMIN_CRYPT,
		HIGHLIGHT: config.HIGHLIGHT || "true",
		HIGHLIGHT_THEME: config.HIGHLIGHT_THEME,
		HIGHLIGHT_PLUGIN: config.HIGHLIGHT_PLUGIN,
		LIMIT_LENGTH: config.LIMIT_LENGTH,
		CAPTCHA_PROVIDER: config.CAPTCHA_PROVIDER
	};
	if (config.CAPTCHA_PROVIDER === "Turnstile") baseConfig.TURNSTILE_SITE_KEY = config.TURNSTILE_SITE_KEY;
	if (config.CAPTCHA_PROVIDER === "Geetest") baseConfig.GEETEST_CAPTCHA_ID = config.GEETEST_CAPTCHA_ID;
	if (config.CAPTCHA_PROVIDER === "Cap") {
		if (config.CAP_API_ENDPOINT) baseConfig.CAP_API_ENDPOINT = config.CAP_API_ENDPOINT;
		else baseConfig.CAP_BUILTIN = true;
	}
	return {
		code: RES_CODE.SUCCESS,
		config: baseConfig
	};
}
/**
* 管理员读取全量配置（1.x getConfigForAdmin 对齐：删除 CREDENTIALS 后返回）。
* @param config 全量配置
* @param isAdminUser 是否管理员
* @returns 配置响应
*/
function getConfigForAdmin(config, isAdminUser) {
	if (isAdminUser) {
		/** 摘除凭证后的副本（不改动内存态原配置） */
		const safeConfig = { ...config };
		delete safeConfig.CREDENTIALS;
		safeConfig.VERSION = VERSION;
		return {
			code: RES_CODE.SUCCESS,
			config: safeConfig
		};
	}
	return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
}
/**
* 修改配置（1.x setConfig 对齐：管理员写入库；键集合由管理面板约束）。
* @param options 配置写入载荷
* @returns 响应体
*/
async function setConfig(options) {
	const { newConfig, isAdminUser, saveConfig } = options;
	if (!isAdminUser) return {
		code: RES_CODE.NEED_LOGIN,
		message: "请先登录"
	};
	await saveConfig(newConfig);
	return { code: RES_CODE.SUCCESS };
}
/**
* GET_CONFIG：读取对外公开配置（白名单字段 + 验证码供应商定向下发）。
* @param ctx 请求上下文
* @returns 公开配置响应
*/
const getConfig = (ctx) => getPublicConfig(ctx.config, isAdmin(ctx.config, ctx.accessToken));
/**
* 管理员读取全量配置（摘除 CREDENTIALS）。
* @param ctx 请求上下文
* @returns 全量配置响应
*/
const getConfigForAdminEvent = (ctx) => getConfigForAdmin(ctx.config, isAdmin(ctx.config, ctx.accessToken));
/**
* 修改配置（管理员写入库；saveConfig 合并语义）。
* @param ctx 请求上下文
* @returns 设置响应
*/
const setConfigEvent = (ctx) => setConfig({
	newConfig: ctx.request.body.config,
	isAdminUser: isAdmin(ctx.config, ctx.accessToken),
	/**
	*
	*/
	saveConfig: (config) => ctx.adapters.database.saveConfig(config)
});
/**
* 管理员登录（密码校验；成功仅返回 code 0，token 由客户端本地计算）。
* @param ctx 请求上下文
* @returns 登录响应
*/
const loginEvent = (ctx) => login(ctx.config, ctx.request.body.password);
/**
* GET_COMMENTS_COUNT 事件处理器（1.x getCommentsCount 语义对齐）。
*/
/**
* 批量获取文章评论数（includeReply 缺省不含回复；垃圾评论不计入）。
* @param ctx 请求上下文
* @returns 计数响应（data: [{url, count}]）
*/
const getCommentsCount = async (ctx) => {
	const res = {};
	try {
		const event = ctx.request.body;
		validate(event, ["urls"]);
		const urls = event.urls;
		const db = ctx.adapters.database;
		res.data = await Promise.all(urls.map(async (url) => {
			/** 单页计数：url 多形态 + 非垃圾 +（缺省）顶级 */
			const urlVariants = new Set(getUrlsQuery([url]));
			let count = 0;
			for (const u of urlVariants) {
				const base = {
					url: u,
					isSpam: { [NOT]: true }
				};
				if (!event.includeReply) base.rid = ABSENT;
				count += await db.countComments(base);
			}
			return {
				url,
				count
			};
		}));
	} catch (e) {
		res.message = e instanceof Error ? e.message : String(e);
		return res;
	}
	return res;
};
/**
* GET_RECENT_COMMENTS 事件处理器（1.x getRecentComments 语义对齐）。
*/
/**
* 剔除「父评论未通过审核」的回复。
*
* 回复自身往往不是垃圾（典型场景：博主回复了一条待审核评论），但它的父评论在页面上
* 不可见，于是从首页点进文章会看到一条「评论不存在」的回复（#600）。这里按 rid 批量
* 回查父评论，把父评论 `isSpam` 的回复过滤掉；父评论已删除（查不到）的不动，保持原行为。
*
* 取舍：过滤发生在分页之后，因此这一页可能少于 pageSize 条。跨库没有 join，无法在查询层
* 完成；对「最新评论」这类展示型列表是可接受的。
* @param db 数据库适配器
* @param comments 已按查询条件取出的评论
* @returns 过滤后的评论列表
*/
async function dropHiddenParentReplies(db, comments) {
	const rids = [...new Set(comments.map((c) => c.rid).filter((r) => Boolean(r)))];
	if (!rids.length) return comments;
	const parents = await db.getComments({ _id: rids });
	const hidden = new Set(parents.filter((p) => p.isSpam === true).map((p) => String(p._id)));
	return comments.filter((c) => !c.rid || !hidden.has(String(c.rid)));
}
/**
* 获取最新评论（非垃圾、可选页内、缺省不含回复、pageSize 上限 100）。
* @param ctx 请求上下文
* @returns 最新评论响应（data: 摘要 DTO 列表）
*/
const getRecentComments = async (ctx) => {
	const res = {};
	try {
		const event = ctx.request.body;
		const config = ctx.config;
		const db = ctx.adapters.database;
		/** 查询条件：非垃圾 +（可选）页内 +（缺省）顶级 */
		const query = { isSpam: { [NOT]: true } };
		if (Array.isArray(event.urls) && event.urls.length) query.url = { $in: getUrlsQuery(event.urls) };
		if (!event.includeReply) query.rid = ABSENT;
		const pageSize = Number(event.pageSize) > 100 ? 100 : Number(event.pageSize) || 10;
		const result = await db.getComments(query, {
			sort: { created: -1 },
			limit: pageSize
		});
		const visible = event.includeReply ? await dropHiddenParentReplies(db, result) : result;
		const toText = await getHtmlToText();
		res.data = visible.map((comment) => ({
			id: String(comment._id),
			url: comment.url,
			nick: comment.nick,
			avatar: getAvatar(comment, config),
			mailMd5: getMailMd5(comment),
			link: comment.link,
			comment: comment.comment,
			commentText: toText(String(comment.comment ?? "")),
			created: comment.created
		}));
	} catch (e) {
		res.message = e instanceof Error ? e.message : String(e);
		return res;
	}
	return res;
};
/**
* 邮件测试（管理员；重置传输器后按最新配置发送测试邮件）。
* @param ctx 请求上下文
* @returns 测试响应
*/
const emailTestEvent = (ctx) => emailTest({
	mail: ctx.request.body.mail,
	config: ctx.config,
	isAdminUser: isAdmin(ctx.config, ctx.accessToken),
	caps: ctx.adapters.capabilities,
	logger: ctx.logger
});
/**
* 图片上传服务（1.x utils/image.js 移植）。
*
* 图床矩阵：7bu / S.EE / 兰空（URL 或 lskypro）/ PicList / EasyImage /
* Chevereto / S3（原生 SigV4，零 SDK）。NSFW 检测（NSFW_API_URL）可选拦截。
*/
/** 最大图片体积（10 MB） */
const MAX_IMAGE_SIZE = 10485760;
/** 图片魔数识别表（JPEG/PNG/GIF/WebP，1.x IMAGE_TYPES 对齐） */
const IMAGE_TYPES = [
	{
		mimeType: "image/jpeg",
		extension: "jpg",
		/**
		*
		*/
		matches: (body) => body.length >= 3 && body[0] === 255 && body[1] === 216 && body[2] === 255
	},
	{
		mimeType: "image/png",
		extension: "png",
		/**
		*
		*/
		matches: (body) => body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10
		]))
	},
	{
		mimeType: "image/gif",
		extension: "gif",
		/**
		*
		*/
		matches: (body) => body.length >= 6 && (body.subarray(0, 6).equals(Buffer.from("GIF87a")) || body.subarray(0, 6).equals(Buffer.from("GIF89a")))
	},
	{
		mimeType: "image/webp",
		extension: "webp",
		/**
		*
		*/
		matches: (body) => body.length >= 12 && body.subarray(0, 4).equals(Buffer.from("RIFF")) && body.subarray(8, 12).equals(Buffer.from("WEBP"))
	}
];
/**
* 解析 base64 图片载荷（1.x parseImage 对齐：体积、data URL 头、
* base64 合法性、魔数与 MIME 一致性四重校验）。
* @param photo data URL 形态的 base64 图片
* @returns 解析结果
*/
function parseImage(photo) {
	if (typeof photo !== "string" || photo.length > Math.ceil(MAX_IMAGE_SIZE / 3) * 4 + 64) throw new Error("图片大小不能超过 10 MB");
	const header = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,/i.exec(photo);
	if (!header) throw new Error("图片数据格式不合法");
	const declaredMimeType = header[1].toLowerCase();
	const base64 = photo.slice(header[0].length);
	if (!base64 || base64.length % 4 !== 0 || !/^[a-z0-9+/]*={0,2}$/i.test(base64)) throw new Error("图片数据格式不合法");
	const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
	if (base64.length * 3 / 4 - padding > MAX_IMAGE_SIZE) throw new Error("图片大小不能超过 10 MB");
	const body = Buffer.from(base64, "base64");
	const imageType = IMAGE_TYPES.find((type) => type.matches(body));
	if (!imageType) throw new Error("仅支持 JPEG、PNG、GIF 和 WebP 图片");
	if (declaredMimeType !== imageType.mimeType) throw new Error("图片 MIME 类型与文件内容不匹配");
	return {
		body,
		mimeType: imageType.mimeType,
		fileName: `${randomBytes(16).toString("hex")}.${imageType.extension}`
	};
}
/**
* FormData 附加图片（1.x appendImage 对齐）。
* @param formData FormData 实例
* @param fieldName 字段名
* @param image 解析后的图片
*/
function appendImage(formData, fieldName, image) {
	formData.append(fieldName, image.body, {
		filename: image.fileName,
		contentType: image.mimeType,
		knownLength: image.body.length
	});
}
/**
* UPLOAD_IMAGE 事件处理（1.x uploadImage 链路对齐：配置校验 → NSFW → 分发）。
* @param options 上传入参
* @returns 上传响应（res.data 含各图床返回）
*/
async function uploadImage(options) {
	const { config, caps } = options;
	const photo = options.photo;
	/** 响应体 */
	const res = {};
	const imageService = config.IMAGE_CDN;
	try {
		if (imageService === "s3") {
			if (!config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) throw new Error("未配置 S3 图床参数（S3_BUCKET、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY）");
		} else if (!imageService || !config.IMAGE_CDN_TOKEN) throw new Error("未配置图片上传服务");
		if (typeof imageService === "string" && ![
			"7bu",
			"see",
			"lskypro",
			"piclist",
			"easyimage",
			"chevereto",
			"s3"
		].includes(imageService) && !isUrl(imageService)) throw new Error("不支持的图片上传服务");
		const image = parseImage(photo);
		if (config.NSFW_API_URL) {
			const nsfwResult = await checkNsfw({
				image,
				config,
				caps
			});
			if (nsfwResult.rejected) {
				res.code = RES_CODE.NSFW_REJECTED;
				res.err = nsfwResult.message;
				return res;
			}
		}
		/** 上传辅助（各图床共享的上下文） */
		const ctx = {
			image,
			config,
			res,
			FormData: await getFormData(caps)
		};
		if (imageService === "7bu") await uploadImageToLskyPro({
			...ctx,
			imageCdn: "https://7bu.top"
		});
		else if (imageService === "see") await uploadImageToSee({
			...ctx,
			imageCdn: "https://s.ee/api/v1/file/upload"
		});
		else if (typeof imageService === "string" && isUrl(imageService)) await uploadImageToLskyPro({
			...ctx,
			imageCdn: imageService
		});
		else if (imageService === "lskypro") await uploadImageToLskyPro({
			...ctx,
			imageCdn: config.IMAGE_CDN_URL
		});
		else if (imageService === "piclist") await uploadImageToPicList({
			...ctx,
			imageCdn: config.IMAGE_CDN_URL
		});
		else if (imageService === "easyimage") await uploadImageToEasyImage(ctx);
		else if (imageService === "chevereto") await uploadImageToChevereto(ctx);
		else if (imageService === "s3") await uploadImageToS3(ctx);
		else throw new Error("不支持的图片上传服务");
	} catch (e) {
		res.code = RES_CODE.UPLOAD_FAILED;
		res.err = e instanceof Error ? e.message : String(e);
	}
	return res;
}
/**
* NSFW 检测（1.x checkNsfw 对齐：分数超阈值拒绝；检测失败不拦截）。
* @param params 检测入参
* @returns 拒绝判定
*/
async function checkNsfw(params) {
	const { image, config, caps } = params;
	const result = {
		rejected: false,
		message: ""
	};
	try {
		const threshold = parseFloat(String(config.NSFW_THRESHOLD)) || .5;
		const apiUrl = String(config.NSFW_API_URL).replace(/\/$/, "");
		const formData = new (await (getFormData(caps)))();
		appendImage(formData, "image", image);
		const scores = (await httpPost(`${apiUrl}/classify`, formData, {
			headers: formData.getHeaders(),
			timeout: 3e4
		})).data;
		if (scores && typeof scores === "object") {
			const nsfwScore = (scores.porn || 0) + (scores.hentai || 0) + (scores.sexy || 0);
			if (nsfwScore > threshold) {
				result.rejected = true;
				result.message = `图片包含不当内容，检测分数 ${nsfwScore.toFixed(3)} 超过阈值 ${threshold}`;
			}
		}
	} catch {}
	return result;
}
/**
* S.EE 图床上传（1.x uploadImageToSee 对齐）。
*/
async function uploadImageToSee(ctx) {
	const FormData = ctx.FormData;
	const formData = new FormData();
	appendImage(formData, "smfile", ctx.image);
	const data = (await httpPost(ctx.imageCdn, formData, { headers: {
		...formData.getHeaders(),
		Authorization: ctx.config.IMAGE_CDN_TOKEN
	} })).data;
	if (data.success) ctx.res.data = data.data;
	else throw new Error(data.message ?? "上传失败");
}
/**
* 兰空图床 v2 上传（1.x uploadImageToLskyPro 对齐；7bu/自定义 URL 同协议）。
*/
async function uploadImageToLskyPro(ctx) {
	const FormData = ctx.FormData;
	const formData = new FormData();
	appendImage(formData, "file", ctx.image);
	const url = `${ctx.imageCdn}/api/v1/upload`;
	let token = String(ctx.config.IMAGE_CDN_TOKEN);
	if (!token.startsWith("Bearer")) token = `Bearer ${token}`;
	const data = (await httpPost(url, formData, { headers: {
		...formData.getHeaders(),
		Authorization: token
	} })).data;
	if (data.status) {
		const payload = data.data ?? {};
		payload.url = data.data?.links?.url;
		ctx.res.data = payload;
	} else throw new Error(data.message ?? "上传失败");
}
/**
* PicList 图床上传（1.x uploadImageToPicList 对齐：query key 鉴权）。
*/
async function uploadImageToPicList(ctx) {
	const FormData = ctx.FormData;
	const formData = new FormData();
	appendImage(formData, "file", ctx.image);
	let url = `${ctx.imageCdn}/upload`;
	if (ctx.config.IMAGE_CDN_TOKEN) url += `?key=${ctx.config.IMAGE_CDN_TOKEN}`;
	const data = (await httpPost(url, formData)).data;
	if (data.success) ctx.res.data = {
		...data,
		url: data.result?.[0]
	};
	else throw new Error(data.message ?? "上传失败");
}
/**
* EasyImage2.0 上传（1.x uploadImageToEasyImage 对齐）。
*/
async function uploadImageToEasyImage(ctx) {
	const FormData = ctx.FormData;
	if (!ctx.config.IMAGE_CDN_URL) throw new Error("未配置 EasyImage2.0 的 API 地址 (IMAGE_CDN_URL)");
	if (!ctx.config.IMAGE_CDN_TOKEN) throw new Error("未配置 EasyImage2.0 的 Token (IMAGE_CDN_TOKEN)");
	const formData = new FormData();
	formData.append("token", ctx.config.IMAGE_CDN_TOKEN);
	appendImage(formData, "image", ctx.image);
	const response = (await httpPost(ctx.config.IMAGE_CDN_URL, formData, { headers: {
		...formData.getHeaders(),
		"User-Agent": "Twikoo"
	} })).data;
	if (response.code !== 200 || response.result !== "success") throw new Error(`API 返回错误 (CODE: ${response.code})`);
	if (!response.url) throw new Error("未找到有效图片 URL");
	ctx.res.data = {
		url: response.url,
		thumb: response.thumb,
		del: response.del
	};
}
/**
* Chevereto 上传（1.x uploadImageToChevereto 对齐）。
*/
async function uploadImageToChevereto(ctx) {
	const FormData = ctx.FormData;
	if (!ctx.config.IMAGE_CDN_URL) throw new Error("未配置 Chevereto 站点地址 (IMAGE_CDN_URL)");
	if (!ctx.config.IMAGE_CDN_TOKEN) throw new Error("未配置 Chevereto API Key (IMAGE_CDN_TOKEN)");
	const formData = new FormData();
	formData.append("key", ctx.config.IMAGE_CDN_TOKEN);
	appendImage(formData, "source", ctx.image);
	formData.append("format", "json");
	const data = (await httpPost(`${ctx.config.IMAGE_CDN_URL}`.replace(/\/$/, "") + "/api/1/upload", formData, { headers: formData.getHeaders() })).data;
	if (data.status_code === 200 && data.image && data.image.url) ctx.res.data = {
		url: data.image.url,
		thumb: data.image.thumb ? data.image.thumb.url : data.image.url,
		del: data.image.delete_url
	};
	else throw new Error(`Chevereto 上传失败: ${data.error?.message ?? JSON.stringify(data)}`);
}
/**
* S3 上传（1.x uploadImageToS3 对齐：原生 AWS SigV4，零 SDK）。
*/
async function uploadImageToS3(ctx) {
	const { image, config } = ctx;
	if (!config.S3_BUCKET) throw new Error("未配置 S3 存储桶名称 (S3_BUCKET)");
	if (!config.S3_ACCESS_KEY_ID) throw new Error("未配置 S3 Access Key ID (S3_ACCESS_KEY_ID)");
	if (!config.S3_SECRET_ACCESS_KEY) throw new Error("未配置 S3 Secret Access Key (S3_SECRET_ACCESS_KEY)");
	const region = config.S3_REGION || "us-east-1";
	const { body, mimeType, fileName } = image;
	const key = `${config.S3_PATH_PREFIX ? `${config.S3_PATH_PREFIX}`.replace(/\/$/, "") + "/" : ""}${fileName}`;
	const forcePathStyle = String(config.S3_FORCE_PATH_STYLE).trim().toLowerCase() !== "false";
	let s3Base;
	let endpoint;
	if (config.S3_ENDPOINT) {
		const endpointBase = `${config.S3_ENDPOINT}`.replace(/\/$/, "");
		s3Base = forcePathStyle ? `${endpointBase}/${config.S3_BUCKET}` : endpointBase;
		endpoint = `${s3Base}/${key}`;
	} else {
		s3Base = `https://${config.S3_BUCKET}.s3.${region}.amazonaws.com`;
		endpoint = `${s3Base}/${key}`;
	}
	const endpointUrl = new URL(endpoint);
	const host = endpointUrl.host;
	const pathname = endpointUrl.pathname;
	const now = /* @__PURE__ */ new Date();
	const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
	const amzDate = now.toISOString().replace(/[:-]/g, "").slice(0, 15) + "Z";
	const payloadHash = createHash("sha256").update(body).digest("hex");
	const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
	const canonicalRequest = [
		"PUT",
		pathname,
		"",
		[
			`content-type:${mimeType}`,
			`host:${host}`,
			`x-amz-content-sha256:${payloadHash}`,
			`x-amz-date:${amzDate}`
		].join("\n") + "\n",
		signedHeaders,
		payloadHash
	].join("\n");
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		createHash("sha256").update(canonicalRequest).digest("hex")
	].join("\n");
	/**
	*
	*/
	const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
	const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${config.S3_SECRET_ACCESS_KEY}`), dateStamp), `${region}`), "s3"), "aws4_request");
	const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
	const authorization = `AWS4-HMAC-SHA256 Credential=${config.S3_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	await httpPut(endpoint, body, {
		headers: {
			"Content-Type": mimeType,
			"x-amz-content-sha256": payloadHash,
			"x-amz-date": amzDate,
			Authorization: authorization
		},
		maxBodyLength: Infinity
	});
	const fileUrl = config.S3_CDN_URL ? `${config.S3_CDN_URL}`.replace(/\/$/, "") + `/${key}` : `${s3Base}/${key}`;
	ctx.res.data = { url: fileUrl };
}
/**
* 上传图片到配置的图床（IMAGE_CDN 分发；NSFW 检测可选拦截）。
* @param ctx 请求上下文
* @returns 上传响应
*/
const uploadImageEvent = (ctx) => uploadImage({
	photo: ctx.request.body.photo,
	config: ctx.config,
	caps: ctx.adapters.capabilities
});
/**
* 获取 QQ 昵称（QQ_API_KEY 鉴权可配；失败返回 null 不抛错）。
* @param ctx 请求上下文
* @returns 昵称响应
*/
const getQQNickEvent = async (ctx) => {
	const res = {};
	try {
		const event = ctx.request.body;
		validate(event, ["qq"]);
		const nick = await getQQNick(event.qq, ctx.config.QQ_API_KEY);
		res.code = RES_CODE.SUCCESS;
		res.nick = nick;
	} catch (e) {
		res.code = RES_CODE.FAIL;
		res.message = e instanceof Error ? e.message : String(e);
	}
	return res;
};
/**
* CAP_CHALLENGE：签发内嵌 Cap 挑战（未启用内嵌 Cap 返回 FAIL）。
* @param ctx 请求上下文
* @returns 挑战响应
*/
const capChallengeEvent = (ctx) => capChallenge({
	config: ctx.config,
	db: ctx.adapters.database
});
/**
* CAP_REDEEM：兑换内嵌 Cap 挑战换取通行 token。
* @param ctx 请求上下文
* @returns 兑换响应
*/
const capRedeemEvent = (ctx) => capRedeem({
	config: ctx.config,
	db: ctx.adapters.database,
	body: ctx.request.body
});
/**
* 事件处理器装配（规范 handlers）。
*
* 25 事件全量注册（一事件一文件）：24 个客户端事件 + 服务端内部事件 `POST_SUBMIT`
* （后置副作用链的执行入口，见 `./post-submit.ts` 头注释，长期保留）。
* dispatcher 模块加载时 import 本文件触发默认注册。
*/
/**
* 接线真实 postSubmit 服务：后置垃圾检测 → 回写结果 → 三路通知。
*
* 本服务是「副作用链的唯一实现」，被两条路径共用：
* 1. 单次执行平台：适配器的派发端口递归自调用 → POST_SUBMIT 事件 → 本服务
*    （1.x 的 HTTP 递归 / `callFunction` 语义，2.0 收敛到 postSubmit 端口）；
* 2. 常驻进程平台与 eo-makers：适配器进程内直调本服务（不 await）。
*/
setPostSubmitService(async (comment, ctx) => {
	const isSpam = await postCheckSpam({
		comment,
		config: ctx.config,
		caps: ctx.adapters.capabilities,
		logger: ctx.logger
	});
	await saveSpamCheckResult(ctx.adapters.database, comment, isSpam);
	await sendNotice({
		comment,
		config: ctx.config,
		caps: ctx.adapters.capabilities,
		logger: ctx.logger,
		/**
		*
		*/
		getParentComment: async (current) => {
			if (!current.pid) return null;
			return ctx.adapters.database.getComment(current.pid);
		}
	});
	return { code: 0 };
});
/**
* 注册默认事件处理器集（模块加载时执行一次；测试可在 resetHandlers() 后
* 重新调用以恢复默认注册表）。
*/
function registerDefaultHandlers() {
	registerHandler(GET_FUNC_VERSION, getFuncVersion);
	registerHandler(COMMENT_GET, commentGet);
	registerHandler(COMMENT_GET_FOR_ADMIN, commentGetForAdmin);
	registerHandler(COMMENT_SET_FOR_ADMIN, commentSetForAdmin);
	registerHandler(COMMENT_DELETE_FOR_ADMIN, commentDeleteForAdmin);
	registerHandler(COMMENT_DELETE_FOR_USER, commentDeleteForUser);
	registerHandler(COMMENT_IMPORT_FOR_ADMIN, commentImportForAdmin);
	registerHandler(COMMENT_EXPORT_FOR_ADMIN, commentExportForAdmin);
	registerHandler(COMMENT_LIKE, commentLike);
	registerHandler(COMMENT_SUBMIT, commentSubmit);
	registerHandler(COUNTER_GET, counterGet);
	registerHandler(GET_PASSWORD_STATUS, getPasswordStatusEvent);
	registerHandler(SET_PASSWORD, setPasswordEvent);
	registerHandler(GET_CONFIG, getConfig);
	registerHandler(GET_CONFIG_FOR_ADMIN, getConfigForAdminEvent);
	registerHandler(SET_CONFIG, setConfigEvent);
	registerHandler(LOGIN, loginEvent);
	registerHandler(GET_COMMENTS_COUNT, getCommentsCount);
	registerHandler(GET_RECENT_COMMENTS, getRecentComments);
	registerHandler(EMAIL_TEST, emailTestEvent);
	registerHandler(UPLOAD_IMAGE, uploadImageEvent);
	registerHandler(GET_QQ_NICK, getQQNickEvent);
	registerHandler(CAP_CHALLENGE, capChallengeEvent);
	registerHandler(CAP_REDEEM, capRedeemEvent);
	registerHandler(POST_SUBMIT, postSubmitEvent);
}
registerDefaultHandlers();
/**
* 事件分发器（规范 core/dispatcher.ts）。
*
* 25 事件全量显式 switch（Scope E 清单）：24 个客户端事件解析到注册表中的
* handler 实现；POST_SUBMIT 是服务端内部事件——后置副作用链的执行入口
* （长期保留，带内部派发令牌校验）。事件清单在这里**显式枚举**
* 正是契约保障：任何事件漏实现/漏断言，契约套件与 switch 清单的 diff
* 立即可见（替代 1.x「各后端 switch 保持一致」的人工约定）。
*/
/**
* 解析注册表并执行事件处理器；未注册（迁移未达）抛
* HandlerNotRegisteredError，由 pipeline catch 统一转 FAIL 错误体。
* @param ctx 请求上下文
* @param event 事件名
* @returns 事件响应体
*/
async function runRegistered(ctx, event) {
	const handler = resolveHandler(event);
	if (!handler) throw new HandlerNotRegisteredError(event);
	return handler(ctx);
}
/**
* 分发事件到对应处理器（标准流程第 8 步）。
*
* POST_SUBMIT 是唯一非客户端事件：后置副作用链的执行入口（长期保留），
* 处理器内校验内部派发令牌以防外部滥用。
* @param ctx 请求上下文
* @returns 事件响应体
*/
async function dispatch(ctx) {
	const eventName = ctx.request.body.event;
	if (!eventName) return {
		code: RES_CODE.NO_PARAM,
		message: "Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置",
		version: VERSION
	};
	switch (eventName) {
		case GET_FUNC_VERSION: return runRegistered(ctx, GET_FUNC_VERSION);
		case COMMENT_GET: return runRegistered(ctx, COMMENT_GET);
		case COMMENT_GET_FOR_ADMIN: return runRegistered(ctx, COMMENT_GET_FOR_ADMIN);
		case COMMENT_SET_FOR_ADMIN: return runRegistered(ctx, COMMENT_SET_FOR_ADMIN);
		case COMMENT_DELETE_FOR_ADMIN: return runRegistered(ctx, COMMENT_DELETE_FOR_ADMIN);
		case COMMENT_DELETE_FOR_USER: return runRegistered(ctx, COMMENT_DELETE_FOR_USER);
		case COMMENT_IMPORT_FOR_ADMIN: return runRegistered(ctx, COMMENT_IMPORT_FOR_ADMIN);
		case COMMENT_EXPORT_FOR_ADMIN: return runRegistered(ctx, COMMENT_EXPORT_FOR_ADMIN);
		case COMMENT_LIKE: return runRegistered(ctx, COMMENT_LIKE);
		case COMMENT_SUBMIT: return runRegistered(ctx, COMMENT_SUBMIT);
		case COUNTER_GET: return runRegistered(ctx, COUNTER_GET);
		case GET_PASSWORD_STATUS: return runRegistered(ctx, GET_PASSWORD_STATUS);
		case SET_PASSWORD: return runRegistered(ctx, SET_PASSWORD);
		case GET_CONFIG: return runRegistered(ctx, GET_CONFIG);
		case GET_CONFIG_FOR_ADMIN: return runRegistered(ctx, GET_CONFIG_FOR_ADMIN);
		case SET_CONFIG: return runRegistered(ctx, SET_CONFIG);
		case LOGIN: return runRegistered(ctx, LOGIN);
		case GET_COMMENTS_COUNT: return runRegistered(ctx, GET_COMMENTS_COUNT);
		case GET_RECENT_COMMENTS: return runRegistered(ctx, GET_RECENT_COMMENTS);
		case EMAIL_TEST: return runRegistered(ctx, EMAIL_TEST);
		case UPLOAD_IMAGE: return runRegistered(ctx, UPLOAD_IMAGE);
		case GET_QQ_NICK: return runRegistered(ctx, GET_QQ_NICK);
		case CAP_CHALLENGE: return runRegistered(ctx, CAP_CHALLENGE);
		case CAP_REDEEM: return runRegistered(ctx, CAP_REDEEM);
		case POST_SUBMIT: return runRegistered(ctx, POST_SUBMIT);
		default: return {
			code: RES_CODE.EVENT_NOT_EXIST,
			message: "请更新 Twikoo 云函数至最新版本"
		};
	}
}
/**
* 日志工具（1.7.24 `twikoo-func/utils/logger.js` 语义对齐 + 改进）。
*
* 保留：verbose/info/warn/error 四级，级别由 TWIKOO_LOG_LEVEL 控制（默认 info）。
* 改进：每请求一个 {@link RequestLogger} 实例——
* - 控制台输出带 requestId 前缀，前端排障可拿 ID 到后端日志检索；
* - 聚合本次请求全部日志行（getText()）供服务端排查；**不回传前端**（含请求参数与来访 IP）。
*/
let envLogLevel = process.env.TWIKOO_LOG_LEVEL || "info";
envLogLevel = envLogLevel.toLowerCase();
/** 当前生效级别（未识别值回落 info，1.x 语义） */
const currentLevel = {
	verbose: 1,
	info: 2,
	warn: 3,
	error: 4
}[envLogLevel] || 2;
/**
* 单条日志参数格式化：Error 取 message（含堆栈太长），对象 best-effort JSON，
* 其余 String()。
* @param message 单个日志参数
* @returns 可读字符串
*/
function formatMessage(message) {
	if (message instanceof Error) return message.message;
	if (typeof message === "string") return message;
	if (typeof message === "object" && message !== null) try {
		return JSON.stringify(message);
	} catch {
		return "[unserializable]";
	}
	return String(message);
}
/**
* 创建请求级日志器（requestId 贯穿全链路）。
* @param requestId 请求 ID（不传则自动生成 UUID）
* @returns 请求级日志器实例
*/
function createRequestLogger(requestId = randomUUID()) {
	/** 聚合缓冲：记录全部级别（控制台按级别过滤，缓冲不过滤——异常诊断需要完整上下文） */
	const lines = [];
	/**
	* 统一写入口：级别够则输出控制台，任何级别都进缓冲。
	* @param level 级别名
	* @param weight 级别权重
	* @param consoleFn 控制台输出函数（console.log/info/warn/error）
	* @param messages 日志参数
	*/
	const write = (level, weight, consoleFn, messages) => {
		const text = messages.map(formatMessage).join(" ");
		const line = `${(/* @__PURE__ */ new Date()).toLocaleString()} Twikoo:[${requestId}] ${text}`;
		lines.push(line);
		if (currentLevel <= weight) consoleFn(line);
	};
	/** verbose 输出 */
	const verbose = (...messages) => write("verbose", 1, console.log, messages);
	/** info 输出 */
	const info = (...messages) => write("info", 2, console.info, messages);
	/** warn 输出 */
	const warn = (...messages) => write("warn", 3, console.warn, messages);
	/** error 输出 */
	const error = (...messages) => write("error", 4, console.error, messages);
	/** 读取聚合文本 */
	const getText = () => lines.join("\n");
	return {
		verbose,
		info,
		warn,
		error,
		getText,
		requestId
	};
}
/**
* 请求处理管线（规范 core/pipeline.ts；标准流程）。
*
* 八步编排（1.7.24 vercel 入口流程语义对齐）：
* 1. protect 限流（requestTimes 按 IP 累计，超限 429）
* 2. validateClientFields（防 NoSQL 操作符注入）
* 3. 生成 accessToken（匿名签到：回传则复用，否则签发）
* 4. 连库（database.init()，实现保证幂等）
* 5. readConfig（getConfig() ?? {}，失败降级空配置）
* 6. allowCors（localhost 正则 + CORS_ALLOW_ORIGIN 白名单 → 响应头）
* 7. OPTIONS 预检 → 204
* 8. dispatch 分发事件 → 回填 res.accessToken → 返回
*
* 与 1.x 的差异（均为计划内改进）：
* - 限流超限从「HTTP 200 + code 1000」升级为 HTTP 429（客户端 TwikooError
*   按 429 映射「请求过于频繁」）；
* - 异常响应体附带 `log` 字段（本次请求聚合日志，requestId 标注）。
*/
/** 限流计数器（1.x requestTimes 语义：按 IP 累计请求次数，进程生命周期内累计） */
const requestTimes = {};
/**
* 步骤 1：防御——按 IP 累计请求次数并检查上限（1.x protect 语义对齐）。
* @param request 内部统一请求
* @param logger 请求级日志器
* @throws RateLimitError 超过 TWIKOO_THROTTLE（默认 250）上限
*/
function protect(request, logger) {
	const ip = request.ip;
	requestTimes[ip] = (requestTimes[ip] || 0) + 1;
	if (requestTimes[ip] > getMaxRequestTimes()) {
		logger.warn(`${ip} 当前请求次数为 ${requestTimes[ip]}，已超过最大请求次数`);
		throw new RateLimitError(ip);
	} else logger.verbose(`${ip} 当前请求次数为 ${requestTimes[ip]}`);
}
/**
* 步骤 3：匿名签到（1.x anonymousSignIn 语义对齐）——请求已携带
* accessToken 则复用，否则签发 32 位随机令牌（1.x 为 uuid 去连字符，
* 2.0 用 Node 内置 crypto.randomUUID，零依赖等价）。
* @param request 内部统一请求
* @returns 本次请求生效的 accessToken
*/
function anonymousSignIn(request) {
	const token = request.body.accessToken;
	if (typeof token === "string" && token) return token;
	return randomUUID().replace(/-/g, "");
}
/**
* 步骤 6：CORS 规则（1.x allowCors + getAllowedOrigin 逐行对齐）。
* 仅当请求携带 Origin 头时产出 CORS 响应头；放行规则：
* localhost 正则恒放行 → config.CORS_ALLOW_ORIGIN 逗号白名单（条目去尾斜杠
* 精确匹配）→ 未配置白名单时直接放行。
* @param request 内部统一请求
* @param config 全量配置
* @returns CORS 响应头（无 Origin 时为空对象）
*/
function allowCors(request, config) {
	const origin = request.headers.origin;
	if (!origin) return {};
	return {
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Origin": getAllowedOrigin(origin, config),
		"Access-Control-Allow-Methods": "POST",
		"Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
		"Access-Control-Max-Age": "600"
	};
}
/** 错误路径共用进行中的配置读取，避免并发拒绝请求堆积查询。 */
const pendingCorsConfig = /* @__PURE__ */ new WeakMap();
/** 错误响应只读取已有数据库的配置，最多等待 100ms；失败或超时不放行跨域，也不改变原错误。 */
async function allowCorsForError(request, database) {
	if (!request.headers.origin) return {};
	let pending = pendingCorsConfig.get(database);
	if (!pending) {
		pending = (async () => {
			try {
				return await database.getConfig() ?? {};
			} catch (e) {
				console.error("Twikoo CORS configuration failed:", e);
				return null;
			}
		})();
		pendingCorsConfig.set(database, pending);
		pending.then(() => pendingCorsConfig.delete(database));
	}
	let timer;
	try {
		const config = await Promise.race([pending, new Promise((resolve) => {
			timer = setTimeout(() => resolve(null), 100);
		})]);
		return config === null ? {} : allowCors(request, config);
	} finally {
		clearTimeout(timer);
	}
}
/**
* 计算放行的 Origin（1.x getAllowedOrigin 逐行对齐）。
* @param origin 请求 Origin
* @param config 全量配置
* @returns 放行则为原 Origin；白名单不匹配为空串（禁止跨域）
*/
function getAllowedOrigin(origin, config) {
	if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/.test(origin)) return origin;
	else if (config.CORS_ALLOW_ORIGIN) {
		const corsList = String(config.CORS_ALLOW_ORIGIN).split(",");
		for (let i = 0; i < corsList.length; i++) if (corsList[i].replace(/\/$/, "") === origin) return origin;
		return "";
	} else return origin;
}
/**
* 步骤 5：读取配置（1.x readConfig 语义对齐）——每次请求读取最新配置；
* 读取失败降级为空配置并记录错误（1.x 建集合动作属于数据库实现的
* init() 职责，见 MongoDatabase）。
*
* ⚠️ 降级结果与「真的没有配置」不可区分，因此必须把 `failed` 一并带出去：
* 凡是「配置为空 ⇒ 放行」的分支都要看它（GHSA-v349-m8q5-7x2g）。
* @param adapters 适配器聚合端口
* @param logger 请求级日志器
* @returns 全量配置（无配置为空对象）与该次读取是否失败
*/
async function readConfig(adapters, logger) {
	try {
		return {
			config: await adapters.database.getConfig() ?? {},
			failed: false
		};
	} catch (e) {
		logger.error("读取配置失败：", e);
		return {
			config: {},
			failed: true
		};
	}
}
/**
* 错误消息提取（1.x `e.message` 语义；非 Error 值 String 化）。
* @param e 捕获值
* @returns 错误消息
*/
function getErrorMessage(e) {
	return e instanceof Error ? e.message : String(e);
}
/**
* 创建统一请求处理器（唯一入口 createHandler 的实现核心）：
* 启动期以适配器聚合装配一次，返回逐请求调用的处理器。
* @param adapters 适配器聚合端口
* @returns 逐请求处理器（TkRequest → TkResponse）
*/
function createPipeline(adapters) {
	/**
	* 逐请求处理器：执行八步编排，任何异常统一转错误体（限流例外 → 429）。
	* @param request 已归一化的内部统一请求
	* @returns 内部统一响应
	*/
	return async function handleRequest(request) {
		const logger = createRequestLogger();
		/** 响应头（CORS 等，异常路径也要保留已计算的头） */
		const headers = {};
		/** 响应体 */
		let body = { code: RES_CODE.SUCCESS };
		/** HTTP 状态（1.x 业务响应恒 200；429 限流 / 204 预检例外） */
		let status = 200;
		/** 步骤 3 产出，步骤 9 回填判断用 */
		let accessToken = "";
		let corsAttempted = false;
		try {
			protect(request, logger);
			validateClientFields(request.body);
			accessToken = anonymousSignIn(request);
			corsAttempted = true;
			await adapters.database.init();
			const { config, failed: configReadFailed } = await readConfig(adapters, logger);
			if (!configReadFailed) Object.assign(headers, allowCors(request, config));
			if (request.method === "OPTIONS") return {
				status: 204,
				body: {},
				headers
			};
			const ctx = {
				request,
				requestId: logger.requestId,
				accessToken,
				config,
				configReadFailed,
				adapters,
				logger
			};
			logger.verbose("请求函数：", request.body.event, "请求参数：", request.body);
			body = await dispatch(ctx);
		} catch (e) {
			logger.error("Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/twikoojs/twikoo/issues");
			logger.error("请求参数：", request.body);
			logger.error("错误信息：", e);
			body = {
				code: RES_CODE.FAIL,
				message: getErrorMessage(e)
			};
			if (e instanceof RateLimitError) status = 429;
			if (!corsAttempted) Object.assign(headers, await allowCorsForError(request, adapters.database));
		}
		if (!body.code && !request.body.accessToken) body.accessToken = accessToken;
		logger.verbose("请求返回：", body);
		return {
			status,
			body,
			headers
		};
	};
}
/** 空操作异步函数（占位槽位通用实现） */
const noop = async () => {};
/** 无 challenge 读取（Promise 包装满足端口形态） */
const noChallenge = () => Promise.resolve(null);
/** 无 token 过期读取（Promise 包装满足端口形态） */
const noExpiry = () => Promise.resolve(null);
/**
* 默认派发实现：进程内直调 postSubmit 服务，**不等待**完成
* （等价 1.x self-hosted `postSubmit(comment)` 与 eo-makers
* `postSubmit(...).catch(...)` 的行为）。
*
* 仅适用于常驻进程平台；单次执行平台须注入自己的递归自调用实现。
*/
const inProcessDispatcher = { 
/**
* 进程内派发：立即返回，副作用在后台继续。
* @param comment 已入库的评论
* @param ctx 当前请求上下文
*/
dispatch(comment, ctx) {
	getPostSubmitService()(comment, ctx).catch((e) => {
		ctx.logger.error("POST_SUBMIT 失败", e instanceof Error ? e.message : String(e));
	});
	return Promise.resolve();
} };
/**
* 组装 TkAdapters（request/response/database/capabilities 必填，
* storage/mailer/notifier 空实现占位，postSubmit 可用 postSubmit 覆写）。
* @param options 必填四项 + 可选的平台派发实现
* @returns 适配器聚合
*/
function scaffoldAdapters(options) {
	/** 占位 Cap 存储（读取恒 null，其余空操作） */
	const storage = {
		challenges: {
			store: noop,
			read: noChallenge,
			delete: noop,
			deleteExpired: noop
		},
		tokens: {
			store: noop,
			get: noExpiry,
			delete: noop,
			deleteExpired: noop
		}
	};
	/** 占位邮件发送 */
	const mailer = { send: noop };
	/** 占位通知发送 */
	const notifier = { notify: noop };
	return {
		request: options.request,
		response: options.response,
		database: options.database,
		storage,
		mailer,
		notifier,
		postSubmit: options.postSubmit ?? inProcessDispatcher,
		capabilities: options.capabilities
	};
}
/**
* MongoDatabase（规范；1.x `src/server/vercel/api/index.js` 语义对齐）。
*
* 语义要点（与 1.x 行为一致）：
* - 评论 `_id` 为 **32 位 uuid 字符串**（1.x parse() 生成，非 ObjectId），
*   全部按字符串等值查询；
* - 「顶级评论」查询 `{ rid: ABSENT }` 翻译为 `{ rid: { $in: ["", null] } }`——
*   Mongo 中 `$in` 含 `null` 时同时命中「字段缺失」「null」「空串」三种形态，
*   与 1.x `rid: { $in: ['', null] }` 逐字对齐（1.x 未用 `$exists: false`，
*   因其无法命中显式空串，见基线 L329/L998）；
* - 计数器自增：`$inc time + $set title/updated`，命中 0 条则插入首条
*   （1.x incCounter 的 update → insert 兜底）；
* - 配置：单文档形态，`updateOne({}, $set, upsert)`（1.x writeConfig 的
*   update → insert 兜底的原子化等价）；
* - 验证码 KV：`cap_kv` 集合（cap 三方法为通用形态；1.x cap_challenges/
*   cap_tokens 为 10 分钟级短命数据，由存储适配器在其上组装过期过滤）。
*
* 依赖外部化：mongodb 驱动**运行时动态加载**（init() 内 `await import`），
* 驱动由声明 `mongodb` 依赖的适配器安装（peerDependenciesMeta optional）。
* 类型面经 `typeof import("mongodb")`（编译期擦除，不产生静态依赖）。
*/
/**
* 构造字符串主键过滤器。
* 驱动类型把 `_id` 条件限定为 ObjectId 族，而 twikoo 的评论主键是 1.x 约定的
* 32 位 uuid 字符串，驱动按字符串等值写入与查询完全一致——此处对类型面做
* 一次集中收窄，业务代码保持纯净。
* @param id 字符串主键
* @returns Mongo 过滤器
*/
function idFilter(id) {
	return { _id: id };
}
/**
* 语义查询对象 → Mongo 过滤器（翻译职责）。
* @param query 语义查询对象
* @returns Mongo 过滤器
*/
function toMongoFilter(query) {
	/** 输出过滤器 */
	const filter = {};
	for (const [key, value] of Object.entries(query)) if (value === ABSENT) filter[key] = { $in: ["", null] };
	else if (Array.isArray(value)) filter[key] = { $in: value };
	else if (typeof value === "object" && value !== null && NOT in value) filter[key] = { $ne: value[NOT] };
	else if (typeof value === "object" && value !== null && GT in value) filter[key] = { $gt: value[GT] };
	else if (typeof value === "object" && value !== null && LT in value) filter[key] = { $lt: value[LT] };
	else filter[key] = value;
	return filter;
}
/**
* 生成评论主键（1.x parse() 的 `_id: uuidv4().replace(/-/g, '')` 对齐）。
* @returns 32 位小写十六进制字符串
*/
function newCommentId() {
	return randomUUID().replace(/-/g, "");
}
/**
* MongoDB 数据库实现（vercel / cloudbase-mongo 形态适配器使用）。
* init() 幂等：连接缓存后复用（1.x connectToDatabase 的 if (db) return 语义）。
*/
var MongoDatabase = class {
	/** 连接串 */
	uri;
	/** 数据库名（空则从 uri 推导） */
	dbName;
	/** 缓存的驱动客户端（init 后非空） */
	client = null;
	/** 缓存的数据库句柄（init 后非空） */
	db = null;
	/**
	* @param options 连接选项（uri 必传；运行环境未配置时 init 抛可读错误）
	*/
	constructor(options) {
		this.uri = options.uri;
		this.dbName = options.dbName;
	}
	/**
	* 取集合句柄（init 后调用）。
	* @param name 集合名
	* @returns 集合句柄
	*/
	col(name) {
		if (!this.db) throw new Error("数据库尚未初始化（init() 未调用或失败）");
		return this.db.collection(name);
	}
	/** 生命周期：建连（幂等，连接缓存；uri 缺失抛可读错误，1.x 文案对齐） */
	async init() {
		if (this.db) return;
		if (!this.uri) throw new Error("未设置环境变量 MONGODB_URI");
		const mongo = await import("./lib-CTOgaeIX.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1));
		this.client = new mongo.MongoClient(this.uri);
		await this.client.connect();
		const derived = new URL(this.uri).pathname.replace(/^\//, "").split("?")[0];
		this.db = this.client.db(this.dbName || derived);
	}
	/** 生命周期：关闭连接（self-hosted shutdown / 测试收尾用） */
	async close() {
		await this.client?.close();
		this.client = null;
		this.db = null;
	}
	/** 评论：获取全部评论（导出用，按自然序） */
	async getAllComments() {
		return await this.col("comment").find({}).toArray();
	}
	/** 评论：语义查询 + 排序/分页（1.x find().sort().skip().limit().toArray() 对齐） */
	async getComments(query, options) {
		const cursor = this.col("comment").find(toMongoFilter(query));
		if (options?.sort) cursor.sort(options.sort);
		if (options?.skip !== void 0) cursor.skip(options.skip);
		if (options?.limit !== void 0) cursor.limit(options.limit);
		return await cursor.toArray();
	}
	/** 评论：按语义查询计数（1.x countDocuments 对齐） */
	async countComments(query) {
		return this.col("comment").countDocuments(toMongoFilter(query));
	}
	/** 评论：按 id 取单条（字符串等值；不存在返回 null） */
	async getComment(id) {
		return await this.col("comment").findOne(idFilter(id)) ?? null;
	}
	/** 评论：新增（_id 缺失时生成 32 位 uuid 串；驱动插入的文档不回写，返回补齐 _id 的副本） */
	async addComment(data) {
		const doc = {
			...data,
			_id: data._id ?? newCommentId()
		};
		await this.col("comment").insertOne(doc);
		return doc;
	}
	/** 评论：按 id 部分更新（$set 语义：未提及字段保持不变，1.x 对齐） */
	async updateComment(id, data) {
		await this.col("comment").updateOne(idFilter(id), { $set: data });
	}
	/** 评论：按 id 删除（1.x deleteOne 对齐；未命中不报错） */
	async deleteComment(id) {
		await this.col("comment").deleteOne(idFilter(id));
	}
	/** 评论：批量导入（缺失 _id 的条目补 32 位 uuid 串，避免驱动生成 ObjectId 破坏字符串 id 语义） */
	async bulkAddComments(list) {
		if (!list.length) return;
		const docs = list.map((item) => ({
			...item,
			_id: item._id ?? newCommentId()
		}));
		await this.col("comment").insertMany(docs);
	}
	/** 计数：读取页面计数（无记录返回 null） */
	async getCounter(url) {
		return await this.col("counter").findOne({ url }) ?? null;
	}
	/** 计数：获取全部页面计数（导出用，按自然序） */
	async getAllCounters() {
		return await this.col("counter").find({}).toArray();
	}
	/** 计数：自增（update 命中 0 条则插入首条；1.x incCounter 兜底语义） */
	async incCounter(url, title) {
		const now = Date.now();
		/** $set 载荷：title 未传时不写入（与 1.x 写 null 的消费端表现等价） */
		const set = { updated: now };
		if (title !== void 0) set.title = title;
		if ((await this.col("counter").updateOne({ url }, {
			$inc: { time: 1 },
			$set: set
		})).modifiedCount === 0) await this.col("counter").insertOne({
			url,
			title,
			time: 1,
			created: now,
			updated: now
		});
		const doc = await this.getCounter(url);
		if (!doc) throw new Error(`计数器自增失败：${url}`);
		return doc;
	}
	/** 配置：读取单文档（_id 为 Mongo 主键，无业务用途，剥除后返回；未初始化返回 null） */
	async getConfig() {
		const doc = await this.col("config").findOne({});
		if (!doc) return null;
		delete doc._id;
		return doc;
	}
	/** 配置：保存（$set 合并语义，与 1.x writeConfig 对齐——setPassword 只写单键依赖合并；未初始化时 upsert 建档） */
	async saveConfig(config) {
		await this.col("config").updateOne({}, { $set: config }, { upsert: true });
	}
	/** 验证码：按 key 读取（不存在返回 null） */
	async capGet(key) {
		const doc = await this.col("cap_kv").findOne({ key });
		return doc ? doc.value : null;
	}
	/** 验证码：按 key 写入（存在则覆盖） */
	async capSet(key, value) {
		await this.col("cap_kv").updateOne({ key }, { $set: {
			key,
			value
		} }, { upsert: true });
	}
	/** 验证码：按 key 删除 */
	async capDel(key) {
		await this.col("cap_kv").deleteOne({ key });
	}
	/**
	* 验证码：删除已过期记录（cap_kv 的值形如 `{ expires }`）。
	*
	* 下推为 `deleteMany({ "value.expires": { $lt: now } })`——该集合正是
	* 「过期不清理会无限增长」的那个，绝不能全量拉回再逐条删。
	* @param now 当前时间戳（毫秒）
	* @returns 删除条数
	*/
	async capDeleteExpired(now) {
		return (await this.col("cap_kv").deleteMany({ "value.expires": { $lt: now } })).deletedCount ?? 0;
	}
};
/**
* 创建统一请求处理器（唯一入口：createHandler(adapters) → handleRequest）。
*
* 启动期调用一次完成装配（注入适配器聚合端口），返回的处理器逐请求调用，
* 内部执行 pipeline 八步编排（限流 → 校验 → 匿名签到 → 连库 → 读配置 →
* CORS → OPTIONS/分发 → 回填）。
* @param adapters 适配器聚合端口
* @returns 统一请求处理器
*/
function createHandler(adapters) {
	/** 返回的逐请求处理器（pipeline 实现） */
	return createPipeline(adapters);
}
//#endregion
//#region src/database/schema.ts
/**
* 建表语句（逐条幂等 `IF NOT EXISTS`）。
*
* 顺序：表 → 索引。`comment` 的索引按「页面查询（url, created）」「最新评论/分页
* （created）」「限流（ip, created）」「回复归组（rid）」四条访问路径建立。
*/
const SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS "comment" (
  "_id" TEXT PRIMARY KEY,
  "uid" TEXT NOT NULL DEFAULT '',
  "nick" TEXT NOT NULL DEFAULT '',
  "mail" TEXT NOT NULL DEFAULT '',
  "mailMd5" TEXT NOT NULL DEFAULT '',
  "link" TEXT NOT NULL DEFAULT '',
  "avatar" TEXT NOT NULL DEFAULT '',
  "ua" TEXT NOT NULL DEFAULT '',
  "ip" TEXT NOT NULL DEFAULT '',
  "ipRegion" TEXT NOT NULL DEFAULT '',
  "master" INTEGER NOT NULL DEFAULT 0,
  "url" TEXT NOT NULL DEFAULT '',
  "href" TEXT NOT NULL DEFAULT '',
  "comment" TEXT NOT NULL DEFAULT '',
  "pid" TEXT NOT NULL DEFAULT '',
  "rid" TEXT NOT NULL DEFAULT '',
  "like" TEXT NOT NULL DEFAULT '[]',
  "top" INTEGER NOT NULL DEFAULT 0,
  "isSpam" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "extra" TEXT NOT NULL DEFAULT '{}'
)`,
	`CREATE INDEX IF NOT EXISTS "idx_comment_url_created" ON "comment" ("url", "created" DESC)`,
	`CREATE INDEX IF NOT EXISTS "idx_comment_created" ON "comment" ("created" DESC)`,
	`CREATE INDEX IF NOT EXISTS "idx_comment_ip_created" ON "comment" ("ip", "created" DESC)`,
	`CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "comment" ("rid")`,
	`CREATE TABLE IF NOT EXISTS "counter" (
  "url" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT '',
  "time" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0
)`,
	`CREATE TABLE IF NOT EXISTS "config" (
  "value" TEXT NOT NULL DEFAULT ''
)`,
	`CREATE TABLE IF NOT EXISTS "cap_kv" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "expires" INTEGER
)`,
	`CREATE INDEX IF NOT EXISTS "idx_cap_kv_expires" ON "cap_kv" ("expires")`
];
/**
* 增量升级语句（针对已存在的 1.x 库）。
*
* 逐条执行、**失败即忽略**：`ALTER TABLE ... ADD COLUMN` 在列已存在时报错，
* 而"列已存在"正是新装库与二次运行的常态。这里不做 `PRAGMA table_info` 预探测，
* 是因为 D1 对 PRAGMA 的支持面随版本变化（探测失败会让整个 init 挂掉，
* 而忽略 ALTER 失败绝不会）。
*
* **两列都要补**。缺口不会表现为「少个字段」：列缺失只在**显式引用该列**的语句上炸，
* 而本包的读路径是 `SELECT *`，所以读取、计数、取单条一律正常，只有**写入**会失败
* （`INSERT` 的列清单由 `COMMENT_COLUMNS` 生成）——这种「读得好好的、一发评论就挂」
* 的表现很容易被误判成别的问题。
*
* - `ipRegion`：1.x 的 `schema.sql` 里只对**新装**库建了这一列，早期建的库需要用户
*   手工执行 `ALTER TABLE comment ADD COLUMN ipRegion ...`（1.x schema.sql 的注释原文）。
*   没跑过那条语句的库就是「20 列、无 ipRegion」形态，写入时报
*   `SQLITE_ERROR: table comment has no column named ipRegion`。
* - `extra`：2.0 新增（承载扩展字段）。
*/
const MIGRATION_STATEMENTS = [`ALTER TABLE "comment" ADD COLUMN "ipRegion" TEXT NOT NULL DEFAULT ''`, `ALTER TABLE "comment" ADD COLUMN "extra" TEXT NOT NULL DEFAULT '{}'`];
/** 已完成建表的绑定（同一 isolate 内只需建一次；WeakMap 不阻止绑定被回收） */
let readyBindings = /* @__PURE__ */ new WeakMap();
/**
* 执行建表 + 升级（幂等，同一绑定对象只跑一次；失败不缓存，下次请求重试）。
* @param db D1 绑定
*/
function ensureSchema(db) {
	const cached = readyBindings.get(db);
	if (cached) return cached;
	const running = (async () => {
		for (const statement of SCHEMA_STATEMENTS) await db.prepare(statement).run();
		for (const statement of MIGRATION_STATEMENTS) try {
			await db.prepare(statement).run();
		} catch {}
	})().catch((e) => {
		readyBindings.delete(db);
		throw e;
	});
	readyBindings.set(db, running);
	return running;
}
//#endregion
//#region src/geo/region-store.ts
/** 属地缓存容量上限（isolate 长驻，必须封顶：每次请求都可能写入若干条） */
const MAX_GEO_ENTRIES = 512;
/** IP → ip2region 管道串（`国家|0|省|市|`，与 ip2region 形态一致）的进程内缓存 */
const regionByIp = /* @__PURE__ */ new Map();
/**
* 归一化 IP（与 `@twikoojs/common` 的 `getIpRegion` 同一套清洗规则：
* 去 IPv4-mapped IPv6 前缀、去端口号）。
*
* 两侧必须用同一归一化函数，否则「写入用 `1.2.3.4:8080`、查询用 `1.2.3.4`」这种
* 错位会让属地静默为空。
* @param ip 原始 IP
* @returns 归一化后的 IP
*/
function normalizeGeoIp(ip) {
	return ip.replace(/^::ffff:/, "").replace(/:[0-9]*$/, "");
}
/**
* `request.cf` → ip2region 管道串（1.x twikoo-cloudflare 逐字对齐：
* `国家|0|省|市|`；运营商 Cloudflare 不提供，故留空）。
* @param cf Cloudflare 请求地理信息（可能为 undefined）
* @returns 管道串；无任何字段时返回空串
*/
function cfRegionToIp2Region(cf) {
	const country = cf?.country ?? "";
	const region = cf?.region ?? "";
	const city = cf?.city ?? "";
	if (!country && !region && !city) return "";
	return `${country}|0|${region}|${city}|`;
}
/**
* 写入一条 IP → 属地映射（超出容量时按插入顺序淘汰最旧的一条）。
* @param ip IP（空值忽略）
* @param region ip2region 管道串（空值忽略）
*/
function rememberRegion(ip, region) {
	if (!ip || !region) return;
	const key = normalizeGeoIp(ip);
	if (!key) return;
	regionByIp.delete(key);
	regionByIp.set(key, region);
	while (regionByIp.size > MAX_GEO_ENTRIES) {
		const oldest = regionByIp.keys().next();
		if (oldest.done) break;
		regionByIp.delete(oldest.value);
	}
}
/**
* 记住本次请求的地理信息（请求入口调用一次）。
* @param ip 客户端 IP
* @param cf Cloudflare 请求地理信息
*/
function rememberRequestGeo(ip, cf) {
	rememberRegion(ip, cfRegionToIp2Region(cf));
}
/**
* 查询 IP 的属地管道串。
* @param ip IP
* @returns 管道串；未命中返回 undefined
*/
function lookupRegion(ip) {
	if (!ip) return void 0;
	return regionByIp.get(normalizeGeoIp(ip));
}
/**
* 构造可注入 `setCustomLibs` 的 ip2region 覆写（fs-free：数据来自本模块缓存）。
* @returns 满足 `Ip2RegionLike` 的查询器工厂
*/
function createCloudflareIp2Region() {
	return { 
	/**
	* 创建查询器（同步接口，故只能读进程内缓存——这也是必须把属地随评论落库的原因）
	* @returns 查询器实例
	*/
create() {
		return { 
		/**
		* 按 IP 查属地
		* @param ip IP
		* @returns `{ city: 0, region }`；未命中返回 null
		*/
binarySearchSync(ip) {
			const region = lookupRegion(ip);
			return region ? {
				city: 0,
				region
			} : null;
		} };
	} };
}
//#endregion
//#region src/database/d1.ts
/**
* D1Database（Cloudflare D1 的 {@link Database} 端口实现）。
*
* **为什么用 D1 而不是 KV/BlobKV**：评论区是「读多写多且要求强一致」的场景
* （发完评论必须立刻可见、限流计数必须准），D1 是 SQLite 强一致存储；
* 且 1.x twikoo-cloudflare 就用 D1，表形态对齐后站长可直接沿用既有数据（见 `schema.ts`）。
*
* **语义查询 → SQL 翻译**（`{ rid: ABSENT }` 这类语义对象见 `@twikoojs/common`
* 的 `ports/database.ts`）：
*
* | 语义条件 | SQL |
* | --- | --- |
* | `ABSENT` | `("col" IS NULL OR "col" = '')` |
* | 数组值 / `{ $in: [...] }` | `"col" IN (?, ?, …)`（空数组 → `0 = 1`，SQLite 的 `IN ()` 是语法错误） |
* | `{ [NOT]: v }` | `("col" IS NULL OR "col" <> ?)`（缺列视为「不等于」，与 Mongo `$ne` 一致） |
* | `{ [GT]: v }` / `{ [LT]: v }` | `"col" > ?` / `"col" < ?` |
* | 标量 / `null` | `"col" = ?` / `"col" IS NULL` |
*
* **扩展字段**：`CommentDoc` 有索引签名兜底（导入器可能带 `ups` / `downs` / 未来字段），
* 这些列不进表结构，改为整体存进 `comment.extra` 的 JSON；读取时先展开 `extra` 再以
* 已知列为准覆盖，于是「读出什么就写回什么」。查询条件用未知字段时退化为
* `json_extract("extra", '$.字段')`（依赖 D1 的 JSON1 函数）。
*
* **不做的两件事**（刻意保持薄）：
* - 不实现 `batch`：批量导入按 1.x 的逐条 `save()` 语义串行执行，单条失败即可见；
* - 不做事务包裹：D1 的 `batch` 才是原子单元，而本端口的 19 个方法都是单语句操作。
*/
/**
* 已知列清单（1.x twikoo-cloudflare 的 21 列 + 2.0 新增的 `extra`）。
*
* `bool` 列在 SQLite 里是 INTEGER 0/1（1.x 同款）；`json` 列存 JSON 文本；
* `extra` 由 {@link collectExtra} 单独处理，不在此表（它不是「一个字段」）。
*/
const COMMENT_COLUMNS = {
	_id: "text",
	uid: "text",
	nick: "text",
	mail: "text",
	mailMd5: "text",
	link: "text",
	avatar: "text",
	ua: "text",
	ip: "text",
	ipRegion: "text",
	master: "bool",
	url: "text",
	href: "text",
	comment: "text",
	pid: "text",
	rid: "text",
	like: "json",
	top: "bool",
	isSpam: "bool",
	created: "number",
	updated: "number"
};
/** 已知列名（稳定顺序：INSERT 的列序与参数序都取它） */
const COMMENT_COLUMN_NAMES = Object.keys(COMMENT_COLUMNS);
/** `extra` 列名 */
const EXTRA_COLUMN = "extra";
/**
* 生成评论主键（1.x `uuid().replace(/-/g, '')` 对齐，32 位十六进制串）。
* 用 Web 标准的 `crypto.randomUUID`：Workers 与 Node 18+ 均原生提供，零依赖。
* @returns 评论 id
*/
function newD1CommentId() {
	return crypto.randomUUID().replace(/-/g, "");
}
/**
* 标量安全字符串化（对象走 JSON，避免把 `[object Object]` 写进库或读出来）。
* @param value 值
* @returns 字符串（null/undefined 为空串）
*/
function toText(value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (value === void 0 || value === null) return "";
	return JSON.stringify(value) ?? "";
}
/**
* 列编码：文档字段值 → SQL 绑定值。
* @param kind 列的存储形态
* @param value 文档字段值
* @returns 绑定值
*/
function encodeColumn(kind, value) {
	if (kind === "bool") return value === true || value === 1 ? 1 : 0;
	if (kind === "json") return JSON.stringify(value ?? []);
	if (kind === "number") return typeof value === "number" && Number.isFinite(value) ? value : 0;
	return toText(value);
}
/**
* 列解码：SQL 值 → 文档字段值。
* @param kind 列的存储形态
* @param value 列值
* @returns 文档字段值（该列无值时返回 undefined）
*/
function decodeColumn(kind, value) {
	if (kind === "bool") {
		if (value === null || value === void 0) return void 0;
		return value === 1 || value === true;
	}
	if (kind === "json") {
		if (typeof value !== "string" || !value) return [];
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	if (kind === "number") {
		if (value === null || value === void 0) return void 0;
		return typeof value === "number" ? value : Number(value);
	}
	if (value === null || value === void 0) return void 0;
	return toText(value);
}
/**
* 查询条件里的标量编码（布尔 → 0/1，与列编码保持一致）。
* @param value 条件值
* @returns 绑定值
*/
function encodeConditionScalar(value) {
	if (value === true) return 1;
	if (value === false) return 0;
	return value;
}
/**
* 解析 `extra` 列。
* @param raw 列值
* @returns 扩展字段表（脏数据时返回空表）
*/
function parseExtra(raw) {
	if (typeof raw !== "string" || !raw) return {};
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		return parsed;
	} catch {
		return {};
	}
}
/**
* 文档 → 「已知列」绑定值（列序与 {@link COMMENT_COLUMN_NAMES} 一致）。
* @param doc 评论文档
* @returns 绑定值数组
*/
function knownValues(doc) {
	return COMMENT_COLUMN_NAMES.map((name) => encodeColumn(COMMENT_COLUMNS[name], doc[name]));
}
/**
* 文档 → 扩展字段表（所有非已知列的字段）。
* @param doc 评论文档
* @returns 扩展字段表
*/
function collectExtra(doc) {
	const extra = {};
	for (const [key, value] of Object.entries(doc)) {
		if (Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, key)) continue;
		if (key === EXTRA_COLUMN) continue;
		extra[key] = value;
	}
	return extra;
}
/**
* 数据行 → 评论文档（先展开 `extra`，再由已知列覆盖——已知列是权威形态）。
* @param row 数据行
* @returns 评论文档
*/
function rowToDoc(row) {
	const doc = parseExtra(row[EXTRA_COLUMN]);
	for (const name of COMMENT_COLUMN_NAMES) {
		const value = decodeColumn(COMMENT_COLUMNS[name], row[name]);
		if (value !== void 0) doc[name] = value;
	}
	return doc;
}
/**
* 字段名 → SQL 表达式。
* @param field 字段名
* @param params 参数数组（未知字段会追加 json_extract 的路径参数）
* @returns SQL 表达式
*/
function fieldExpression(field, params) {
	if (Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, field)) return `"${field}"`;
	params.push(`$.${field}`);
	return `json_extract("${EXTRA_COLUMN}", ?)`;
}
/**
* 追加一个字段条件。
* @param field 字段名
* @param condition 条件值
* @param parts 条件片段数组
* @param params 绑定参数数组
*/
function appendCondition(field, condition, parts, params) {
	const expr = fieldExpression(field, params);
	if (condition === ABSENT) {
		parts.push(`(${expr} IS NULL OR ${expr} = ?)`);
		params.push("");
		return;
	}
	if (Array.isArray(condition)) {
		appendIn(expr, condition, parts, params);
		return;
	}
	if (condition !== null && typeof condition === "object") {
		const object = condition;
		if (NOT in object) {
			parts.push(`(${expr} IS NULL OR ${expr} <> ?)`);
			params.push(encodeConditionScalar(object[NOT]));
			return;
		}
		if (GT in object) {
			parts.push(`${expr} > ?`);
			params.push(object[GT]);
			return;
		}
		if (LT in object) {
			parts.push(`${expr} < ?`);
			params.push(object[LT]);
			return;
		}
		if ("$in" in object && Array.isArray(object.$in)) {
			appendIn(expr, object.$in, parts, params);
			return;
		}
		throw new Error(`D1 查询条件不支持该形态：${field}`);
	}
	if (condition === null) {
		parts.push(`${expr} IS NULL`);
		return;
	}
	parts.push(`${expr} = ?`);
	params.push(encodeConditionScalar(condition));
}
/**
* 追加 `IN` 条件（空集合退化为恒假：SQLite 的 `IN ()` 是语法错误）。
* @param expr 字段 SQL 表达式
* @param values 集合
* @param parts 条件片段数组
* @param params 绑定参数数组
*/
function appendIn(expr, values, parts, params) {
	if (!values.length) {
		parts.push("1 = 0");
		return;
	}
	parts.push(`${expr} IN (${values.map(() => "?").join(", ")})`);
	params.push(...values.map((value) => encodeConditionScalar(value)));
}
/**
* 语义查询 → WHERE 子句。
* @param query 语义查询对象
* @returns WHERE 子句
*/
function buildWhere(query) {
	const parts = [];
	const params = [];
	for (const [field, condition] of Object.entries(query)) appendCondition(field, condition, parts, params);
	return {
		sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
		params
	};
}
/**
* 查询选项 → `ORDER BY` + `LIMIT/OFFSET` 片段。
*
* 排序字段只认已知列（扩展字段没有索引，且可能整列不存在）；`OFFSET` 在 SQLite 里
* 必须挂在 `LIMIT` 上，故「只给 skip」时用 `LIMIT -1 OFFSET n` 表达「不限条数」。
* @param options 查询选项
* @returns 片段与绑定参数
*/
function buildOrderAndPage(options) {
	const params = [];
	let sql = "";
	if (!options) return {
		sql,
		params
	};
	if (options.sort) {
		const orders = [];
		for (const [field, direction] of Object.entries(options.sort)) {
			if (!Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, field)) continue;
			orders.push(`"${field}" ${direction === -1 ? "DESC" : "ASC"}`);
		}
		if (orders.length) sql += ` ORDER BY ${orders.join(", ")}`;
	}
	if (options.limit !== void 0) {
		sql += " LIMIT ?";
		params.push(options.limit);
		if (options.skip !== void 0) {
			sql += " OFFSET ?";
			params.push(options.skip);
		}
	} else if (options.skip !== void 0) {
		sql += " LIMIT -1 OFFSET ?";
		params.push(options.skip);
	}
	return {
		sql,
		params
	};
}
/**
* 数据行 → 计数字档。
* @param row 数据行
* @returns 计数字档
*/
function rowToCounter(row) {
	const title = row.title;
	const doc = {
		url: toText(row.url),
		time: Number(row.time ?? 0)
	};
	if (typeof title === "string" && title) doc.title = title;
	const created = decodeColumn("number", row.created);
	if (created !== void 0) doc.created = created;
	const updated = decodeColumn("number", row.updated);
	if (updated !== void 0) doc.updated = updated;
	return doc;
}
/**
* D1 数据库实现（Cloudflare Workers 适配器使用）。
*/
var D1Database = class {
	/** D1 绑定（`env.DB`） */
	db;
	/**
	* @param db D1 绑定
	*/
	constructor(db) {
		this.db = db;
	}
	/**
	* 生命周期：初始化（建表 + 1.x 增量升级；过程幂等，同一绑定只跑一次）。
	*/
	async init() {
		await ensureSchema(this.db);
	}
	/**
	* 数据行 → 文档，并把库里的属地回填进属地缓存（供 `binarySearchSync` 同步命中）。
	*
	* 这一步是 Cloudflare 的属地方案能成立的关键：DTO 层是按评论的 `ip` 反查属地的，
	* 而 Workers 无法按任意 IP 查询，故靠「读评论时顺手登记」把库里的属地塞进
	* 进程内缓存（`ip2region: true` 由 `setCustomLibs` 覆写满足，见 `geo/region-store.ts`）。
	* @param rows 数据行
	* @returns 评论文档列表
	*/
	toDocs(rows) {
		const docs = rows.map((row) => rowToDoc(row));
		for (const doc of docs) rememberRegion(doc.ip, doc.ipRegion);
		return docs;
	}
	/**
	* 预编译 + 绑定。
	* @param sql SQL 文本
	* @param params 绑定参数
	* @returns 语句
	*/
	stmt(sql, params = []) {
		const prepared = this.db.prepare(sql);
		return params.length ? prepared.bind(...params) : prepared;
	}
	/** 评论：获取全部评论（导出用，自然序） */
	async getAllComments() {
		const { results } = await this.stmt(`SELECT * FROM "comment"`).all();
		return this.toDocs(results ?? []);
	}
	/** 评论：语义查询 + 排序/分页 */
	async getComments(query, options) {
		const where = buildWhere(query);
		const page = buildOrderAndPage(options);
		const { results } = await this.stmt(`SELECT * FROM "comment"${where.sql}${page.sql}`, [...where.params, ...page.params]).all();
		return this.toDocs(results ?? []);
	}
	/** 评论：按语义查询计数 */
	async countComments(query) {
		const where = buildWhere(query);
		return await this.stmt(`SELECT COUNT(*) AS "count" FROM "comment"${where.sql}`, where.params).first("count") ?? 0;
	}
	/** 评论：按 id 取单条（不存在返回 null） */
	async getComment(id) {
		const row = await this.stmt(`SELECT * FROM "comment" WHERE "_id" = ?`, [id]).first();
		if (!row) return null;
		return this.toDocs([row])[0] ?? null;
	}
	/** 评论：新增（回填 _id 与属地；扩展字段进 extra） */
	async addComment(data) {
		const doc = {
			...data,
			_id: data._id ?? newD1CommentId()
		};
		if (!doc.ipRegion) {
			const region = lookupRegion(doc.ip);
			if (region) doc.ipRegion = region;
		}
		const columns = [...COMMENT_COLUMN_NAMES, EXTRA_COLUMN];
		await this.stmt(`INSERT INTO "comment" (${columns.map((name) => `"${name}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, [...knownValues(doc), JSON.stringify(collectExtra(doc))]).run();
		return doc;
	}
	/** 评论：按 id 部分更新（未提及字段保持不变；扩展字段合并进 extra） */
	async updateComment(id, data) {
		const assignments = [];
		const params = [];
		const extraPatch = {};
		for (const [field, value] of Object.entries(data)) if (Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, field)) {
			assignments.push(`"${field}" = ?`);
			params.push(encodeColumn(COMMENT_COLUMNS[field], value));
		} else if (field !== EXTRA_COLUMN) extraPatch[field] = value;
		if (Object.keys(extraPatch).length) {
			const row = await this.stmt(`SELECT "${EXTRA_COLUMN}" FROM "comment" WHERE "_id" = ?`, [id]).first();
			assignments.push(`"${EXTRA_COLUMN}" = ?`);
			params.push(JSON.stringify({
				...parseExtra(row?.[EXTRA_COLUMN]),
				...extraPatch
			}));
		}
		if (!assignments.length) return;
		await this.stmt(`UPDATE "comment" SET ${assignments.join(", ")} WHERE "_id" = ?`, [...params, id]).run();
	}
	/** 评论：按 id 删除 */
	async deleteComment(id) {
		await this.stmt(`DELETE FROM "comment" WHERE "_id" = ?`, [id]).run();
	}
	/** 评论：批量导入（1.x 逐条 save 语义：串行写入，便于定位坏数据） */
	async bulkAddComments(list) {
		for (const item of list) await this.addComment(item);
	}
	/** 计数：读取页面计数（无记录返回 null） */
	async getCounter(url) {
		const row = await this.stmt(`SELECT * FROM "counter" WHERE "url" = ?`, [url]).first();
		return row ? rowToCounter(row) : null;
	}
	/** 计数：获取全部页面计数（导出用） */
	async getAllCounters() {
		const { results } = await this.stmt(`SELECT * FROM "counter"`).all();
		return (results ?? []).map((row) => rowToCounter(row));
	}
	/**
	* 计数：自增（无记录则创建；1.x 的 upsert + 回查两语句形态）。
	*
	* `title` 缺省时**保留库中已有标题**（1.x 会写成空串，导致「无标题的深链访问」把
	* 页面标题抹掉；这里按「未提供 = 不改」处理）。
	*/
	async incCounter(url, title) {
		const now = Date.now();
		const providedTitle = title === void 0 ? null : title;
		await this.stmt("INSERT INTO \"counter\" (\"url\", \"title\", \"time\", \"created\", \"updated\") VALUES (?, COALESCE(?, ''), 1, ?, ?) ON CONFLICT(\"url\") DO UPDATE SET \"time\" = \"counter\".\"time\" + 1, \"title\" = CASE WHEN ? IS NULL THEN \"counter\".\"title\" ELSE ? END, \"updated\" = ?", [
			url,
			providedTitle,
			now,
			now,
			providedTitle,
			providedTitle,
			now
		]).run();
		return await this.getCounter(url) ?? {
			url,
			time: 1,
			...providedTitle !== null ? { title: providedTitle } : {},
			created: now,
			updated: now
		};
	}
	/** 配置：读取（无行 / 空串 / 脏 JSON 均返回 null，由 pipeline 降级为空配置） */
	async getConfig() {
		const value = await this.stmt(`SELECT "value" FROM "config" LIMIT 1`).first("value");
		if (typeof value !== "string" || !value) return null;
		try {
			const parsed = JSON.parse(value);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
			return parsed;
		} catch {
			return null;
		}
	}
	/** 配置：保存（合并语义：1.x / BlobKV 的 `{ ...current, ...config }` 对齐） */
	async saveConfig(config) {
		const merged = {
			...await this.getConfig() ?? {},
			...config
		};
		const json = JSON.stringify(merged);
		await this.stmt(`INSERT INTO "config" ("value") SELECT ? WHERE NOT EXISTS (SELECT 1 FROM "config")`, [json]).run();
		await this.stmt(`UPDATE "config" SET "value" = ?`, [json]).run();
	}
	/** 验证码：按 key 读取（无值返回 null） */
	async capGet(key) {
		const value = await this.stmt(`SELECT "value" FROM "cap_kv" WHERE "key" = ?`, [key]).first("value");
		if (typeof value !== "string" || !value) return null;
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	}
	/** 验证码：按 key 写入（存在则覆盖；`expires` 单独成列以便按下标清理） */
	async capSet(key, value) {
		const expires = value !== null && typeof value === "object" && typeof value.expires === "number" ? value.expires : null;
		await this.stmt("INSERT INTO \"cap_kv\" (\"key\", \"value\", \"expires\") VALUES (?, ?, ?) ON CONFLICT(\"key\") DO UPDATE SET \"value\" = excluded.\"value\", \"expires\" = excluded.\"expires\"", [
			key,
			JSON.stringify(value ?? null),
			expires
		]).run();
	}
	/** 验证码：按 key 删除（不存在时为空操作） */
	async capDel(key) {
		await this.stmt(`DELETE FROM "cap_kv" WHERE "key" = ?`, [key]).run();
	}
	/** 验证码：删除已过期记录（下推为带索引的批量 DELETE） */
	async capDeleteExpired(now) {
		return (await this.stmt(`DELETE FROM "cap_kv" WHERE "expires" IS NOT NULL AND "expires" < ?`, [now]).run()).meta?.changes ?? 0;
	}
};
//#endregion
//#region src/database/mongo.ts
/** MongoDB 复用公共实现，仅补充 Workers 的属地持久化与读取回填。 */
var CloudflareMongoDatabase = class extends MongoDatabase {
	/** 仅在属地未提供时回填缓存，保留调用方显式提供的空字符串或 null。 */
	addComment(data) {
		const region = data.ipRegion !== void 0 ? data.ipRegion : lookupRegion(data.ip);
		return super.addComment(region ? {
			...data,
			ipRegion: region
		} : data);
	}
	/** 读取列表后恢复属地缓存，冷启动后公开与管理员 DTO 仍能显示属地。 */
	async getComments(query, options) {
		const comments = await super.getComments(query, options);
		for (const comment of comments) rememberRegion(comment.ip, comment.ipRegion);
		return comments;
	}
};
//#endregion
//#region src/dispatch.ts
/**
* 通过 ctx.waitUntil 托管垃圾检测与通知，避免等待耗时操作或让其失败影响已保存的评论。
* 后台执行仍受 Workers 的 30 秒窗口与 CPU 上限约束；MongoDB 收尾必须等待实际任务。
*/
/**
* 创建 Cloudflare 形态的 POST_SUBMIT 派发器。
*
* 取不到 `executionCtx` 时（离线调用、单测、非 Workers 宿主）退化为
* `scaffoldAdapters` 的默认语义：进程内直调、不等待。此时副作用能否跑完取决于宿主，
* **不静默丢弃**——异常会记进请求日志。
* @returns 派发端口实现
*/
function createCloudflareDispatcher() {
	return { 
	/**
	* 派发后置副作用
	* @param comment 已入库的评论
	* @param ctx 当前请求上下文
	*/
dispatch(comment, ctx) {
		/** 副作用 promise（含兜底日志；失败不影响 COMMENT_SUBMIT 的返回） */
		let running;
		try {
			running = getPostSubmitService()(comment, ctx);
		} catch (e) {
			ctx.logger.error("POST_SUBMIT 派发失败", e instanceof Error ? e.message : String(e));
			return Promise.resolve();
		}
		const guarded = running.catch((e) => {
			ctx.logger.error("POST_SUBMIT 失败", e instanceof Error ? e.message : String(e));
			return { code: 0 };
		});
		const executionCtx = ctx.request.raw?.executionCtx;
		if (typeof executionCtx?.waitUntil === "function") executionCtx.waitUntil(guarded);
		return Promise.resolve();
	} };
}
//#endregion
//#region src/form-data.ts
/**
* 判断是否为二进制载荷（Buffer 是 Uint8Array 的子类，故用 ArrayBuffer.isView 统一识别）。
* @param value 待判断值
* @returns 是否二进制
*/
function isBinary(value) {
	return ArrayBuffer.isView(value) || value instanceof ArrayBuffer;
}
/**
* 构造可注入 `setCustomLibs` 的 FormData 构造器（每次调用返回新的类，避免用例间串味）。
* @returns FormData 构造器
*/
function createNativeFormData() {
	/**
	* 原生 FormData 的薄包装：补齐 `form-data` 包的调用面（Buffer 增补 + getHeaders）。
	*/
	class CloudflareFormData extends FormData {
		/**
		* 附加字段（Buffer 转 Blob，原生 FormData 只接受 Blob / 字符串）
		* @param name 字段名
		* @param value 字段值
		* @param options 附加选项（filename / contentType）
		*/
		append(name, value, options) {
			const { filename, contentType } = options ?? {};
			if (isBinary(value)) {
				const blob = new Blob([value], contentType ? { type: contentType } : {});
				super.append(name, blob, filename ?? "blob");
				return;
			}
			super.append(name, typeof value === "string" ? value : String(value));
		}
		/**
		* multipart 请求头（空对象：边界与 Content-Type 交给 fetch 生成）
		* @returns 空请求头
		*/
		getHeaders() {
			return {};
		}
	}
	return CloudflareFormData;
}
//#endregion
//#region src/mail/nodemailer.ts
/**
* 校验认证信息（1.x twikoo-cloudflare 文案逐字对齐）。
* @param mailConfig 传输器配置
*/
function validateMailAuth(mailConfig) {
	if (!mailConfig.auth?.user) throw new Error("需要在 SMTP_USER 中配置账户名，如果邮件服务不需要可随意填写。");
	if (!mailConfig.auth?.pass) throw new Error("需要在 SMTP_PASS 中配置 API 令牌。");
}
/**
* 走 HTTP API 发信（SendGrid / MailChannels / Resend）。
* @param service 服务名（小写）
* @param mailConfig 传输器配置（令牌取 `auth.pass`）
* @param mail 邮件内容
* @returns 发送结果
*/
async function sendViaHttpApi(service, mailConfig, mail) {
	const token = String(mailConfig.auth?.pass ?? "");
	const headers = { "Content-Type": "application/json" };
	let endpoint;
	/** 错误文案里的服务显示名 */
	let displayName;
	if (service === "sendgrid") {
		displayName = "SendGrid";
		endpoint = "https://api.sendgrid.com/v3/mail/send";
		headers.Authorization = `Bearer ${token}`;
	} else if (service === "mailchannels") {
		displayName = "MailChannels";
		endpoint = "https://api.mailchannels.net/tx/v1/send";
		headers["X-Api-Key"] = token;
		headers.Accept = "application/json";
	} else {
		displayName = "Resend";
		endpoint = "https://api.resend.com/emails";
		headers.Authorization = `Bearer ${token}`;
		headers.Accept = "application/json";
	}
	const body = JSON.stringify(service === "sendgrid" || service === "mailchannels" ? {
		personalizations: [{ to: [{ email: mail.to }] }],
		from: { email: mail.from },
		subject: mail.subject,
		content: [{
			type: "text/html",
			value: mail.html
		}]
	} : {
		from: mail.from,
		to: mail.to,
		subject: mail.subject,
		html: mail.html
	});
	const response = await fetch(endpoint, {
		method: "POST",
		headers,
		body
	});
	if (!response.ok) throw new Error(`${displayName} 发送失败：HTTP ${response.status} ${await response.text()}`);
	return {
		ok: true,
		status: response.status
	};
}
/**
* 构造兼容 HTTP 通道的 nodemailer 适配器。
* @returns 可注入 `setCustomLibs` 的 nodemailer 形态对象
*/
function createCloudflareNodemailer() {
	return { 
	/**
	* 创建仅保存配置的包装器，实际连接在发送或校验时建立。
	* @param options 传输器配置
	* @returns 传输器
	*/
createTransport(options) {
		const mailConfig = options ?? {};
		const service = String(mailConfig.service ?? "").toLowerCase();
		const httpApi = service === "sendgrid" || service === "mailchannels" || service === "resend";
		return {
			/**
			* HTTP 通道只校验配置；SMTP 通道执行真实的连接及认证校验。
			* @returns 配置是否可用
			*/
			async verify() {
				if (httpApi) {
					validateMailAuth(mailConfig);
					return true;
				}
				const { default: nodemailer } = await import("./nodemailer-Dn_NX6t-.js");
				const transport = nodemailer.createTransport({
					...mailConfig,
					pool: false
				});
				try {
					return await transport.verify();
				} finally {
					transport.close();
				}
			},
			/**
			* 发信
			* @param mail 邮件载荷
			* @returns 发送结果
			*/
			async sendMail(mail) {
				if (httpApi) {
					validateMailAuth(mailConfig);
					return sendViaHttpApi(service, mailConfig, mail ?? {});
				}
				const { default: nodemailer } = await import("./nodemailer-Dn_NX6t-.js");
				const transport = nodemailer.createTransport({
					...mailConfig,
					pool: false
				});
				try {
					return await transport.sendMail(mail);
				} finally {
					transport.close();
				}
			}
		};
	} };
}
//#endregion
//#region src/main.ts
/**
* Cloudflare Workers 入口：转换平台载荷、注入适配器并管理请求内连接。
* 业务逻辑由 @twikoojs/common 处理；数据库、能力与部署配置见本包 README。
*/
/**
* Cloudflare 平台能力：IP 属地由 request.cf 与落库数据提供，上传使用原生 FormData。
* 其余已启用能力使用公共层的真实依赖；Akismet 与腾讯云内容审核仍关闭。
*/
const cloudflareCapabilities = {
	mail: true,
	domPurify: true,
	ip2region: true,
	akismet: false,
	tencentTms: false,
	imageUpload: true,
	qqAvatar: true,
	ai: true
};
/** D1 实例缓存（按绑定对象缓存：同一 isolate 内绑定对象稳定，避免每次请求重建） */
const databases = /* @__PURE__ */ new WeakMap();
/**
* 读取并解析请求体（JSON；非法或空体归一为 `{}`）。
*
* 为什么在入口解析而不是在 `toTkRequest` 里：`RequestPort.toTkRequest` 是**同步**契约
* （见 `@twikoojs/common` 的 `ports/request.ts`），而 `request.json()` 是异步的。
* @param request Workers 请求对象
* @returns 请求体（含 `event` / `accessToken`）
*/
async function readRequestBody(request) {
	const method = String(request.method ?? "POST").toUpperCase();
	if (method !== "POST" && method !== "PUT" || !request.body) return {};
	try {
		const parsed = await request.json();
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
		return {};
	} catch {
		return {};
	}
}
/**
* 收集请求头（键小写化，与 `TkRequest.headers` 的约定一致）。
* @param request Workers 请求对象
* @returns 请求头表
*/
function collectHeaders(request) {
	const headers = {};
	request.headers.forEach((value, key) => {
		headers[key.toLowerCase()] = value;
	});
	return headers;
}
/**
* 解析客户端 IP（1.x twikoo-cloudflare 取 `CF-Connecting-IP`；缺省回落到转发首跳 / x-real-ip）。
*
* 三分支而非 `??` 串联：空串在 `??` 下不会被跳过，而「头存在但为空」在真实链路上
* 并不代表拿到了 IP。
* @param headers 小写化的请求头
* @returns 客户端 IP；均缺失时为空串
*/
function resolveIp(headers) {
	const connecting = headers["cf-connecting-ip"];
	if (connecting) return connecting;
	const forwarded = headers["x-forwarded-for"];
	if (forwarded) return forwarded.split(",")[0].trim();
	return headers["x-real-ip"] ?? "";
}
/**
* 读取 `request.cf`（Workers 专有字段，标准 `Request` 类型里没有，故收窄为最小结构面）。
* @param request Workers 请求对象
* @returns 地理信息；非 Workers 宿主返回 undefined
*/
function readCf(request) {
	return request.cf;
}
/**
* 平台载荷 → 内部统一请求。
* @param raw 平台原始载荷
* @returns 内部统一请求
*/
function toTkRequest(raw) {
	const url = new URL(raw.request.url);
	const query = {};
	url.searchParams.forEach((value, key) => {
		query[key] = value;
	});
	const headers = collectHeaders(raw.request);
	return {
		method: String(raw.request.method ?? "POST").toUpperCase(),
		path: url.pathname,
		query,
		body: raw.body,
		headers,
		ip: resolveIp(headers),
		raw
	};
}
/**
* 内部统一响应 → Workers 响应（状态码与响应头透传；204 无体）。
* @param tkRes 内部统一响应
* @returns Workers `Response`
*/
function fromTkResponse(tkRes) {
	if (tkRes.status === 204) return new Response(null, {
		status: 204,
		headers: tkRes.headers
	});
	return new Response(JSON.stringify(tkRes.body), {
		status: tkRes.status,
		headers: {
			...tkRes.headers,
			"Content-Type": "application/json;charset=UTF-8"
		}
	});
}
/** 注入 HTTP 邮件兼容层、原生 FormData 与 request.cf 属地查询；其余库由公共层加载。 */
function installCloudflareLibs() {
	setCustomLibs({
		nodemailer: createCloudflareNodemailer(),
		"form-data": createNativeFormData(),
		"@imaegoo/node-ip2region": createCloudflareIp2Region()
	});
}
/**
* 取（并缓存）D1 数据库实例。
* @param env 环境绑定
* @returns D1 数据库实现
*/
function getD1Database(env) {
	const binding = env?.DB;
	if (!binding) throw new Error("未绑定 D1 数据库：请在 wrangler.toml 中声明 [[d1_databases]] 并设置 binding = \"DB\"");
	const cached = databases.get(binding);
	if (cached) return cached;
	const created = new D1Database(binding);
	databases.set(binding, created);
	return created;
}
/**
* 装配本次请求的运行态（覆写公共库 + MongoDB 或 D1）。
* MongoDB 不跨请求缓存；D1 仍按绑定复用。
* @param env 环境绑定
* @returns 数据库端口实现
*/
function prepareCloudflareRuntime(env) {
	installCloudflareLibs();
	return Promise.resolve(env.MONGODB_URI ? new CloudflareMongoDatabase({
		uri: env.MONGODB_URI,
		dbName: env.MONGODB_DB_NAME
	}) : getD1Database(env));
}
/**
* 创建 Worker 请求处理器（注入的数据库由调用方管理，不在请求结束时关闭）。
* @param options 注入项
* @returns 逐请求处理器
*/
function createCloudflareFunc(options = {}) {
	return async (request, env = {}, executionCtx) => {
		let ownedDatabase;
		const pending = [];
		try {
			rememberRequestGeo(resolveIp(collectHeaders(request)), readCf(request));
			const body = await readRequestBody(request);
			if (options.database) installCloudflareLibs();
			const database = options.database ?? await prepareCloudflareRuntime(env);
			if (!options.database && env.MONGODB_URI) ownedDatabase = database;
			const tkRequest = toTkRequest({
				request,
				env,
				executionCtx: ownedDatabase ? { 
				/** 收集真实后置任务，关闭 MongoDB 时等待它们全部完成。 */
waitUntil(promise) {
					pending.push(promise);
				} } : executionCtx,
				body
			});
			return fromTkResponse(await createHandler(scaffoldAdapters({
				request: { 
				/** 事件即请求体（闭包透传，见 toTkRequest） */
toTkRequest: () => tkRequest },
				response: { 
				/** TkResponse 恒等透传（序列化见 fromTkResponse） */
fromTkResponse: (r) => r },
				database,
				capabilities: cloudflareCapabilities,
				postSubmit: createCloudflareDispatcher()
			}))(tkRequest));
		} catch (e) {
			return fromTkResponse({
				status: 200,
				headers: {},
				body: {
					code: RES_CODE.FAIL,
					message: e instanceof Error ? e.message : String(e)
				}
			});
		} finally {
			if (ownedDatabase) {
				const database = ownedDatabase;
				const cleanup = Promise.allSettled(pending).then(() => database.close?.()).catch((error) => {
					console.error("MongoDB 连接关闭失败", error);
				});
				if (pending.length && typeof executionCtx?.waitUntil === "function") executionCtx.waitUntil(cleanup);
				else await cleanup;
			}
		}
	};
}
/** 默认处理器（模块级懒建：warm isolate 复用同一份装配） */
let defaultHandler = null;
/** Workers 默认入口。 */
var main_default = { 
/**
* Workers 请求入口
* @param request Workers 请求对象
* @param env 环境变量与绑定
* @param executionCtx 执行上下文
* @returns Workers 响应
*/
fetch(request, env, executionCtx) {
	defaultHandler ??= createCloudflareFunc();
	return defaultHandler(request, env, executionCtx);
} };
//#endregion
export { D1Database, MIGRATION_STATEMENTS, SCHEMA_STATEMENTS, cloudflareCapabilities, createCloudflareDispatcher, createCloudflareFunc, main_default as default, ensureSchema, fromTkResponse, getD1Database, installCloudflareLibs, newD1CommentId, prepareCloudflareRuntime, toTkRequest };

//# sourceMappingURL=index.js.map