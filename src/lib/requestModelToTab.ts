import type { HttpTab, RequestModel } from "@/types";

export function requestModelToHttpTab(request: RequestModel): HttpTab {
  return {
    tabId: "",
    requestId: request.id,
    name: request.name,
    isDirty: false,
    type: "http",
    method: request.method,
    url: request.url,
    params: request.params,
    headers: request.headers,
    auth: request.auth,
    body: request.body,
    preScript: request.preScript,
    postScript: request.postScript,
    timeoutMs: request.timeoutMs,
    assertions: request.assertions,
    sslVerify: request.sslVerify,
    followRedirects: request.followRedirects,
  };
}
