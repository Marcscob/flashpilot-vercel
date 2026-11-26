import { Environment, Paddle, EventName } from '@paddle/paddle-node-sdk';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export { EventName };

export type PaddleEnv = 'sandbox' | 'live';

const GATEWAY_BASE_URL = 'https://connector-gateway.lovable.dev/paddle';

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === 'sandbox'
    ? getEnv('PADDLE_SANDBOX_API_KEY')
    : getEnv('PADDLE_LIVE_API_KEY');
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');

  return new Paddle(connectionApiKey, {
    environment: GATEWAY_BASE_URL as unknown as Environment,
    customHeaders: {
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
    },
  });
}

export async function gatewayFetch(env: PaddleEnv, path: string, init?: RequestInit): Promise<Response> {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');
  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
      ...init?.headers,
    },
  });
}

type PaddleListResponse<T> = {
  data?: T[];
  meta?: {
    pagination?: {
      has_more?: boolean;
      next?: string | null;
    };
  };
};

/**
 * Reads every page from a Paddle list endpoint. Paddle returns an absolute
 * `meta.pagination.next` URL, while the connector gateway expects only the
 * Paddle path.
 */
export async function gatewayFetchAll<T = unknown>(
  env: PaddleEnv,
  path: string,
): Promise<T[]> {
  const rows: T[] = [];
  const seenPaths = new Set<string>();
  let nextPath = path;
  const gatewayPath = new URL(GATEWAY_BASE_URL).pathname.replace(/\/$/, '');

  for (let page = 0; page < 1_000; page += 1) {
    if (seenPaths.has(nextPath)) {
      throw new Error('Paginação do Paddle retornou o mesmo cursor');
    }
    seenPaths.add(nextPath);

    const response = await gatewayFetch(env, nextPath);
    if (!response.ok) {
      throw new Error(`Falha ao consultar o Paddle (${response.status})`);
    }
    const json = (await response.json()) as PaddleListResponse<T>;
    if (!Array.isArray(json.data)) {
      throw new Error('Resposta paginada do Paddle sem lista de dados');
    }
    rows.push(...json.data);

    const pagination = json.meta?.pagination;
    if (!pagination?.has_more) return rows;

    const next = pagination.next;
    if (!next) {
      throw new Error('Resposta paginada do Paddle sem próximo cursor');
    }
    const nextUrl = new URL(next, GATEWAY_BASE_URL);
    let nextUrlPath = nextUrl.pathname;
    if (nextUrlPath.startsWith(`${gatewayPath}/`)) {
      nextUrlPath = nextUrlPath.slice(gatewayPath.length);
    }
    nextPath = `${nextUrlPath.startsWith('/') ? '' : '/'}${nextUrlPath}${nextUrl.search}`;
  }

  throw new Error('Paginação do Paddle excedeu o limite de segurança');
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === 'sandbox'
    ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get('paddle-signature');
  const body = await req.text();
  const secret = getWebhookSecret(env);

  if (!signature || !body) {
    throw new Error('Missing signature or body');
  }

  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}
