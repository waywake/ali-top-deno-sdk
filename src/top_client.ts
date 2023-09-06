import {
  checkRequired,
  formatDateTime,
  getApiResponseName,
  md5,
} from "./top_util.ts";

interface ITopClientOptions {
  url?: string;
  appKey: string;
  appSecret: string;
  targetAppKey?: string;
}

type RequestParams = Record<string, unknown>;
type RequestHeaders = Record<string, string>;

export class TopClient {
  private readonly url: string;
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly targetAppKey: string;

  constructor(options: ITopClientOptions) {
    if (!options.appKey || !options.appSecret) {
      throw new Error("appKey or appSecret need!");
    }

    this.url = options.url || "http://gw.api.taobao.com/router/rest";
    this.appKey = options.appKey;
    this.appSecret = options.appSecret;
    this.targetAppKey = options.targetAppKey || "";
  }

  private timestamp() {
    return formatDateTime(new Date());
  }

  private async invoke(
    type: "get" | "post",
    method: string,
    params: RequestParams,
    responseNames: string[],
    httpHeaders: RequestHeaders
  ) {
    params.method = method;
    const result = await this.request(type, params, httpHeaders);

    let response = result;
    if (responseNames) {
      for (const name of responseNames) {
        if (response[name] === undefined) {
          return undefined;
        }
        response = response[name];
      }
    }

    return response;
  }

  async request(
    type: "get" | "post",
    params: RequestParams,
    httpHeaders: RequestHeaders
  ) {
    const err = checkRequired(params, "method");
    if (err) throw err;

    const args: Record<string, string> = {
      method: params["method"] as string,
      timestamp: this.timestamp(),
      // timestamp: "2023-09-05 09:04:17",
      format: "json",
      app_key: this.appKey,
      v: "2.0",
      sign_method: "md5",
      target_app_key: this.targetAppKey,
      partner_id: "top-sdk-deno-20230905",
    };

    args["sign"] = this.sign({
      ...params,
      ...args,
    });

    delete params["method"];
    const url = `${this.url}?${new URLSearchParams(args)}`;
    console.log("url: ", url);

    const formData = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      formData.set(key, val as string);
    }

    const resp = await fetch(url, {
      method: type.toUpperCase(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...httpHeaders,
      },
      body: formData,
    });

    const result = await resp.json();
    if (result?.response?.flag === "failure") {
      throw new Error(
        `Request error: ${result.response.message} (${JSON.stringify(
          result.response
        )})`
      );
    }

    return result;
  }

  private sign(params: RequestParams) {
    console.log("sign params: ", params);
    const sorted = Object.keys(params).sort();
    let baseString = this.appSecret;

    for (const key of sorted) {
      baseString += key + params[key];
    }

    baseString += this.appSecret;
    console.log("sign baseString: ", baseString);
    console.log(md5(baseString).toUpperCase());
    return md5(baseString).toUpperCase();
  }

  public execute(
    apiName: string,
    params: RequestParams,
    httpHeaders: RequestHeaders = {}
  ) {
    return this.invoke(
      "post",
      apiName,
      params,
      [getApiResponseName(apiName)],
      httpHeaders
    );
  }

  public get(apiName: string, params: RequestParams) {
    return this.invoke(
      "get",
      apiName,
      params,
      [getApiResponseName(apiName)],
      {}
    );
  }
}
