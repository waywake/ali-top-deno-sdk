import { checkRequired, formatDateTime, md5, pickKeys } from "./top_util.ts";

interface ITopClientOptions {
  url?: string;
  appKey: string;
  appSecret: string;
  targetAppKey?: string;
}

type RequestParams = Record<string, string>;
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

  async request(
    params: RequestParams,
    responseNames: string[],
    httpHeaders: RequestHeaders
  ) {
    const err = checkRequired(params, "method");
    if (err) throw err;

    const args: Record<string, string> = {
      method: params["method"] as string,
      timestamp: this.timestamp(),
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

    let body: BodyInit;
    const headers = { ...httpHeaders };
    const isMultipart = Object.values(params).some((val) =>
      val.startsWith("@")
    );

    if (isMultipart) {
      throw new Error("Multipart is not supported yet");
    } else {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        searchParams.set(key, val as string);
      });
      body = searchParams.toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const formData = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      formData.set(key, val as string);
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    const result = await resp.json();
    if (result === null) {
      throw new Error("Response is null");
    }

    return responseNames.length > 0 ? pickKeys(result, responseNames) : result;
  }

  private sign(params: RequestParams) {
    const sorted = Object.keys(params).sort();
    let baseString = this.appSecret;

    for (const key of sorted) {
      baseString += key + params[key];
    }

    baseString += this.appSecret;
    return md5(baseString).toUpperCase();
  }

  public execute(
    params: RequestParams,
    responseNames: string[],
    httpHeaders: RequestHeaders = {}
  ) {
    return this.request(params, responseNames, httpHeaders);
  }
}
