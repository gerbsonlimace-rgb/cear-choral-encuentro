import { describe, expect, it, vi } from "vitest";
import { createAttendanceScanQueue } from "./attendanceScanQueue";
import { mergeAttendanceProgress, type PublicAttendanceActivity } from "./publicAttendance.domain";

const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: Error) => void; const promise = new Promise((ok, no) => { resolve = ok; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i=0;i<10;i++) await Promise.resolve(); };

describe("continuous scan queue", () => {
  it("accepts distinct codes immediately, bounds concurrent writes and suppresses duplicates", async () => {
    const requests = Array.from({length:4}, deferred); let index=0;
    const submit = vi.fn(() => requests[index++].promise);
    const results = vi.fn();
    const queue = createAttendanceScanQueue({ submit, onChange: vi.fn(), onResult: results, concurrency: 2 });
    expect(queue.enqueue("ana")).toBe("queued");
    expect(queue.enqueue("ana")).toBe("duplicate");
    queue.enqueue("bia"); queue.enqueue("caio");
    expect(submit).toHaveBeenCalledTimes(2);
    expect(queue.snapshot().pending).toBe(3);
    requests[0].resolve({ status: "recorded" }); await tick();
    expect(submit).toHaveBeenCalledTimes(3);
    expect(queue.snapshot().pending).toBe(2);
    requests[1].resolve({ status: "recorded" }); requests[2].resolve({status:"already_recorded"}); await tick();
    expect(queue.snapshot().pending).toBe(0);
    expect(results).toHaveBeenCalledTimes(3);
    expect(queue.enqueue("ana")).toBe("duplicate");
  });
  it("keeps network failures for explicit retry and lets the next code proceed", async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({status:"recorded"});
    const onResult = vi.fn();
    const queue = createAttendanceScanQueue({submit,onChange:vi.fn(),onResult,concurrency:1});
    queue.enqueue("ana"); queue.enqueue("bia"); await tick();
    expect(queue.snapshot()).toMatchObject({pending:1,failed:1});
    expect(onResult).toHaveBeenCalledTimes(1);
    queue.retryFailed(); await tick();
    expect(queue.snapshot()).toMatchObject({pending:0,failed:0});
    expect(submit).toHaveBeenCalledTimes(3);
  });
  it("does not lose a scan when capacity is reached and suppresses callbacks after disposal", async () => {
    const request=deferred(), onResult=vi.fn();
    const queue=createAttendanceScanQueue({submit:()=>request.promise,onChange:vi.fn(),onResult,capacity:1});
    queue.enqueue("ana"); expect(queue.enqueue("bia")).toBe("full");
    queue.dispose(); request.resolve({status:"recorded"}); await tick();
    expect(onResult).not.toHaveBeenCalled();
    expect(queue.enqueue("bia")).toBe("disposed");
  });
  it("ignores stale replies while allowing newer snapshots to reflect cancellations", () => {
    const activity={id:"a",attended:20,totalConfirmed:157,revision:"2026-11-20T10:00:00.000002Z"} as PublicAttendanceActivity;
    expect(mergeAttendanceProgress(activity,{id:"a",attended:19,totalConfirmed:157,revision:"2026-11-20T10:00:00.000001Z"}).attended).toBe(20);
    expect(mergeAttendanceProgress(activity,{id:"a",attended:19,totalConfirmed:156,revision:"2026-11-20T10:00:00.000003Z"}).totalConfirmed).toBe(156);
  });
});
