//#region ../../node_modules/.pnpm/@xsai+shared@0.5.0/node_modules/@xsai/shared/dist/index.js
var XSAIError = class extends Error {
	constructor(message, code, options = {}) {
		super(message, { cause: options.cause });
		this.code = code;
		this.name = new.target.name;
	}
	static isInstance(error) {
		return error instanceof this;
	}
};
var APICallError = class extends XSAIError {
	constructor(message, options) {
		super(message, "api_call_error", options);
		this.requestBody = options.requestBody;
		this.response = options.response;
		this.responseBody = options.responseBody;
		this.responseHeaders = Object.fromEntries(options.response.headers.entries());
		this.statusCode = options.response.status;
		this.statusText = options.response.statusText;
		this.url = options.response.url;
	}
};
var InvalidResponseError = class extends XSAIError {
	constructor(message, options) {
		super(message, "invalid_response", options);
		Object.assign(this, options);
	}
};
var InvalidToolCallError = class extends XSAIError {
	constructor(message, options) {
		super(message, "invalid_tool_call", options);
		Object.assign(this, options);
	}
};
var InvalidToolInputError = class extends XSAIError {
	constructor(message, options) {
		super(message, "invalid_tool_input", options);
		Object.assign(this, options);
	}
};
var JSONParseError = class extends XSAIError {
	constructor(message, options) {
		super(message, "json_parse_error", options);
		this.text = options.text;
	}
};
const strCamelToSnake = (str) => str.replace(/[A-Z]/g, (s) => `_${s.toLowerCase()}`);
const objCamelToSnake = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [strCamelToSnake(k), v]));
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
const requestBody = (body) => JSON.stringify(objCamelToSnake(clean({
	...body,
	abortSignal: void 0,
	apiKey: void 0,
	baseURL: void 0,
	fetch: void 0,
	headers: void 0
})));
const requestHeaders = (headers, apiKey) => clean({
	Authorization: apiKey !== void 0 ? `Bearer ${apiKey}` : void 0,
	...headers
});
const requestURL = (path, baseURL) => {
	const base = baseURL.toString();
	return new URL(path, base.endsWith("/") ? base : `${base}/`);
};
const responseCatch = async (res) => {
	if (!res.ok) {
		const responseBody = await res.text();
		throw new APICallError(`Remote sent ${res.status} response: ${responseBody}`, {
			response: res,
			responseBody
		});
	}
	if (!res.body) throw new InvalidResponseError("Response body is empty from remote server", {
		reason: "empty_body",
		response: res
	});
	if (!(res.body instanceof ReadableStream)) {
		const contentType = res.headers.get("Content-Type");
		throw new InvalidResponseError(`Expected Response body to be a ReadableStream, but got ${String(res.body)}; Content Type is ${contentType}`, {
			body: res.body,
			contentType,
			reason: "invalid_body",
			response: res
		});
	}
	return res;
};
const postJSON = async (path, options) => (options.fetch ?? globalThis.fetch)(requestURL(path, options.baseURL), {
	body: requestBody(options),
	headers: requestHeaders({
		"Content-Type": "application/json",
		...options.headers
	}, options.apiKey),
	method: "POST",
	signal: options.abortSignal
}).then(responseCatch);
const responseJSON = async (res) => {
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch (cause) {
		throw new JSONParseError(`Failed to parse response, response body: ${text}`, {
			cause,
			text
		});
	}
};
const trampoline = async (fn) => {
	let result = await fn();
	while (result instanceof Function) result = await result();
	return result;
};
//#endregion
//#region ../../node_modules/.pnpm/@xsai+shared-chat@0.5.0/node_modules/@xsai/shared-chat/dist/index.js
const chat = async (options) => postJSON("chat/completions", {
	...options,
	maxSteps: void 0,
	onEvent: void 0,
	onFinish: void 0,
	onStepFinish: void 0,
	postToolCall: void 0,
	prepareStep: void 0,
	preToolCall: void 0,
	stopWhen: void 0,
	tools: options.tools?.map(({ execute: _execute, ...tool }) => tool)
});
const toToolMessageContent = (result) => {
	if (typeof result === "string") return result;
	if (Array.isArray(result)) {
		if (result.every((item) => item !== null && typeof item === "object" && "type" in item && [
			"file",
			"image_url",
			"input_audio",
			"text"
		].includes(item.type))) return result;
	}
	return JSON.stringify(result);
};
const toCompletionToolCall = (toolCall) => ({
	args: toolCall.function.arguments ?? "",
	toolCallId: toolCall.id,
	toolCallType: "function",
	toolName: toolCall.function.name ?? ""
});
const parseToolInput = async (tool, input) => {
	let result;
	try {
		result = JSON.parse(input.trim() || "{}");
	} catch (cause) {
		throw new InvalidToolInputError(`Failed to parse tool input for "${tool.function.name}".`, {
			cause,
			toolInput: input,
			toolName: tool.function.name
		});
	}
	if (tool.validate) {
		const validated = await tool.validate(result);
		if (validated.issues) throw new InvalidToolInputError(`Tool input validation failed for "${tool.function.name}".`, {
			cause: validated.issues,
			toolInput: result,
			toolName: tool.function.name
		});
		result = validated.value;
	}
	return result;
};
const createErrorToolResult = (toolCall, args, cause, abortSignal) => ({
	args,
	isError: true,
	result: `Tool "${toolCall.toolName}" execution failed: ${abortSignal?.aborted === true ? "This operation was aborted" : cause instanceof Error ? cause.message : String(cause)}`,
	toolCallId: toolCall.toolCallId,
	toolName: toolCall.toolName
});
const catchToolError = async (toolCall, abortSignal, callback) => {
	try {
		return await callback(toolCall);
	} catch (cause) {
		return createErrorToolResult(toolCall, InvalidToolInputError.isInstance(cause) ? cause.toolInput : toolCall.args, cause, abortSignal);
	}
};
const assertSameToolCallId = (source, next, label) => {
	if (source === next.toolCallId) return;
	throw new InvalidToolCallError(`${label} must preserve toolCallId "${source}".`, {
		reason: "tool_call_id_mismatch",
		toolCall: next
	});
};
const findTool = (tools, toolName, toolCall) => {
	const tool = tools?.find((tool2) => tool2.function.name === toolName);
	if (!tool) {
		const availableTools = tools?.map((tool2) => tool2.function.name);
		throw new InvalidToolCallError(`Model tried to call unavailable tool "${toolName}", ${availableTools == null || availableTools.length === 0 ? "No tools are available" : `Available tools: ${availableTools.join(", ")}`}.`, {
			availableTools,
			reason: "unknown_tool",
			toolCall,
			toolName
		});
	}
	return tool;
};
const executeTool = async ({ abortSignal, messages, postToolCall, preToolCall, toolCall, tools, wrapResult }) => {
	const wrap = wrapResult ?? toToolMessageContent;
	const toolName = toolCall.function.name;
	const toolArguments = toolCall.function.arguments;
	if (toolName == null) throw new InvalidToolCallError(`Missing toolCall.function.name: ${JSON.stringify(toolCall)}`, {
		reason: "missing_name",
		toolCall
	});
	if (toolArguments == null) throw new InvalidToolCallError(`Missing toolCall.function.arguments: ${JSON.stringify(toolCall)}`, {
		reason: "missing_arguments",
		toolCall
	});
	const toolExecuteOptions = {
		abortSignal,
		messages,
		toolCallId: toolCall.id
	};
	let completionToolCall = {
		args: toolArguments,
		toolCallId: toolCall.id,
		toolCallType: "function",
		toolName
	};
	let completionToolResult;
	let parsedArgs;
	let shouldPostToolCall = false;
	const preToolCallResult = await catchToolError(completionToolCall, abortSignal, async (toolCall2) => preToolCall?.(toolCall2, toolExecuteOptions));
	if (preToolCallResult) {
		assertSameToolCallId(completionToolCall.toolCallId, preToolCallResult, "preToolCallResult");
		if ("result" in preToolCallResult) completionToolResult = preToolCallResult;
		else completionToolCall = preToolCallResult;
	}
	completionToolResult ??= await catchToolError(completionToolCall, abortSignal, async () => {
		const tool = findTool(tools, completionToolCall.toolName, completionToolCall);
		parsedArgs = await parseToolInput(tool, completionToolCall.args);
		if (abortSignal?.aborted === true) return createErrorToolResult(completionToolCall, parsedArgs, abortSignal.reason, abortSignal);
		shouldPostToolCall = true;
		const result = await tool.execute(parsedArgs, toolExecuteOptions);
		return {
			args: parsedArgs,
			result,
			toolCallId: completionToolCall.toolCallId,
			toolName: completionToolCall.toolName
		};
	});
	if (shouldPostToolCall) {
		completionToolResult.args = parsedArgs;
		const postToolCallResult = await catchToolError(completionToolResult, abortSignal, async (toolResult) => postToolCall?.(toolResult, toolExecuteOptions));
		if (postToolCallResult) {
			assertSameToolCallId(completionToolResult.toolCallId, postToolCallResult, "postToolCallResult");
			completionToolResult = postToolCallResult;
		}
	}
	return {
		completionToolCall,
		completionToolResult,
		result: wrap(completionToolResult.result)
	};
};
const resolvePrepareStep = async ({ input, model, prepareStep, stepNumber, steps, toolChoice }) => {
	const prepared = prepareStep == null ? void 0 : await prepareStep({
		input: structuredClone(input),
		model,
		stepNumber,
		steps: structuredClone(steps)
	});
	return {
		input: prepared?.input != null ? structuredClone(prepared.input) : input,
		model: prepared?.model ?? model,
		toolChoice: prepared?.toolChoice ?? toolChoice
	};
};
const stepCountAtLeast = (count) => ({ steps }) => steps.length >= count;
const shouldStop = (stopWhen, context) => stopWhen(context);
const computeTotalUsage = (totalUsage, usage) => totalUsage == null ? usage : {
	inputTokens: totalUsage.inputTokens + usage.inputTokens,
	outputTokens: totalUsage.outputTokens + usage.outputTokens,
	totalTokens: totalUsage.totalTokens + usage.totalTokens
};
const normalizeChatCompletionUsage = (usage) => ({
	inputTokens: usage.prompt_tokens,
	outputTokens: usage.completion_tokens,
	totalTokens: usage.total_tokens
});
//#endregion
//#region ../../node_modules/.pnpm/@xsai+generate-text@0.5.0/node_modules/@xsai/generate-text/dist/index.js
const rawGenerateText = async (options) => {
	const messages = options.steps == null ? structuredClone(options.messages) : options.messages;
	const steps = options.steps ?? [];
	const stepOptions = await resolvePrepareStep({
		input: messages,
		model: options.model,
		prepareStep: options.prepareStep,
		stepNumber: steps.length,
		steps,
		toolChoice: options.toolChoice
	});
	return chat({
		...options,
		messages: stepOptions.input,
		model: stepOptions.model,
		steps: void 0,
		stream: false,
		toolChoice: stepOptions.toolChoice,
		totalUsage: void 0
	}).then(responseJSON).then(async (res) => {
		const { choices } = res;
		const usage = normalizeChatCompletionUsage(res.usage);
		const totalUsage = computeTotalUsage(options.totalUsage, usage);
		if (!choices?.length) {
			const responseBody = JSON.stringify(res);
			throw new InvalidResponseError(`No choices returned, response body: ${responseBody}`, {
				reason: "no_choices",
				responseBody
			});
		}
		const { finish_reason: finishReason, message } = choices[0];
		const msgToolCalls = message?.tool_calls ?? [];
		const toolCalls = msgToolCalls.map(toCompletionToolCall);
		const toolResults = [];
		const stopWhen = options.stopWhen ?? stepCountAtLeast(1);
		messages.push(message);
		const step = {
			finishReason,
			text: Array.isArray(message.content) ? message.content.filter((m) => m.type === "text").map((m) => m.text).join("\n") : message.content,
			toolCalls,
			toolResults,
			usage
		};
		if (options.abortSignal?.aborted === true) throw options.abortSignal.reason ?? /* @__PURE__ */ new Error("This operation was aborted");
		const stop = shouldStop(stopWhen, {
			input: messages,
			step,
			steps: [...steps, step]
		});
		if (!stop && msgToolCalls.length > 0) {
			const results = await Promise.all(msgToolCalls.map(async (toolCall) => executeTool({
				abortSignal: options.abortSignal,
				messages,
				postToolCall: options.postToolCall,
				preToolCall: options.preToolCall,
				toolCall,
				tools: options.tools
			})));
			toolCalls.length = 0;
			for (const { completionToolCall, completionToolResult, result } of results) {
				toolCalls.push(completionToolCall);
				toolResults.push(completionToolResult);
				messages.push({
					content: result,
					role: "tool",
					tool_call_id: completionToolCall.toolCallId
				});
			}
		}
		const willContinue = toolCalls.length > 0 && !stop && !options.abortSignal?.aborted;
		steps.push(step);
		if (options.onStepFinish) await options.onStepFinish(step);
		if (!willContinue) return {
			finishReason: step.finishReason,
			messages,
			reasoningText: message.reasoning ?? message.reasoning_content,
			steps,
			text: step.text,
			toolCalls: step.toolCalls,
			toolResults: step.toolResults,
			totalUsage,
			usage: step.usage
		};
		else return async () => rawGenerateText({
			...options,
			messages,
			steps,
			totalUsage
		});
	});
};
const generateText = async (options) => trampoline(async () => rawGenerateText(options));
//#endregion
export { generateText };

//# sourceMappingURL=dist-DFi7Q9EW.js.map