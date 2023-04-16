import {
  QuirrelClient,
  EnqueueJobOpts,
  EnqueueJobOptions,
  Job,
  DefaultJobOptions,
  QuirrelJobHandler,
  QuirrelOptions,
} from "./client";
import { registerDevelopmentDefaults } from "./client/config";

export interface WorkerContext {
  request: Request;
}

export type WorkerRequestHandler = (
  ctx: WorkerContext | Request
) => Promise<Response>;

export {
  Job,
  EnqueueJobOpts,
  EnqueueJobOptions,
  DefaultJobOptions,
  QuirrelJobHandler,
};

registerDevelopmentDefaults({
  applicationPort: 8787,
});

export type Queue<Payload> = Omit<
  QuirrelClient<Payload>,
  "respondTo" | "makeRequest"
>;

export function Queue<Payload>(
  route: string,
  handler: QuirrelJobHandler<Payload>,
  options?: QuirrelOptions
): Queue<Payload> & WorkerRequestHandler {
  const quirrel = new QuirrelClient<Payload>({
    options,
    handler,
    route,
  });

  async function workerReqHandler(ctx: WorkerContext | Request) {
    const request = "request" in ctx ? ctx.request : ctx;
    const body = await request.text();
    const response = await quirrel.respondTo(
      body,
      Object.fromEntries(request.headers.entries())
    );
    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
    });
  }

  workerReqHandler.enqueue = (payload: Payload, options: EnqueueJobOptions) =>
    quirrel.enqueue(payload, options);

  workerReqHandler.enqueueMany = (
    jobs: { payload: Payload; options?: EnqueueJobOptions }[]
  ) => quirrel.enqueueMany(jobs);

  workerReqHandler.delete = (jobId: string) => quirrel.delete(jobId);

  workerReqHandler.invoke = (jobId: string) => quirrel.invoke(jobId);

  workerReqHandler.get = () => quirrel.get();

  workerReqHandler.getById = (jobId: string) => quirrel.getById(jobId);

  return workerReqHandler;
}

export function CronJob(
  route: string,
  cronSchedule: NonNullable<NonNullable<EnqueueJobOptions["repeat"]>["cron"]>,
  handler: () => Promise<void>,
  options?: QuirrelOptions
) {
  return Queue(route, handler, options) as unknown;
}
